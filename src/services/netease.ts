// ============================================================
// 网易云音乐 API 客户端（基于 NeteaseCloudMusicApi）
// 仅在本地开发时调用（通过 Vite 代理 /netease → localhost:3000）
// ============================================================

import { DEMO_NE_PLAYLISTS, DEMO_NE_PLAYLIST, DEMO_NE_TRACKS, PREVIEW } from '@/dev/demoData';

export interface NeArtist {
  id: number;
  name: string;
}

export interface NeAlbum {
  id: number;
  name: string;
  picUrl: string;
}

export interface NetEaseTrack {
  id: number;
  name: string;
  ar: NeArtist[];
  al: NeAlbum;
  dt: number; // duration ms
}

export interface NetEasePlaylistSummary {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  creator?: { nickname: string };
}

export interface NetEaseUser {
  account: { id: number };
  profile: {
    userId: number;
    nickname: string;
    avatarUrl: string;
  };
}

// 远程 API（Vercel 部署的 NeteaseCloudMusicApi，CORS 默认全开）
// 自定义域名优先（国内直连），vercel.app 作为兜底；任一地址可用即自动切换
// 本地开发如需走 Vite 代理，在 .env.local 设置 VITE_NETEASE_API=/netease
const BUILTIN_BASES = [
  'https://api.6qxxvp.top',
  'https://api-enhanced-five-puce.vercel.app',
];

function normalizeBase(b: string): string {
  const t = b.trim().replace(/\/+$/, '');
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const ENV_BASE = normalizeBase(
  ((import.meta as any).env?.VITE_NETEASE_API as string | undefined) || '',
);

/** 内置候选地址（含构建期环境变量注入的地址） */
export const NETEASE_BASES: string[] = ENV_BASE
  ? [ENV_BASE, ...BUILTIN_BASES.filter((b) => normalizeBase(b) !== ENV_BASE)]
  : BUILTIN_BASES.slice();

/** 用户在「设置 → 网易云 API 地址」里填的地址（空串 = 用内置） */
export function getCustomBase(): string {
  return normalizeBase(usePrefs.getState().neteaseBase || '');
}

/** 实际要尝试的地址列表：自定义地址优先，其次内置兜底 */
export function getBases(): string[] {
  const custom = getCustomBase();
  if (!custom) return NETEASE_BASES;
  return [custom, ...NETEASE_BASES.filter((b) => normalizeBase(b) !== custom)];
}

/** 当前生效的地址；checkApiAvailable 会把第一个可用的地址设为生效地址 */
let _activeBase = '';

export function getActiveBase(): string {
  return _activeBase || getBases()[0];
}

/** @deprecated 请改用 getActiveBase()，它会跟随自定义地址切换 */
export const NETEASE_BASE_URL = NETEASE_BASES[0];

const COOKIE_KEY = 'netease_cookie';
let _cookie = localStorage.getItem(COOKIE_KEY) ?? '';

// ---------------- 原生存储封装 ----------------
// iOS 自定义 scheme 下 localStorage 可能被系统回收，关键数据同步写入
// Capacitor Preferences（原生 UserDefaults），读取时优先用原生值

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { usePrefs } from '@/stores/prefs';

async function prefGet(key: string): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    }
  } catch (err) {
    console.warn('[store] Preferences.get failed', key, err);
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function prefSet(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {}
  try {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
    }
  } catch (err) {
    console.warn('[store] Preferences.set failed', key, err);
  }
}

async function prefRemove(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {}
  try {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key });
    }
  } catch (err) {
    console.warn('[store] Preferences.remove failed', key, err);
  }
}

/** fetch 超时（ms）：防止 WKWebView 中请求挂起；Vercel 冷启动可能较慢，放宽到 20s */
export const FETCH_TIMEOUT_MS = 20000;
/** 可达性探测超时（ms）：探测只是打个 /banner 小请求，短超时避免逐个候选拖太久 */
export const PROBE_TIMEOUT_MS = 6000;

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function setCookie(value: string) {
  _cookie = value;
  clearNeteaseCache(); // 换账号了，之前拉到的歌单 / 收藏一律作废
  void prefSet(COOKIE_KEY, value);
}

export function clearCookie() {
  _cookie = '';
  clearNeteaseCache();
  void prefRemove(COOKIE_KEY);
}

