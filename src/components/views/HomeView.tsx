// ============================================================
// HomeView - 主页菜单
// 音乐资料 / 歌单（网易云） / 专辑 / 我喜欢的（网易云） / 搜索 / 设置
// 两种呈现：图标网格（grid）/ 列表（list），由设置里的「主页布局」切换
// 列表字号 / 上下位置由「列表字号 / 列表位置」调节
// ============================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { HOME_LIST_GAP, HOME_LIST_SIZE, usePrefs } from '@/stores/prefs';
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
  const currentTrack = usePlayer((s) => s.currentTrack);

  const homeLayout = usePrefs((s) => s.homeLayout);
  const homeListSize = usePrefs((s) => s.homeListSize);
  const homeListPos = usePrefs((s) => s.homeListPos);

  const listRef = useRef<HTMLDivElement>(null);
  /** 底部正在播放卡片占掉的高度，避免最后一行被压住 */
  const [bottomClearance, setBottomClearance] = useState(0);
  /** 列表整体上边距（按「列表位置」算出） */
  const [padTop, setPadTop] = useState(0);

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

  // 量出底部「正在播放」卡片的高度：卡片是浮层，不避让就会盖住最后一项
  useEffect(() => {
    let ro: ResizeObserver | undefined;
    const measure = () => {
      const card = document.querySelector('.nowplaying-card') as HTMLElement | null;
      const area = (card?.offsetParent as HTMLElement | null) ?? null;
      if (!card || !area) {
        setBottomClearance(0);
        return;
      }
      const gap = area.getBoundingClientRect().bottom - card.getBoundingClientRect().top + 8;
      setBottomClearance(Math.max(0, Math.round(gap)));
    };
    const raf = requestAnimationFrame(() => {
      measure();
      const card = document.querySelector('.nowplaying-card');
      if (card && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(measure);
        ro.observe(card);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [currentTrack]);

  // 根据可视高度与内容高度，把整列推到「偏上 / 居中 / 偏下」
  // 内容高度用「行高 + 行距」常数算，不读 DOM，避免 padding 自我放大
  useEffect(() => {
    if (homeLayout !== 'list') return;
    const scroller = listRef.current?.querySelector('.list-scroll') as HTMLElement | null;
    if (!scroller) return;
    const { row } = HOME_LIST_SIZE[homeListSize];
    // flex gap 只出现在行与行之间，末行后面没有
    const contentH = listItems.length * row + Math.max(0, listItems.length - 1) * HOME_LIST_GAP;
    const free = scroller.clientHeight - contentH;
    const next =
      homeListPos === 'top' ? 0 : homeListPos === 'mid' ? Math.round(free / 2) : Math.round(free);
    setPadTop(Math.max(0, next));
  }, [homeLayout, homeListSize, homeListPos, listItems.length, bottomClearance]);

  const pick = (i: number) => {
    setIndex(i);
    if (onPick) {
      onPick(i);
      return;
    }
    const target = ICONS[i]?.screen;
    if (target) push(target);
  };

  const spec = HOME_LIST_SIZE[homeListSize];
  const listVars = {
    '--hl-row': `${spec.row}px`,
    '--hl-font': `${spec.font}px`,
    '--hl-radius': `${spec.radius}px`,
    '--hl-gap': `${HOME_LIST_GAP}px`,
    '--hl-pad-top': `${padTop}px`,
  } as CSSProperties;

  return (
    <div
      className="h-full flex flex-col z-10 relative"
      style={{ paddingBottom: bottomClearance || undefined }}
    >
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
        <div ref={listRef} className="home-list flex-1 min-h-0" style={listVars}>
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
