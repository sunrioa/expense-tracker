import { theme } from 'antd';
import type { ThemeConfig } from 'antd';
import type { ColorScheme } from '../hooks/useColorScheme';

/**
 * antd 主题：极简的「墨色 + 暖灰」。
 *
 * 界面本身几乎不用彩色 —— 主按钮是墨色（深色模式下反过来是近白），
 * 彩色只留给数据：分类色、选中月份的柱子。取值和 styles.css 的令牌是同一套，
 * 两边必须一致，否则弹层和页面会是两种灰。
 */

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const LIGHT = {
  ink: '#111111',
  text2: '#52514e',
  text3: '#6b6a66',
  text4: '#a3a29c',
  bg: '#f6f6f4',
  surface: '#ffffff',
  elevated: '#ffffff',
  border: '#e4e3de',
  border2: '#ecebe7',
  hoverBorder: '#b9b8b1',
  focusRing: 'rgb(17 17 17 / 0.08)',
  track: '#efeeea',
  trackOn: '#ffffff',
  error: '#d03b3b',
  success: '#15803d',
  warning: '#b45309',
  info: '#2a78d6',
  mask: 'rgb(17 17 17 / 0.28)'
} as const;

const DARK = {
  ink: '#f2f2f0',
  text2: '#c3c2b7',
  text3: '#8f8e88',
  text4: '#5f5e59',
  bg: '#0d0d0c',
  surface: '#1a1a19',
  elevated: '#232321',
  border: '#34332f',
  border2: '#2a2a27',
  hoverBorder: '#55544f',
  focusRing: 'rgb(242 242 240 / 0.1)',
  track: '#262624',
  trackOn: '#3a3a37',
  error: '#e66767',
  success: '#4ade80',
  warning: '#fbbf24',
  info: '#3987e5',
  mask: 'rgb(0 0 0 / 0.6)'
} as const;

export function antdTheme(scheme: ColorScheme): ThemeConfig {
  const dark = scheme === 'dark';
  const c = dark ? DARK : LIGHT;

  const field = {
    activeBorderColor: c.ink,
    hoverBorderColor: c.hoverBorder,
    activeShadow: `0 0 0 3px ${c.focusRing}`
  };

  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: FONT,
      fontSize: 14,
      colorPrimary: c.ink,
      colorLink: c.ink,
      colorInfo: c.info,
      colorError: c.error,
      colorSuccess: c.success,
      colorWarning: c.warning,
      colorText: c.ink,
      colorTextSecondary: c.text2,
      colorTextTertiary: c.text3,
      colorTextQuaternary: c.text4,
      colorTextPlaceholder: c.text4,
      colorBorder: c.border,
      colorBorderSecondary: c.border2,
      colorBgLayout: c.bg,
      colorBgContainer: c.surface,
      colorBgElevated: c.elevated,
      colorBgMask: c.mask,
      // 深色模式的主色是近白，压在上面的字（主按钮、选中项）要反过来用墨色
      ...(dark ? { colorTextLightSolid: '#111111', colorBgBase: c.bg } : {}),
      borderRadius: 10,
      borderRadiusSM: 8,
      borderRadiusLG: 16,
      controlHeight: 38,
      controlHeightLG: 44,
      controlHeightSM: 28,
      boxShadowSecondary: dark
        ? '0 12px 32px -8px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.06)'
        : '0 12px 32px -12px rgb(17 17 17 / 0.18), 0 0 0 1px rgb(17 17 17 / 0.05)',
      motionDurationMid: '0.18s',
      motionDurationSlow: '0.24s'
    },
    components: {
      Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
      Input: field,
      InputNumber: field,
      Select: { ...field, optionSelectedBg: c.track, optionActiveBg: c.track },
      Segmented: { trackBg: c.track, itemSelectedBg: c.trackOn, itemSelectedColor: c.ink, itemColor: c.text2 },
      // 深色模式下提示框用浅底：上面的字统一走 colorTextLightSolid（已改成墨色）
      Tooltip: dark ? { colorBgSpotlight: '#f2f2f0' } : {},
      Dropdown: { paddingBlock: 8 },
      Modal: { contentBg: c.elevated, headerBg: c.elevated },
      Message: { contentBg: c.elevated }
    }
  };
}
