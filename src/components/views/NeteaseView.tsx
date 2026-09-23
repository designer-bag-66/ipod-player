// ============================================================
// 网易云视图：登录 + 我的歌单 + 歌单详情
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { ListMenu } from '@/components/ui/ListMenu';
import {
  fetchUserPlaylists,
  fetchPlaylistDetail,
  hasCookie,
  type NetEasePlaylistSummary,
  type NetEaseTrack,
  type NetEaseUser,
} from '@/services/netease';

// ============================================================
// 登录视图（QR 扫码）
// ============================================================
export function NeteaseLoginView() {
  const apiOnline = useAuth((s) => s.apiOnline);
  const user = useAuth((s) => s.user);
  const qrImg = useAuth((s) => s.qrImg);
  const qrStatus = useAuth((s) => s.qrStatus);
  const errorMessage = useAuth((s) => s.errorMessage);
  const accountError = useAuth((s) => s.accountError);
  const startLogin = useAuth((s) => s.startLogin);
  const resetLogin = useAuth((s) => s.resetLogin);
  const refreshAccount = useAuth((s) => s.refreshAccount);
  const setItems = useNavigation((s) => s.setItems);
  const push = useNavigation((s) => s.push);

  // 登录成功（user 已就绪）→ 0.6s 后跳到歌单列表
  useEffect(() => {
    if (user) {
      const t = window.setTimeout(() => {
        push({ name: 'netease.playlists' });
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [user, push]);

  // QR 已成功但 fetchAccount 失败 → 也跳到歌单（让歌单页继续重试）
  useEffect(() => {
    if (qrStatus === 'success' && !user && accountError) {
      // 不自动跳，让用户手动按 SELECT 重试 / 进入
    }
  }, [qrStatus, user, accountError]);

  // 列表项注册
  useEffect(() => {
    let label = apiOnline ? '使用网易云 APP 扫码' : '请先启动本地服务';
    if (qrStatus === 'expired') label = '二维码已过期';
    if (qrStatus === 'success' && !user) label = '登录成功，按 SELECT 重试';

    setItems([
      { kind: 'title', label },
      { kind: 'action', label: qrImg ? '刷新二维码' : '生成二维码', meta: '' },
      ...(qrStatus === 'success' && !user
        ? [{ kind: 'action' as const, label: '重试获取用户信息', meta: '' }]
        : []),
    ]);
  }, [apiOnline, qrImg, qrStatus, user, accountError, setItems]);

  // 进入登录页：API 在线则自动生成 QR
  useEffect(() => {
    if (apiOnline && !qrImg && qrStatus === 'idle') {
      startLogin();
    }
  }, [apiOnline, qrImg, qrStatus, startLogin]);

  // 离开登录页：清理轮询 + 状态
  useEffect(() => {
    return () => {
      resetLogin();
    };
  }, [resetLogin]);

  // 处理登录页 SELECT：item.label 区分动作
  useEffect(() => {
    (NeteaseLoginView as any).__select = (idx: number, label: string) => {
      if (label === '重试获取用户信息') {
        refreshAccount();
        return;
      }
      if (label === '刷新二维码' || label === '生成二维码') {
        startLogin();
        return;
      }
    };
  }, [refreshAccount, startLogin]);

  return (
    <div className="h-full w-full flex flex-col items-center justify-start pt-2 pb-2 px-3">
      {!apiOnline ? (
        <div className="text-center mt-6">
          <div className="text-[13px] font-bold mb-2" style={{ color: 'var(--screen-text-primary)' }}>
            无法连接本地服务
          </div>
          <div className="text-[11px] leading-relaxed" style={{ color: 'var(--screen-text-secondary)' }}>
            请先启动网易云 API（端口 3000）：
            <div className="my-1 px-2 py-1 bg-black/5 rounded font-mono text-[10px] text-left">
              cd D:\tools\NeteaseCloudMusicApi
              <br />
              node app.js
            </div>
            看到 <span className="font-mono">server running @ http://localhost:3000</span> 后回到本应用
          </div>
        </div>
      ) : qrStatus === 'success' && !user ? (
        <>
          <div className="qr-frame" style={{ opacity: 0.4 }}>
            {qrImg && <img src={qrImg} alt="qrcode" className="qr-img" />}
          </div>
          <div className="qr-status mt-3 text-[12px] font-bold" style={{ color: '#1a936f' }}>
            ✓ 扫码成功
          </div>
          <div className="qr-status mt-1 text-[11px]" style={{ color: 'var(--screen-text-secondary)' }}>
            {accountError || '正在获取用户信息…'}
          </div>
          <div className="qr-tip mt-1 text-[9px]" style={{ color: 'var(--screen-text-muted)' }}>
            按 SELECT 重试获取用户信息
          </div>
        </>
      ) : user ? (
        <div className="flex flex-col items-center mt-6">
          <img src={user.profile.avatarUrl} className="w-12 h-12 rounded-full mb-2" alt="avatar" />
          <div className="text-[13px] font-bold" style={{ color: 'var(--screen-text-primary)' }}>
            {user.profile.nickname}
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--screen-text-muted)' }}>
            登录成功，正在进入…
          </div>
        </div>
      ) : (
        <>
          <div className="qr-frame">
            {qrImg ? (
              <img src={qrImg} alt="qrcode" className="qr-img" />
            ) : (
              <div className="qr-placeholder">生成中…</div>
            )}
          </div>
          <div className="qr-status mt-2 text-[11px]" style={{ color: 'var(--screen-text-secondary)' }}>
            {qrStatus === 'ready' && '请使用网易云 APP 扫码'}
            {qrStatus === 'scanned' && '已扫码，请在手机上确认登录'}
            {qrStatus === 'expired' && '二维码已过期，按 SELECT 刷新'}
            {qrStatus === 'error' && (errorMessage || '出错，请重试')}
            {qrStatus === 'idle' && '准备中…'}
          </div>
          <div className="qr-tip mt-1 text-[9px]" style={{ color: 'var(--screen-text-muted)' }}>
            网易云 APP → 我的 → 右上角扫码
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// 我的歌单列表
// ============================================================
export function NeteasePlaylistsView() {
  const user = useAuth((s) => s.user);
  const refreshAccount = useAuth((s) => s.refreshAccount);
  const logout = useAuth((s) => s.logout);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const push = useNavigation((s) => s.push);

  const [list, setList] = useState<NetEasePlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // 进入时若无 user 但 cookie 还在，尝试补救
  useEffect(() => {
    if (!user && hasCookie()) {
      console.log('[netease] trying to refresh account on playlists view');
      refreshAccount();
    }
  }, [user, refreshAccount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchUserPlaylists(user.account.id);
        if (!cancelled) setList(data);
      } catch (err) {
        console.error('[netease] playlists failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const items: any[] = [];
    if (user) {
      items.push({
        kind: 'action',
        label: `${user.profile.nickname} · 退出`,
        meta: '',
      });
    }
    if (loading) {
      items.push({ kind: 'title', label: '加载中…' });
    } else if (list.length === 0) {
      items.push({ kind: 'title', label: '（无歌单）' });
    } else {
      // 第 0 项留给「退出登录」，从 1 开始才是歌单
      for (const p of list) {
        items.push({
          kind: 'submenu',
          label: p.name,
          meta: String(p.trackCount),
        });
      }
    }
    setItems(items);
  }, [user, list, loading, setItems, logout]);

  // 自定义 SELECT 处理：列表项 → 进入 playlist；行为第 0 项 → 退出登录
  useEffect(() => {
    (NeteasePlaylistsView as any).__select = (idx: number) => {
      if (idx === 0 && user) {
        logout();
        return;
      }
      // list 偏移 1
      const plIdx = idx - 1;
      if (plIdx >= 0 && plIdx < list.length) {
        push({ name: 'netease.playlist', playlistId: list[plIdx].id });
      }
    };
  }, [user, list, logout, push]);

  return (
    <div className="h-full w-full flex flex-col">
      {user && list.length > 0 && (
        <div className="px-2 pt-1 pb-1 flex items-center gap-2 border-b border-black/5">
          <img src={user.profile.avatarUrl} className="w-6 h-6 rounded-full" alt="avatar" />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--screen-text-primary)' }}>
            {user.profile.nickname}
          </span>
          <span className="text-[9px]" style={{ color: 'var(--screen-text-muted)' }}>
            {list.length} 个歌单
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ListMenu items={items} selectedIndex={selectedIndex} />
      </div>
    </div>
  );
}

export function selectNeteasePlaylistItem(idx: number) {
  (NeteasePlaylistsView as any).__select?.(idx);
}

// ============================================================
// 单个歌单详情
// ============================================================
export function NeteasePlaylistView({ playlistId }: { playlistId: number }) {
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const playNeteaseTrack = usePlayer((s) => s.playNeteaseTrack);

  const [meta, setMeta] = useState<NetEasePlaylistSummary | null>(null);
  const [tracks, setTracks] = useState<NetEaseTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { playlist, tracks } = await fetchPlaylistDetail(playlistId);
        if (!cancelled) {
          setMeta(playlist);
          setTracks(tracks);
        }
      } catch (err) {
        console.error('[netease] detail failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  useEffect(() => {
    if (loading) {
      setItems([{ kind: 'title', label: '加载中…' }]);
    } else if (tracks.length === 0) {
      setItems([{ kind: 'title', label: '（空歌单）' }]);
    } else {
      setItems(
        tracks.map((t) => ({
          kind: 'track' as const,
          label: t.name,
          meta: t.ar.map((a) => a.name).join(' / '),
          trackId: `netease:${t.id}`,
        })),
      );
    }
  }, [loading, tracks, setItems]);

  useEffect(() => {
    (NeteasePlaylistView as any).__lastPlay = (idx: number) => {
      const t = tracks[idx];
      if (!t) return;
      // 先抓所有 URL 再批量播放（首曲先放，其余到队列）
      playNeteaseTrack(t, tracks);
    };
  }, [tracks, playNeteaseTrack]);

  return (
    <div className="h-full w-full flex flex-col">
      {meta && (
        <div className="px-2 pt-1 pb-1 flex items-center gap-2 border-b border-black/5">
          <img src={`${meta.coverImgUrl}?param=120y120`} className="w-7 h-7 rounded" alt="cover" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold truncate" style={{ color: 'var(--screen-text-primary)' }}>
              {meta.name}
            </div>
            <div className="text-[9px] truncate" style={{ color: 'var(--screen-text-muted)' }}>
              {meta.creator?.nickname ?? ''} · {meta.trackCount} 首
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ListMenu items={items} selectedIndex={selectedIndex} />
      </div>
    </div>
  );
}

export function playNeteaseSongAt(idx: number) {
  (NeteasePlaylistView as any).__lastPlay?.(idx);
}