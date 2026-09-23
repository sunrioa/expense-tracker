import { theme } from 'antd';
import type { ThemeConfig } from 'antd';
import type { ColorScheme } from '../hooks/useColorScheme';

/**
 * antd 主题。
 *
 * 这里的取值和 styles.css 里的 token 是同一套色板 —— 两边必须一致，
 * 否则会出现「卡片是墨绿底、下拉菜单是中性灰底」这种割裂。
 * 深色模式下特意把 colorBgBase 设成带青绿的近黑，让 antd 自己生成的
 * 那一整套灰阶也跟着偏青绿，而不是纯中性灰。
 */

const LIGHT = {
  primary: '#0f766e',
  heading: '#134e4a',
  border: '#dbe9e4',
  borderSecondary: '#e3ece9',
  rowHover: '#f6faf8',
  tint: '#e6f2ef',
  tintText: '#115e59',
  error: '#be123c',
  warning: '#b45309',
  success: '#4d7c0f'
} as const;

const DARK = {
  primary: '#2dd4bf',
  heading: '#99f6e4',
  border: '#273a35',
  borderSecondary: '#1e2f2b',
  rowHover: '#162622',
  tint: '#16302c',
  tintText: '#5eead4',
  error: '#fb7185',
  warning: '#fbbf24',
  success: '#a3e635'
} as const;

export function antdTheme(scheme: ColorScheme): ThemeConfig {
  const dark = scheme === 'dark';
  const c = dark ? DARK : LIGHT;

  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: c.primary,
      colorInfo: c.primary,
      colorLink: c.primary,
      colorError: c.error,
      colorWarning: c.warning,
      colorSuccess: c.success,
      colorBorder: c.border,
      colorBorderSecondary: c.borderSecondary,
      colorTextHeading: c.heading,
      borderRadius: 9,
      fontSize: 14,
      // 深色模式：给 antd 一个带青绿的近黑做基底，它会据此生成整套灰阶
      ...(dark
        ? {
            colorBgBase: '#0a1513',
            colorBgContainer: '#101d1a',
            colorBgElevated: '#16241f',
            colorBgLayout: '#0a1513'
          }
        : {})
    },
    components: {
      Button: { primaryShadow: 'none' },
      Card: { paddingLG: 18 },
      Table: {
        headerBg: 'transparent',
        headerSplitColor: 'transparent',
        rowHoverBg: c.rowHover,
        borderColor: c.borderSecondary
      },
      Segmented: { itemSelectedBg: c.tint, itemSelectedColor: c.tintText },
      Tag: { defaultBg: c.tint, defaultColor: c.tintText }
    }
  };
}
