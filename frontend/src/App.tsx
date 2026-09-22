import { Layout, Menu, Typography } from 'antd';
import { AccountBookOutlined, BarChartOutlined } from '@ant-design/icons';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PageTransition from './components/PageTransition';
import LedgerPage from './pages/LedgerPage';
import StatsPage from './pages/StatsPage';

const { Header, Content, Footer } = Layout;

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const selected = location.pathname.startsWith('/stats') ? 'stats' : 'ledger';

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="brand">
          <AccountBookOutlined className="brand-icon" />
          <span className="brand-title">记账本</span>
          <Typography.Text className="brand-sub">Expense Tracker</Typography.Text>
        </div>
        <Menu
          className="app-menu"
          mode="horizontal"
          selectedKeys={[selected]}
          onClick={({ key }) => navigate(key === 'stats' ? '/stats' : '/')}
          items={[
            { key: 'ledger', icon: <AccountBookOutlined />, label: '记账' },
            { key: 'stats', icon: <BarChartOutlined />, label: '统计' }
          ]}
        />
      </Header>

      <Content className="app-content">
        <PageTransition>
          <Routes>
            <Route path="/" element={<LedgerPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransition>
      </Content>

      <Footer className="app-footer">
        记账本 · Spring Boot + React + MySQL
      </Footer>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
