// ============================================================
// 播放器 Store（文档 3.2 PlayerState + 4.2 系统媒体）
// 用单例 HTMLAudioElement + MediaSession API
// 兼容本地曲库（blob URL）和网易云（/netease-stream 代理）
// ============================================================

import { create } from 'zustand';
import type {
  Track,
  TrackID,
  PlayerState,
  RepeatMode,
  ShuffleMode,
} from '@/types';
import { useLibrary } from './library';
import { setSetting, getSetting } from '@/services/storage';
import {
  fetchSongUrl,
  lookupNeteaseTrack,
  NETEASE_BASE_URL,
  type NetEaseTrack,
} from '@/services/netease';

// ---------------- 音效（EQ） ----------------

export type EqMode = 'off' | 'pop' | 'rock' | 'classic' | 'jazz' | 'bass';

export const EQ_LABELS: Record<EqMode, string> = {
  off: '关闭',
  pop: '流行',
  rock: '摇滚',
  classic: '古典',
  jazz: '爵士',
  bass: '低音增强',
};

export const EQ_ORDER: EqMode[] = ['off', 'pop', 'rock', 'classic', 'jazz', 'bass'];

/** 预设：[低频架(120Hz)dB, 峰值(1kHz)dB, 高频架(6kHz)dB] */
const EQ_PRESETS: Record<EqMode, [number, number, number]> = {
  off: [0, 0, 0],
  pop: [2, 1.5, 2],
  rock: [4.5, -1, 3],
  classic: [1, 0, 4],
  jazz: [3, 2, 1.5],
  bass: [7, 0, -1],
};

// Web Audio EQ 链（惰性创建，仅在选择非关闭音效后启用）
let eqCtx: AudioContext | null = null;
let eqFilters: BiquadFilterNode[] | null = null;

function ensureEqChain(audio: HTMLAudioElement) {
  if (eqFilters) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(audio);
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 120;
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.8;
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 6000;
    src.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(ctx.destination);
    eqCtx = ctx;
    eqFilters = [low, mid, high];
  } catch (err) {
    console.warn('[player] EQ init failed', err);
  }
}

function applyEqGain(mode: EqMode) {
  if (!eqFilters) return;
  const [l, m, h] = EQ_PRESETS[mode];
  eqFilters[0].gain.value = l;
  eqFilters[1].gain.value = m;
  eqFilters[2].gain.value = h;
}

function resumeEq() {
  if (eqCtx && eqCtx.state === 'suspended') {
    eqCtx.resume().catch(() => {});
  }
}

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
  eq: EqMode;
  setEq(mode: EqMode): void;
  cycleEq(): void;
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
  eq: 'off',
  currentTrack: null,
  audio: new Audio(),
  rafId: null,

  async init() {
    const audio = get().audio;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    // 恢复设置
    const settings = await Promise.all([
      getSetting<RepeatMode>('repeat'),
      getSetting<ShuffleMode>('shuffle'),
      getSetting<number>('volume'),
      getSetting<EqMode>('eq'),
    ]);
    set({
      repeat: settings[0] ?? 'off',
      shuffle: settings[1] ?? 'off',
      volume: settings[2] ?? 1,
      eq: settings[3] ?? 'off',
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
    let url: string | null = null;

    if (track.id.startsWith('netease:')) {
      const neId = Number(track.id.slice(8));
      const item = await fetchSongUrl(neId, 320000);
      if (!item?.url) {
        console.warn('[player] netease track no url (VIP?)', neId);
        set({ status: 'error' });
        return;
      }
      // 远程 API：音频直连网易云 CDN（audio.src 不受 CORS 限制，转 https 过 iOS ATS）
      // 本地开发（BASE=/netease）：走 Vite 流代理
      url = NETEASE_BASE_URL.startsWith('http')
        ? item.url.replace(/^http:/, 'https:')
        : `/netease-stream?u=${encodeURIComponent(item.url)}`;
    } else {
      const lib = useLibrary.getState();
      url = (await lib.getBlobUrl(track.id)) ?? null;
      if (!url) {
        console.warn('[player] blob not found', track.id);
        return;
      }
    }

    const lib = useLibrary.getState();
    const fullQueue =
      queue ??
      (get().queue.length > 0
        ? get().queue
        : lib.tracks.map((t) => t.id));
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

    // 音效开启时确保 EQ 链已接入并恢复 AudioContext
    if (get().eq !== 'off') {
      ensureEqChain(audio);
      applyEqGain(get().eq);
      resumeEq();
    }

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
      fileName: 'netease.mp3',
      importedAt: Date.now(),
      liked: false,
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

    const lib = useLibrary.getState();
    const nextTrack = lib.tracks.find((t) => t.id === s.queue[nextIdx]);
    if (nextTrack) {
      await get().playTrack(nextTrack, s.queue);
      set({ currentIndex: nextIdx });
      return;
    }
    // 网易云曲目（queue id 前缀 netease:）
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

    const lib = useLibrary.getState();
    const prevTrack = lib.tracks.find((t) => t.id === s.queue[prevIdx]);
    if (prevTrack) {
      await get().playTrack(prevTrack, s.queue);
      set({ currentIndex: prevIdx });
      return;
    }
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

  setEq(mode) {
    set({ eq: mode });
    setSetting('eq', mode);
    if (mode !== 'off') {
      ensureEqChain(get().audio);
      applyEqGain(mode);
      resumeEq();
    } else if (eqFilters) {
      applyEqGain('off');
    }
  },

  cycleEq() {
    const cur = get().eq;
    const idx = EQ_ORDER.indexOf(cur);
    const next = EQ_ORDER[(idx + 1) % EQ_ORDER.length];
    get().setEq(next);
  },

  teardown() {
    const { audio } = get();
    audio.pause();
    audio.src = '';
  },
}));