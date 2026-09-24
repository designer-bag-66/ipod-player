// ============================================================
// SongListView - 「我喜欢的音乐」（网易云云端收藏）
//
// 本地曲库已移除，所以这里只剩一条路径：登录后拉 /likelist + /song/detail。
// 未登录时提示去「设置」登录。
// 每行左侧带专辑封面（网易云 CDN）。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { ListMenu } from '@/components/ui/ListMenu';
import {
  fetchLikedTracks,
  peekLikedTracks,
  neteaseArtwork,
  rememberNeteaseTracks,
  type NetEaseTrack,
} from '@/services/netease';
import type { MenuItem } from '@/types';

export function SongListView() {
  const neUser = useAuth((s) => s.user);
  const setItems = useNavigation((s) => s.setItems);
  const selectedIndex = useNavigation((s) => s.selectedIndex);

  // 网易云接口用的是 userId，注意它不等于 account.id
  const uid = neUser ? (neUser.profile?.userId ?? neUser.account.id) : 0;
  const cached = uid ? peekLikedTracks(uid) : undefined;
  const [tracks, setTracks] = useState<NetEaseTrack[]>(cached ?? []);
  const [loading, setLoading] = useState(!!uid && !cached);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // 有缓存就静默刷新，不闪「加载中…」
    if (!peekLikedTracks(uid)) setLoading(true);
    setError('');
    fetchLikedTracks(uid)
      .then((list) => {
        if (cancelled) return;
        rememberNeteaseTracks(list); // 登记进查表，next()/previous() 才还原得出
        setTracks(list);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[SongListView] 拉取网易云收藏失败', err);
        setError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, reload]);

  const listItems = useMemo<MenuItem[]>(
    () =>
      tracks.map((t) => ({
        kind: 'track' as const,
        label: t.name,
        meta: (t.ar ?? []).map((a) => a.name).join('/'),
        trackId: `netease:${t.id}`,
        artwork: { url: neteaseArtwork(t) },
      })),
    [tracks],
  );

  useEffect(() => {
    setItems(listItems);
  }, [listItems, setItems]);

  // 供 main.tsx 的 SELECT 分发调用
  useEffect(() => {
    (SongListView as any).__lastPlay = (idx: number) => {
      const list = tracks;
      const t = list[idx];
      if (!t) return;
      rememberNeteaseTracks(list); // 整个列表就是播放队列
      void usePlayer.getState().playNeteaseTrack(t, list);
    };
  }, [tracks]);

  if (!neUser) {
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
        加载中…
      </div>
    );
  }

  if (error && tracks.length === 0) {
    return (
      <div className="text-center mt-6 px-3">
        <div
          className="text-[10px] leading-relaxed mb-2 break-all"
          style={{ color: 'var(--screen-text-secondary)' }}
        >
          {error}
        </div>
        <button className="np-btn" onClick={() => setReload((n) => n + 1)}>
          重试
        </button>
      </div>
    );
  }

  return (
    <ListMenu
      items={listItems}
      selectedIndex={selectedIndex}
      onPick={(i) => playSongAt(i)}
    />
  );
}

/** 播放「我喜欢的」第 idx 首（供轮盘 SELECT 与列表点按共用） */
export function playSongAt(idx: number) {
  (SongListView as any).__lastPlay?.(idx);
}
