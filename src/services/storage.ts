// ============================================================
// IndexedDB 存储层
// 文档 3 节建议：音频 -> Documents/Audio；曲库索引 -> Application Support
// Web 端等价：音频 Blob 存这里；曲库/喜欢/歌单/设置 也存这里
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import type { Track, Playlist } from '@/types';

const DB_NAME = 'ipod-player-db';
const DB_VERSION = 1;

export interface TrackBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tracks')) {
          const store = db.createObjectStore('tracks', { keyPath: 'id' });
          store.createIndex('importedAt', 'importedAt');
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Tracks ----------

export async function saveTrack(track: Track): Promise<void> {
  const db = await getDB();
  await db.put('tracks', track);
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await getDB();
  const tracks = (await db.getAll('tracks')) as Track[];
  return tracks.sort((a, b) => b.importedAt - a.importedAt);
}

export async function getTrack(id: string): Promise<Track | undefined> {
  const db = await getDB();
  return (await db.get('tracks', id)) as Track | undefined;
}

export async function updateTrack(
  id: string,
  patch: Partial<Track>,
): Promise<void> {
  const db = await getDB();
  const existing = (await db.get('tracks', id)) as Track | undefined;
  if (!existing) return;
  await db.put('tracks', { ...existing, ...patch, id });
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'blobs'], 'readwrite');
  await tx.objectStore('tracks').delete(id);
  await tx.objectStore('blobs').delete(id);
  await tx.done;
}

// ---------- Blobs ----------

export async function saveBlob(record: TrackBlobRecord): Promise<void> {
  const db = await getDB();
  await db.put('blobs', record);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const rec = (await db.get('blobs', id)) as TrackBlobRecord | undefined;
  return rec?.blob;
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('blobs', id);
}

// ---------- Playlists ----------

export async function savePlaylist(p: Playlist): Promise<void> {
  const db = await getDB();
  await db.put('playlists', p);
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDB();
  return (await db.getAll('playlists')) as Playlist[];
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('playlists', id);
}

// ---------- Settings ----------

export async function getSetting<T = unknown>(
  key: string,
): Promise<T | undefined> {
  const db = await getDB();
  const rec = (await db.get('settings', key)) as SettingsRecord | undefined;
  return rec?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

// ---------- Maintenance ----------

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['tracks', 'blobs', 'playlists', 'settings'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('tracks').clear(),
    tx.objectStore('blobs').clear(),
    tx.objectStore('playlists').clear(),
    tx.objectStore('settings').clear(),
  ]);
  await tx.done;
}