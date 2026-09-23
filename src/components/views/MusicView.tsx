// ============================================================
// MusicView - 音乐二级菜单
// 我喜欢的音乐 / 我的歌单 / 网易云歌单 / 歌手 / 专辑 / 歌曲 / 导入歌曲
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '@/stores/library';
import { useAuth } from '@/stores/auth';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';
import {
  fetchUserPlaylists,
  type NetEasePlaylistSummary,
} from '@/services/netease';

export function MusicView() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const neUser = useAuth((s) => s.user);
  const apiOnline = useAuth((s) => s.apiOnline);
  const logout = useAuth((s) => s.logout);
  const push = useNavigation((s) => s.push);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);

  const [nePlaylists, setNePlaylists] = useState<NetEasePlaylistSummary[]>([]);
  const [neLoading, setNeLoading] = useState(false);

  const likedCount = useMemo(() => tracks.filter((t) => t.liked).length, [tracks]);
  const playlistArr = useMemo(() => Object.values(playlists), [playlists]);

  // 登录后拉取网易云歌单
  useEffect(() => {
    let cancelled = false;
    if (neUser) {
      setNeLoading(true);
      fetchUserPlaylists(neUser.account.id)
        .then((data) => {
          if (!cancelled) setNePlaylists(data);
        })
        .catch((err) => console.error('[MusicView] fetch netease playlists failed', err))
        .finally(() => {
          if (!cancelled) setNeLoading(false);
        });
    } else {
      setNePlaylists([]);
      setNeLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [neUser]);

  // 构建列表并注册每个索引对应的动作
  useEffect(() => {
    const nextItems: typeof items = [];
    const nextActions: Array<() => void> = [];

    const pushItem = (item: (typeof items)[number], action: () => void) => {
      nextItems.push(item);
      nextActions.push(action);
    };

    pushItem(
      { kind: 'submenu', label: '我喜欢的音乐', meta: String(likedCount) },
      () => push({ name: 'music.favorites' }),
    );

    if (playlistArr.length > 0) {
      pushItem({ kind: 'title', label: '我的歌单' }, () => {});
      playlistArr.forEach((p) =>
        pushItem(
          { kind: 'submenu', label: p.name, meta: String(p.orderedTrackIDs.length) },
          () => push({ name: 'music.playlist', playlistId: p.id }),
        ),
      );
    }

    // 网易云区域
    pushItem({ kind: 'title', label: '网易云音乐' }, () => {});
    if (neUser) {
      if (neLoading) {
        pushItem({ kind: 'title', label: '加载中…' }, () => {});
      } else if (nePlaylists.length === 0) {
        pushItem({ kind: 'title', label: '（无歌单）' }, () => {});
      } else {
        nePlaylists.forEach((p) =>
          pushItem(
            { kind: 'submenu', label: p.name, meta: String(p.trackCount) },
            () => push({ name: 'netease.playlist', playlistId: p.id }),
          ),
        );
      }
      pushItem(
        { kind: 'action', label: `${neUser.profile.nickname} · 退出` },
        () => logout(),
      );
    } else if (apiOnline) {
      pushItem(
        { kind: 'action', label: '登录网易云音乐' },
        () => push({ name: 'netease.login' }),
      );
    } else {
      pushItem(
        { kind: 'title', label: '服务离线' },
        () => {},
      );
    }

    pushItem(
      { kind: 'submenu', label: '歌手', meta: String(new Set(tracks.map((t) => t.artist)).size) },
      () => push({ name: 'music.artists' }),
    );
    pushItem(
      { kind: 'submenu', label: '专辑', meta: String(new Set(tracks.map((t) => t.album)).size) },
      () => push({ name: 'music.albums' }),
    );
    pushItem(
      { kind: 'submenu', label: '歌曲', meta: String(tracks.length) },
      () => push({ name: 'music.songs' }),
    );
    pushItem(
      { kind: 'action', label: '导入歌曲…' },
      () => push({ name: 'settings.import' }),
    );

    setItems(nextItems);
    (MusicView as any).__actions = nextActions;
  }, [
    likedCount,
    playlistArr,
    tracks,
    neUser,
    nePlaylists,
    neLoading,
    apiOnline,
    push,
    logout,
    setItems,
  ]);

  return <ListMenu items={items} selectedIndex={selectedIndex} />;
}

export function selectMusicItem(index: number) {
  const actions: Array<() => void> = (MusicView as any).__actions;
  if (actions && actions[index]) {
    actions[index]();
  }
}