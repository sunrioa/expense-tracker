import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { App as AntApp } from 'antd';
import { currentPeriod, type Period, type RecordNode } from '@ledger/shared';
import * as api from '../api';
import { categorySlots, groupHistory, monthTotals, nameHistory, type NameMemory } from '../lib/ledger';
import { errMsg } from '../utils/error';
import { monthShort } from '../utils/format';
import RecordSheet, { type EditorState } from '../components/RecordSheet';
import BatchSheet, { type BatchRequest } from '../components/BatchSheet';

/**
 * 全局账本状态。
 *
 * 一次拉下全部记录，切月份、搜索、算每月合计都在本地完成 —— 个人账本几年下来
 * 也就几千行，而服务端本来每次请求也是整表读进内存再建树，按月请求并不会更省。
 * 换来的是切月份零等待、搜索不打接口。
 *
 * 记一笔 / 编辑 / 批量生成的面板也挂在这里：顶栏、手机底栏、页面里任何地方
 * 都能唤起同一个面板，保存后所有页面一起刷新。
 */

export interface LedgerContextValue {
  tree: RecordNode[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** 每次成功加载后 +1，统计页据此重新拉取 */
  version: number;
  reload: () => Promise<void>;

  /** 每月合计 */
  totals: Map<Period, number>;
  /** 分类 → 色板槽位 */
  slots: Map<string, number>;
  names: NameMemory[];
  groupNames: string[];

  openAdd: (opts?: { period?: Period; groupId?: number }) => void;
  openEdit: (node: RecordNode) => void;
  openBatch: (period: Period) => void;
  /** 有面板开着时，页面上的快捷键要让路 */
  sheetOpen: boolean;

  remove: (node: RecordNode) => Promise<void>;
  copyMonth: (from: Period, to: Period) => Promise<void>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger 必须在 <LedgerProvider> 里使用');
  return ctx;
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { message } = AntApp.useApp();

  const [tree, setTree] = useState<RecordNode[]>([]);
  const [status, setStatus] = useState<LedgerContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // 连续触发多次加载时，只认最后一次的结果
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await api.fetchTree();
      if (mine !== seq.current) return;
      setTree(Array.isArray(data) ? data : []);
      setStatus('ready');
      setError(null);
      setVersion((v) => v + 1);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(errMsg(e, '加载失败'));
      setStatus((s) => (s === 'ready' ? s : 'error'));
      message.error(errMsg(e, '加载失败'));
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totals = useMemo(() => monthTotals(tree), [tree]);
  const slots = useMemo(() => categorySlots(tree), [tree]);
  const names = useMemo(() => nameHistory(tree), [tree]);
  const groupNames = useMemo(() => groupHistory(tree), [tree]);

  /* ---------------- 面板 ---------------- */

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [batch, setBatch] = useState<BatchRequest | null>(null);

  const openAdd = useCallback<LedgerContextValue['openAdd']>((opts = {}) => {
    setEditor({ mode: 'add', period: opts.period ?? currentPeriod(), groupId: opts.groupId });
  }, []);
  const openEdit = useCallback((node: RecordNode) => setEditor({ mode: 'edit', node }), []);
  const openBatch = useCallback((period: Period) => setBatch({ period }), []);

  /* ---------------- 删除：不弹确认，给撤销 ---------------- */

  const restore = useCallback(
    async (node: RecordNode) => {
      try {
        const top = await api.createRecord({
          parentId: node.parentId ?? null,
          name: node.name,
          detail: node.detail ?? null,
          amount: node.amount ?? 0,
          period: node.period
        });
        // 按原来的顺序逐条插回，id 递增，排序和删除前一致
        for (const c of node.children) {
          await api.createRecord({
            parentId: top.id,
            name: c.name,
            detail: c.detail ?? null,
            amount: c.amount ?? 0,
            period: c.period
          });
        }
        message.success('已恢复');
      } catch (e) {
        message.error(`恢复失败：${errMsg(e)}`);
      } finally {
        await reload();
      }
    },
    [message, reload]
  );

  const remove = useCallback(
    async (node: RecordNode) => {
      try {
        const res = await api.deleteRecord(node.id);
        await reload();
        const key = `undo-${node.id}`;
        const extra = res.deleted > 1 ? `和它的 ${res.deleted - 1} 项` : '';
        message.open({
          key,
          type: 'success',
          duration: 6,
          content: (
            <span className="toast-undo">
              已删除「{node.name}」{extra}
              <button
                type="button"
                onClick={() => {
                  message.destroy(key);
                  void restore(node);
                }}
              >
                撤销
              </button>
            </span>
          )
        });
      } catch (e) {
        message.error(errMsg(e));
      }
    },
    [message, reload, restore]
  );

  const copyMonth = useCallback(
    async (from: Period, to: Period) => {
      try {
        const res = await api.copyMonth({ from, to });
        await reload();
        if (res.created === 0) {
          message.info(`${monthShort(to)}已经有这些条目了，没有需要复制的`);
        } else {
          message.success(
            `已从${monthShort(from)}复制 ${res.created} 条${res.skipped ? `，${res.skipped} 条已存在所以跳过` : ''}`
          );
        }
      } catch (e) {
        message.error(errMsg(e));
      }
    },
    [message, reload]
  );

  const value = useMemo<LedgerContextValue>(
    () => ({
      tree,
      status,
      error,
      version,
      reload,
      totals,
      slots,
      names,
      groupNames,
      openAdd,
      openEdit,
      openBatch,
      sheetOpen: editor !== null || batch !== null,
      remove,
      copyMonth
    }),
    [tree, status, error, version, reload, totals, slots, names, groupNames, openAdd, openEdit, openBatch, editor, batch, remove, copyMonth]
  );

  return (
    <LedgerContext.Provider value={value}>
      {children}
      <RecordSheet state={editor} onClose={() => setEditor(null)} onSwitch={setEditor} />
      <BatchSheet request={batch} onClose={() => setBatch(null)} />
    </LedgerContext.Provider>
  );
}
