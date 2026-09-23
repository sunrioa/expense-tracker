import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import { useColorScheme } from '../hooks/useColorScheme';
import { antdTheme } from './antdTheme';

/**
 * 把「当前是浅色还是深色」接到 antd 上。
 *
 * 必须是个组件而不是 main.tsx 里的一段配置 —— 系统主题变化时要触发重渲染。
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme(scheme)}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