// ---------------- 响应缓存（先出缓存、后台刷新） ----------------
// 以前每次进歌单都要重新等一次网络，体验很差。这里做一层 SWR 缓存：
// - TTL 内直接返回缓存，不发请求
// - 超过 TTL 也先把旧数据交出去（视图用 peek* 同步渲染），同时后台刷新
// - 登录态变化时整体失效
//
// 视图正确用法：首帧用 peek*() 初始化 state（有缓存就立刻出内容、不显示「加载中」），
// 再 await fetch*() 做一次静默刷新。

/** 缓存有效期 */
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  data: unknown;
}

const memo = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export const playlistCacheKey = (uid: number) => `playlists:${uid}`;
export const playlistDetailCacheKey = (id: number) => `playlist:${id}`;
export const likedCacheKey = (uid: number) => `liked:${uid}`;

/** 同步读缓存（没有则 undefined）——用于首帧直接渲染 */
export function peekNeteaseCache<T>(key: string): T | undefined {
  return memo.get(key)?.data as T | undefined;
}

function isFresh(key: string): boolean {
  const e = memo.get(key);
  return !!e && Date.now() - e.at < CACHE_TTL;
}

function putCache(key: string, data: unknown): void {
  memo.set(key, { at: Date.now(), data });
  persistCacheSoon();
}

// ---------------- 缓存持久化 ----------------
// 只放内存的话 App 重启（或切后台被回收）后又要重新等一次网络。
// 这里把歌单列表 / 歌单详情 / 收藏写进原生存储，启动时回填，做到「秒开」。

const PERSIST_KEY = 'ne_cache_v1';
const PERSIST_LIMIT = 1_500_000; // 约 1.5MB，超出则丢弃较旧的详情
let persistTimer: number | null = null;
let cacheHydrated = false;

/** 启动时把上次的缓存读回内存（失效与否交给 TTL/SWR 判断，旧数据也能先顶上） */
export async function hydrateNeteaseCache(): Promise<void> {
  if (cacheHydrated) return;
  cacheHydrated = true;
  try {
    const raw = await prefGet(PERSIST_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, CacheEntry>;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v.at === 'number' && 'data' in v) memo.set(k, v);
    }
  } catch (err) {
    console.warn('[netease] 缓存回填失败', err);
  }
}

function persistCacheSoon(): void {
  if (persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistCache();
  }, 800);
}

async function persistCache(): Promise<void> {
  try {
    const entries = [...memo.entries()]
      .filter(
        ([k]) =>
          k.startsWith('playlists:') || k.startsWith('playlist:') || k.startsWith('liked:'),
      )
      .sort((a, b) => b[1].at - a[1].at);

    const out: Record<string, CacheEntry> = {};
    let size = 0;
    for (const [k, v] of entries) {
      const s = JSON.stringify(v).length;
      if (size + s > PERSIST_LIMIT) continue; // 体积超了就跳过更旧的
      out[k] = v;
      size += s;
    }
    await prefSet(PERSIST_KEY, JSON.stringify(out));
  } catch (err) {
    console.warn('[netease] 缓存持久化失败', err);
  }
}

/** 登录态变化时整体失效 */
export function clearNeteaseCache(): void {
  memo.clear();
  inflight.clear();
  void prefRemove(PERSIST_KEY);
}

/** 同一个 key 的并发请求合并成一次 */
function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---------------- 登录态缓存 ----------------
// 冷启动/网络抖动导致 /user/account 暂时拿不到资料时，用缓存维持登录态，避免被踢出
// 同时写入原生存储，避免切后台后 localStorage 被回收导致掉线

const USER_KEY = 'netease_user';
let _cachedUser: NetEaseUser | null = null;

export function loadCachedUser(): NetEaseUser | null {
  if (_cachedUser) return _cachedUser;
  try {
    const s = localStorage.getItem(USER_KEY);
    if (s) {
      _cachedUser = JSON.parse(s) as NetEaseUser;
      return _cachedUser;
    }
  } catch {}
  return null;
}

export function saveCachedUser(user: NetEaseUser) {
  _cachedUser = user;
  void prefSet(USER_KEY, JSON.stringify(user));
}

export function clearCachedUser() {
  _cachedUser = null;
  void prefRemove(USER_KEY);
}

