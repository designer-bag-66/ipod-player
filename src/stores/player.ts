// ============================================================
// 播放器 Store（文档 3.2 PlayerState + 4.2 系统媒体）
// 用单例 HTMLAudioElement + MediaSession API
// 只播放在线曲目：网易云（音频直连 CDN，或本地开发走 /netease-stream 代理）
// ============================================================

import { create } from 'zustand';
import type { Track, TrackID, PlayerState, RepeatMode, ShuffleMode } from '@/types';
import { setSetting, getSetting } from '@/services/storage';
import {
  fetchSongUrl,
  lookupNeteaseTrack,
  getActiveBase,
  type NetEaseTrack,
  type SongUrlItem,
} from '@/services/netease';

interface PlayerStore extends PlayerState {
  /** 当前播放的 Track（用于 NowPlaying） */
  currentTrack: Track | null;
  /** 内部音频元素 */
  audio: HTMLAudioElement;
  /** 进度刷新定时器 id */
  rafId: number | null;

  init(): Promise<void>;
  playTrack(track: Track, queue?: TrackID[]): Promise<void>;
  playNeteaseTrack(track: NetEaseTrack, queue: NetEaseTrack[]): Promise<void>;
  toggle(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(elapsed: number): Promise<void>;
  cycleRepeat(): void;
  toggleShuffle(): void;
  setVolume(v: number): void;
  teardown(): void;
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => {
    usePlayer.getState().play();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    usePlayer.getState().pause();
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    usePlayer.getState().previous();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    usePlayer.getState().next();
  });
  navigator.mediaSession.setActionHandler('seekbackward', () => {
    const s = usePlayer.getState();
    s.seek(Math.max(0, s.elapsed - 10));
  });
  navigator.mediaSession.setActionHandler('seekforward', () => {
    const s = usePlayer.getState();
    s.seek(Math.min(s.currentTrack?.duration ?? 0, s.elapsed + 10));
  });
}

