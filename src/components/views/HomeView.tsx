// ============================================================
// HomeView - 主页菜单
// 音乐资料 / 歌单（网易云） / 专辑 / 我喜欢的（网易云） / 搜索 / 设置
// ============================================================

import { useEffect, useMemo } from 'react';
import { useLibrary } from '@/stores/library';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import type { Screen } from '@/types';

interface IconItem {
  label: string;
  icon: string;
  screen: Screen;
}

export function HomeView() {
  const tracks = useLibrary((s) => s.tracks);
  const neUser = useAuth((s) => s.user);
  const setItems = useNavigation((s) => s.setItems);
  const setIndex = useNavigation((s) => s.setIndex);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const homeIndex = useNavigation((s) => s.homeIndex);
  const setHomeIndex = useNavigation((s) => s.setHomeIndex);
  const push = useNavigation((s) => s.push);

  const ICONS = useMemo<IconItem[]>(() => {
    const favId = neUser?.account.id;
    return [
      { label: '音乐资料', icon: '🎵', screen: { name: 'music' } },
      {
        label: '歌单',
        icon: '📑',
        screen: neUser ? { name: 'netease.playlists' } : { name: 'netease.login' },
      },
      { label: '专辑', icon: '📀', screen: { name: 'music.albums' } },
      {
        label: '我喜欢的',
        icon: '♥',
        screen: neUser
          ? { name: 'netease.playlist', playlistId: favId! }
          : { name: 'netease.login' },
      },
      { label: '搜索', icon: '🔍', screen: { name: 'search' } },
      { label: '设置', icon: '⚙️', screen: { name: 'settings' } },
    ];
  }, [neUser]);

  useEffect(() => {
    // 把图标作为导航 items 注册，使轮盘滑动可以改变 selectedIndex
    setItems(
      ICONS.map((icon) => ({
        kind: 'submenu' as const,
        label: icon.label,
        meta: '',
      })),
    );
  }, [ICONS, setItems]);

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

      <div className="icon-grid">
        {ICONS.map((item, i) => (
          <div
            key={item.label}
            data-home-icon-index={i}
            className={`icon-cell ${i === selectedIndex ? 'selected' : ''}`}
            onClick={() => push(item.screen)}
          >
            <div className="icon-bubble">{item.icon}</div>
            <span className="icon-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
