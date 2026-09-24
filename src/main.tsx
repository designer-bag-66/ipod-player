// ============================================================
// App 主入口
// 负责：路由派发、Click Wheel 事件分发、首选项恢复、主页索引记忆
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Screen as ScreenType } from '@/types';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { IPodShell } from '@/components/shell/IPodShell';
import { Screen as ScreenShell } from '@/components/shell/Screen';
import { ClickWheel } from '@/components/shell/ClickWheel';
import { QuickPanel, type QuickAdjust } from '@/components/shell/QuickPanel';
import {
  isNative,
  readBrightness,
  readVolume,
  setBrightnessLevel,
  setVolumeLevel,
  watchVolume,
} from '@/services/system';
import { App as CapacitorApp } from '@capacitor/app';
import { NavTransition, type NavAnimState } from '@/components/shell/NavTransition';
import { HomeView } from '@/components/views/HomeView';
import { SongListView, playSongAt } from '@/components/views/SongListView';
import { NowPlayingView } from '@/components/views/NowPlayingView';
import { SearchView, playSearchResult } from '@/components/views/SearchView';
import { SettingsView, settingsAction } from '@/components/views/SettingsView';
import { NeteaseApiView, neteaseApiAction } from '@/components/views/NeteaseApiView';
import {
  NeteaseLoginView,
  NeteasePlaylistsView,
  NeteasePlaylistView,
  selectNeteasePlaylistItem,
  playSelectedPlaylistTrack,
  playNeteaseSongAt,
} from '@/components/views/NeteaseView';
import { PlayQueueView, selectQueueItem } from '@/components/views/PlayQueueView';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/prefs';
import { PREVIEW } from '@/dev/demoData';

const NAV_ANIM_MS = 280;
/** 原生容器：亮度/音量直接改系统值，Web 端用 CSS 滤镜 + audio.volume 兜底 */
const NATIVE = isNative();