async function updateMediaSessionMetadata(track: Track) {
  if (!('mediaSession' in navigator)) return;
  const artwork = track.artworkUrl
    ? [
        {
          src: track.artworkUrl,
          sizes: '512x512',
          type: 'image/jpeg',
        },
      ]
    : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork,
    });
  } catch (err) {
    console.warn('[mediaSession] metadata failed', err);
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  queue: [],
  currentIndex: -1,
  status: 'idle',
  elapsed: 0,
  shuffle: 'off',
  repeat: 'off',
  volume: 1,
  currentTrack: null,
  audio: new Audio(),
  rafId: null,

  async init() {
    const audio = get().audio;
    audio.preload = 'auto';

    // 恢复设置
    const settings = await Promise.all([
      getSetting<RepeatMode>('repeat'),
      getSetting<ShuffleMode>('shuffle'),
      getSetting<number>('volume'),
    ]);
    set({
      repeat: settings[0] ?? 'off',
      shuffle: settings[1] ?? 'off',
      volume: settings[2] ?? 1,
    });
    audio.volume = get().volume;

    setupMediaSession();

    audio.addEventListener('ended', () => {
      const s = get();
      if (s.repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
        return;
      }
      s.next();
    });

    audio.addEventListener('timeupdate', () => {
      set({ elapsed: audio.currentTime });
    });

    audio.addEventListener('play', () => {
      set({ status: 'playing' });
    });
    audio.addEventListener('pause', () => {
      set({ status: 'paused' });
    });
    audio.addEventListener('waiting', () => {
      set({ status: 'loading' });
    });
    audio.addEventListener('error', () => {
      set({ status: 'error' });
    });
  },

  async playTrack(track, queue) {
    const audio = get().audio;
    if (!track.id.startsWith('netease:')) {
      console.warn('[player] 本地曲库已移除，只能播放在线曲目:', track.id);
      return;
    }

    const neId = Number(track.id.slice(8));
    let item: SongUrlItem | null = null;
    try {
      item = await fetchSongUrl(neId, 320000);
    } catch (err) {
      // 网络/API 不可达：以前这里会直接抛出去，把调用方的后续流程一起打断
      console.warn('[player] netease song url failed', neId, err);
      set({ status: 'error' });
      return;
    }
    if (!item?.url) {
      console.warn('[player] netease track no url (VIP?)', neId);
      set({ status: 'error' });
      return;
    }

    // 远程 API：音频直连网易云 CDN（audio.src 不受 CORS 限制）
    // 仅当 API 本身是 https 时才把音频地址也升到 https（过 iOS ATS）；
    // 若 API 是 http（例如局域网自建），保持原样，否则 http 音频会加载失败
    // 本地开发（BASE=/netease）：走 Vite 流代理
    let url: string;
    const base = getActiveBase();
    if (!base.startsWith('http')) {
      url = `/netease-stream?u=${encodeURIComponent(item.url)}`;
    } else if (base.startsWith('https')) {
      url = item.url.replace(/^http:/, 'https:');
    } else {
      url = item.url;
    }

    const fullQueue = queue ?? get().queue;
    const idx = fullQueue.indexOf(track.id);

    audio.src = url;
    audio.currentTime = 0;
    set({
      currentTrack: track,
      queue: fullQueue,
      currentIndex: idx >= 0 ? idx : 0,
      elapsed: 0,
      status: 'loading',
    });
    await updateMediaSessionMetadata(track);

    try {
      await audio.play();
      set({ status: 'playing' });
    } catch (err) {
      console.error('[player] play failed', err);
      set({ status: 'error' });
    }
  },

  async playNeteaseTrack(track, queue) {
    const localId = `netease:${track.id}`;
    const fakeTrack: Track = {
      id: localId,
      title: track.name,
      artist: track.ar.map((a) => a.name).join(' / '),
      album: track.al.name,
      duration: track.dt / 1000,
      artworkUrl: track.al.picUrl
        ? `${track.al.picUrl.replace(/^http:/, 'https:')}?param=300y300`
        : undefined,
    };
    const queueIds = queue.map((t) => `netease:${t.id}`);
    await get().playTrack(fakeTrack, queueIds);
  },

  async toggle() {
    const { status } = get();
    if (status === 'playing') return get().pause();
    return get().play();
  },

  async play() {
    const { audio, currentTrack } = get();
    if (!currentTrack) return;
    try {
      await audio.play();
    } catch (err) {
      console.error('[player] resume failed', err);
    }
  },

  async pause() {
    get().audio.pause();
  },

  async next() {
    const s = get();
    if (!s.currentTrack || s.queue.length === 0) return;

    if (s.repeat === 'one') {
      const audio = s.audio;
      audio.currentTime = 0;
      await audio.play();
      return;
    }

    let nextIdx = s.currentIndex + 1;
    if (nextIdx >= s.queue.length) {
      if (s.repeat === 'all') nextIdx = 0;
      else return s.pause();
    }

    // 队列里的曲目都是网易云曲目（queue id 前缀 netease:）
    const neTrack = lookupNeteaseTrack(s.queue[nextIdx]);
    if (neTrack) {
      const q = s.queue.map((id) => lookupNeteaseTrack(id)).filter(Boolean) as NetEaseTrack[];
      await get().playNeteaseTrack(neTrack, q);
      set({ currentIndex: nextIdx });
    }
  },

  async previous() {
    const s = get();
    if (!s.currentTrack || s.queue.length === 0) return;

    // 距开始 >3s 时回到开头
    if (s.elapsed > 3) {
      s.audio.currentTime = 0;
      return;
    }

    let prevIdx = s.currentIndex - 1;
    if (prevIdx < 0) prevIdx = s.repeat === 'all' ? s.queue.length - 1 : 0;

    const neTrack = lookupNeteaseTrack(s.queue[prevIdx]);
    if (neTrack) {
      const q = s.queue.map((id) => lookupNeteaseTrack(id)).filter(Boolean) as NetEaseTrack[];
      await get().playNeteaseTrack(neTrack, q);
      set({ currentIndex: prevIdx });
    }
  },

  async seek(elapsed) {
    const { audio, currentTrack } = get();
    if (!currentTrack) return;
    audio.currentTime = Math.min(
      Math.max(0, elapsed),
      currentTrack.duration || audio.duration || 0,
    );
    set({ elapsed: audio.currentTime });
  },

  cycleRepeat() {
    const next: RepeatMode =
      get().repeat === 'off' ? 'all' : get().repeat === 'all' ? 'one' : 'off';
    set({ repeat: next });
    setSetting('repeat', next);
  },

  toggleShuffle() {
    const next: ShuffleMode = get().shuffle === 'off' ? 'on' : 'off';
    set({ shuffle: next });
    setSetting('shuffle', next);

    // 应用洗牌到当前队列（保留当前曲目位置）
    const { queue, currentIndex, currentTrack } = get();
    if (queue.length === 0) return;
    const rest = queue.filter((_, i) => i !== currentIndex);
    const shuffled = shuffleArray(rest);
    const newQueue = currentTrack
      ? [currentTrack.id, ...shuffled]
      : shuffled;
    set({ queue: newQueue, currentIndex: 0 });
  },

  setVolume(v) {
    const vol = Math.min(1, Math.max(0, v));
    get().audio.volume = vol;
    set({ volume: vol });
    setSetting('volume', vol);
  },

  teardown() {
    const { audio } = get();
    audio.pause();
    audio.src = '';
  },
}));