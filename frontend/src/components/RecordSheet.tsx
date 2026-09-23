import { useMemo, useRef, useState } from 'react';
import type { ComponentRef, KeyboardEvent } from 'react';
import { App as AntApp, AutoComplete, Input, InputNumber } from 'antd';
import type { Period, RecordNode, RecordPatch } from '@ledger/shared';
import * as api from '../api';
import { useLedger } from '../state/ledger';
import { amountOf, type NameMemory } from '../lib/ledger';
import { errMsg } from '../utils/error';
import { money, monthSmart, yuan } from '../utils/format';
import { cls, objectKey } from '../utils/cls';
import Sheet, { SheetHead } from './Sheet';
import { MonthField } from './MonthGrid';
import { slotColor } from './CompositionBar';
import Money from './Money';
import Icon from './Icon';

export type EditorState =
  | { mode: 'add'; period: Period; groupId?: number }
  | { mode: 'edit'; node: RecordNode };

/** 记到哪个分组：不分组 / 这个月已有的分组 / 新建一个 */
type GroupChoice = { kind: 'none' } | { kind: 'existing'; id: number } | { kind: 'new'; name: string };

type Errors = Partial<Record<'name' | 'amount' | 'group', string>>;

export interface RecordSheetProps {
  state: EditorState | null;
  onClose: () => void;
  /** 「再记一笔」「记一笔到这个分组」：原地换成另一个表单 */
  onSwitch: (next: EditorState) => void;
}

