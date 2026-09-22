import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  DeleteOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import * as api from '../api';
import type {
  BatchFillItem,
  OptionsQuery,
  Period,
  RangeQuery,
  RecordNode,
  RecordOption,
  RecordPatch
} from '@ledger/shared';
import { currentPeriod, money, periodLabel, sumAmounts, walkTree, yuan } from '../utils/format';
import { errMsg } from '../utils/error';
import { useCountUp } from '../hooks/useCountUp';
import { useIsNarrow } from '../hooks/useMediaQuery';
import MonthBar from '../components/MonthBar';
import RecordCardList from '../components/RecordCardList';
import RecordEditDrawer from '../components/RecordEditDrawer';

const { MonthPicker } = DatePicker;

/* ------------------------------------------------------------ 本页类型 */

/**
 * 表格行：把 RecordNode 树摊平后的一行。
 *
 * 刻意**不**保留 children —— rc-table 只要在 record 上看到 children 就会把它
 * 当成树形数据，把展开图标塞进第一列，破坏列布局。这个约束原来只写在注释里，
 * 现在由类型本身表达：LedgerRow 根本没有 children 字段。
 */
interface LedgerRow {
  id: number;
  name: string;
  detail?: string;
  amount?: number;
  subtotal?: number;
  period: Period;
  path?: string;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  childNames: string[];
  expanded: boolean;
}

interface QuickForm {
  period: Dayjs | null;
  name: string;
  detail: string;
  amount: number | null;
  parentId?: number;
}

interface ChildForm {
  name: string;
  detail: string;
  amount: number | null;
  period: Dayjs | null;
}

interface BatchItemForm {
  name: string;
  detail: string;
  amount: number | null;
}

interface BatchForm {
  parentName: string;
  items: BatchItemForm[];
  from: Dayjs | null;
  to: Dayjs | null;
  detailTemplate: string;
  skipExisting: boolean;
}

/**
 * 能当父项用的最小形状。
 * 桌面表格传的是 LedgerRow，手机卡片列表传的是 RecordNode，两者都满足。
 */
interface ParentLike {
  id: number;
  name: string;
  period: Period;
  path?: string;
}

interface ModalState {
  open: boolean;
  parent: ParentLike | null;
}

const EMPTY_ITEM: BatchItemForm = { name: '', detail: '', amount: null };

/* ------------------------------------------------------------ 可编辑单元格 */

interface TextCellProps {
  value?: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

function TextCell({ value, onCommit, placeholder, className, disabled, allowEmpty }: TextCellProps) {
  const [v, setV] = useState(value || '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setV(value || '');
  }, [value, focused]);

  const commit = () => {
    const next = v.trim();
    if (next === (value || '')) return;
    if (!next && !allowEmpty) {
      setV(value || '');
      return;
    }
    onCommit(next);
  };

  return (
    <Input
      size="small"
      variant="borderless"
      className={className}
      value={v}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onPressEnter={(e) => e.currentTarget.blur()}
    />
  );
}

interface AmountCellProps {
  value?: number | null;
  parentLike?: boolean;
  /** 只读时不会调用 onCommit，所以 onCommit 可以不传 */
  readOnly?: boolean;
  onCommit?: (value: number) => void;
  tooltip?: ReactNode;
}

/**
 * 金额单元格。
 *
 * <p>父项 / 子项的金额都靠右对齐到同一条基准线，区别只在颜色和字重：
 * <ul>
 *   <li>父项（顶级条目，以及任何有子项的节点）—— 靛蓝粗体，不带 ¥ 符号</li>
 *   <li>子项（非顶级的明细行）—— 常规深灰，带 ¥ 符号</li>
 * </ul>
 * 除「有子项的父项」（金额由子项汇总，只读）外，点击数字即可就地修改。
 */
