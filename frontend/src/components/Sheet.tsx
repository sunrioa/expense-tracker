import { Drawer, Modal } from 'antd';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useIsNarrow } from '../hooks/useMediaQuery';
import Icon from './Icon';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** 读屏用的标题 */
  label: string;
  width?: number;
  children: ReactNode;
}

/**
 * 面板容器：宽屏是居中的对话框，手机是从底部滑上来的抽屉 —— 拇指够得着，
 * 也不会像居中弹窗那样被键盘顶出屏幕。
 *
 * 标题、内容、底部按钮由调用方用 SheetHead / 普通 div 自己排，
 * 两种形态共用同一份结构和样式。
 *
 * 打开时聚焦内容里带 data-autofocus 的输入框。不能只靠 autoFocus：
 * 对话框首次挂载时外层还是 display:none，聚焦会落空，等打开动画结束
 * antd 又会把焦点收回到对话框容器上 —— 所以在动画结束之后再聚焦一次。
 */
export default function Sheet({ open, onClose, label, width = 460, children }: SheetProps) {
  const narrow = useIsNarrow();
  const inner = useRef<HTMLDivElement>(null);
  const afterOpenChange = (visible: boolean) => {
    if (!visible) return;
    const target = inner.current?.querySelector<HTMLElement>('[data-autofocus]');
    if (target && !target.contains(document.activeElement)) target.focus();
  };
  const body = (
    <div ref={inner} className="sheet-inner">
      {children}
    </div>
  );

  if (narrow) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        placement="bottom"
        height="auto"
        closable={false}
        title={null}
        footer={null}
        autoFocus={false}
        destroyOnHidden
        rootClassName="sheet sheet-bottom"
        aria-label={label}
        afterOpenChange={afterOpenChange}
      >
        <div className="sheet-grip" aria-hidden="true" />
        {body}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      title={null}
      width={width}
      destroyOnHidden
      rootClassName="sheet sheet-modal"
      style={{ top: '10vh' }}
      aria-label={label}
      afterOpenChange={afterOpenChange}
    >
      {body}
    </Modal>
  );
}

export function SheetHead({ title, extra, onClose }: { title: ReactNode; extra?: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-head">
      <h2 className="sheet-title">{title}</h2>
      {extra}
      <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="关闭">
        <Icon name="close" />
      </button>
    </div>
  );
}
