// ============================================================
// ClickWheel - 纯视觉轮盘：无独立按钮边框，统一处理 pointer 事件
//
// 行为：
// - 圆环区域滑动：顺时针/逆时针累积角度 → 菜单步进（轮盘视觉静止）
// - 中央黑色圆形：点击确认（SELECT）
// - 圆环四象限轻触：MENU / 上一首 / 下一首 / 播放暂停
// - 滑动与点击区分：移动超过阈值视为滑动，抬起时不触发按键
// - 按下反馈：轻微变暗 + 短促震动，无旋转/发光/呼吸动画
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { angleFromCenter, createAccumulator, feedWheel, normalizeAngle } from '@/utils/angle';
import { haptic } from '@/services/haptic';
import { playTick, unlockSound } from '@/services/sound';

interface Props {
  onSelect: () => void;
  onMenu: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onWheel: (delta: number) => void;
  /** 长按中央确认键（600ms）触发 */
  onLongPress?: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
}

const STEP_DEG = 20; // 文档 4.3：18~22° 推荐 20°
const CENTER_RATIO = 0.42;
const OUTER_PAD_RATIO = 1; // 整个圆盘区域都响应（修复边缘播放/暂停键失效）
const TAP_ANGLE_HALF = Math.PI / 6; // 每个按键占 60° 扇形
const SWIPE_ANGLE_THRESHOLD = 0.35; // 约 20° 视为滑动，提高切歌按键命中率
const LONG_PRESS_MS = 600;
const LONG_PRESS_MOVE_PX = 14;

/** 根据角度判断落在四向按键的哪个象限（0 点在 12 点钟方向，顺时针为正） */
function buttonAtAngle(angle: number): 'menu' | 'prev' | 'next' | 'play' | null {
  const a = normalizeAngle(angle);
  if (Math.abs(a) <= TAP_ANGLE_HALF) return 'menu';
  if (Math.abs(a - Math.PI / 2) <= TAP_ANGLE_HALF) return 'next';
  if (Math.abs(a + Math.PI / 2) <= TAP_ANGLE_HALF) return 'prev';
  if (Math.abs(Math.abs(a) - Math.PI) <= TAP_ANGLE_HALF) return 'play';
  return null;
}

