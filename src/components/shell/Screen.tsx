// ============================================================
// Screen - iPod 圆角显示屏容器
// - 顶部状态栏：标题 + 系统时间（真实时间，不是倒计时）
// - 内容区：当前视图（由 App.tsx 根据 Screen 渲染）
// ============================================================

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NowPlayingBar } from './NowPlayingBar';

interface Props {
  title: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function Screen({ title, rightSlot, children }: Props) {
  const [now, setNow] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <filter id="metal-wave" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.08"
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="18"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <div data-screen-bezel className="screen-bezel w-full" style={{ aspectRatio: '7 / 9' }}>
        <div className="screen-surface w-full h-full flex flex-col">
          <div className="screen-statusbar">
            <span className="title">{title}</span>
            <span className="icons">
              <span style={{ marginRight: 6 }}>{now}</span>
              <Battery />
            </span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {children}
            <NowPlayingBar />
          </div>
          {rightSlot && <div className="px-3 pb-2">{rightSlot}</div>}
        </div>
      </div>
    </>
  );
}

function Battery() {
  return (
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="18"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeOpacity="0.6"
      />
      <rect x="19.5" y="3.5" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.6" />
      <rect x="2" y="2" width="14" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}