function AmountCell({ value, parentLike, readOnly, onCommit, tooltip }: AmountCellProps) {
  const num = value === null || value === undefined ? 0 : Number(value);
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<number | null>(num);

  useEffect(() => {
    if (!editing) setV(num);
  }, [num, editing]);

  if (readOnly) {
    const text = <span className="amount-group">{money(num)}</span>;
    return tooltip ? <Tooltip title={tooltip}>{text}</Tooltip> : text;
  }

  if (!editing) {
    return (
      <Tooltip title={tooltip}>
        <span
          className={`amount-view${parentLike ? ' is-parent' : ' is-leaf'}`}
          onClick={() => {
            setV(num);
            setEditing(true);
          }}
        >
          {!parentLike && <span className="amount-cur">¥</span>}
          {money(num)}
        </span>
      </Tooltip>
    );
  }

  return (
    <InputNumber
      autoFocus
      size="small"
      variant="borderless"
      className="amount-edit"
      changeOnWheel={false}
      min={0}
      step={1}
      precision={2}
      style={{ width: '100%' }}
      value={v}
      onChange={(n) => setV(n)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={() => {
        setEditing(false);
        // 原来还判了 v === ''：InputNumber 的 onChange 只会给出 number | null，
        // 空字符串这个分支永远进不去，类型收紧后直接去掉。
        const next = v === null || v === undefined ? 0 : Number(v);
        if (next !== num) onCommit?.(next);
      }}
      onPressEnter={(e) => e.currentTarget.blur()}
    />
  );
}

interface PeriodCellProps {
  value?: Period;
  onCommit: (value: Period) => void;
}

function PeriodCell({ value, onCommit }: PeriodCellProps) {
  const [v, setV] = useState<Dayjs | null>(value ? dayjs(value) : null);

  useEffect(() => {
    setV(value ? dayjs(value) : null);
  }, [value]);

  return (
    <MonthPicker
      size="small"
      variant="borderless"
      allowClear={false}
      format="YYYY-MM"
      style={{ width: '100%' }}
      value={v}
      onChange={(d) => {
        if (!d) return;
        setV(d);
        const next = d.format('YYYY-MM');
        if (next !== value) onCommit(next);
      }}
    />
  );
}

/* ------------------------------------------------------------ 主页面 */

export default function LedgerPage() {
  const { message, modal } = AntApp.useApp();

  /** null = 查看全部月份 */
  const [month, setMonth] = useState<Dayjs | null>(() => dayjs(currentPeriod()));
  const [months, setMonths] = useState<Period[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tree, setTree] = useState<RecordNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<RecordOption[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const selectedPeriod = month ? month.format('YYYY-MM') : null;

  const [quick, setQuick] = useState<QuickForm>({
    period: dayjs(currentPeriod()),
    name: '',
    detail: '',
    amount: null,
    parentId: undefined
  });

  const [childModal, setChildModal] = useState<ModalState>({ open: false, parent: null });
  const [childForm, setChildForm] = useState<ChildForm>({
    name: '',
    detail: '',
    amount: null,
    period: dayjs(currentPeriod())
  });

  const [batchModal, setBatchModal] = useState<ModalState>({ open: false, parent: null });
  const [batchForm, setBatchForm] = useState<BatchForm>({
    parentName: '',
    items: [{ ...EMPTY_ITEM }],
    from: dayjs(currentPeriod()),
    to: dayjs(currentPeriod()),
    detailTemplate: '',
    skipExisting: true
  });

  const [submitting, setSubmitting] = useState(false);

  /* 手机专用：右下角悬浮按钮唤起的添加抽屉，以及点条目打开的编辑抽屉 */
  const isNarrow = useIsNarrow();
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editing, setEditing] = useState<RecordNode | null>(null);

  /* ---------------- 数据加载 ---------------- */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: RangeQuery = {};
      if (selectedPeriod) {
        params.from = selectedPeriod;
        params.to = selectedPeriod;
      }
      if (keyword) params.keyword = keyword;
      const data = await api.fetchTree(params);
      setTree(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(errMsg(e));
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, keyword, message]);

  const loadOptions = useCallback(async () => {
    try {
      const params: OptionsQuery = selectedPeriod ? { period: selectedPeriod } : {};
      const data = await api.fetchOptions(params);
      setOptions(Array.isArray(data) ? data : []);
    } catch {
      /* 下拉选项失败不影响主流程 */
    }
  }, [selectedPeriod]);

  const loadMonths = useCallback(async () => {
    try {
      const data = await api.fetchPeriods();
      setMonths(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadMonths();
  }, [loadMonths]);

  /* ---------------- 汇总 ---------------- */

  // 用共享层的整数分求和，和后端算出来的数字逐分一致
  const total = useMemo(() => sumAmounts((tree || []).map((n) => n.subtotal ?? 0)), [tree]);

  const leafTotalCount = useMemo(() => {
    let c = 0;
    walkTree(tree, (n) => {
      if (!n.hasChildren) c += 1;
    });
    return c;
  }, [tree]);

  /** 只允许「顶级条目」作为父项：子项不再支持继续挂子项 */
  const parentOptions = useMemo(
    () => options.filter((o) => o.depth === 0).map((o) => ({ label: o.label, value: o.id })),
    [options]
  );

  const monthOptions = useMemo(
    () => months.map((p) => ({ label: periodLabel(p), value: p })),
    [months]
  );

  /**
   * 表格数据源：把树摊平成当前可见的行。
   *
   * <p>刻意不使用 antd 的树形展开 —— 树形模式下展开图标会被塞进「支出名称」
   * 单元格里，和可编辑输入框抢宽度、导致换行错位。这里自己维护缩进与展开，
   * 表格每列都是干净的独立单元格。
   */
  const rows = useMemo<LedgerRow[]>(() => {
    const out: LedgerRow[] = [];
    const walk = (nodes: RecordNode[] | undefined) => {
      (nodes ?? []).forEach((n) => {
        const hasChildren = !!(n.children && n.children.length);
        const expanded = hasChildren && !collapsed.has(n.id);
        out.push({
          id: n.id,
          name: n.name,
          detail: n.detail,
          amount: n.amount,
          subtotal: n.subtotal,
          period: n.period,
          path: n.path,
          depth: n.depth || 0,
          hasChildren,
          childCount: hasChildren ? n.children.length : 0,
          childNames: hasChildren ? n.children.map((c) => c.name).filter(Boolean) : [],
          expanded
        });
        if (expanded) walk(n.children);
      });
    };
    walk(tree);
    return out;
  }, [tree, collapsed]);

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ---------------- 操作 ---------------- */

  const refreshAll = async () => {
    await Promise.all([load(), loadOptions(), loadMonths()]);
  };

  const submitQuick = async () => {
    if (!quick.name.trim()) {
      message.warning('请填写支出名称');
      return;
    }
    // 同 AmountCell：InputNumber 不会给出空字符串，原来的 amount === '' 分支已去掉
    if (quick.amount === null || quick.amount === undefined) {
      message.warning('请填写支出金额');
      return;
    }
    setSubmitting(true);
    try {
      await api.createRecord({
        parentId: quick.parentId || null,
        name: quick.name.trim(),
        detail: quick.detail,
        amount: Number(quick.amount),
        period: quick.period ? quick.period.format('YYYY-MM') : null
      });
      message.success('已添加');
      setQuick((q) => ({ ...q, name: '', detail: '', amount: null }));
      setQuickOpen(false);
      await refreshAll();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const patch = async (id: number, changes: RecordPatch) => {
    try {
      await api.updateRecord(id, changes);
      await refreshAll();
    } catch (e) {
      message.error(errMsg(e));
      load();
    }
  };

  const remove = async (row: { id: number }) => {
    try {
      const res = await api.deleteRecord(row.id);
      message.success(`已删除 ${res.deleted || 1} 条记录`);
      await refreshAll();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const openChildModal = (parent: ParentLike) => {
    setChildForm({
      name: '',
      detail: '',
      amount: null,
      period: parent.period ? dayjs(parent.period) : dayjs(currentPeriod())
    });
    setChildModal({ open: true, parent });
  };

  const submitChild = async () => {
    const parent = childModal.parent;
    // 弹窗只会带着 parent 打开，这里只是让类型闭合
    if (!parent) return;
    if (!childForm.name.trim()) {
      message.warning('请填写支出名称');
      return;
    }
    if (childForm.amount === null || childForm.amount === undefined) {
      message.warning('请填写支出金额');
      return;
    }
    setSubmitting(true);
    try {
      await api.createRecord({
        parentId: parent.id,
        name: childForm.name.trim(),
        detail: childForm.detail,
        amount: Number(childForm.amount),
        period: childForm.period ? childForm.period.format('YYYY-MM') : null
      });
      message.success('子项已添加');
      setChildModal({ open: false, parent: null });
      await refreshAll();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const openBatchModal = (parent: ParentLike | null) => {
    const base = month || dayjs(currentPeriod());
    setBatchForm({
      parentName: parent ? parent.name : '',
      items: [{ ...EMPTY_ITEM }],
      from: base,
      to: base,
      detailTemplate: '',
      skipExisting: true
    });
    setBatchModal({ open: true, parent: parent || null });
  };

  const submitBatch = async () => {
    const items: BatchFillItem[] = batchForm.items
      .filter((i) => i.name && i.name.trim())
      .map((i) => ({ name: i.name.trim(), detail: i.detail, amount: Number(i.amount || 0) }));
    if (!items.length) {
      message.warning('请至少填写一个子项名称');
      return;
    }
    const { from, to } = batchForm;
    if (!from || !to) {
      message.warning('请选择月份范围');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.batchFill({
        parentName: batchForm.parentName && batchForm.parentName.trim() ? batchForm.parentName.trim() : null,
        createParentIfMissing: true,
        items,
        fromPeriod: from.format('YYYY-MM'),
        toPeriod: to.format('YYYY-MM'),
        detailTemplate: batchForm.detailTemplate,
        skipExisting: batchForm.skipExisting
      });
      modal.success({
        title: '按月生成完成',
        content: (
          <div>
            <div>覆盖月份：<b>{res.months}</b> 个</div>
            <div>新增记录：<b>{res.created}</b> 行</div>
            {res.parentCreated > 0 && <div>新建支出名称：{res.parentCreated} 个</div>}
            {res.skipped > 0 && <div>跳过已存在：{res.skipped} 行</div>}
            <div>生成金额合计：<b>{yuan(res.totalAmount)}</b></div>
          </div>
        )
      });
      setBatchModal({ open: false, parent: null });
      await refreshAll();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 顶部合计数字滚动到位，刷新后能直观看出变化方向 */
  const animatedTotal = useCountUp(total);

  /* ---------------- 表格 ---------------- */

  const childSummary = (row: LedgerRow): string => {
    const names = row.childNames || [];
    if (!names.length) return '—';
    const s = names.join(' · ');
    return s.length > 44 ? `${s.slice(0, 44)}…` : s;
  };

  const columns = useMemo<TableColumnsType<LedgerRow>>(
    () => [
      {
        key: 'tree',
        width: 76,
        className: 'col-tree',
        onHeaderCell: () => ({ className: 'col-tree' }),
        render: (_: unknown, row: LedgerRow) => (
          <div
            className={`tree-cell depth-${row.depth}`}
            style={{ paddingLeft: row.depth * 14 }}
          >
            {row.depth > 0 && <span className="tree-guide" />}
            <span className="tree-box">
              {row.hasChildren ? (
                <button
                  type="button"
                  className={`tree-toggle${row.expanded ? ' is-open' : ''}`}
                  onClick={() => toggleCollapse(row.id)}
                  title={row.expanded ? '收起子项' : '展开子项'}
                >
                  {row.expanded ? '−' : '+'}
                </button>
              ) : (
                <span className={`tree-dot${row.depth === 0 ? ' is-top' : ''}`} />
              )}
            </span>
          </div>
        )
      },
      {
        title: '支出名称',
        dataIndex: 'name',
        width: '22%',
        className: 'col-name',
        onHeaderCell: () => ({ className: 'col-name' }),
        render: (name: string, row: LedgerRow) => (
          <div className="name-cell">
            <TextCell
              value={name}
              className={row.depth === 0 ? 'text-parent' : 'text-leaf'}
              placeholder="如：交通 / 吃"
              onCommit={(v) => patch(row.id, { name: v })}
            />
            {row.hasChildren && (
              <Tag className="child-tag" bordered={false}>
                {row.childCount} 个子项
              </Tag>
            )}
          </div>
        )
      },
      {
        title: '支出详细',
        dataIndex: 'detail',
        width: '26%',
        className: 'col-detail',
        onHeaderCell: () => ({ className: 'col-detail' }),
        render: (detail: string | undefined, row: LedgerRow) => (
          <TextCell
            value={detail}
            allowEmpty
            className={row.hasChildren ? 'text-hint' : 'text-leaf'}
            placeholder={
              row.hasChildren ? childSummary(row) : '这笔钱的说明，如：单车80+公交60+地铁120'
            }
            onCommit={(v) => patch(row.id, { detail: v })}
          />
        )
      },
      {
        title: '支出金额',
        dataIndex: 'subtotal',
        width: '17%',
        align: 'right',
        className: 'col-amount',
        onHeaderCell: () => ({ className: 'col-amount' }),
        render: (subtotal: number | undefined, row: LedgerRow) => {
          // 有子项 → 父项金额由子项汇总，只读
          if (row.hasChildren) {
            return (
              <AmountCell
                value={subtotal}
                parentLike
                readOnly
                tooltip="父项金额由所有子项自动汇总，不需要手工填写"
              />
            );
          }
          // 顶级条目即使没有子项，也按父项的外观显示（点击仍可修改）
          const top = row.depth === 0;
          return (
            <AmountCell
              value={row.amount}
              parentLike={top}
              tooltip={top ? '顶级条目的金额，点击可直接修改' : '点击可直接修改金额'}
              onCommit={(v) => patch(row.id, { amount: v })}
            />
          );
        }
      },
      {
        title: '归属月份',
        dataIndex: 'period',
        width: 124,
        className: 'col-period',
        onHeaderCell: () => ({ className: 'col-period' }),
        render: (period: Period, row: LedgerRow) => (
          <PeriodCell value={period} onCommit={(v) => patch(row.id, { period: v })} />
        )
      },
      {
        title: '操作',
        key: 'action',
        width: 108,
        align: 'center',
        className: 'col-action',
        onHeaderCell: () => ({ className: 'col-action' }),
        render: (_: unknown, row: LedgerRow) => (
          <Space size={2} className="row-actions">
            {row.depth === 0 && (
              <Tooltip title="添加子项">
                <Button
                  type="text"
                  size="small"
                  className="act-btn act-add"
                  icon={<PlusOutlined />}
                  onClick={() => openChildModal(row)}
                />
              </Tooltip>
            )}
            <Popconfirm
              title={row.hasChildren ? '删除该项及其全部子项？' : '删除这条记录？'}
              description={
                row.hasChildren ? `该操作会同时删除 ${row.childCount} 个子项，不可恢复。` : undefined
              }
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => remove(row)}
            >
              <Tooltip title="删除">
                <Button type="text" size="small" danger className="act-btn" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [patch, remove, toggleCollapse]
  );

  /* ---------------- 渲染 ---------------- */

  /** 四个输入项。桌面放在卡片里的面板中，手机放在抽屉里，共用同一份 JSX。 */
  const quickFields = (
    <div className="quick-grid">
      <div className="quick-field">
        <label>归属月份</label>
        <MonthPicker
          allowClear={false}
          format="YYYY-MM"
          value={quick.period}
          onChange={(d) => setQuick((q) => ({ ...q, period: d }))}
        />
      </div>
      <div className="quick-field">
        <label>支出名称</label>
        <Input
          placeholder="如：交通 / 吃"
          value={quick.name}
          onChange={(e) => setQuick((q) => ({ ...q, name: e.target.value }))}
          onPressEnter={submitQuick}
        />
      </div>
      <div className="quick-field">
        <label>支出详细</label>
        <Input
          placeholder="这笔钱的说明，如：单车80+公交60"
          value={quick.detail}
          onChange={(e) => setQuick((q) => ({ ...q, detail: e.target.value }))}
          onPressEnter={submitQuick}
        />
      </div>
      <div className="quick-field">
        <label>支出金额</label>
        <InputNumber
          style={{ width: '100%' }}
          changeOnWheel={false}
          min={0}
          precision={2}
          prefix="¥"
          placeholder="0.00"
          value={quick.amount}
          onChange={(n) => setQuick((q) => ({ ...q, amount: n }))}
          onPressEnter={submitQuick}
        />
      </div>
    </div>
  );

  const quickParentPicker = (
    <Select
      allowClear
      showSearch
      placeholder="归到某个顶级条目下（留空 = 新建顶级条目）"
      optionFilterProp="label"
      value={quick.parentId}
      options={parentOptions}
      onChange={(v) => setQuick((q) => ({ ...q, parentId: v }))}
    />
  );

  const emptyText = selectedPeriod
    ? `${periodLabel(selectedPeriod)}还没有记录`
    : '还没有任何记录';

  return (
    <div className="page">
      {/* ---------- 筛选 ---------- */}
      {/*
        手机上整张筛选卡换成吸顶月份条：记账最常做的事是「翻到上个月看看花了多少」，
        原来每次对比都得先滚回页面顶部。
      */}
      {isNarrow ? (
        <MonthBar
          month={month}
          onChange={setMonth}
          onMore={() => setMoreOpen(true)}
          hasFilter={!!keyword}
        />
      ) : (
      <Card className="section-card bar-teal" size="small">
        {!isNarrow && (
          <div className="hint-block">
            按月记账：每条记录都归属到某个月，金额填这个月该项花的总额即可，不用按天记。
            想拆细就加子项 —— 例如「交通」下面建「单车 / 公交 / 地铁」，各自填这个月的金额，
            <b>父项金额由子项自动汇总</b>，顶部合计会实时累加。
          </div>
        )}

        <div className="filter-bar">
          <div className="filter-month">
            <MonthPicker
              value={month}
              allowClear
              placeholder="全部月份"
              format="YYYY-MM"
              onChange={(d) => setMonth(d || null)}
            />
            <Select
              placeholder="跳到已有月份"
              value={selectedPeriod && months.includes(selectedPeriod) ? selectedPeriod : undefined}
              options={monthOptions}
              onChange={(v) => setMonth(v ? dayjs(v) : null)}
            />
          </div>

          <div className="filter-search">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索名称 / 详细"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onPressEnter={() => setKeyword(keywordInput)}
            />
            <Button onClick={() => setKeyword(keywordInput)}>查询</Button>
            {keyword && (
              <Button
                type="link"
                onClick={() => {
                  setKeywordInput('');
                  setKeyword('');
                }}
              >
                清除
              </Button>
            )}
          </div>

          <div className="filter-actions">
            <Button onClick={() => setMonth(dayjs(currentPeriod()))}>回到本月</Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => openBatchModal(null)}>
              批量生成
            </Button>
            <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={loading}>
              刷新
            </Button>
          </div>
        </div>
      </Card>
      )}

      {/* ---------- 合计（手机上这是第一屏最重要的数字） ---------- */}
      <Card className="section-card bar-sage" size="small">
        <div className="total-strip">
          <span className="total-label">{periodLabel(selectedPeriod)}合计</span>
          <span className="total-number">{yuan(animatedTotal)}</span>
          <span className="total-label">
            共 {leafTotalCount} 条明细 · {tree.length} 个支出名称
          </span>
        </div>

        {/* 手机上这块常驻会占掉约 400px，改由右下角悬浮按钮唤起抽屉 */}
        {!isNarrow && (
          <>
            <Divider className="soft-divider" />
            <div className="quick-panel">
              <div className="panel-title">
                <PlusCircleOutlined className="panel-icon" />
                快速添加一条记录
              </div>
              {quickFields}
              <div className="quick-actions">
                <div className="quick-parent">{quickParentPicker}</div>
                <Button
                  type="primary"
                  className="btn-gradient"
                  icon={<PlusOutlined />}
                  loading={submitting}
                  onClick={submitQuick}
                >
                  添加记录
                </Button>
                <span className="quick-hint">子项只支持一层：顶级条目 → 子项</span>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ---------- 明细 ---------- */}
      <Card
        className="section-card bar-clay"
        size="small"
        title="支出明细"
        extra={
          !isNarrow && (
            <span className="table-legend">
              <span className="legend-item">
                <i className="legend-dot dot-parent" />
                顶级条目（金额由子项汇总）
              </span>
              <span className="legend-item">
                <i className="legend-dot dot-leaf" />
                明细项（可直接编辑）
              </span>
            </span>
          )
        }
      >
        {isNarrow ? (
          <RecordCardList
            tree={tree}
            collapsed={collapsed}
            onToggle={toggleCollapse}
            onPick={setEditing}
            onAddChild={openChildModal}
            loading={loading}
            emptyText={emptyText}
          />
        ) : (
          <Table<LedgerRow>
            className="ledger-table"
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 720 }}
            pagination={false}
            rowClassName={(row) => (row.depth === 0 ? 'top-row' : 'child-row')}
            locale={{ emptyText: <Empty description={emptyText} /> }}
          />
        )}
      </Card>

      {/* ---------- 手机：悬浮添加按钮 ---------- */}
      {isNarrow && (
        <button
          type="button"
          className="fab"
          aria-label="添加一条记录"
          onClick={() => setQuickOpen(true)}
        >
          <PlusOutlined />
        </button>
      )}

      {/* ---------- 手机：添加抽屉 ---------- */}
      <Drawer
        open={isNarrow && quickOpen}
        onClose={() => setQuickOpen(false)}
        placement="bottom"
        height="auto"
        title="添加一条记录"
        className="edit-drawer"
        footer={
          <div className="drawer-footer">
            <Button onClick={() => setQuickOpen(false)}>取消</Button>
            <Button
              type="primary"
              className="btn-gradient"
              icon={<PlusOutlined />}
              loading={submitting}
              onClick={submitQuick}
            >
              添加记录
            </Button>
          </div>
        }
      >
        <div className="drawer-form">
          {quickFields}
          <div className="quick-field">
            <label>归到哪个顶级条目下</label>
            {quickParentPicker}
            <span className="field-hint">留空 = 新建一个顶级条目。子项只支持一层</span>
          </div>
        </div>
      </Drawer>

      {/* ---------- 手机：更多筛选与操作 ---------- */}
      <Drawer
        open={isNarrow && moreOpen}
        onClose={() => setMoreOpen(false)}
        placement="bottom"
        height="auto"
        title="筛选与操作"
        className="edit-drawer"
        footer={
          <div className="drawer-footer">
            <Button onClick={() => setMoreOpen(false)}>关闭</Button>
          </div>
        }
      >
        <div className="drawer-form">
          <div className="quick-field">
            <label>搜索名称 / 详细</label>
            <div className="filter-search">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="如：地铁 / 房租"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onPressEnter={() => {
                  setKeyword(keywordInput);
                  setMoreOpen(false);
                }}
              />
              <Button
                type="primary"
                className="btn-gradient"
                onClick={() => {
                  setKeyword(keywordInput);
                  setMoreOpen(false);
                }}
              >
                查询
              </Button>
            </div>
            {keyword && (
              <Button
                type="link"
                size="small"
                style={{ paddingLeft: 0 }}
                onClick={() => {
                  setKeywordInput('');
                  setKeyword('');
                }}
              >
                清除「{keyword}」
              </Button>
            )}
          </div>

          <div className="quick-field">
            <label>跳到已有月份</label>
            <Select
              placeholder="选择一个有记录的月份"
              value={selectedPeriod && months.includes(selectedPeriod) ? selectedPeriod : undefined}
              options={monthOptions}
              onChange={(v) => {
                setMonth(v ? dayjs(v) : null);
                setMoreOpen(false);
              }}
            />
          </div>

          <div className="drawer-actions">
            <Button
              block
              onClick={() => {
                setMonth(dayjs(currentPeriod()));
                setMoreOpen(false);
              }}
            >
              回到本月
            </Button>
            <Button
              block
              onClick={() => {
                setMonth(null);
                setMoreOpen(false);
              }}
            >
              全部月份
            </Button>
            <Button
              block
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setMoreOpen(false);
                openBatchModal(null);
              }}
            >
              批量生成
            </Button>
            <Button block icon={<ReloadOutlined />} loading={loading} onClick={refreshAll}>
              刷新
            </Button>
          </div>
        </div>
      </Drawer>

      {/* ---------- 手机：编辑抽屉 ---------- */}
      <RecordEditDrawer
        open={isNarrow && editing !== null}
        record={editing}
        submitting={submitting}
        onClose={() => setEditing(null)}
        onSave={async (id, changes) => {
          await patch(id, changes);
          setEditing(null);
        }}
        onDelete={async (r) => {
          await remove(r);
          setEditing(null);
        }}
      />

      {/* ---------- 添加子项 ---------- */}
      <Modal
        title={
          childModal.parent
            ? `在「${childModal.parent.path || childModal.parent.name}」下添加子项`
            : '添加子项'
        }
        open={childModal.open}
        onCancel={() => setChildModal({ open: false, parent: null })}
        onOk={submitChild}
        confirmLoading={submitting}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ display: 'grid', gap: 12, paddingTop: 8 }}>
          <div className="quick-field">
            <label>支出名称</label>
            <Input
              placeholder="如：单车 / 公交 / 地铁"
              value={childForm.name}
              onChange={(e) => setChildForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="quick-field">
            <label>支出详细</label>
            <Input
              placeholder="选填"
              value={childForm.detail}
              onChange={(e) => setChildForm((f) => ({ ...f, detail: e.target.value }))}
            />
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <div className="quick-field">
                <label>支出金额（这个月的合计）</label>
                <InputNumber
                  style={{ width: '100%' }}
                  changeOnWheel={false}
                  min={0}
                  precision={2}
                  prefix="¥"
                  value={childForm.amount}
                  onChange={(n) => setChildForm((f) => ({ ...f, amount: n }))}
                />
              </div>
            </Col>
            <Col span={12}>
              <div className="quick-field">
                <label>归属月份</label>
                <MonthPicker
                  style={{ width: '100%' }}
                  allowClear={false}
                  format="YYYY-MM"
                  value={childForm.period}
                  onChange={(d) => setChildForm((f) => ({ ...f, period: d }))}
                />
              </div>
            </Col>
          </Row>
        </div>
      </Modal>

      {/* ---------- 按月批量生成 ---------- */}
      <Modal
        title={batchModal.parent ? `按月批量生成到「${batchModal.parent.name}」` : '按月批量生成'}
        open={batchModal.open}
        onCancel={() => setBatchModal({ open: false, parent: null })}
        onOk={submitBatch}
        confirmLoading={submitting}
        okText="生成记录"
        cancelText="取消"
        width={720}
        destroyOnHidden
      >
        <div className="hint-block">
          典型用法：支出名称填「房租」，子项写 3200，月份选 2026-01 ~ 2026-12，
          一次就会生成 12 条记录（一个月一条）。已经存在的月份会自动跳过，可以放心重复点。
        </div>

        <div className="quick-field" style={{ marginBottom: 14 }}>
          <label>支出名称（不存在会自动创建；留空则直接生成顶级条目）</label>
          <Input
            placeholder="如：房租 / 话费 / 交通"
            value={batchForm.parentName}
            onChange={(e) => setBatchForm((f) => ({ ...f, parentName: e.target.value }))}
          />
        </div>

        <div className="section-title">子项（每行一个支出名称）</div>
        {batchForm.items.map((item, idx) => (
          <div className="batch-item-row" key={idx}>
            <Input
              placeholder="名称，如：单车"
              value={item.name}
              onChange={(e) => {
                const items = [...batchForm.items];
                items[idx] = { ...items[idx], name: e.target.value };
                setBatchForm((f) => ({ ...f, items }));
              }}
            />
            <Input
              placeholder="详细（选填）"
              value={item.detail}
              onChange={(e) => {
                const items = [...batchForm.items];
                items[idx] = { ...items[idx], detail: e.target.value };
                setBatchForm((f) => ({ ...f, items }));
              }}
            />
            <InputNumber
              style={{ width: '100%' }}
              changeOnWheel={false}
              min={0}
              precision={2}
              prefix="¥"
              placeholder="金额"
              value={item.amount}
              onChange={(n) => {
                const items = [...batchForm.items];
                items[idx] = { ...items[idx], amount: n };
                setBatchForm((f) => ({ ...f, items }));
              }}
            />
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              disabled={batchForm.items.length <= 1}
              onClick={() =>
                setBatchForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
              }
            />
          </div>
        ))}
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={() => setBatchForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))}
        >
          再加一个子项
        </Button>

        <Divider />

        <Row gutter={[12, 12]}>
          <Col xs={12} sm={10}>
            <div className="quick-field">
              <label>起始月份</label>
              <MonthPicker
                style={{ width: '100%' }}
                allowClear={false}
                format="YYYY-MM"
                value={batchForm.from}
                onChange={(d) => setBatchForm((f) => ({ ...f, from: d }))}
              />
            </div>
          </Col>
          <Col xs={12} sm={10}>
            <div className="quick-field">
              <label>结束月份</label>
              <MonthPicker
                style={{ width: '100%' }}
                allowClear={false}
                format="YYYY-MM"
                value={batchForm.to}
                onChange={(d) => setBatchForm((f) => ({ ...f, to: d }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={4}>
            <div className="quick-field">
              <label className="label-spacer">&nbsp;</label>
              <Button
                block
                onClick={() =>
                  setBatchForm((f) => ({
                    ...f,
                    from: dayjs(currentPeriod()),
                    to: dayjs(currentPeriod())
                  }))
                }
              >
                本月
              </Button>
            </div>
          </Col>
          <Col span={24}>
            <div className="quick-field">
              <label>详细模板（选填，可用 {'{period}'} {'{month}'} {'{name}'} {'{parent}'} 占位）</label>
              <Input
                placeholder="例如：{name} 月度"
                value={batchForm.detailTemplate}
                onChange={(e) => setBatchForm((f) => ({ ...f, detailTemplate: e.target.value }))}
              />
            </div>
          </Col>
          <Col span={24}>
            <Checkbox
              checked={batchForm.skipExisting}
              onChange={(e) => setBatchForm((f) => ({ ...f, skipExisting: e.target.checked }))}
            >
              跳过已存在的同名同月份记录（推荐，避免重复生成）
            </Checkbox>
          </Col>
        </Row>
      </Modal>
    </div>
  );
}
