import { Tooltip } from 'antd';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { currentPeriod } from '@ledger/shared';
import { LedgerProvider, useLedger } from './state/ledger';
import { useViewMonth } from './hooks/useViewMonth';
import { useHotkeys } from './hooks/useHotkeys';
import { cls } from './utils/cls';
import PageTransition from './components/PageTransition';
import Icon from './components/Icon';
import LedgerPage from './pages/LedgerPage';
import StatsPage from './pages/StatsPage';

/** 标志：一个墨色圆角方块，里面三根小柱子 */
function Logo() {
  return (
    <svg className="logo" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="7" className="logo-bg" />
      <path d="M7.5 16.5v-3M12 16.5v-9M16.5 16.5v-5.5" className="logo-bars" />
    </svg>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) => cls('nav-link', isActive && 'is-active');

function Shell() {
  const { openAdd, sheetOpen } = useLedger();
  const { pathname } = useLocation();
  const [viewMonth] = useViewMonth();

  // 在账本页记账，默认记到正在看的那个月；在别处就记到本月
  const add = () => openAdd({ period: pathname === '/' ? viewMonth : currentPeriod() });
  useHotkeys({ n: add }, !sheetOpen);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="记账本首页">
            <Logo />
            <span>记账本</span>
          </NavLink>
          <nav className="nav" aria-label="主导航">
            <NavLink to="/" end className={navClass}>
              账本
            </NavLink>
            <NavLink to="/stats" className={navClass}>
              统计
            </NavLink>
          </nav>
          <Tooltip title="快捷键 N" mouseEnterDelay={0.4}>
            <button type="button" className="btn btn-primary" onClick={add}>
              <Icon name="plus" size={16} strokeWidth={2.2} />
              记一笔
            </button>
          </Tooltip>
        </div>
      </header>

      <main className="main">
        <PageTransition>
          <Routes>
            <Route path="/" element={<LedgerPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransition>
      </main>

      {/* 手机：导航和「记一笔」都放在拇指够得着的底部 */}
      <nav className="tabbar" aria-label="主导航">
        <NavLink to="/" end className={({ isActive }) => cls('tab', isActive && 'is-active')}>
          <Icon name="ledger" size={22} />
          <span>账本</span>
        </NavLink>
        <button type="button" className="tab-add" aria-label="记一笔" onClick={add}>
          <Icon name="plus" size={24} strokeWidth={2.2} />
        </button>
        <NavLink to="/stats" className={({ isActive }) => cls('tab', isActive && 'is-active')}>
          <Icon name="chart" size={22} />
          <span>统计</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LedgerProvider>
        <Shell />
      </LedgerProvider>
    </BrowserRouter>
  );
}
