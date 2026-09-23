// ============================================================
// HomeView - 主页菜单（文档 4.4）
// Music / Now Playing / Search / Settings
// ============================================================

import { useEffect, useMemo } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { formatTime } from '@/components/ui/ProgressBar';

interface IconItem {
  label: string;
  icon: string;
  screen: { name: string } & Record<string, string>;
}

const ICONS: IconItem[] = [
  { label: '音乐资料', icon: '🎵', screen: { name: 'music.songs' } },
  { label: '歌手', icon: '🎤', screen: { name: 'music.artists' } },
  { label: '专辑', icon: '📀', screen: { name: 'music.albums' } },
  { label: '我喜欢的', icon: '♥', screen: { name: 'music.favorites' } },
  { label: '搜索', icon: '🔍', screen: { name: 'search' } },
  { label: '设置', icon: '⚙️', screen: { name: 'settings' } },
];

export function HomeView() {
  const tracks = useLibrary((s) => s.tracks);
  const currentTrack = usePlayer((s) => s.currentTrack);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = currentTrack?.duration ?? 0;
  const status = usePlayer((s) => s.status);
  const setItems = useNavigation((s) => s.setItems);
  const setIndex = useNavigation((s) => s.setIndex);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const homeIndex = useNavigation((s) => s.homeIndex);
  const setHomeIndex = useNavigation((s) => s.setHomeIndex);
  const push = useNavigation((s) => s.push);

  useEffect(() => {
    // 把图标作为导航 items 注册，使轮盘滑动可以改变 selectedIndex
    setItems(
      ICONS.map((icon) => ({
        kind: 'submenu' as const,
        label: icon.label,
        meta: '',
      })),
    );
  }, [setItems]);

  // 进入主页后，恢复保存的图标选中位置
  useEffect(() => {
    if (homeIndex > 0) setIndex(homeIndex);
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滚轮在主页上滚动时，把当前位置同步到 homeIndex
  useEffect(() => {
    setHomeIndex(selectedIndex);
  }, [selectedIndex, setHomeIndex]);

  const pct = useMemo(() => (duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0), [elapsed, duration]);

  return (
    <div className="h-full flex flex-col z-10 relative">
      <div className="text-center mt-1 mb-2 z-10">
        <h1
          className="text-[15px] font-extrabold tracking-wide"
          style={{ color: 'var(--screen-text-primary)' }}
        >
          音乐资料
        </h1>
        <div
          className="text-[9px] mt-0.5 font-semibold"
          style={{ color: 'var(--screen-text-muted)' }}
        >
          Music Library
        </div>
      </div>

      <div className="icon-grid flex-1">
        {ICONS.map((item, i) => (
          <div
            key={item.label}
            data-home-icon-index={i}
            className={`icon-cell ${i === selectedIndex ? 'selected' : ''}`}
            onClick={() => push(item.screen as any)}
          >
            <div className="icon-bubble">{item.icon}</div>
            <span className="icon-label">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="media-widget">
        <div className="flex items-center gap-3">
          <div className="cover">{currentTrack ? '♫' : '🎵'}</div>
          <div className="flex-1 min-w-0">
            <div className="track-title truncate">
              {currentTrack?.title ?? '没有歌曲'}
            </div>
            <div className="track-sub truncate">
              {status === 'playing'
                ? `${currentTrack?.artist} · 播放中`
                : status === 'paused'
                ? `${currentTrack?.artist ?? 'Apple Music 2'} · 已暂停`
                : `${currentTrack?.artist ?? 'Apple Music 2'} · 待播放`}
            </div>
          </div>
          <div className="eq-disc" />
        </div>
        <div className="widget-progress">
          <div
            className="widget-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="flex justify-between text-[9px] mt-1.5 font-medium"
          style={{ color: 'rgba(0,0,0,0.45)' }}
        >
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
