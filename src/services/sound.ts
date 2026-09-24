// ============================================================
// 交互音效：用 WebAudio 现场合成「咔哒」声，无需音频资源
// - scroll：滚轮每走一格（高频短促，接近 iPod 齿轮声）
// - select：按下中央确认键
// - back：MENU 返回
//
// 音量 = TONES 里的基准 gain × 档位倍率（关 / 弱 / 中 / 强）
// iOS 需在首次用户手势中解锁 AudioContext，故提供 unlockSound()
// ============================================================

import { FEEDBACK_SCALE, usePrefs } from '@/stores/prefs';

export type TickKind = 'scroll' | 'select' | 'back';

interface Tone {
  freq: number;
  dur: number;
  gain: number;
  type: OscillatorType;
}

// 基准音量按「中」档定：scroll 以前只有 12ms / 0.045，手机上几乎听不见，已调响调长
const TONES: Record<TickKind, Tone> = {
  scroll: { freq: 1900, dur: 0.028, gain: 0.1, type: 'square' },
  select: { freq: 1180, dur: 0.05, gain: 0.12, type: 'triangle' },
  back: { freq: 640, dur: 0.055, gain: 0.11, type: 'triangle' },
};

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 在首次用户手势里调用，解锁 iOS WKWebView 的 WebAudio */
export function unlockSound(): void {
  audioCtx();
}

/** 播放一次交互音效；档位为「关」时静默返回 */
export function playTick(kind: TickKind = 'select'): void {
  const scale = FEEDBACK_SCALE[usePrefs.getState().soundFeedback];
  if (scale <= 0) return;
  const c = audioCtx();
  if (!c) return;

  const t = TONES[kind];
  const now = c.currentTime;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = t.type;
    osc.frequency.setValueAtTime(t.freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(t.gain * scale, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + t.dur + 0.02);
  } catch {
    /* ignore */
  }
}
