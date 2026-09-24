// ============================================================
// 网易云相关界面
// - NeteaseLoginView：手机号 + 短信验证码登录（替代扫码）
// - NeteasePlaylistsView / NeteasePlaylistView：歌单与播放
// 请求统一走 services/netease 的 call()（自动带登录 cookie）；
// 歌曲一律保留接口原始字段（name/ar/al/dt），player 依赖这些字段
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { ListMenu } from '@/components/ui/ListMenu';
import {
  fetchUserPlaylists,
  fetchPlaylistDetail,
  peekUserPlaylists,
  peekPlaylistDetail,
  neteaseArtwork,
  rememberNeteaseTracks,
  type NetEaseTrack,
} from '@/services/netease';
import type { MenuItem } from '@/types';

export interface NeteaseViewProps {
  playlistId?: number;
}

/** 模块级缓存，供 SELECT 事件在 main.tsx 中查到对应 id */
let cachedPlaylists: any[] = [];
let cachedPlaylist: any = null;

function trackLabel(t: any): string {
  return t?.name ?? '未知歌曲';
}

function trackMeta(t: any): string {
  return (t?.ar || t?.artists || []).map((a: any) => a.name).join('/') || '未知艺人';
}

/**
 * 播放歌单中的某一首。
 * 必须传原始 NetEaseTrack：player.playNeteaseTrack 读的是 name/ar/al/dt
 */
export function playNeteaseSongAt(playlist: any, idx: number) {
  const tracks: NetEaseTrack[] = playlist?.tracks ?? [];
  const t = tracks[idx];
  if (!t) return;
  rememberNeteaseTracks(tracks); // 注册进查表，next()/previous() 才能还原曲目
  void usePlayer.getState().playNeteaseTrack(t, tracks);
}

export function NeteaseLoginView() {
  const apiOnline = useAuth((s) => s.apiOnline);
  const user = useAuth((s) => s.user);
  const phone = useAuth((s) => s.phone);
  const code = useAuth((s) => s.code);
  const codeStatus = useAuth((s) => s.codeStatus);
  const codeError = useAuth((s) => s.codeError);
  const errorMessage = useAuth((s) => s.errorMessage);
  const loginDebug = useAuth((s) => s.loginDebug);
  const setPhone = useAuth((s) => s.setPhone);
  const setCode = useAuth((s) => s.setCode);
  const sendCode = useAuth((s) => s.sendCode);
  const verifyCode = useAuth((s) => s.verifyCode);
  const setItems = useNavigation((s) => s.setItems);

  // 登录入口在「设置」里，成功后返回上一页（也就是设置）
  useEffect(() => {
    if (user) {
      const t = window.setTimeout(() => useNavigation.getState().back(), 700);
      return () => window.clearTimeout(t);
    }
  }, [user]);

  // 注册一条 action，使轮盘 SELECT 也能触发主操作
  useEffect(() => {
    (NeteaseLoginView as any).__select = () => {
      useAuth.getState().primaryAction();
    };
    const label = !apiOnline ? '重试连接' : codeStatus === 'sent' ? '登录' : '获取验证码';
    setItems([{ kind: 'action', label, meta: '' }]);
    return () => {
      setItems([]);
      (NeteaseLoginView as any).__select = undefined;
    };
  }, [apiOnline, codeStatus, setItems]);

  if (user) {
    return (
      <div className="flex flex-col items-center mt-6">
        {user.profile.avatarUrl ? (
          <img src={user.profile.avatarUrl} className="w-12 h-12 rounded-full mb-2" alt="avatar" />
        ) : null}
        <div className="text-[13px] font-bold" style={{ color: 'var(--screen-text-primary)' }}>
          {user.profile.nickname}
        </div>
        <div className="text-[10px] mt-1" style={{ color: 'var(--screen-text-muted)' }}>
          登录成功，正在返回…
        </div>
      </div>
    );
  }

  if (!apiOnline) {
    return (
      <div className="text-center mt-5 px-3">
        <div className="text-[13px] font-bold mb-2" style={{ color: 'var(--screen-text-primary)' }}>
          无法连接网易云 API
        </div>
        <div
          className="text-[10px] leading-relaxed mb-2 break-all"
          style={{ color: 'var(--screen-text-secondary)' }}
        >
          {errorMessage}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--screen-text-muted)' }}>
          按 SELECT 重试连接
        </div>
        <div className="text-[9px] mt-3 leading-relaxed" style={{ color: 'var(--screen-text-muted)' }}>
          内置地址为 Vercel 托管，手机网络常不可达。
          <br />
          到「设置 → 网易云 API 地址」可填自建地址。
        </div>
      </div>
    );
  }

  const sending = codeStatus === 'sending';
  const sent = codeStatus === 'sent';
  const verifying = codeStatus === 'verifying';

  return (
    <div className="h-full w-full flex flex-col items-center justify-start pt-3 pb-3 px-4">
      <div className="text-[12px] font-bold mb-3" style={{ color: 'var(--screen-text-primary)' }}>
        网易云手机号登录
      </div>

      <input
        className="np-input"
        type="tel"
        inputMode="numeric"
        placeholder="请输入手机号"
        value={phone}
        maxLength={11}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="np-input"
        type="tel"
        inputMode="numeric"
        placeholder="短信验证码"
        value={code}
        maxLength={6}
        disabled={!sent && !verifying}
        onChange={(e) => setCode(e.target.value)}
        style={{ marginTop: 8 }}
      />

      <button
        className="np-btn"
        disabled={sending || verifying}
        onClick={() => (sent || verifying ? verifyCode() : sendCode())}
      >
        {sent || verifying ? (verifying ? '登录中…' : '登录') : sending ? '发送中…' : '获取验证码'}
      </button>

      {codeError ? (
        <div className="text-[11px] mt-3 text-center" style={{ color: '#ff4d5e' }}>
          {codeError}
        </div>
      ) : null}

      <div className="text-[9px] mt-3 text-center leading-relaxed" style={{ color: 'var(--screen-text-muted)' }}>
        {sent ? '验证码已发送，请查收短信' : '使用手机号 + 短信验证码登录'}
      </div>

      {loginDebug ? (
        <div
          className="mt-2 px-2 text-[9px] whitespace-pre-wrap break-all text-center"
          style={{ color: 'var(--screen-text-muted)' }}
        >
          [debug] {loginDebug}
        </div>
      ) : null}
    </div>
  );
}