/** 启动时从原生存储恢复 cookie + 登录态（localStorage 可能被系统回收） */
export async function restoreSession(): Promise<{ cookie: boolean; user: NetEaseUser | null }> {
  const [cookie, userJson] = await Promise.all([prefGet(COOKIE_KEY), prefGet(USER_KEY)]);
  if (cookie) {
    _cookie = cookie;
    try {
      localStorage.setItem(COOKIE_KEY, cookie);
    } catch {}
  }
  if (userJson) {
    try {
      _cachedUser = JSON.parse(userJson) as NetEaseUser;
      localStorage.setItem(USER_KEY, userJson);
    } catch {}
  }
  return { cookie: !!cookie, user: _cachedUser };
}

export function hasCookie(): boolean {
  return _cookie.length > 0;
}

async function call<T = any>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  // 避免缓存
  qs.set('_t', String(Date.now()));
  const base = getActiveBase();
  const headers: Record<string, string> = {};
  if (_cookie) {
    if (base.startsWith('http')) {
      // 跨域 fetch 不允许自定义 Cookie 请求头，改用 query 参数传递
      qs.set('cookie', _cookie);
    } else {
      headers['Cookie'] = _cookie;
    }
  }
  const url = `${base}${path}${qs.toString() ? '?' + qs.toString() : ''}`;
  console.log('[netease] request', path, 'cookie-sent?', !!_cookie, _cookie ? _cookie.slice(0, 60) : '');
  const res = await fetchWithTimeout(url, { headers });
  const json: any = await res.json();
  // 提取 set-cookie 风格的 cookie（部分接口会回传）
  if (typeof json?.cookie === 'string' && json.cookie.length > 0) {
    console.log('[netease] response cookie captured', path, json.cookie.slice(0, 80));
    setCookie(json.cookie);
  }
  console.log('[netease] response', path, 'code:', json?.code, json);
  if (json?.code !== undefined && json.code !== 200 && json.code !== 802 && json.code !== 801 && json.code !== 800) {
    console.warn('[netease] non-200', path, json);
  }
  return json as T;
}

// ---------------- 登录 ----------------

export interface QrKeyResp { data: { unikey: string } }
export interface QrCreateResp { data: { qrurl: string; qrimg: string } }
export interface QrCheckResp {
  code: number; // 800=等待扫码 801=已扫 802=成功 803=过期
  message?: string;
  cookie?: string;
  /** 部分版本在 802 时会直接返回 profile */
  profile?: any;
}

/** 申请登录二维码 key */
export async function loginQrKey(): Promise<string> {
  const r = await call<QrKeyResp>('/login/qr/key', {});
  return r.data.unikey;
}

/** 生成二维码图片（返回 base64 dataURL，可直接用于 <img>） */
export async function loginQrCreate(key: string): Promise<{ qrurl: string; qrimg: string }> {
  const r = await call<QrCreateResp>('/login/qr/create', { key, qrimg: true });
  return { qrurl: r.data.qrurl, qrimg: r.data.qrimg };
}

/** 轮询扫码状态 */
export async function loginQrCheck(key: string): Promise<QrCheckResp> {
  const r = await call<QrCheckResp>('/login/qr/check', { key });
  if (r.code === 802 && r.cookie) {
    setCookie(r.cookie);
  }
  return r;
}

// ---------------- 手机号登录 ----------------
export interface CellphoneSentResp {
  code: number;
  message?: string;
}
/** 发送短信验证码 */
export async function sendCellphoneCode(phone: string): Promise<CellphoneSentResp> {
  const r = await call<CellphoneSentResp>('/captcha/sent', { phone });
  return { code: r.code, message: r.message };
}

export interface CellphoneLoginResp {
  code: number; // 200 = 成功
  message?: string;
  profile?: { userId: number; nickname: string; avatarUrl: string };
  account?: { id: number };
  cookie?: string;
}
/** 手机号 + 短信验证码登录 */
export async function loginCellphone(phone: string, captcha: string): Promise<CellphoneLoginResp> {
  const r = await call<CellphoneLoginResp>('/login/cellphone', { phone, captcha });
  if (r.code === 200 && r.cookie) {
    setCookie(r.cookie);
  }
  return r;
}

/** 用当前 cookie 验证登录态 */
export async function fetchAccount(): Promise<NetEaseUser | null> {
  if (!_cookie) return null;
  const r = await call<{ account?: any; profile?: any; code: number }>('/user/account', {});
  if (r.code !== 200 || !r.profile || !r.account) {
    // cookie 失效
    return null;
  }
  return r as unknown as NetEaseUser;
}

