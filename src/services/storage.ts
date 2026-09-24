// ============================================================
// IndexedDB 存储层（现在只剩通用键值设置）
//
// 本地曲库已整体移除，所以 tracks / blobs / playlists 三张表作废。
// DB_VERSION 升到 2，升级时把旧表删掉，顺带清掉用户设备上的历史数据。
// 现在只用 settings 表存「循环模式 / 随机 / 音量 / 亮度」这类键值。
//
// 注意：网易云 cookie 和 App 偏好不在这个库里（走 localStorage / Preferences）。
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'ipod-player-db';
const DB_VERSION = 2;

/** 本地曲库时代的表，升级时删除 */
const LEGACY_STORES = ['tracks', 'blobs', 'playlists'];

export interface SettingsRecord {
  key: string;
  value: unknown;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 清掉本地曲库遗留的表（含其中的音频 / 封面 blob）
        for (const legacy of LEGACY_STORES) {
          if (db.objectStoreNames.contains(legacy)) db.deleteObjectStore(legacy);
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Settings ----------

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const rec = (await db.get('settings', key)) as SettingsRecord | undefined;
  return rec?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}
