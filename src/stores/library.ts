// ============================================================
// 曲库 Store（文档 3.2 / 4.1）
// - 维护 Track[] 与 Playlist[]
// - 提供导入 / 删除 / 切换喜欢 / 持久化能力
// ============================================================

import { create } from 'zustand';
import type { Track, Playlist, TrackID } from '@/types';
import {
  getAllTracks,
  saveTrack,
  deleteTrack as dbDeleteTrack,
  updateTrack as dbUpdateTrack,
  getAllPlaylists,
  savePlaylist,
  deletePlaylist as dbDeletePlaylist,
  saveBlob,
  deleteBlob,
  getBlob,
} from '@/services/storage';
import { readMetadata } from '@/services/metadata';

interface ImportProgress {
  total: number;
  done: number;
  failed: number;
  skipped: number;
}

interface LibraryState {
  tracks: Track[];
  playlists: Record<string, Playlist>;
  loaded: boolean;
  importing: ImportProgress | null;

  init(): Promise<void>;
  importFiles(files: FileList | File[]): Promise<void>;
  removeTrack(id: TrackID): Promise<void>;
  toggleLiked(id: TrackID): Promise<void>;
  createPlaylist(name: string): Promise<Playlist>;
  removePlaylist(id: string): Promise<void>;
  addToPlaylist(playlistId: string, trackId: string): Promise<void>;
  removeFromPlaylist(playlistId: string, trackId: string): Promise<void>;
  /** 返回指定 id 的 Blob 对象 URL（用于播放）；需要调用方负责 revoke */
  getBlobUrl(id: TrackID): Promise<string | undefined>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  tracks: [],
  playlists: {},
  loaded: false,
  importing: null,

  async init() {
    if (get().loaded) return;
    const [tracks, playlists] = await Promise.all([
      getAllTracks(),
      getAllPlaylists(),
    ]);
    set({
      tracks,
      playlists: Object.fromEntries(playlists.map((p) => [p.id, p])),
      loaded: true,
    });
  },

  async importFiles(files) {
    const arr = Array.from(files);
    const audioFiles = arr.filter((f) => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|flac|ogg)$/i.test(f.name));
    const progress: ImportProgress = {
      total: audioFiles.length,
      done: 0,
      failed: 0,
      skipped: arr.length - audioFiles.length,
    };
    set({ importing: progress });

    for (const file of audioFiles) {
      try {
        const meta = await readMetadata(file, file.name);
        const id = crypto.randomUUID();

        // 1. 保存音频 Blob
        await saveBlob({
          id,
          blob: file,
          mimeType: file.type || 'audio/mpeg',
        });

        // 2. 保存封面 blob（若有）
        let artworkUrl: string | undefined;
        if (meta.artwork) {
          artworkUrl = URL.createObjectURL(meta.artwork);
        }

        const track: Track = {
          id,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          duration: meta.duration,
          artworkUrl,
          fileName: file.name,
          importedAt: Date.now(),
          liked: false,
        };

        await saveTrack(track);
        progress.done += 1;
        set((s) => ({
          tracks: [track, ...s.tracks],
          importing: { ...progress },
        }));
      } catch (err) {
        console.error('[import] failed', file.name, err);
        progress.failed += 1;
        set({ importing: { ...progress } });
      }
    }

    set({ importing: null });
  },

  async removeTrack(id) {
    await Promise.all([dbDeleteTrack(id), deleteBlob(id)]);
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      playlists: Object.fromEntries(
        Object.entries(s.playlists).map(([pid, p]) => [
          pid,
          { ...p, orderedTrackIDs: p.orderedTrackIDs.filter((tid) => tid !== id) },
        ]),
      ),
    }));
  },

  async toggleLiked(id) {
    const t = get().tracks.find((x) => x.id === id);
    if (!t) return;
    const liked = !t.liked;
    await dbUpdateTrack(id, { liked });
    set((s) => ({
      tracks: s.tracks.map((x) => (x.id === id ? { ...x, liked } : x)),
    }));
  },

  async createPlaylist(name) {
    const pl: Playlist = {
      id: crypto.randomUUID(),
      name,
      orderedTrackIDs: [],
    };
    await savePlaylist(pl);
    set((s) => ({ playlists: { ...s.playlists, [pl.id]: pl } }));
    return pl;
  },

  async removePlaylist(id) {
    await dbDeletePlaylist(id);
    set((s) => {
      const next = { ...s.playlists };
      delete next[id];
      return { playlists: next };
    });
  },

  async addToPlaylist(playlistId, trackId) {
    const pl = get().playlists[playlistId];
    if (!pl) return;
    if (pl.orderedTrackIDs.includes(trackId)) return;
    const next = { ...pl, orderedTrackIDs: [...pl.orderedTrackIDs, trackId] };
    await savePlaylist(next);
    set((s) => ({ playlists: { ...s.playlists, [playlistId]: next } }));
  },

  async removeFromPlaylist(playlistId, trackId) {
    const pl = get().playlists[playlistId];
    if (!pl) return;
    const next = {
      ...pl,
      orderedTrackIDs: pl.orderedTrackIDs.filter((id) => id !== trackId),
    };
    await savePlaylist(next);
    set((s) => ({ playlists: { ...s.playlists, [playlistId]: next } }));
  },

  async getBlobUrl(id) {
    const blob = await getBlob(id);
    if (!blob) return undefined;
    return URL.createObjectURL(blob);
  },
}));