// ---------------- 歌单 ----------------

/** 同步读「我的歌单」缓存，用于首帧直接渲染 */
export function peekUserPlaylists(uid: number): NetEasePlaylistSummary[] | undefined {
  return peekNeteaseCache<NetEasePlaylistSummary[]>(playlistCacheKey(uid));
}

export async function fetchUserPlaylists(
  uid: number,
  force = false,
): Promise<NetEasePlaylistSummary[]> {
  // 预览模式：返回示例歌单，避免评审板里出现空列表
  if (PREVIEW.active) return DEMO_NE_PLAYLISTS;
  const key = playlistCacheKey(uid);
  if (!force && isFresh(key)) return peekNeteaseCache<NetEasePlaylistSummary[]>(key)!;
  return dedupe(key, async () => {
    const r = await call<{ playlist: NetEasePlaylistSummary[] }>('/user/playlist', {
      uid,
      limit: 50,
    });
    const list = r.playlist ?? [];
    putCache(key, list);
    return list;
  });
}

export interface PlaylistDetail {
  playlist: NetEasePlaylistSummary;
  tracks: NetEaseTrack[];
}

/** 同步读歌单详情缓存 */
export function peekPlaylistDetail(id: number): PlaylistDetail | undefined {
  return peekNeteaseCache<PlaylistDetail>(playlistDetailCacheKey(id));
}

export async function fetchPlaylistDetail(id: number, force = false): Promise<PlaylistDetail> {
  // 预览模式：返回示例歌单详情
  if (PREVIEW.active) return { playlist: DEMO_NE_PLAYLIST, tracks: DEMO_NE_TRACKS };
  const key = playlistDetailCacheKey(id);
  if (!force && isFresh(key)) return peekNeteaseCache<PlaylistDetail>(key)!;
  return dedupe(key, async () => {
    const r = await call<any>('/playlist/detail', { id });
    const pl = r.playlist;
    const ids = (pl?.trackIds ?? []).map((t: any) => t.id) as number[];
    // 详细歌曲信息（包含 ar / al / dt）
    let tracks: NetEaseTrack[] = r.playlist?.tracks ?? [];
    if (tracks.length === 0 && ids.length > 0) {
      const detail = await call<{ songs: NetEaseTrack[] }>('/song/detail', {
        ids: ids.slice(0, 200).join(','),
      });
      tracks = detail.songs ?? [];
    }
    const result: PlaylistDetail = { playlist: pl, tracks };
    putCache(key, result);
    return result;
  });
}

// ---------------- 歌曲 ----------------

/** 「我喜欢的音乐」：只要 id 列表 */
export async function fetchLikelist(uid: number): Promise<number[]> {
  if (PREVIEW.active) return DEMO_NE_TRACKS.map((t) => t.id);
  const r = await call<{ ids: number[] }>('/likelist', { uid });
  return r.ids ?? [];
}

/** 按 id 批量取歌曲详情 */
export async function fetchSongDetail(ids: number[]): Promise<NetEaseTrack[]> {
  if (PREVIEW.active) return DEMO_NE_TRACKS;
  if (!ids.length) return [];
  const r = await call<{ songs: NetEaseTrack[] }>('/song/detail', { ids: ids.join(',') });
  return r.songs ?? [];
}

/** 同步读「我喜欢的音乐」缓存，用于首帧直接渲染 */
export function peekLikedTracks(uid: number): NetEaseTrack[] | undefined {
  return peekNeteaseCache<NetEaseTrack[]>(likedCacheKey(uid));
}

/**
 * 「我喜欢的音乐」完整曲目：/likelist 拿 id → /song/detail 拿详情。
 * 两步合并成一个缓存项，返回再进不会重新请求。
 */
export async function fetchLikedTracks(uid: number, force = false): Promise<NetEaseTrack[]> {
  if (PREVIEW.active) return DEMO_NE_TRACKS;
  const key = likedCacheKey(uid);
  if (!force && isFresh(key)) return peekNeteaseCache<NetEaseTrack[]>(key)!;
  return dedupe(key, async () => {
    const ids = await fetchLikelist(uid);
    const list = await fetchSongDetail(ids.slice(0, 300));
    putCache(key, list);
    return list;
  });
}

