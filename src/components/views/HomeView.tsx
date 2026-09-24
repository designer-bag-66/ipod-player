// ============================================================
// HomeView - 主页菜单
//
// 呈现方式（列表 / 图标网格）、图标与文案、行高字号、网格列数
// 全部来自「设计源」src/design，本文件不再写死任何尺寸/配色。
// 只有「列表字号倍率」和「列表上下位置」仍是 App 自己的偏好（prefs）。
// ============================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { HOME_LIST_GAP, HOME_LIST_SCALE, usePrefs } from '@/stores/prefs';
import { useDesign } from '@/design';
import { ListMenu } from '@/components/ui/ListMenu';
import type { MenuItem, Screen } from '@/types';

interface Props {
  /** 选中某项（由 main 统一处理跳转 + 飞入动画） */
  onPick?: (index: number) => void;
}

/** 下标 → 路由（顺序固定，设计源里的 icons 只负责图标与文案） */
// 网易云登录入口统一在「设置」里，这里不再做登录跳转：
// 未登录时歌单页会引导去设置，「我喜欢的」会自动回落本地收藏
const HOME_ROUTES: (() => Screen)[] = [
  // 歌单：未登录时列表页会引导去「设置」登录
  () => ({ name: 'netease.playlists' }),
  // 当前播放列表（播放队列）
  () => ({ name: 'play-queue' }),
  // 我喜欢的：网易云云端收藏，未登录时列表页引导去设置
  () => ({ name: 'favorites' }),
  () => ({ name: 'search' }),
  () => ({ name: 'settings' }),
];

export function HomeView({ onPick }: Props) {
  const setItems = useNavigation((s) => s.setItems);
  const setIndex = useNavigation((s) => s.setIndex);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const homeIndex = useNavigation((s) => s.homeIndex);
  const setHomeIndex = useNavigation((s) => s.setHomeIndex);
  const push = useNavigation((s) => s.push);
  const currentTrack = usePlayer((s) => s.currentTrack);

  const homeListSize = usePrefs((s) => s.homeListSize);
  const homeListPos = usePrefs((s) => s.homeListPos);

  const designIcons = useDesign((s) => s.doc.icons);
  const layout = useDesign((s) => s.doc.layout);
  const isList = layout.homeLayout === 'list';

  const listRef = useRef<HTMLDivElement>(null);
  /** 底部正在播放卡片占掉的高度，避免最后一行被压住 */
  const [bottomClearance, setBottomClearance] = useState(0);
  /** 列表整体上边距（按「列表位置」算出） */
  const [padTop, setPadTop] = useState(0);

  const menuItems = useMemo<MenuItem[]>(
    () =>
      designIcons.map((it) => ({
        kind: 'submenu' as const,
        label: it.label,
        meta: '',
        icon: it.icon,
        iconColor: it.color,
      })),
    [designIcons],
  );

  useEffect(() => {
    // 把条目注册给导航层，使轮盘滑动可以改变 selectedIndex
    setItems(menuItems);
  }, [menuItems, setItems]);

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
  // 行高用「设计源 rowHeight × 字号倍率」，与 CSS 里的算法保持一致
  useEffect(() => {
    if (!isList) return;
    const scroller = listRef.current?.querySelector('.list-scroll') as HTMLElement | null;
    if (!scroller) return;
    const row = layout.rowHeight * HOME_LIST_SCALE[homeListSize];
    const contentH = menuItems.length * row + Math.max(0, menuItems.length - 1) * HOME_LIST_GAP;
    const free = scroller.clientHeight - contentH;
    const next =
      homeListPos === 'top' ? 0 : homeListPos === 'mid' ? Math.round(free / 2) : Math.round(free);
    setPadTop(Math.max(0, next));
  }, [isList, homeListSize, homeListPos, layout.rowHeight, menuItems.length, bottomClearance]);

  const pick = (i: number) => {
    setIndex(i);
    if (onPick) {
      onPick(i);
      return;
    }
    const target = HOME_ROUTES[i]?.();
    if (target) push(target);
  };

  const listVars = {
    '--hl-scale': String(HOME_LIST_SCALE[homeListSize]),
    '--hl-gap': `${HOME_LIST_GAP}px`,
    '--hl-pad-top': `${padTop}px`,
  } as CSSProperties;

  return (
    <div
      className="h-full flex flex-col z-10 relative"
      style={{ paddingBottom: bottomClearance || undefined }}
    >
      {layout.showHomeTitle && (
        <div className="home-titlebar">
          <span className="ttl">{layout.homeTitle}</span>
          {layout.homeSub && <span className="sub">{layout.homeSub}</span>}
        </div>
      )}

      {isList ? (
        <div ref={listRef} className="home-list flex-1 min-h-0" style={listVars}>
          <ListMenu
            items={menuItems}
            selectedIndex={selectedIndex}
            indexAttr="home-icon"
            onPick={pick}
          />
        </div>
      ) : (
        <div className="icon-grid">
          {designIcons.map((item, i) => (
            <div
              key={`${item.label}-${i}`}
              data-home-icon-index={i}
              className={`icon-cell ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => pick(i)}
            >
              <div className="icon-bubble">{item.icon}</div>
              {layout.showIconLabel && <span className="icon-label">{item.label}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
