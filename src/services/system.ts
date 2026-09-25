// ============================================================
// system - 系统级亮度 / 音量
// 原生（iOS）走 Capacitor 插件，直接读写系统亮度与系统音量；
// Web 端退化为「CSS 滤镜 + audio.volume」，接口保持一致。
// ============================================================

import { Capacitor } from '@capacitor/core';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';
import { VolumeControl } from 'capacitor-volume-controller';
import { usePlayer } from '@/stores/player';
import { getSetting, setSetting } from '@/services/storage';

/** 是否运行在原生容器（iOS/Android），Web 为 false */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function clamp(v: number, min: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(min, v));
}

/** 读取亮度：原生取系统亮度，Web 取本地设置 */
export async function readBrightness(): Promise<number> {
  if (isNative()) {
    try {
      const { brightness } = await ScreenBrightness.getBrightness();
      return clamp(brightness, 0.05);
    } catch {
      /* 插件不可用时回退到本地设置 */
    }
  }
  const saved = await getSetting<number>('brightness');
  return typeof saved === 'number' && saved > 0 ? clamp(saved, 0.3) : 1;
}

/** 设置亮度：原生直接改系统背光，Web 改 CSS 滤镜 */
export async function setBrightnessLevel(v: number): Promise<number> {
  const val = clamp(v, isNative() ? 0.05 : 0.3);
  await setSetting('brightness', val).catch(() => {});
  if (isNative()) {
    try {
      await ScreenBrightness.setBrightness({ brightness: val });
    } catch {
      /* 忽略：失败时至少保证 UI 数值同步 */
    }
  }
  return val;
}

/** 读取音量：原生取系统音量，Web 取播放器音量 */
export async function readVolume(): Promise<number> {
  if (isNative()) {
    try {
      const { value } = await VolumeControl.getVolumeLevel();
      return clamp(value, 0);
    } catch {
      /* 回退 */
    }
  }
  return usePlayer.getState().volume;
}

/** 设置音量：原生改系统音量，Web 改 audio 元素音量；播放器状态始终同步 */
export async function setVolumeLevel(v: number): Promise<number> {
  const val = clamp(v, 0);
  if (isNative()) {
    try {
      await VolumeControl.setVolumeLevel({ value: val });
    } catch {
      /* 忽略：iOS 不允许直接改系统音量，交给下面的增益兜底 */
    }
  }
  // iOS 上 <audio>.volume 不可写、系统音量也改不了，
  // 走 Web Audio 增益才能真正改变输出音量
  usePlayer.getState().setVolumeWithGain(val);
  return val;
}

/**
 * 监听系统音量变化（硬件按键 / 系统面板 / 自身调用），返回取消函数。
 * Web 端为空实现。
 */
export async function watchVolume(cb: (v: number) => void): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const handle = await VolumeControl.addListener('volumeLevelChanged', (e) => {
      if (typeof e.value === 'number') cb(clamp(e.value, 0));
    });
    await VolumeControl.watchVolume({ disableSystemVolumeHandler: true });
    return () => {
      Promise.resolve(handle.remove()).catch(() => {});
      VolumeControl.clearWatch().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