/** 网易云封面小图地址（300×300） */
export function neteaseArtwork(t: NetEaseTrack): string | undefined {
  return t.al?.picUrl ? `${t.al.picUrl.replace(/^http:/, 'https:')}?param=300y300` : undefined;
}

/**
 * 搜索歌曲（/cloudsearch）。
 * 返回的曲目带 name/ar/al/dt，可以直接交给 player.playNeteaseTrack 播放。
 */
export async function searchSongs(keywords: string, limit = 30): Promise<NetEaseTrack[]> {
  const kw = keywords.trim();
  if (!kw) return [];

  // 预览模式：按关键词过滤示例曲目，方便评审板里看列表排版
  if (PREVIEW.active) {
    const q = kw.toLowerCase();
    return DEMO_NE_TRACKS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.ar ?? []).some((a) => a.name.toLowerCase().includes(q)),
    );
  }

  const key = `search:${kw}:${limit}`;
  if (isFresh(key)) return peekNeteaseCache<NetEaseTrack[]>(key)!;
  return dedupe(key, async () => {
    const r = await call<{ result?: { songs?: NetEaseTrack[] } }>('/cloudsearch', {
      keywords: kw,
      type: 1,
      limit,
    });
    const list = r.result?.songs ?? [];
    putCache(key, list);
    return list;
  });
}

export interface SongUrlItem {
  id: number;
  url: string | null;
  br: number;
  size: number;
  type?: string;
}

export async function fetchSongUrl(id: number, br = 320000): Promise<SongUrlItem | null> {
  // 预览模式：给个拿不到的地址。这样 playTrack 仍会写入 currentTrack/queue
  // （「点歌 → 播放页」的流程能走完），但不会真的出声、也不会触发 ended 连锁切歌
  if (PREVIEW.active) return { id, url: '/__preview_silence.mp3', br, size: 0 };
  const r = await call<{ data: SongUrlItem[] }>('/song/url', { id, br });
  return r.data?.[0] ?? null;
}

// ---------------- 网易云曲目查表 ----------------
// 队列里只存 `netease:<id>` 字符串，next()/previous() 靠这张表还原出完整曲目

const neteaseTrackMap = new Map<string, NetEaseTrack>();

export function rememberNeteaseTracks(tracks: NetEaseTrack[]): void {
  for (const t of tracks) neteaseTrackMap.set(`netease:${t.id}`, t);
}

export function lookupNeteaseTrack(id: string): NetEaseTrack | undefined {
  return neteaseTrackMap.get(id);
}

// ---------------- 服务可达性 ----------------

/** 最近一次可达性检查失败的原因（供 UI 显示 / 排查） */
let _lastApiError = '';

export function getLastApiError(): string {
  return _lastApiError;
}

/** 逐个探测候选地址：第一个可用的会成为生效地址 */
async function probeBase(base: string): Promise<{ ok: boolean; reason: string }> {
  try {
    const res = await fetchWithTimeout(`${base}/banner?type=0&_t=${Date.now()}`, undefined, PROBE_TIMEOUT_MS);
    let json: any;
    try {
      json = await res.json();
    } catch {
      return { ok: false, reason: `HTTP ${res.status}，响应不是 JSON` };
    }
    if (json?.code !== 200) {
      return { ok: false, reason: `HTTP ${res.status}，code=${json?.code}` };
    }
    return { ok: true, reason: '' };
  } catch (err: any) {
    const msg =
      err?.name === 'AbortError'
        ? `请求超时（${PROBE_TIMEOUT_MS / 1000}s 无响应）`
        : String(err?.message ?? err);
    return { ok: false, reason: msg };
  }
}

/** 检查网易云 API 服务是否可达，失败时记录原因 */
export async function checkApiAvailable(): Promise<boolean> {
  _activeBase = ''; // 重新走完整探测，避免沿用切换前的旧地址
  const reasons: string[] = [];
  for (const base of getBases()) {
    const host = base.replace(/^https?:\/\//, '');
    const r = await probeBase(base);
    if (r.ok) {
      _activeBase = base;
      _lastApiError = '';
      return true;
    }
    reasons.push(`${host}: ${r.reason}`);
  }
  _lastApiError = reasons.join(' | ').slice(0, 160);
  return false;
}

/** 重置生效地址（切换自定义地址后调用） */
export function resetActiveBase(): void {
  _activeBase = '';
}