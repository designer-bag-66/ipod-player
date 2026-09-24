// ============================================================
// Screen - iPod 圆角显示屏容器
// - 顶部状态栏：仅标题（居中显示）
// - 内容区：当前视图（由 App.tsx 根据 Screen 渲染）
// - 支持亮度调节（CSS filter）
// ============================================================

import type { ReactNode } from 'react';
import { NowPlayingBar } from './NowPlayingBar';

interface Props {
  title: string;
  rightSlot?: ReactNode;
  /** 屏幕亮度 0.3 ~ 1 */
  brightness?: number;
  /** 沉浸式视图（如正在播放）自带导航条，隐藏通用状态栏 */
  hideStatusbar?: boolean;
  children: ReactNode;
}

export function Screen({ title, rightSlot, brightness = 1, hideStatusbar, children }: Props) {
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
        <div
          className="screen-surface w-full h-full flex flex-col"
          style={brightness < 1 ? { filter: `brightness(${brightness})` } : undefined}
        >
          <div className="screen-statusbar" style={{ justifyContent: 'center', display: hideStatusbar ? 'none' : 'flex' }}>
            <span className="title">{title}</span>
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