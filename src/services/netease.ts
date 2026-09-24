// ============================================================
// 网易云音乐 API 客户端（基于 NeteaseCloudMusicApi）
// 仅在本地开发时调用（通过 Vite 代理 /netease → localhost:3000）
// ============================================================

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
  void prefSet(COOKIE_KEY, value);
}

export function clearCookie() {
  _cookie = '';
  void prefRemove(COOKIE_KEY);
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

export async function fetchUserPlaylists(uid: number): Promise<NetEasePlaylistSummary[]> {
  const r = await call<{ playlist: NetEasePlaylistSummary[] }>('/user/playlist', { uid, limit: 50 });
  return r.playlist ?? [];
}

export async function fetchPlaylistDetail(id: number): Promise<{
  playlist: NetEasePlaylistSummary;
  tracks: NetEaseTrack[];
}> {
  const r = await call<any>('/playlist/detail', { id });
  const pl = r.playlist;
  const ids = (pl?.trackIds ?? []).map((t: any) => t.id) as number[];
  // 详细歌曲信息（包含 ar / al / dt）
  let tracks: NetEaseTrack[] = r.playlist?.tracks ?? [];
  if (tracks.length === 0 && ids.length > 0) {
    const detail = await call<{ songs: NetEaseTrack[] }>('/song/detail', { ids: ids.slice(0, 200).join(',') });
    tracks = detail.songs ?? [];
  }
  return { playlist: pl, tracks };
}

// ---------------- 歌曲 ----------------

export interface SongUrlItem {
  id: number;
  url: string | null;
  br: number;
  size: number;
  type?: string;
}

export async function fetchSongUrl(id: number, br = 320000): Promise<SongUrlItem | null> {
  const r = await call<{ data: SongUrlItem[] }>('/song/url', { id, br });
  return r.data?.[0] ?? null;
}

// 内部：根据网易云 track.id 生成代理 URL
export function streamUrlOf(trackId: number | string): string {
  return `/netease-stream?u=${encodeURIComponent('PLACEHOLDER')}`;
}

// ---------------- 类型转换 ----------------

const neteaseTrackMap = new Map<string, NetEaseTrack>();

export function rememberNeteaseTracks(tracks: NetEaseTrack[]): void {
  for (const t of tracks) neteaseTrackMap.set(`netease:${t.id}`, t);
}

export function lookupNeteaseTrack(id: string): NetEaseTrack | undefined {
  return neteaseTrackMap.get(id);
}

/** NetEase 歌曲 → 本地 Track 形态（id 前缀 netease: 用于走代理） */
export function neteaseToLocalTrack(t: NetEaseTrack): import('@/types').Track {
  const id = `netease:${t.id}`;
  neteaseTrackMap.set(id, t);
  return {
    id,
    title: t.name,
    artist: t.ar.map((a) => a.name).join(' / '),
    album: t.al.name,
    duration: t.dt / 1000,
    artworkUrl: t.al?.picUrl ? `${t.al.picUrl.replace(/^http:/, 'https:')}?param=300y300` : undefined,
    fileName: 'netease.mp3',
    importedAt: Date.now(),
    liked: false,
  };
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