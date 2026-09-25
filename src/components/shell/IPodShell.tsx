// ============================================================
// iPodShell - 整个设备外壳（屏幕 + Click Wheel）
// 自适应：横屏手机/桌面/竖屏手机 都按比例缩放
//
// 接收 transitioning=true 时，给屏幕加上 view-popping 类
// 让屏幕在 280ms 内 scale(0.85) + opacity 0 + blur 淡出
//
// 「显示框的宽/高/位置、滚轮的大小/位置」由「设置 → 布局调整」自由调节：
// 存成 prefs 的绝对值，这里以行内 CSS 变量覆盖到壳上（优先于设计源 :root）。
// ============================================================

import type { CSSProperties, ReactNode } from 'react';
import { usePrefs } from '@/stores/prefs';

interface Props {
  children: ReactNode;
  wheel: ReactNode;
  transitioning?: boolean;
}

export function IPodShell({ children, wheel, transitioning }: Props) {
  const screenW = usePrefs((s) => s.screenW);
  const screenH = usePrefs((s) => s.screenH);
  const screenDy = usePrefs((s) => s.screenDy);
  const wheelSize = usePrefs((s) => s.wheelSize);
  const wheelDy = usePrefs((s) => s.wheelDy);

  const shellStyle = {
    '--screen-w': `${screenW}%`,
    '--screen-h': `${screenH}px`,
    '--screen-dy': `${screenDy}px`,
    '--wheel-size': `${wheelSize}%`,
    '--wheel-dy': `${wheelDy}px`,
  } as CSSProperties;

  return (
    <div
      className={`ipod-shell safe-top safe-bottom ${transitioning ? 'popping' : ''}`}
      style={shellStyle}
    >
      <div className="w-full flex flex-col items-center flex-1 min-h-0">
        {children}
      </div>
      <div
        className="shrink-0"
        style={{
          width: 'min(var(--wheel-size, 90%), calc(var(--wheel-max, 46) * 1vh))',
          marginBottom: 'var(--wheel-mb, 0px)',
          transform: 'translateY(var(--wheel-dy, 0px))',
        }}
      >
        {wheel}
      </div>
    </div>
  );
}
