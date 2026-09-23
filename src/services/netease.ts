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
// 本地开发如需走 Vite 代理，在 .env.local 设置 VITE_NETEASE_API=/netease
const BASE: string =
  ((import.meta as any).env?.VITE_NETEASE_API as string | undefined) ||
  'https://api-enhanced-five-puce.vercel.app';

export const NETEASE_BASE_URL = BASE;

const COOKIE_KEY = 'netease_cookie';
let _cookie = localStorage.getItem(COOKIE_KEY) ?? '';

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
    if (BASE.startsWith('http')) {
      // 跨域 fetch 不允许自定义 Cookie 请求头，改用 query 参数传递
      qs.set('cookie', _cookie);
    } else {
      headers['Cookie'] = _cookie;
    }
  }
  const url = `${BASE}${path}${qs.toString() ? '?' + qs.toString() : ''}`;
  console.log('[netease] request', path, 'cookie-sent?', !!_cookie, _cookie ? _cookie.slice(0, 60) : '');
  const res = await fetch(url, { headers });
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
    artworkUrl: `${t.al.picUrl}?param=300y300`,
    fileName: 'netease.mp3',
    importedAt: Date.now(),
    liked: false,
  };
}

// ---------------- 服务可达性 ----------------

/** 检查本地 NeteaseCloudMusicApi 服务是否可达 */
export async function checkApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/banner?type=0&_t=${Date.now()}`);
    const json: any = await res.json();
    return json?.code === 200;
  } catch {
    return false;
  }
}