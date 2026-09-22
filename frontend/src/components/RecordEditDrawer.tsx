import { useEffect, useState } from 'react';
import { Button, DatePicker, Drawer, Input, InputNumber, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { RecordNode, RecordPatch } from '@ledger/shared';

const { MonthPicker } = DatePicker;

export interface RecordEditDrawerProps {
  open: boolean;
  record: RecordNode | null;
  submitting?: boolean;
  onClose: () => void;
  onSave: (id: number, patch: RecordPatch) => void | Promise<void>;
  onDelete: (record: RecordNode) => void | Promise<void>;
}

/**
 * 手机上的编辑面板。
 *
 * 只提交**改过的字段** —— 和后端的局部更新语义对齐，没碰的字段不会被覆盖。
 * 有子项的父项金额由子项汇总，这里禁用输入并说明原因，避免用户白填一个值。
 */
export default function RecordEditDrawer({
  open,
  record,
  submitting = false,
  onClose,
  onSave,
  onDelete
}: RecordEditDrawerProps) {
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [period, setPeriod] = useState<Dayjs | null>(null);

  useEffect(() => {
    if (!record) return;
    setName(record.name);
    setDetail(record.detail ?? '');
    setAmount(record.amount ?? 0);
    setPeriod(record.period ? dayjs(record.period) : null);
  }, [record]);

  if (!record) return null;

  const isParent = record.hasChildren;

  const submit = () => {
    const patch: RecordPatch = {};
    if (name.trim() !== record.name) patch.name = name.trim();
    if (detail !== (record.detail ?? '')) patch.detail = detail;
    if (!isParent && amount !== (record.amount ?? 0)) patch.amount = amount;
    const nextPeriod = period ? period.format('YYYY-MM') : undefined;
    if (nextPeriod && nextPeriod !== record.period) patch.period = nextPeriod;

    // 什么都没改就直接关掉，别发一次空请求
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    void onSave(record.id, patch);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      height="auto"
      title={record.path || record.name}
      className="edit-drawer"
      footer={
        <div className="drawer-footer">
          <Popconfirm
            title={isParent ? '删除该项及其全部子项？' : '删除这条记录？'}
            description={
              isParent ? `会同时删除 ${record.children.length} 个子项，不可恢复。` : undefined
            }
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => void onDelete(record)}
          >
            <Button danger icon={<DeleteOutlined />} disabled={submitting}>
              删除
            </Button>
          </Popconfirm>
          <Button type="primary" className="btn-gradient" loading={submitting} onClick={submit}>
            保存
          </Button>
        </div>
      }
    >
      <div className="drawer-form">
        <div className="quick-field">
          <label>支出名称</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：交通 / 吃" />
        </div>

        <div className="quick-field">
          <label>支出详细</label>
          <Input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="选填，如：单车80+公交60"
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
            disabled={isParent}
            value={isParent ? (record.subtotal ?? 0) : amount}
            onChange={(n) => setAmount(n)}
          />
          {isParent && <span className="field-hint">金额由 {record.children.length} 个子项自动汇总，不用手工填</span>}
        </div>

        <div className="quick-field">
          <label>归属月份</label>
          <MonthPicker
            style={{ width: '100%' }}
            allowClear={false}
            format="YYYY-MM"
            value={period}
            onChange={(d) => setPeriod(d)}
          />
          {isParent && <span className="field-hint">改月份会把全部子项一起带过去</span>}
        </div>
      </div>
    </Drawer>
  );
}
