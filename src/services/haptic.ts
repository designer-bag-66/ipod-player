// ============================================================
// 触感反馈（强度可调：关 / 弱 / 中 / 强）
//
// - 原生（Capacitor）：走 Haptics 插件，档位映射到 Light / Medium / Heavy
// - 网页：走 Vibrate API（时长 = 基准 × 档位倍率）
//   注意 iOS Safari 不支持 Vibrate API，桌面浏览器也基本没有马达，
//   所以浏览器里 iPhone 上不会震 —— 这是平台限制，不是开关失灵。
// ============================================================

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { FEEDBACK_SCALE, usePrefs, type FeedbackLevel } from '@/stores/prefs';

/** 档位 → 原生震动强度 */
const IMPACT: Record<FeedbackLevel, ImpactStyle> = {
  off: ImpactStyle.Light,
  low: ImpactStyle.Light,
  mid: ImpactStyle.Medium,
  high: ImpactStyle.Heavy,
};

/** 网页端震动基准时长（ms），乘档位倍率后使用 */
const WEB_BASE_MS = 8;

/** 触发一次触感反馈；档位为「关」时静默返回 */
export async function haptic(): Promise<void> {
  const level = usePrefs.getState().haptics;
  const scale = FEEDBACK_SCALE[level];
  if (scale <= 0) return;

  if (!Capacitor.isNativePlatform()) {
    if ('vibrate' in navigator) navigator.vibrate(Math.round(WEB_BASE_MS * scale));
    return;
  }

  try {
    await Haptics.impact({ style: IMPACT[level] });
  } catch {
    /* ignore */
  }
}
