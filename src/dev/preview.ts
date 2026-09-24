// ============================================================
// 预览模式启动钩子（配合「界面评审板」public/board.html）
//
// 用法：/?demo=1&screen=favorites&quick=1&user=0
//   demo=1     开启预览（注入示例播放状态 / 登录态）
//   screen=X   启动后直接进入某个页面
//   quick=1    启动后直接展开主页的快捷面板
//   user=0     不注入网易云登录态（用来看未登录状态）
//
// 不带 demo=1 时本函数直接返回，正常使用完全不受影响。
// ============================================================

import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { rememberNeteaseTracks } from '@/services/netease';
import type { Screen, Track } from '@/types';
import { DEMO_NE_TRACKS, DEMO_USER, PREVIEW } from './demoData';

/** 把 URL 里的 screen 名字翻译成 Screen 对象；home / 未知都返回 null（= 停在主页） */
function resolveScreen(name: string): Screen | null {
  switch (name) {
    case 'favorites':
      return { name: 'favorites' };
    case 'search':
      return { name: 'search' };
    case 'settings':
      return { name: 'settings' };
    case 'settings.netease':
      return { name: 'settings.netease' };
    case 'netease.login':
      return { name: 'netease.login' };
    case 'netease.playlists':
      return { name: 'netease.playlists' };
    case 'netease.playlist':
      return { name: 'netease.playlist', playlistId: 101 };
    case 'play-queue':
      return { name: 'play-queue' };
    case 'now-playing':
      return { name: 'now-playing' };
    default:
      return null;
  }
}

/** 示例曲目 → 播放器形态（与 player.playNeteaseTrack 的转换保持一致） */
function toPlayingTrack(t: (typeof DEMO_NE_TRACKS)[number] | undefined): Track | null {
  if (!t) return null;
  return {
    id: `netease:${t.id}`,
    title: t.name,
    artist: t.ar.map((a) => a.name).join(' / '),
    album: t.al.name,
    duration: t.dt / 1000,
    artworkUrl: t.al.picUrl
      ? `${t.al.picUrl.replace(/^http:/, 'https:')}?param=300y300`
      : undefined,
  };
}

export function applyPreview(): void {
  if (!PREVIEW.active) return;

  // 1) 示例播放状态：用网易云示例曲目。
  //    先登记进「曲目查表」，播放页 / 队列页才拿得到曲目信息。
  //    只写状态不真正播放（audio 不动，页面不会发声）。
  rememberNeteaseTracks(DEMO_NE_TRACKS);
  usePlayer.setState({
    currentTrack: toPlayingTrack(DEMO_NE_TRACKS[0]),
    queue: DEMO_NE_TRACKS.map((t) => `netease:${t.id}`),
    currentIndex: 0,
    status: 'playing',
    elapsed: 42,
  });

  // 2) 网易云登录态
  if (PREVIEW.seedUser) {
    useAuth.setState({ apiOnline: true, user: DEMO_USER, errorMessage: '' });
  }

  // 3) 直达指定页面（栈里保留一层 home，这样返回逻辑仍然成立）
  const target = resolveScreen(PREVIEW.screen);
  useNavigation.setState({
    stack: target ? [{ name: 'home' }, target] : [{ name: 'home' }],
    selectedIndex: 0,
  });
}
