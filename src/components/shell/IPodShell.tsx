// ============================================================
// iPodShell - 整个设备外壳（屏幕 + Click Wheel）
// 自适应：横屏手机/桌面/竖屏手机 都按比例缩放
//
// 接收 transitioning=true 时，给屏幕加上 view-popping 类
// 让屏幕在 280ms 内 scale(0.85) + opacity 0 + blur 淡出
// ============================================================

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  wheel: ReactNode;
  transitioning?: boolean;
}

export function IPodShell({ children, wheel, transitioning }: Props) {
  return (
    <div className={`ipod-shell safe-top safe-bottom ${transitioning ? 'popping' : ''}`}>
      <div className="w-full flex flex-col items-center flex-1 min-h-0">
        {children}
      </div>
      <div className="w-[90%] shrink-0">{wheel}</div>
    </div>
  );
}