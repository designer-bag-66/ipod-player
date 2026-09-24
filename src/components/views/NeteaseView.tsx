// ============================================================
// 网易云相关界面
// - NeteaseLoginView：手机号 + 短信验证码登录（替代扫码）
// - NeteasePlaylistsView / NeteasePlaylistView：歌单与播放
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import type { MenuItem } from '@/types';
import { NETEASE_BASES } from '@/services/netease';

export interface NeteaseViewProps {
  playlistId?: number;
}

/** 模块级缓存，供 SELECT 事件在 main.tsx 中查到对应 id */
let cachedPlaylists: any[] = [];
let cachedPlaylist: any = null;

function toNeteaseTrack(t: any) {
  return {
    id: `netease:${t.id}`,
    title: t.name,
    artist: (t.ar || t.artists || []).map((a: any) => a.name).join('/') || '未知艺人',
    album: (t.al && t.al.name) || '未知专辑',
    artworkUrl: t.al && t.al.picUrl ? `${t.al.picUrl}?param=300y300` : undefined,
    duration: Math.floor((t.dt || 0) / 1000),
  };
}

// 播放歌单中的某一首（纯播放，不改写曲库）
export function playNeteaseSongAt(playlist: any, idx: number) {
  const tracks = (playlist.tracks || []).map(toNeteaseTrack);
  const t = tracks[idx];
  if (!t) return;
  usePlayer.getState().playNeteaseTrack(t, tracks);
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
  const push = useNavigation((s) => s.push);
  const setItems = useNavigation((s) => s.setItems);

  // 登录成功后跳转到歌单列表
  useEffect(() => {
    if (user) {
      const t = window.setTimeout(() => push({ name: 'netease.playlists' }), 600);
      return () => window.clearTimeout(t);
    }
  }, [user, push]);

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
          登录成功，正在进入…
        </div>
      </div>
    );
  }

  if (!apiOnline) {
    return (
      <div className="text-center mt-6 px-3">
        <div className="text-[13px] font-bold mb-2" style={{ color: 'var(--screen-text-primary)' }}>
          无法连接网易云 API
        </div>
        <div className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--screen-text-secondary)' }}>
          {errorMessage}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--screen-text-muted)' }}>
          按 SELECT 重试连接
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
        <div className="mt-2 px-2 text-[9px] whitespace-pre-wrap break-all text-center" style={{ color: 'var(--screen-text-muted)' }}>
          [debug] {loginDebug}
        </div>
      ) : null}
    </div>
  );
}

export function NeteasePlaylistsView() {
  const user = useAuth((s) => s.user);
  const push = useNavigation((s) => s.push);
  const setItems = useNavigation((s) => s.setItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playlists, setPlaylists] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${NETEASE_BASES[0]}/user/playlist?uid=${user?.account.id}&timestamp=${Date.now()}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (data.code === 200) {
        setPlaylists(data.playlist || []);
      } else {
        setError(data.message || `加载失败（code=${data.code}）`);
      }
    } catch (e: any) {
      setError(String(e));
      useAuth.getState().refreshAccount();
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    cachedPlaylists = playlists;
    setItems(
      playlists.map((p) => ({
        kind: 'submenu' as const,
        label: p.name,
        meta: `${(p.trackCount || 0)} 首`,
      })) as MenuItem[],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists]);

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
        <div className="text-[10px] mb-2" style={{ color: 'var(--screen-text-secondary)' }}>
          {error}
        </div>
        <button className="np-btn" onClick={load}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pt-2">
      <div className="text-[10px] mb-1" style={{ color: 'var(--screen-text-muted)' }}>
        共 {playlists.length} 个歌单
      </div>
      <button className="np-btn" onClick={() => useAuth.getState().logout()}>
        退出登录
      </button>
    </div>
  );
}

export function NeteasePlaylistView({ playlistId }: NeteaseViewProps) {
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const push = useNavigation((s) => s.push);
  const setItems = useNavigation((s) => s.setItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playlist, setPlaylist] = useState<any>(null);

  const load = async () => {
    if (playlistId == null) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${NETEASE_BASES[0]}/playlist/detail?id=${playlistId}&timestamp=${Date.now()}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (data.code === 200) {
        const tracks = (data.playlist.tracks || []).map(toNeteaseTrack);
        setPlaylist({ ...data.playlist, tracks });
      } else {
        setError(data.message || `加载失败（code=${data.code}）`);
      }
    } catch (e: any) {
      setError(String(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  useEffect(() => {
    if (!playlist) return;
    cachedPlaylist = playlist;
    setItems(
      playlist.tracks.map((t: any) => ({
        kind: 'action' as const,
        label: t.title,
        meta: t.artist,
        disabled: false,
      })) as MenuItem[],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

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
        <div className="text-[10px] mb-2" style={{ color: 'var(--screen-text-secondary)' }}>
          {error}
        </div>
        <button className="np-btn" onClick={() => void load()}>
          重试
        </button>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-2 mb-2">
        {playlist.coverImgUrl ? (
          <img
            src={`${playlist.coverImgUrl}?param=96y96`}
            className="w-12 h-12 rounded-lg"
            alt="cover"
          />
        ) : null}
        <div className="min-w-0">
          <div className="text-[12px] font-bold truncate" style={{ color: 'var(--screen-text-primary)' }}>
            {playlist.name}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--screen-text-muted)' }}>
            {playlist.tracks.length} 首
          </div>
        </div>
      </div>
      <div className="text-[10px] mb-2" style={{ color: 'var(--screen-text-muted)' }}>
        滚动选择歌曲，按 SELECT 播放
      </div>
      {playlist.tracks[selectedIndex] ? (
        <button
          className="np-btn"
          onClick={() => playNeteaseSongAt(playlist, selectedIndex)}
        >
          播放选中
        </button>
      ) : null}
    </div>
  );
}

export function selectNeteasePlaylistItem(index: number) {
  const p = cachedPlaylists[index];
  if (p) useNavigation.getState().push({ name: 'netease.playlist', playlistId: p.id });
}

/** 在当前歌单内播放指定索引（供轮盘 SELECT 与「播放选中」按钮共用） */
export function playSelectedPlaylistTrack(index: number) {
  if (cachedPlaylist) playNeteaseSongAt(cachedPlaylist, index);
}