/** 网易云接口要的 uid（注意它不等于 account.id） */
function uidOf(user: { profile?: { userId?: number }; account?: { id?: number } } | null): number {
  return user?.profile?.userId ?? user?.account?.id ?? 0;
}

export function NeteasePlaylistsView() {
  const user = useAuth((s) => s.user);
  const setItems = useNavigation((s) => s.setItems);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const setIndex = useNavigation((s) => s.setIndex);

  const uid = uidOf(user);
  // 有缓存就首帧直接出内容，不再闪「加载歌单中…」
  const cachedPlaylistsList = uid ? peekUserPlaylists(uid) : undefined;
  const [playlists, setPlaylists] = useState<any[]>(cachedPlaylistsList ?? []);
  const [loading, setLoading] = useState(!!uid && !cachedPlaylistsList);
  const [error, setError] = useState('');

  const listItems = useMemo<MenuItem[]>(
    () =>
      playlists.map((p) => ({
        kind: 'submenu' as const,
        label: p.name,
        meta: `${p.trackCount || 0} 首`,
      })),
    [playlists],
  );

  const load = async (force = false) => {
    if (!uid) return;
    // 已有缓存时不再显示「加载中」，只在后台把列表换掉
    if (!peekUserPlaylists(uid)) setLoading(true);
    setError('');
    try {
      setPlaylists(await fetchUserPlaylists(uid, force));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    cachedPlaylists = playlists;
    setItems(listItems);
  }, [listItems, setItems]);

  // 登录入口统一在「设置」里，这里只做引导
  if (!user) {
    return (
      <div className="text-center mt-6 px-3">
        <div
          className="text-[10px] leading-relaxed mb-2"
          style={{ color: 'var(--screen-text-secondary)' }}
        >
          还没有登录网易云账号
        </div>
        <button
          className="np-btn"
          onClick={() => useNavigation.getState().push({ name: 'settings' })}
        >
          去设置登录
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center mt-6 text-[11px]" style={{ color: 'var(--screen-text-secondary)' }}>
        加载歌单中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center mt-6 px-3">
        <div className="text-[11px] mb-2" style={{ color: 'var(--screen-text-primary)' }}>
          加载失败
        </div>
        <div className="text-[10px] mb-2 break-all" style={{ color: 'var(--screen-text-secondary)' }}>
          {error}
        </div>
        <button className="np-btn" onClick={() => void load(true)}>
          重试
        </button>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="text-center mt-6 px-3">
        <div className="text-[10px] leading-relaxed" style={{ color: 'var(--screen-text-secondary)' }}>
          没拿到歌单：登录可能已失效，或该账号暂无歌单
        </div>
        <button className="np-btn" onClick={() => void load(true)}>
          重试
        </button>
      </div>
    );
  }

  return (
    <ListMenu
      items={listItems}
      selectedIndex={selectedIndex}
      onPick={(i) => {
        setIndex(i);
        selectNeteasePlaylistItem(i);
      }}
    />
  );
}

