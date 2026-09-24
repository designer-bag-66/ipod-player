// ============================================================
// HomeView - 主页菜单
// 音乐资料 / 歌单（网易云） / 专辑 / 我喜欢的（网易云） / 搜索 / 设置
// 两种呈现：图标网格（grid）/ 列表（list），由设置里的「主页布局」切换
// ============================================================

import { useEffect, useMemo } from 'react';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePrefs } from '@/stores/prefs';
import { ListMenu } from '@/components/ui/ListMenu';
import type { MenuItem, Screen } from '@/types';

interface IconItem {
  label: string;
  icon: string;
  screen: Screen;
}

interface Props {
  /** 选中某项（由 main 统一处理跳转 + 飞入动画） */
  onPick?: (index: number) => void;
}

export function HomeView({ onPick }: Props) {
  const neUser = useAuth((s) => s.user);
  const setItems = useNavigation((s) => s.setItems);
  const setIndex = useNavigation((s) => s.setIndex);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const homeIndex = useNavigation((s) => s.homeIndex);
  const setHomeIndex = useNavigation((s) => s.setHomeIndex);
  const push = useNavigation((s) => s.push);
  const homeLayout = usePrefs((s) => s.homeLayout);

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

  const listItems = useMemo<MenuItem[]>(
    () => ICONS.map((icon) => ({ kind: 'submenu' as const, label: icon.label, meta: '' })),
    [ICONS],
  );

  useEffect(() => {
    // 把条目注册给导航层，使轮盘滑动可以改变 selectedIndex
    setItems(listItems);
  }, [listItems, setItems]);

  // 进入主页后，恢复保存的选中位置
  useEffect(() => {
    if (homeIndex > 0) setIndex(homeIndex);
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滚轮在主页上滚动时，把当前位置同步到 homeIndex
  useEffect(() => {
    setHomeIndex(selectedIndex);
  }, [selectedIndex, setHomeIndex]);

  const pick = (i: number) => {
    setIndex(i);
    if (onPick) {
      onPick(i);
      return;
    }
    const target = ICONS[i]?.screen;
    if (target) push(target);
  };

  return (
    <div className="h-full flex flex-col z-10 relative">
      <div className="text-center mt-1 mb-1 z-10">
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

      {homeLayout === 'list' ? (
        <div className="home-list flex-1 min-h-0">
          <ListMenu
            items={listItems}
            selectedIndex={selectedIndex}
            indexAttr="home-icon"
            onPick={pick}
          />
        </div>
      ) : (
        <div className="icon-grid">
          {ICONS.map((item, i) => (
            <div
              key={item.label}
              data-home-icon-index={i}
              className={`icon-cell ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => pick(i)}
            >
              <div className="icon-bubble">{item.icon}</div>
              <span className="icon-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
