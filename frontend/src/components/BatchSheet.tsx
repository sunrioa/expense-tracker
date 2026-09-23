import { useMemo, useRef, useState } from 'react';
import { App as AntApp, AutoComplete, Input, InputNumber } from 'antd';
import { monthsBetween, sumAmounts, type Period } from '@ledger/shared';
import * as api from '../api';
import { useLedger } from '../state/ledger';
import { errMsg } from '../utils/error';
import { monthLabel, yuan } from '../utils/format';
import { objectKey } from '../utils/cls';
import Sheet, { SheetHead } from './Sheet';
import { MonthField } from './MonthGrid';
import Icon from './Icon';

interface Line {
  id: number;
  name: string;
  amount: number | null;
}

export interface BatchRequest {
  /** 默认的起始月份 */
  period: Period;
}

export interface BatchSheetProps {
  /** null = 关闭 */
  request: BatchRequest | null;
  onClose: () => void;
}

/**
 * 批量生成：同样的几笔支出，一次写进连续的多个月 —— 典型是全年的房租、话费。
 * 已经有同名记录的月份会自动跳过，重复点也不会生成两份。
 */
export default function BatchSheet({ request, onClose }: BatchSheetProps) {
  const last = useRef<BatchRequest | null>(null);
  if (request) last.current = request;
  const current = request ?? last.current;

  return (
    <Sheet open={request !== null} onClose={onClose} label="批量生成" width={520}>
      {current && <BatchForm key={objectKey(current)} start={current.period} onClose={onClose} />}
    </Sheet>
  );
}

let lineSerial = 0;
const newLine = (): Line => ({ id: ++lineSerial, name: '', amount: null });

function BatchForm({ start, onClose }: { start: Period; onClose: () => void }) {
  const { totals, groupNames, reload } = useLedger();
  const { message } = AntApp.useApp();

  const [group, setGroup] = useState('');
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [from, setFrom] = useState<Period>(start);
  // 默认铺到当年年底：最常见的用法就是「今年剩下的月份」
  const [to, setTo] = useState<Period>(() => `${start.slice(0, 4)}-12`);
  const [template, setTemplate] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = lines.filter((l) => l.name.trim());
  const months = monthsBetween(from, to) + 1;
  const perMonth = sumAmounts(valid.map((l) => l.amount ?? 0));

  const groupOptions = useMemo(() => {
    const k = group.trim().toLowerCase();
    return groupNames
      .filter((g) => !k || g.toLowerCase().includes(k))
      .slice(0, 6)
      .map((g) => ({ value: g }));
  }, [groupNames, group]);

  const patchLine = (id: number, change: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...change } : l)));

  const submit = async () => {
    if (busy) return;
    if (!valid.length) return setError('至少写一个条目的名称');
    if (group.trim().length > 64) return setError('分组名最长 64 个字');
    if (months < 1) return setError('结束月份不能早于起始月份');
    setError(null);
    setBusy(true);
    try {
      const res = await api.batchFill({
        parentName: group.trim() || null,
        createParentIfMissing: true,
        items: valid.map((l) => ({ name: l.name.trim(), amount: l.amount ?? 0 })),
        fromPeriod: from,
        toPeriod: to,
        detailTemplate: template.trim() || null,
        skipExisting: true
      });
      await reload();
      message.success(
        res.created
          ? `已生成 ${res.created} 条，共 ${yuan(res.totalAmount)}${res.skipped ? `；${res.skipped} 条已存在所以跳过` : ''}`
          : '这些月份都已经有了，没有新生成'
      );
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-form">
      <SheetHead title="批量生成" onClose={onClose} />

      <div className="sheet-body">
        <p className="sheet-note">同样的几笔支出一次写进连续的多个月，已有同名记录的月份自动跳过。</p>

        <div className="field">
          <span className="field-label">月份</span>
          <div className="range-row">
            <MonthField value={from} onChange={setFrom} totals={totals}>
              <button type="button" className="field-btn">
                {monthLabel(from)}
                <Icon name="chevronDown" size={14} />
              </button>
            </MonthField>
            <span className="range-sep">到</span>
            <MonthField value={to} onChange={setTo} totals={totals}>
              <button type="button" className="field-btn">
                {monthLabel(to)}
                <Icon name="chevronDown" size={14} />
              </button>
            </MonthField>
            <span className="range-count">{months > 0 ? `${months} 个月` : ''}</span>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="batch-group">
            分组 <span className="field-optional">选填</span>
          </label>
          <AutoComplete id="batch-group" value={group} options={groupOptions} onChange={(v: string) => setGroup(v)}>
            <Input autoComplete="off" />
          </AutoComplete>
        </div>

        <div className="field">
          <span className="field-label">条目</span>
          <div className="batch-lines">
            {lines.map((l, i) => (
              <div className="batch-line" key={l.id}>
                <Input
                  autoFocus={i === 0}
                  data-autofocus={i === 0 || undefined}
                  aria-label={`第 ${i + 1} 条的名称`}
                  maxLength={64}
                  autoComplete="off"
                  placeholder="名称"
                  value={l.name}
                  onChange={(e) => patchLine(l.id, { name: e.target.value })}
                />
                <InputNumber
                  aria-label={`第 ${i + 1} 条的金额`}
                  className="amount-input"
                  value={l.amount}
                  onChange={(v) => patchLine(l.id, { amount: typeof v === 'number' ? v : null })}
                  min={0}
                  precision={2}
                  controls={false}
                  changeOnWheel={false}
                  inputMode="decimal"
                  prefix="¥"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="删掉这一条"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="text-btn" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Icon name="plus" size={15} />
              再加一条
            </button>
          </div>
        </div>

        {advanced ? (
          <div className="field">
            <label className="field-label" htmlFor="batch-tpl">
              备注模板
            </label>
            <Input
              id="batch-tpl"
              maxLength={255}
              autoComplete="off"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <p className="field-hint">
              可用占位：{'{month}'} 月份数字、{'{period}'} 年-月、{'{name}'} 条目名、{'{parent}'} 分组名
            </p>
          </div>
        ) : (
          <button type="button" className="text-btn" onClick={() => setAdvanced(true)}>
            备注模板…
          </button>
        )}

        {error && <p className="field-error block">{error}</p>}
      </div>

      <div className="sheet-foot">
        <span className="foot-summary">
          {valid.length > 0 && months > 0
            ? `${months} 个月 × ${valid.length} 条，最多 ${yuan(perMonth * months)}`
            : ' '}
        </span>
        <span className="grow" />
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? '生成中…' : '生成'}
        </button>
      </div>
    </div>
  );
}
