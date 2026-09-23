// ============================================================
// iPodPlayer 类型定义
// 与文档 3.2 关键模型对齐：Track / Playlist / PlayerState
// ============================================================

export type TrackID = string;

export interface Track {
  id: TrackID;
  /** 在 IndexedDB 中存储的 Blob 引用；运行时通过 URL.createObjectURL 取出 */
  title: string;
  artist: string;
  album: string;
  duration: number; // 秒
  /** 内嵌封面 blob URL；可能为空 */
  artworkUrl?: string;
  /** 原始文件名（用于 fallback 显示） */
  fileName: string;
  importedAt: number;
  liked: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  orderedTrackIDs: TrackID[];
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

/** 菜单层级：用于 Click Wheel 选择与 MENU 返回 */
export type MenuItem =
  | { kind: 'title'; label: string }
  | { kind: 'submenu'; label: string; meta?: string }
  | { kind: 'action'; label: string; meta?: string }
  | { kind: 'track'; label: string; trackId: TrackID; meta?: string }
  | { kind: 'toggle'; label: string; value: boolean; meta?: string };

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
  | { name: 'music' }
  | { name: 'music.favorites' }
  | { name: 'music.playlists' }
  | { name: 'music.artists' }
  | { name: 'music.albums' }
  | { name: 'music.songs' }
  | { name: 'music.playlist'; playlistId: string }
  | { name: 'now-playing' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'settings.import' }
  // ---- 网易云 ----
  | { name: 'netease.login' }
  | { name: 'netease.playlists' }
  | { name: 'netease.playlist'; playlistId: number };