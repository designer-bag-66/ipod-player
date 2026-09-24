// ============================================================
// iPodPlayer 类型定义
// 本地曲库已移除：曲目只剩「播放器的统一形态」+ 网易云在线曲目
// ============================================================

export type TrackID = string;

/**
 * 播放器统一曲目形态。
 * 网易云曲目由 player.playNeteaseTrack 转换成本形态后交给音频元素。
 */
export interface Track {
  id: TrackID;
  title: string;
  artist: string;
  album: string;
  duration: number; // 秒
  /** 封面地址（网易云会给补过参数的 CDN 链接） */
  artworkUrl?: string;
}

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'loading' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';
export type ShuffleMode = 'off' | 'on';

export interface PlayerState {
  queue: TrackID[];
  currentIndex: number;
  status: PlaybackStatus;
  elapsed: number;
  shuffle: ShuffleMode;
  repeat: RepeatMode;
  volume: number;
}

/** 行首的行内元素：emoji 图标（主页）或封面槽位（曲目列表） */
export interface MenuRowExtras {
  /** 行首的 emoji 图标 */
  icon?: string;
  /** 图标颜色（例如「我喜欢的」用红心） */
  iconColor?: string;
  /** 行首的封面槽位：有 url 显示图片，没 url 显示占位方块 */
  artwork?: { url?: string };
}

/** 菜单层级：用于 Click Wheel 选择与 MENU 返回 */
export type MenuItem =
  | { kind: 'title'; label: string }
  | ({ kind: 'submenu'; label: string; meta?: string } & MenuRowExtras)
  | ({ kind: 'action'; label: string; meta?: string } & MenuRowExtras)
  | ({ kind: 'track'; label: string; trackId: TrackID; meta?: string } & MenuRowExtras)
  | ({ kind: 'toggle'; label: string; value: boolean; meta?: string } & MenuRowExtras);

export interface MenuScreen {
  /** 顶部状态栏标题 */
  title: string;
  /** 列表条目 */
  items: MenuItem[];
  /** 当前选中索引 */
  selectedIndex: number;
}

export type Screen =
  | { name: 'home' }
  /** 我喜欢的（网易云云端收藏） */
  | { name: 'favorites' }
  /** 当前播放列表（播放队列） */
  | { name: 'play-queue' }
  | { name: 'now-playing' }
  /** 搜索网易云在线歌曲 */
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'settings.netease' }
  /** 布局调整（显示框 / 滚轮） */
  | { name: 'layout' }
  // ---- 网易云 ----
  | { name: 'netease.login' }
  | { name: 'netease.playlists' }
  | { name: 'netease.playlist'; playlistId: number };
