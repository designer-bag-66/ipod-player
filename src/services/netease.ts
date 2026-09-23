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
const DEFAULT_BASES = [
  'https://api.6qxxvp.top',
  'https://api-enhanced-five-puce.vercel.app',
];

const ENV_BASE = ((import.meta as any).env?.VITE_NETEASE_API as string | undefined) || '';

export const NETEASE_BASES: string[] = ENV_BASE
  ? [ENV_BASE, ...DEFAULT_BASES.filter((b) => b !== ENV_BASE)]
  : DEFAULT_BASES;

/** 当前生效的地址；checkApiAvailable 会把第一个可用的地址设为生效地址 */
let _activeBase = NETEASE_BASES[0];

export function getActiveBase(): string {
  return _activeBase;
}

export const NETEASE_BASE_URL = NETEASE_BASES[0];

const COOKIE_KEY = 'netease_cookie';
let _cookie = localStorage.getItem(COOKIE_KEY) ?? '';

/** fetch 超时（ms）：防止 WKWebView 中请求挂起；Vercel 冷启动可能较慢，放宽到 20s */
export const FETCH_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function setCookie(value: string) {
  _cookie = value;
  try {
    localStorage.setItem(COOKIE_KEY, value);
  } catch {}
}

export function clearCookie() {
  _cookie = '';
  try {
    localStorage.removeItem(COOKIE_KEY);
  } catch {}
}

// ---------------- 登录态缓存 ----------------
// 冷启动/网络抖动导致 /user/account 暂时拿不到资料时，用缓存维持登录态，避免被踢出

const USER_KEY = 'netease_user';

export function loadCachedUser(): NetEaseUser | null {
  try {
    const s = localStorage.getItem(USER_KEY);
    return s ? (JSON.parse(s) as NetEaseUser) : null;
  } catch {
    return null;
  }
}

export function saveCachedUser(user: NetEaseUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearCachedUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export function hasCookie(): boolean {
  return _cookie.length > 0;
}

async function call<T = any>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  // 避免缓存
  qs.set('_t', String(Date.now()));
  const headers: Record<string, string> = {};
  if (_cookie) {
    if (_activeBase.startsWith('http')) {
      // 跨域 fetch 不允许自定义 Cookie 请求头，改用 query 参数传递
      qs.set('cookie', _cookie);
    } else {
      headers['Cookie'] = _cookie;
    }
  }
  const url = `${_activeBase}${path}${qs.toString() ? '?' + qs.toString() : ''}`;
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
    const res = await fetchWithTimeout(`${base}/banner?type=0&_t=${Date.now()}`);
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
        ? `请求超时（${FETCH_TIMEOUT_MS / 1000}s 无响应）`
        : String(err?.message ?? err);
    return { ok: false, reason: msg };
  }
}

/** 检查网易云 API 服务是否可达，失败时记录原因 */
export async function checkApiAvailable(): Promise<boolean> {
  const reasons: string[] = [];
  for (const base of NETEASE_BASES) {
    const host = base.replace(/^https?:\/\//, '');
    const r = await probeBase(base);
    if (r.ok) {
      _activeBase = base;
      _lastApiError = '';
      return true;
    }
    reasons.push(`${host}: ${r.reason}`);
  }
  _lastApiError = reasons.join(' | ').slice(0, 120);
  return false;
}