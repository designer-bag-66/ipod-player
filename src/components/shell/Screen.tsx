// ============================================================
// Screen - iPod 圆角显示屏容器
// - 顶部状态栏：标题（居中 / 两端），时钟可选（设计源 statusbarStyle / showClock）
// - 屏幕背景：渐变 / 纯色 / 波纹金属（设计源 bgMode → data-bg）
// - 支持亮度调节（CSS filter）
//
// 尺寸、圆角、比例、配色全部来自 src/design（CSS 变量），此处不写死
// ============================================================

import type { ReactNode } from 'react';
import { NowPlayingBar } from './NowPlayingBar';
import { useDesign } from '@/design';

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
  const bgMode = useDesign((s) => s.doc.tokens.bgMode);
  const statusbarStyle = useDesign((s) => s.doc.layout.statusbarStyle);
  const showClock = useDesign((s) => s.doc.layout.showClock);

  return (
    <>
      {/* 波纹金属背景用的 SVG 位移滤镜 */}
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
      <div data-screen-bezel className="screen-bezel w-full">
        <div
          className="screen-surface w-full h-full flex flex-col"
          data-bg={bgMode}
          style={brightness < 1 ? { filter: `brightness(${brightness})` } : undefined}
        >
          <div
            className="screen-statusbar"
            style={{
              display: hideStatusbar ? 'none' : 'flex',
              justifyContent: statusbarStyle === 'center' ? 'center' : 'space-between',
            }}
          >
            <span className="title">{title}</span>
            {statusbarStyle !== 'center' && (
              <span className="icons" style={{ display: showClock ? 'flex' : 'none' }}>
                <span>{clockText()}</span>
                <span>🔋</span>
              </span>
            )}
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

/** 状态栏时钟：显示本地 时:分 */
function clockText(): string {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