export function App() {
  const playerInit = usePlayer((s) => s.init);
  const currentTrack = usePlayer((s) => s.currentTrack);
  const status = usePlayer((s) => s.status);

  const stack = useNavigation((s) => s.stack);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const items = useNavigation((s) => s.items);
  const homeIndex = useNavigation((s) => s.homeIndex);
  const moveIndex = useNavigation((s) => s.moveIndex);
  const back = useNavigation((s) => s.back);
  const push = useNavigation((s) => s.push);
  const home = useNavigation((s) => s.home);
  const setIndex = useNavigation((s) => s.setIndex);
  const setHomeIndex = useNavigation((s) => s.setHomeIndex);
  const current = stack[stack.length - 1];

  const [navAnim, setNavAnim] = useState<NavAnimState>(null);
  const [popping, setPopping] = useState(false);
  const navTimersRef = useRef<number[]>([]);

  // 快捷面板（主菜单按 MENU）：播放列表 / 亮度 / 音量
  const [quick, setQuick] = useState<{ open: boolean; row: number; adjusting: QuickAdjust }>({
    open: PREVIEW.active && PREVIEW.quick,
    row: 0,
    adjusting: PREVIEW.active ? PREVIEW.quickAdjust : 'none',
  });
  const [brightness, setBrightness] = useState(1);
  const volume = usePlayer((s) => s.volume);

  useEffect(() => {
    usePrefs.getState().init(); // 先恢复首选项（API 地址等）
    playerInit();
    // 预览模式下示例登录态已注入，跳过联网 bootstrap，避免被覆盖
    if (!PREVIEW.active) useAuth.getState().bootstrap();
    // 启动即用系统值同步亮度 / 音量（Web 端读本地设置）
    void readBrightness().then(setBrightness);
    void readVolume().then((v) => usePlayer.getState().setVolume(v));
  }, [playerInit]);

  function applyBrightness(v: number) {
    void setBrightnessLevel(v).then(setBrightness);
  }

  // 监听系统音量变化（硬件按键 / 系统面板），保持界面显示与实际一致
  useEffect(() => {
    let stop: (() => void) | null = null;
    void watchVolume((v) => usePlayer.getState().setVolume(v)).then((fn) => {
      stop = fn;
    });
    return () => stop?.();
  }, []);

  // 卸载时清理 timer
  useEffect(() => {
    return () => {
      navTimersRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  // 切后台再回来时，iOS WKWebView 视口尺寸可能变化导致布局变形；
  // 恢复时滚动归零并触发一次 resize，让布局重新计算
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      window.setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.dispatchEvent(new Event('resize'));
      }, 120);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);

    // 回到前台时补一次登录态恢复（若已掉线则重新 bootstrap）
    let handle: { remove: () => Promise<void> } | null = null;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      window.setTimeout(() => {
        const s = useAuth.getState();
        if (!s.user) void s.bootstrap();
      }, 300);
      // 回到前台时重新对齐系统亮度 / 音量（期间可能用硬件按键改过）
      if (NATIVE) {
        window.setTimeout(() => {
          void readBrightness().then(setBrightness);
          void readVolume().then((v) => usePlayer.getState().setVolume(v));
        }, 200);
      }
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      handle?.remove().catch(() => {});
    };
  }, []);

  function queueTimer(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    navTimersRef.current.push(id);
    return id;
  }

  /** 获取主页图标的屏幕坐标 */
  function getHomeIconRect(index: number): DOMRect | null {
    const el = document.querySelector(
      `[data-home-icon-index="${index}"]`,
    ) as HTMLElement | null;
    if (!el) return null;
    return el.getBoundingClientRect();
  }

  /** 获取屏幕显示框的屏幕坐标 */
  function getScreenBezelRect(): DOMRect | null {
    const el = document.querySelector('[data-screen-bezel]') as HTMLElement | null;
    if (!el) return null;
    return el.getBoundingClientRect();
  }

  // 屏幕标题
  const title = (() => {
    switch (current.name) {
      case 'home':
        return 'iPod';
      case 'favorites':
        return '我喜欢的音乐';
      case 'now-playing':
        return '正在播放';
      case 'search':
        return '搜索';
      case 'settings':
        return '设置';
      case 'settings.netease':
        return '网易云 API';
      case 'netease.login':
        return '网易云登录';
      case 'netease.playlists':
        return '我的歌单';
      case 'netease.playlist':
        return '歌单';
      case 'play-queue':
        return '播放';
    }
  })();

  const commitNav = useCallback(
    (action: () => void, ms = NAV_ANIM_MS) => {
      queueTimer(action, ms);
    },
    [],
  );

  /** 打开主页第 index 项（轮盘 SELECT 与列表点按共用），带图标飞入动画 */
  function openHomeIcon(index: number) {
    const routes: Record<number, ScreenType> = {
      // 歌单：未登录时列表页会引导去「设置」登录
      0: { name: 'netease.playlists' },
      // 播放列表：当前播放队列
      1: { name: 'play-queue' },
      // 我喜欢的：网易云云端收藏，未登录时列表页引导去设置
      2: { name: 'favorites' },
      3: { name: 'search' },
      4: { name: 'settings' },
    };
    const target = routes[index];
    if (!target) return;
    setHomeIndex(index);
    const iconRect = getHomeIconRect(index);
    const screenRect = getScreenBezelRect();
    if (iconRect && screenRect) {
      setNavAnim({ kind: 'push', iconRect, screenRect });
      commitNav(() => {
        push(target);
        setNavAnim(null);
      });
    } else {
      push(target);
    }
  }

  // SELECT 处理
  function handleSelect() {
    // 快捷面板打开时，SELECT 只作用于面板
    if (quick.open) {
      // 面板已精简为「亮度 / 音量」两项
      if (quick.adjusting !== 'none') {
        setQuick((q) => ({ ...q, adjusting: 'none' }));
      } else if (quick.row === 0) {
        setQuick((q) => ({ ...q, adjusting: 'bright' }));
      } else {
        setQuick((q) => ({ ...q, adjusting: 'vol' }));
      }
      return;
    }

    const item = items[selectedIndex];
    switch (current.name) {
      case 'home':
        openHomeIcon(selectedIndex);
        return;
      case 'now-playing':
        return;
      case 'search':
        if (item?.kind === 'track') playSearchResult(selectedIndex);
        return;
      case 'favorites':
        if (item?.kind === 'track') playSongAt(selectedIndex);
        return;
      case 'settings':
        if (item) settingsAction(item.label);
        return;
      case 'settings.netease':
        neteaseApiAction(item?.label);
        return;
      case 'netease.login':
        // 根据 label 分发到登录页内置动作
        {
          const item = items[selectedIndex];
          if (item.kind === 'action') {
            if (item.label === '重试获取用户信息') {
              useAuth.getState().refreshAccount();
            } else if (item.label === '重试连接') {
              useAuth.getState().bootstrap();
            } else {
              useAuth.getState().primaryAction();
            }
          }
        }
        return;
      case 'netease.playlists':
        selectNeteasePlaylistItem(selectedIndex);
        return;
      case 'netease.playlist':
        playSelectedPlaylistTrack(selectedIndex);
        return;
      case 'play-queue':
        selectQueueItem(selectedIndex);
        return;
    }
  }

  // MENU / 返回
  function handleMenu() {
    // 快捷面板：调节中先回到面板，否则关闭
    if (quick.open) {
      if (quick.adjusting !== 'none') {
        setQuick((q) => ({ ...q, adjusting: 'none' }));
      } else {
        setQuick({ open: false, row: 0, adjusting: 'none' });
      }
      return;
    }
    // 主菜单：按 MENU 展开快捷面板
    if (current.name === 'home') {
      setQuick({ open: true, row: 0, adjusting: 'none' });
      return;
    }
    const iconRect = getHomeIconRect(homeIndex);
    const screenRect = getScreenBezelRect();
    setPopping(true);
    if (iconRect && screenRect) {
      setNavAnim({ kind: 'pop', iconRect, screenRect });
    }
    commitNav(() => {
      if (!back()) home();
      setIndex(homeIndex);
      setNavAnim(null);
      setPopping(false);
    });
  }

  // 渲染当前屏幕内容
  function renderBody() {
    switch (current.name) {
      case 'home':
        return <HomeView onPick={openHomeIcon} />;
      case 'favorites':
        return <SongListView />;
      case 'now-playing':
        return <NowPlayingView />;
      case 'search':
        return <SearchView />;
      case 'settings':
        return <SettingsView />;
      case 'settings.netease':
        return <NeteaseApiView />;
      case 'netease.login':
        return <NeteaseLoginView />;
      case 'netease.playlists':
        return <NeteasePlaylistsView />;
      case 'netease.playlist':
        return <NeteasePlaylistView playlistId={current.playlistId} />;
      case 'play-queue':
        return <PlayQueueView />;
      default:
        return <HomeView onPick={openHomeIcon} />;
    }
  }

  return (
    <IPodShell
      transitioning={popping}
      wheel={
        <ClickWheel
          onSelect={handleSelect}
          onMenu={handleMenu}
          onPrev={() => usePlayer.getState().previous()}
          onNext={() => usePlayer.getState().next()}
          onPlayPause={() => usePlayer.getState().toggle()}
          onWheel={(d) => {
            if (quick.open) {
              if (quick.adjusting === 'bright') {
                applyBrightness(brightness + d * 0.05);
              } else if (quick.adjusting === 'vol') {
                void setVolumeLevel(volume + d * 0.05);
              } else {
                setQuick((q) => ({
                  ...q,
                  row: Math.min(1, Math.max(0, q.row + d)),
                }));
              }
              return;
            }
            moveIndex(d);
          }}
          onLongPress={() => push({ name: 'now-playing' })}
          isPlaying={status === 'playing'}
        />
      }
    >
      {/* 原生端亮度由系统背光控制，不再叠加 CSS 滤镜（避免双重变暗） */}
      <ScreenShell title={title} brightness={NATIVE ? 1 : brightness} hideStatusbar={current.name === 'now-playing'}>
        {renderBody()}
        <QuickPanel
          open={quick.open}
          row={quick.row}
          adjusting={quick.adjusting}
          brightness={brightness}
          volume={volume}
        />
      </ScreenShell>
      <NavTransition state={navAnim} duration={NAV_ANIM_MS} />
    </IPodShell>
  );
}