export function NeteasePlaylistView({ playlistId }: NeteaseViewProps) {
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const setIndex = useNavigation((s) => s.setIndex);
  const setItems = useNavigation((s) => s.setItems);
  // 有缓存就用缓存做首帧，避免「加载歌曲中…」
  const firstDetail = playlistId != null ? peekPlaylistDetail(playlistId) : undefined;
  const [loading, setLoading] = useState(!firstDetail);
  const [error, setError] = useState('');
  const [playlist, setPlaylist] = useState<any>(
    firstDetail ? { ...firstDetail.playlist, tracks: firstDetail.tracks || [] } : null,
  );

  const listItems = useMemo<MenuItem[]>(
    () =>
      (playlist?.tracks ?? []).map((t: any) => ({
        kind: 'action' as const,
        label: trackLabel(t),
        meta: trackMeta(t),
        artwork: { url: neteaseArtwork(t as NetEaseTrack) },
      })),
    [playlist],
  );

  const load = async (force = false) => {
    if (playlistId == null) return;
    // 已有缓存时静默刷新，不闪「加载歌曲中…」
    if (!peekPlaylistDetail(playlistId)) setLoading(true);
    setError('');
    try {
      const detail = await fetchPlaylistDetail(playlistId, force);
      // 保留原始字段，交给 playNeteaseTrack
      setPlaylist({ ...detail.playlist, tracks: detail.tracks || [] });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setLoading(false);
  };

  useEffect(() => {
    // 同一实例切换到另一个歌单时，先用缓存顶上，别显示上一个歌单
    const c = playlistId != null ? peekPlaylistDetail(playlistId) : undefined;
    setPlaylist(c ? { ...c.playlist, tracks: c.tracks || [] } : null);
    setLoading(!c);
    setError('');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  useEffect(() => {
    if (!playlist) return;
    cachedPlaylist = playlist;
    setItems(listItems);
  }, [playlist, listItems, setItems]);

  if (loading) {
    return (
      <div className="text-center mt-6 text-[11px]" style={{ color: 'var(--screen-text-secondary)' }}>
        加载歌曲中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center mt-6 px-3">
        <div className="text-[11px] mb-2" style={{ color: 'var(--screen-text-primary)' }}>
          加载失败
        </div>
        <div className="text-[10px] mb-2 break-all" style={{ color: 'var(--screen-text-secondary)' }}>
          {error}
        </div>
        <button className="np-btn" onClick={() => void load(true)}>
          重试
        </button>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 pt-1 pb-1">
        {playlist.coverImgUrl ? (
          <img
            src={`${playlist.coverImgUrl}?param=96y96`}
            className="w-9 h-9 rounded-md"
            alt="cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] font-bold truncate"
            style={{ color: 'var(--screen-text-primary)' }}
          >
            {playlist.name}
          </div>
          <div className="text-[9px]" style={{ color: 'var(--screen-text-muted)' }}>
            {playlist.tracks.length} 首 · 点按播放
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ListMenu
          items={listItems}
          selectedIndex={selectedIndex}
          onPick={(i) => {
            setIndex(i);
            playNeteaseSongAt(playlist, i);
          }}
        />
      </div>
    </div>
  );
}

export function selectNeteasePlaylistItem(index: number) {
  const p = cachedPlaylists[index];
  if (p) useNavigation.getState().push({ name: 'netease.playlist', playlistId: p.id });
}

/** 在当前歌单内播放指定索引（供轮盘 SELECT 与列表点按共用） */
export function playSelectedPlaylistTrack(index: number) {
  if (cachedPlaylist) playNeteaseSongAt(cachedPlaylist, index);
}