export default function RecordSheet({ state, onClose, onSwitch }: RecordSheetProps) {
  // 关闭动画播放时 state 已经是 null，内容得保持原样直到面板收起
  const last = useRef<EditorState | null>(null);
  if (state) last.current = state;
  const current = state ?? last.current;

  return (
    <Sheet open={state !== null} onClose={onClose} label={current?.mode === 'edit' ? '编辑记录' : '记一笔'}>
      {current && <RecordForm key={objectKey(current)} state={current} onClose={onClose} onSwitch={onSwitch} />}
    </Sheet>
  );
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function RecordForm({ state, onClose, onSwitch }: { state: EditorState } & Omit<RecordSheetProps, 'state'>) {
  const { tree, totals, slots, names, reload, remove } = useLedger();
  const { message } = AntApp.useApp();

  const node = state.mode === 'edit' ? state.node : null;
  const isAdd = state.mode === 'add';
  const isGroup = !!node && node.children.length > 0;

  const [name, setName] = useState(node?.name ?? '');
  const [amount, setAmount] = useState<number | null>(node ? (node.amount ?? 0) : null);
  const [detail, setDetail] = useState(node?.detail ?? '');
  const [period, setPeriod] = useState<Period>(state.mode === 'add' ? state.period : state.node.period);
  const [group, setGroup] = useState<GroupChoice>(() => {
    const id = state.mode === 'add' ? state.groupId : state.node.parentId;
    return id ? { kind: 'existing', id } : { kind: 'none' };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<'save' | 'next' | null>(null);
  const amountRef = useRef<ComponentRef<typeof InputNumber>>(null);

  /** 选中月份里的顶级条目（编辑时排除自己） */
  const tops = useMemo(
    () => tree.filter((n) => n.period === period && n.id !== node?.id),
    [tree, period, node]
  );
  const groups = useMemo(
    () => tops.filter((n) => n.children.length > 0).sort((a, b) => amountOf(b) - amountOf(a)),
    [tops]
  );
  const findTop = (label: string) => tops.find((n) => sameName(n.name, label));

  /** 新分组的名字恰好是个有金额的独立条目：保存时它会变成分组，要提前说清楚 */
  const convertTarget = (() => {
    if (group.kind !== 'new' || !group.name.trim()) return undefined;
    const t = findTop(group.name);
    return t && t.children.length === 0 && (t.amount ?? 0) > 0 ? t : undefined;
  })();

  /* ---------------- 名称联想 ---------------- */

  const suggestions = useMemo(() => {
    const k = name.trim().toLowerCase();
    if (!k) return [];
    const seen = new Set<string>();
    const out: NameMemory[] = [];
    for (const m of names) {
      if (seen.has(m.name) || !m.name.toLowerCase().includes(k)) continue;
      seen.add(m.name);
      out.push(m);
      if (out.length >= 6) break;
    }
    return out;
  }, [names, name]);

  /** 选了一个记过的名称：新记账时顺手带出上次的分组和金额 */
  const applyMemory = (m: NameMemory) => {
    setName(m.name);
    if (!isAdd) return;
    if (group.kind === 'none' && m.group) {
      const same = findTop(m.group);
      setGroup(same && same.children.length > 0 ? { kind: 'existing', id: same.id } : { kind: 'new', name: m.group });
    }
    if (amount === null) setAmount(m.amount);
    window.setTimeout(() => amountRef.current?.select(), 0);
  };

  /** 换月份：分组跟到新月份的同名分组，新月份没有就准备新建一个同名的 */
  const changePeriod = (p: Period) => {
    setPeriod(p);
    if (group.kind !== 'existing') return;
    const g = tree.find((n) => n.id === group.id);
    if (!g || g.period === p) return;
    const same = tree.find((n) => n.period === p && n.id !== node?.id && sameName(n.name, g.name));
    setGroup(same && same.children.length > 0 ? { kind: 'existing', id: same.id } : { kind: 'new', name: g.name });
  };

  /* ---------------- 保存 ---------------- */

  const validate = (): boolean => {
    const e: Errors = {};
    const nm = name.trim();
    if (!nm) e.name = '写个名称，比如「午餐」「地铁」';
    else if (nm.length > 64) e.name = '名称最长 64 个字';
    if (!isGroup) {
      if (amount === null || Number.isNaN(amount)) e.amount = '填一下金额';
      else if (amount < 0) e.amount = '金额不能是负数';
    }
    if (group.kind === 'new') {
      const g = group.name.trim();
      if (!g) e.group = '给新分组起个名字，或者选「不分组」';
      else if (g.length > 64) e.group = '分组名最长 64 个字';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /**
   * 算出要挂到哪个父项下，必要时先建好分组。
   * 目标是有金额的独立条目时，先把它原来的金额拆成一个同名子项 ——
   * 否则它一变成分组，这笔钱就从合计里消失了。
   */
  const resolveParent = async (): Promise<number | null> => {
    if (group.kind === 'none') return null;
    if (group.kind === 'existing') return group.id;
    const target = findTop(group.name);
    if (target) {
      if (target.children.length === 0 && (target.amount ?? 0) > 0) {
        await api.createRecord({
          parentId: target.id,
          name: target.name,
          detail: target.detail ?? null,
          amount: target.amount ?? 0,
          period: target.period
        });
        await api.updateRecord(target.id, { amount: 0, detail: null });
      }
      return target.id;
    }
    const created = await api.createRecord({ parentId: null, name: group.name.trim(), detail: null, amount: 0, period });
    return created.id;
  };

  const submit = async (next = false) => {
    if (busy || !validate()) return;
    setBusy(next ? 'next' : 'save');
    try {
      if (state.mode === 'add') {
        const parentId = await resolveParent();
        await api.createRecord({ parentId, name: name.trim(), detail: detail.trim() || null, amount: amount ?? 0, period });
        await reload();
        message.success(`已记下「${name.trim()}」${yuan(amount ?? 0)}`);
        if (next) onSwitch({ mode: 'add', period, groupId: parentId ?? undefined });
        else onClose();
        return;
      }

      const n = state.node;
      const patch: RecordPatch = {};
      if (name.trim() !== n.name) patch.name = name.trim();
      if (detail.trim() !== (n.detail ?? '')) patch.detail = detail.trim() || null;
      if (!isGroup && amount !== (n.amount ?? 0)) patch.amount = amount;
      if (period !== n.period) patch.period = period;
      if (!isGroup) {
        const parentId = await resolveParent();
        if (parentId !== (n.parentId ?? null)) patch.parentId = parentId;
      }
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      await api.updateRecord(n.id, patch);
      await reload();
      message.success('已保存');
      onClose();
    } catch (e) {
      message.error(errMsg(e));
      // 分组可能已经建好了，刷新一下，界面和数据库保持一致
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const onFormKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  /* ---------------- 渲染 ---------------- */

  const title = isAdd ? '记一笔' : isGroup ? '编辑分组' : '编辑';

  return (
    <div className="sheet-form" onKeyDown={onFormKey}>
      <SheetHead
        title={title}
        onClose={onClose}
        extra={
          <MonthField value={period} onChange={changePeriod} totals={totals} placement="bottomRight">
            <button type="button" className="chip chip-month" aria-label={`归属月份：${monthSmart(period)}，点击更改`}>
              {monthSmart(period)}
              <Icon name="chevronDown" size={14} />
            </button>
          </MonthField>
        }
      />

      <div className="sheet-body">
        {isGroup && node && (
          <p className="sheet-note">
            {node.children.length} 项，合计 <Money value={amountOf(node)} className="money-inline" />
            。改月份会把这 {node.children.length} 项一起带过去。
          </p>
        )}

        <div className={cls('field-row', isGroup && 'is-single')}>
          <div className="field field-name">
            <label className="field-label" htmlFor="rec-name">
              名称
            </label>
            {/* id 要给 AutoComplete：它会用自己生成的 id 覆盖里面 Input 的 id，label 就对不上了 */}
            <AutoComplete
              id="rec-name"
              value={name}
              options={suggestions.map((m) => ({
                value: m.name,
                label: (
                  <span className="ac-opt">
                    <span>{m.name}</span>
                    <span className="ac-meta">
                      {m.group ? `${m.group} · ` : ''}
                      {money(m.amount)}
                    </span>
                  </span>
                )
              }))}
              onChange={(v: string) => setName(v)}
              onSelect={(v: string) => {
                const m = suggestions.find((s) => s.name === v);
                if (m) applyMemory(m);
              }}
              defaultActiveFirstOption={false}
              popupMatchSelectWidth
            >
              <Input
                autoFocus={isAdd}
                data-autofocus={isAdd || undefined}
                autoComplete="off"
                placeholder={isGroup ? '比如：交通' : '比如：午餐、地铁'}
                status={errors.name ? 'error' : undefined}
                onPressEnter={() => (isGroup ? void submit() : amountRef.current?.focus())}
              />
            </AutoComplete>
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          {!isGroup && (
            <div className="field field-amount">
              <label className="field-label" htmlFor="rec-amount">
                金额
              </label>
              <InputNumber
                id="rec-amount"
                ref={amountRef}
                className="amount-input"
                value={amount}
                onChange={(v) => setAmount(typeof v === 'number' ? v : null)}
                min={0}
                max={9999999999}
                precision={2}
                controls={false}
                changeOnWheel={false}
                inputMode="decimal"
                prefix="¥"
                placeholder="0.00"
                status={errors.amount ? 'error' : undefined}
                onPressEnter={() => void submit()}
              />
              {errors.amount && <span className="field-error">{errors.amount}</span>}
            </div>
          )}
        </div>

        {!isGroup && (
          <div className="field">
            <span className="field-label" id="rec-group-label">
              分组
            </span>
            <div className="chips" role="group" aria-labelledby="rec-group-label">
              <button
                type="button"
                aria-pressed={group.kind === 'none'}
                className={cls('chip', group.kind === 'none' && 'is-on')}
                onClick={() => setGroup({ kind: 'none' })}
              >
                不分组
              </button>
              {groups.map((g) => {
                const on = group.kind === 'existing' && group.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    className={cls('chip', on && 'is-on')}
                    onClick={() => setGroup({ kind: 'existing', id: g.id })}
                  >
                    <span className="dot" style={{ background: slotColor(slots.get(g.name) ?? 0) }} />
                    <span className="chip-text">{g.name}</span>
                  </button>
                );
              })}
              {group.kind === 'new' ? (
                <Input
                  size="small"
                  className="chip-input"
                  autoFocus={!group.name}
                  maxLength={64}
                  value={group.name}
                  placeholder="新分组名"
                  status={errors.group ? 'error' : undefined}
                  onChange={(e) => setGroup({ kind: 'new', name: e.target.value })}
                  onPressEnter={() => void submit()}
                />
              ) : (
                <button type="button" className="chip chip-dashed" onClick={() => setGroup({ kind: 'new', name: '' })}>
                  <Icon name="plus" size={14} />
                  新分组
                </button>
              )}
            </div>
            {convertTarget && (
              <p className="field-hint">
                「{convertTarget.name}」现在是一笔 {yuan(convertTarget.amount)} 的独立支出。保存后它会变成分组，原来的金额作为其中一项保留，合计不变。
              </p>
            )}
            {errors.group && <span className="field-error">{errors.group}</span>}
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="rec-detail">
            备注
          </label>
          <Input
            id="rec-detail"
            value={detail}
            maxLength={255}
            autoComplete="off"
            placeholder="选填，比如「单车 80 + 公交 60」"
            onChange={(e) => setDetail(e.target.value)}
            onPressEnter={() => void submit()}
          />
        </div>
      </div>

      <div className="sheet-foot">
        {node && (
          <button
            type="button"
            className="btn btn-quiet btn-danger"
            disabled={busy !== null}
            onClick={() => {
              onClose();
              void remove(node);
            }}
          >
            <Icon name="trash" size={16} />
            {isGroup ? '删除分组' : '删除'}
          </button>
        )}
        <span className="grow" />
        {isAdd && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => void submit(true)}>
            {busy === 'next' ? '保存中…' : '再记一笔'}
          </button>
        )}
        {isGroup && node && (
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => onSwitch({ mode: 'add', period: node.period, groupId: node.id })}
          >
            <Icon name="plus" size={16} />
            记一笔到这里
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void submit()}>
          {busy === 'save' ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
