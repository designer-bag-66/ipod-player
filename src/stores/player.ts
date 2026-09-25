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
  /** 用户手动调节音量：真正改变输出音量（Web Audio 增益 + 系统音量） */
  setVolumeWithGain(v: number): void;
  /** 在用户手势中解锁音频元素（iOS 首次必须手势触发才能后续自动播放） */
  unlock(): void;
  teardown(): void;
}

// ---------------- 音频增益（音量真正生效） ----------------
// iOS 不允许 JS 改 <audio>.volume，系统音量也无法直接写入，
// 因此这里用 Web Audio 的 GainNode 控制实际输出音量。
// 只有在「用户手动调节音量」时才创建（必须在手势中），并带自检：
// 若接入后音频没有推进（跨域被静音等），自动旁路还原直连，避免没声音。

let audioCtx: AudioContext | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;
let audioGain: GainNode | null = null;
let audioGraphBypass = false;
let unlocked = false;

/** 1 帧静音 wav（用于 iOS 手势解锁） */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function ensureAudioGraph(audio: HTMLAudioElement): boolean {
  if (audioGraphBypass) return false;
  if (audioGain) {
    if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
    return true;
  }
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return false;
    const ctx: AudioContext = new Ctx();
    const src = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = usePlayer.getState().volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    audioCtx = ctx;
    audioSource = src;
    audioGain = gain;

    // 自检：接入后若音频被静音（跨域资源），还原为直连输出
    window.setTimeout(() => {
      const t0 = audio.currentTime;
      window.setTimeout(() => {
        if (audioGraphBypass || !audioSource || !audioCtx) return;
        const progressing = !audio.paused && !audio.ended && audio.currentTime > t0 + 0.2;
        if (!progressing && audio.readyState >= 2) {
          try {
            audioSource.disconnect();
            audioSource.connect(audioCtx.destination);
          } catch {}
          audioGraphBypass = true;
          console.warn('[player] Web Audio 增益已旁路还原（避免静音）');
        }
      }, 1600);
    }, 2500);
    return true;
  } catch (err) {
    console.warn('[player] 音频增益初始化失败', err);
    audioGraphBypass = true;
    return false;
  }
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
      void s.next().then(() => {
        // 兜底：若自动切歌后没有真正播起来（iOS 手势限制 / 网络抖动），
        // 稍等一下再尝试一次，避免「播完一首就停」
        window.setTimeout(() => {
          const cur = get();
          if (cur.status !== 'playing' && cur.currentTrack) {
            void cur.next();
          }
        }, 1500);
      });
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
    // 依次尝试高/中/低码率：高码率拿不到地址（版权/会员）时还能出声
    let item: SongUrlItem | null = null;
    for (const br of [320000, 192000, 128000]) {
      try {
        const got = await fetchSongUrl(neId, br);
        if (got?.url) {
          item = got;
          break;
        }
      } catch (err) {
        console.warn('[player] netease song url failed', neId, br, err);
      }
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
    // 以 audio 元素的真实状态为准：status 可能卡在 loading/error 上
    const { audio, status } = get();
    if (!audio.paused && status !== 'paused') return get().pause();
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
    if (audioGain) {
      try {
        audioGain.gain.value = vol;
      } catch {}
    }
    set({ volume: vol });
    setSetting('volume', vol);
  },

  setVolumeWithGain(v) {
    const audio = get().audio;
    ensureAudioGraph(audio);
    get().setVolume(Math.min(1, Math.max(0, v)));
  },

  unlock() {
    // iOS：首次必须在用户手势里播一次，之后才允许自动续播
    const { audio } = get();
    if (unlocked) return;
    unlocked = true;
    try {
      const prevSrc = audio.src;
      const prevTime = audio.currentTime;
      const wasPaused = audio.paused;
      audio.src = SILENT_WAV;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          audio.pause();
          if (prevSrc) {
            audio.src = prevSrc;
            audio.currentTime = prevTime;
            if (!wasPaused) void audio.play().catch(() => {});
          }
        }).catch(() => {});
      }
    } catch {
      /* 忽略：解锁失败不影响其它功能 */
    }
  },

  teardown() {
    const { audio } = get();
    audio.pause();
    audio.src = '';
  },
}));