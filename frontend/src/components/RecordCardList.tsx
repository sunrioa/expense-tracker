import { Empty, Spin, Tag } from 'antd';
import { DownOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { RecordNode } from '@ledger/shared';
import { yuan } from '../utils/format';

export interface RecordCardListProps {
  tree: RecordNode[];
  /** 收起状态的父项 id */
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  /** 点任意一行 → 打开编辑抽屉 */
  onPick: (record: RecordNode) => void;
  onAddChild: (parent: RecordNode) => void;
  loading?: boolean;
  emptyText?: ReactNode;
}

/**
 * 手机上的明细列表。
 *
 * 不用表格：六列可编辑表格是桌面的交互模式，塞进 390px 只能横滑 + 误触。
 * 这里一个顶级条目一张卡，金额右对齐到同一条基准线，点任意一行打开编辑抽屉 ——
 * 手机上「点开再改」比「就地编辑」可靠得多。
 */
export default function RecordCardList({
  tree,
  collapsed,
  onToggle,
  onPick,
  onAddChild,
  loading = false,
  emptyText = '还没有任何记录'
}: RecordCardListProps) {
  if (!loading && tree.length === 0) {
    return <Empty description={emptyText} />;
  }

  return (
    <Spin spinning={loading}>
      <div className="rec-list">
        {tree.map((node) => {
          const hasChildren = node.children.length > 0;
          const expanded = hasChildren && !collapsed.has(node.id);
          // 父项没填详细时，用子项名称拼一句摘要，别留空行
          const summary =
            node.detail || (hasChildren ? node.children.map((c) => c.name).join(' · ') : '');

          return (
            <div className="rec-card" key={node.id}>
              <button type="button" className="rec-row rec-row-top" onClick={() => onPick(node)}>
                <span className="rec-main">
                  <span className="rec-name">{node.name}</span>
                  {hasChildren && (
                    <Tag className="rec-count" bordered={false}>
                      {node.children.length} 项
                    </Tag>
                  )}
                  {summary && <span className="rec-sub">{summary}</span>}
                </span>
                <span className="rec-amount">{yuan(node.subtotal ?? 0)}</span>
              </button>

              {hasChildren && (
                <button
                  type="button"
                  className={`rec-expand${expanded ? ' is-open' : ''}`}
                  onClick={() => onToggle(node.id)}
                >
                  {expanded ? <DownOutlined /> : <RightOutlined />}
                  {expanded ? '收起子项' : `展开 ${node.children.length} 个子项`}
                </button>
              )}

              {expanded &&
                node.children.map((child) => (
                  <button
                    type="button"
                    className="rec-row rec-row-child"
                    key={child.id}
                    onClick={() => onPick(child)}
                  >
                    <span className="rec-main">
                      <span className="rec-name">{child.name}</span>
                      {child.detail && <span className="rec-sub">{child.detail}</span>}
                    </span>
                    <span className="rec-amount">{yuan(child.amount ?? 0)}</span>
                  </button>
                ))}

              {/* 只有顶级条目能加子项：子项下不能再挂子项 */}
              {expanded && (
                <button type="button" className="rec-add" onClick={() => onAddChild(node)}>
                  <PlusOutlined />
                  添加子项
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Spin>
  );
}
