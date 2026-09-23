import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 切换页面时淡入。外层挂 key={pathname}，路由一变就重建子树、CSS 动画重放。
 * 数据都在全局状态里，重建页面不会重新请求。
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="page-transition" key={pathname}>
      {children}
    </div>
  );
}
