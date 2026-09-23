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
    <div className={`ipod-shell p-4 max-w-[420px] mx-auto safe-top safe-bottom ${transitioning ? 'popping' : ''}`}>
      <div className="flex flex-col items-center gap-4">
        {children}
        <div className="w-[90%] pb-2">{wheel}</div>
      </div>
    </div>
  );
}