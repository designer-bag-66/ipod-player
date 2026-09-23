// ============================================================
// NavTransition - 进入/退出子菜单的过渡覆盖层
//
// 只在屏幕显示框内做动画：
// - push：从图标矩形放大到屏幕边框矩形
// - pop：  从屏幕边框矩形缩小到图标矩形
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type NavAnimState =
  | { kind: 'push'; iconRect: DOMRect; screenRect: DOMRect }
  | { kind: 'pop'; iconRect: DOMRect; screenRect: DOMRect }
  | null;

interface Props {
  state: NavAnimState;
  duration?: number;
  onComplete?: () => void;
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function NavTransition({ state, duration = 280, onComplete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const stateRef = useRef<NavAnimState>(null);

  useLayoutEffect(() => {
    if (!state) {
      stateRef.current = null;
      setExpanded(false);
      return;
    }
    stateRef.current = state;
    setExpanded(false);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setExpanded(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [state]);

  useEffect(() => {
    if (!state || !expanded) return;
    const id = setTimeout(() => onComplete?.(), duration + 30);
    return () => clearTimeout(id);
  }, [expanded, state, duration, onComplete]);

  if (!state) return null;

  const { iconRect, screenRect, kind } = state;
  const isPush = kind === 'push';

  const start = isPush ? rectStyle(iconRect) : rectStyle(screenRect);
  const end = isPush ? rectStyle(screenRect) : rectStyle(iconRect);
  const style = expanded ? end : start;

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        background: 'rgba(220, 222, 230, 0.96)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        ...style,
        transition: `left ${duration}ms ${EASE}, top ${duration}ms ${EASE}, width ${duration}ms ${EASE}, height ${duration}ms ${EASE}, border-radius ${duration}ms ${EASE}, opacity ${Math.round(
          duration * 0.8,
        )}ms ${EASE}`,
        pointerEvents: 'none',
      }}
    />
  );
}

function rectStyle(r: DOMRect) {
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    borderRadius: Math.min(r.width, r.height) * 0.12,
    opacity: 1,
  };
}