export function ClickWheel({
  onSelect,
  onMenu,
  onPrev,
  onNext,
  onPlayPause,
  onWheel,
  onLongPress,
  isPlaying,
  disabled,
}: Props) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const accRef = useRef(createAccumulator(STEP_DEG));
  const prevAngleRef = useRef<number | null>(null);
  const startAngleRef = useRef<number | null>(null);
  const touchingRef = useRef(false);
  const startTargetRef = useRef<'center' | 'ring' | null>(null);
  const movedRef = useRef(false);
  const downTimeRef = useRef(0);
  const stepCountRef = useRef(0);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longFiredRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const [pressed, setPressed] = useState<'wheel' | 'center' | 'menu' | 'prev' | 'next' | 'play' | null>(null);

  const resetPress = useCallback(() => {
    setPressed(null);
  }, []);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;

    function getCenter() {
      const rect = el!.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, radius: rect.width / 2 };
    }

    function onPointerDown(e: PointerEvent) {
      if (disabled) return;
      // 首次手势里解锁 WebAudio，之后才听得到选择音效
      unlockSound();
      const { cx, cy, radius } = getCenter();
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const innerRadius = radius * CENTER_RATIO;

      movedRef.current = false;
      startAngleRef.current = null;
      downTimeRef.current = Date.now();
      stepCountRef.current = 0;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      longFiredRef.current = false;
      clearLongPress();

      // 中央确认键
      if (dist < innerRadius) {
        startTargetRef.current = 'center';
        setPressed('center');
        // 长按进入播放界面
        if (onLongPress) {
          longPressTimerRef.current = window.setTimeout(() => {
            longFiredRef.current = true;
            setPressed(null);
            onLongPress();
            haptic();
          }, LONG_PRESS_MS);
        }
        e.preventDefault();
        return;
      }

      // 红色圆环区（整个圆盘）
      if (dist < radius * OUTER_PAD_RATIO) {
        touchingRef.current = true;
        const angle = angleFromCenter(e.clientX, e.clientY, cx, cy);
        prevAngleRef.current = angle;
        startAngleRef.current = angle;
        startTargetRef.current = 'ring';
        setPressed('wheel');
        accRef.current.accumulator = 0;
        e.preventDefault();
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!startTargetRef.current) return;

      const { cx, cy } = getCenter();

      // 中央键：移动超过阈值取消长按
      if (startTargetRef.current === 'center') {
        const sp = startPosRef.current;
        if (sp && Math.hypot(e.clientX - sp.x, e.clientY - sp.y) > LONG_PRESS_MOVE_PX) {
          clearLongPress();
        }
        return;
      }

      if (touchingRef.current && prevAngleRef.current !== null) {
        const cur = angleFromCenter(e.clientX, e.clientY, cx, cy);
        const delta = cur - prevAngleRef.current;
        const normalized = Math.atan2(Math.sin(delta), Math.cos(delta));
        prevAngleRef.current = cur;

        const steps = feedWheel(accRef.current, normalized);
        if (steps !== 0) {
          onWheel(steps);
          haptic();
          playTick('scroll');
          movedRef.current = true;
          stepCountRef.current += Math.abs(steps);
        }

        // 从起始角度移动超过阈值也判定为滑动，抬起时不触发按键
        if (startAngleRef.current !== null) {
          const totalDelta = Math.abs(normalizeAngle(cur - startAngleRef.current));
          if (totalDelta > SWIPE_ANGLE_THRESHOLD) {
            movedRef.current = true;
          }
        }
      }
      e.preventDefault();
    }

    function onPointerUp(e: PointerEvent) {
      if (!startTargetRef.current) return;
      clearLongPress();

      // 快速轻点判定：即使手指有轻微抖动（触发了 1 步滚轮），仍视为按键
      const duration = Date.now() - downTimeRef.current;
      const isTap =
        stepCountRef.current === 0 ||
        (duration < 350 && stepCountRef.current <= 1);

      if (isTap) {
        if (startTargetRef.current === 'center') {
          if (!longFiredRef.current) {
            onSelect();
            haptic();
            playTick('select');
          }
        } else if (startTargetRef.current === 'ring') {
          // 用按下时的角度判断按键，避免抬起时手指滑出扇形区导致失效
          const angle = startAngleRef.current ?? (() => {
            const { cx, cy } = getCenter();
            return angleFromCenter(e.clientX, e.clientY, cx, cy);
          })();
          const btn = buttonAtAngle(angle);
          if (btn) {
            setPressed(btn);
            switch (btn) {
              case 'menu':
                onMenu();
                break;
              case 'prev':
                onPrev();
                break;
              case 'next':
                onNext();
                break;
              case 'play':
                onPlayPause();
                break;
            }
            haptic();
            playTick(btn === 'menu' ? 'back' : 'select');
          }
        }
      }

      e.preventDefault();
      touchingRef.current = false;
      prevAngleRef.current = null;
      startAngleRef.current = null;
      startTargetRef.current = null;
      movedRef.current = false;
      startPosRef.current = null;
      // 短暂保留按下视觉后清除
      setTimeout(resetPress, 90);
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
    };
  }, [disabled, onMenu, onNext, onPlayPause, onPrev, onSelect, onWheel, onLongPress, resetPress, clearLongPress]);

  return (
    <div className="relative w-full select-none">
      <div
        ref={wheelRef}
        className={`wheel ${pressed === 'wheel' ? 'pressed' : ''}`}
        role="application"
        aria-label="iPod Click Wheel"
      >
        <div className={`wheel-center ${pressed === 'center' ? 'pressed' : ''}`} aria-label="SELECT 确认" />

        <div className={`wheel-label menu ${pressed === 'menu' ? 'pressed' : ''}`} aria-hidden>
          MENU
        </div>

        <div className={`wheel-label prev ${pressed === 'prev' ? 'pressed' : ''}`} aria-hidden>
          <IconDoubleLeft />
        </div>

        <div className={`wheel-label next ${pressed === 'next' ? 'pressed' : ''}`} aria-hidden>
          <IconDoubleRight />
        </div>

        <div className={`wheel-label play ${pressed === 'play' ? 'pressed' : ''}`} aria-hidden>
          {isPlaying ? <IconPause /> : <IconPlay />}
        </div>
      </div>
    </div>
  );
}

function IconDoubleLeft() {
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="14,3 4,10 14,17" />
      <polyline points="28,3 18,10 28,17" />
    </svg>
  );
}

function IconDoubleRight() {
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4,3 14,10 4,17" />
      <polyline points="18,3 28,10 18,17" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4,3 16,11 4,19 4,3" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor" aria-hidden>
      <rect x="2" y="2" width="5" height="16" rx="2.5" />
      <rect x="11" y="2" width="5" height="16" rx="2.5" />
    </svg>
  );
}
