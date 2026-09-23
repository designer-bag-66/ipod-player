// ============================================================
// App 主入口
// 负责：路由派发、Click Wheel 事件分发、首选项恢复、主页索引记忆
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Screen as ScreenType } from '@/types';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { IPodShell } from '@/components/shell/IPodShell';
import { Screen as ScreenShell } from '@/components/shell/Screen';
import { ClickWheel } from '@/components/shell/ClickWheel';
import { NavTransition, type NavAnimState } from '@/components/shell/NavTransition';
import { HomeView } from '@/components/views/HomeView';
import { MusicView, selectMusicItem } from '@/components/views/MusicView';
import { SongListView, playSongAt } from '@/components/views/SongListView';
import { ArtistsView } from '@/components/views/ArtistsView';
import { AlbumsView } from '@/components/views/AlbumsView';
import { NowPlayingView } from '@/components/views/NowPlayingView';
import { SearchView, playSearchResult } from '@/components/views/SearchView';
import { SettingsView, settingsAction } from '@/components/views/SettingsView';
import {
  NeteaseLoginView,
  NeteasePlaylistsView,
  NeteasePlaylistView,
  selectNeteasePlaylistItem,
  playNeteaseSongAt,
} from '@/components/views/NeteaseView';
import { useAuth } from '@/stores/auth';

const NAV_ANIM_MS = 280;

export function App() {
  const init = useLibrary((s) => s.init);
  const libLoaded = useLibrary((s) => s.loaded);
  const playerInit = usePlayer((s) => s.init);
  const currentTrack = usePlayer((s) => s.currentTrack);
  const status = usePlayer((s) => s.status);
  const tracks = useLibrary((s) => s.tracks);
  const neUser = useAuth((s) => s.user);

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

  useEffect(() => {
    init();
    playerInit();
    useAuth.getState().bootstrap();
  }, [init, playerInit]);

  // 卸载时清理 timer
  useEffect(() => {
    return () => {
      navTimersRef.current.forEach((id) => clearTimeout(id));
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
      case 'music':
        return '音乐';
      case 'music.favorites':
        return '我喜欢的音乐';
      case 'music.songs':
        return '歌曲';
      case 'music.artists':
        return '歌手';
      case 'music.albums':
        return '专辑';
      case 'music.playlists':
        return '我的歌单';
      case 'music.playlist':
        return '歌单';
      case 'now-playing':
        return '正在播放';
      case 'search':
        return '搜索';
      case 'settings':
        return '设置';
      case 'settings.import':
        return '导入歌曲';
      case 'netease.login':
        return '网易云登录';
      case 'netease.playlists':
        return '我的歌单';
      case 'netease.playlist':
        return '歌单';
    }
  })();

  const commitNav = useCallback(
    (action: () => void, ms = NAV_ANIM_MS) => {
      queueTimer(action, ms);
    },
    [],
  );

  // SELECT 处理
  function handleSelect() {
    const item = items[selectedIndex];
    switch (current.name) {
      case 'home': {
        const favId = neUser?.account.id;
        const iconRoutes: Record<number, ScreenType> = {
          0: { name: 'music' },
          1: neUser ? { name: 'netease.playlists' } : { name: 'netease.login' },
          2: { name: 'music.albums' },
          3: neUser
            ? { name: 'netease.playlist', playlistId: favId! }
            : { name: 'netease.login' },
          4: { name: 'search' },
          5: { name: 'settings' },
        };
        if (!(selectedIndex in iconRoutes)) return;
        const target = iconRoutes[selectedIndex];
        const iconRect = getHomeIconRect(selectedIndex);
        const screenRect = getScreenBezelRect();
        setHomeIndex(selectedIndex);
        if (iconRect && screenRect) {
          setNavAnim({ kind: 'push', iconRect, screenRect });
          commitNav(() => {
            push(target);
            setNavAnim(null);
          });
        } else {
          push(target);
        }
        return;
      }
      case 'music':
        selectMusicItem(selectedIndex);
        return;
      case 'now-playing':
        return;
      case 'search':
        if (item.kind === 'track') playSearchResult(selectedIndex);
        return;
      case 'music.songs':
      case 'music.favorites':
        if (item.kind === 'track') playSongAt(selectedIndex);
        return;
      case 'settings':
        settingsAction(selectedIndex);
        return;
      case 'netease.login':
        // 根据 label 分发到登录页内置动作
        {
          const item = items[selectedIndex];
          if (item.kind === 'action') {
            if (item.label === '重试获取用户信息') {
              useAuth.getState().refreshAccount();
            } else {
              useAuth.getState().startLogin();
            }
          }
        }
        return;
      case 'netease.playlists':
        selectNeteasePlaylistItem(selectedIndex);
        return;
      case 'netease.playlist':
        if (item.kind === 'track') playNeteaseSongAt(selectedIndex);
        return;
    }
  }

  // MENU / 返回
  function handleMenu() {
    if (current.name === 'home') return;
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
        return <HomeView />;
      case 'music':
        return <MusicView />;
      case 'music.songs':
        return <SongListView filter="all" />;
      case 'music.favorites':
        return <SongListView filter="liked" />;
      case 'music.playlists':
        return <SongListView filter="all" />;
      case 'music.artists':
        return <ArtistsView />;
      case 'music.albums':
        return <AlbumsView />;
      case 'now-playing':
        return <NowPlayingView />;
      case 'search':
        return <SearchView />;
      case 'settings':
        return <SettingsView />;
      case 'settings.import':
        return <SettingsView />;
      case 'netease.login':
        return <NeteaseLoginView />;
      case 'netease.playlists':
        return <NeteasePlaylistsView />;
      case 'netease.playlist':
        return <NeteasePlaylistView playlistId={current.playlistId} />;
      default:
        return <HomeView />;
    }
  }

  if (!libLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white text-sm">
        正在加载…
      </div>
    );
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
          onWheel={(d) => moveIndex(d)}
          isPlaying={status === 'playing'}
        />
      }
    >
      <ScreenShell title={title}>{renderBody()}</ScreenShell>
      <NavTransition state={navAnim} duration={NAV_ANIM_MS} />
    </IPodShell>
  );
}