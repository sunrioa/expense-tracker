import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 路由切换时重放入场动画。
 *
 * 没有引第三方动画库：外层挂一个 key={pathname}，路由一变 React 就重建这棵
 * 子树，CSS 的 animation 随之重新播放，页面内部的分块错峰由 .page > * 的
 * nth-child 延迟负责。
 *
 * 代价是切页时组件状态不保留 —— 这两个页面切回来本来也会重新拉数据，
 * 没有额外损失。
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="page-transition" key={pathname}>
      {children}
    </div>
  );
}
