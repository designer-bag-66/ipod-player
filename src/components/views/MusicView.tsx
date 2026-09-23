// ============================================================
// MusicView - 音乐二级菜单
// 我喜欢的音乐 / 我的歌单 / 歌手 / 专辑 / 歌曲 / 导入歌曲
// ============================================================

import { useEffect, useMemo } from 'react';
import { useLibrary } from '@/stores/library';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';

export function MusicView() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);

  const likedCount = useMemo(() => tracks.filter((t) => t.liked).length, [tracks]);
  const playlistArr = useMemo(() => Object.values(playlists), [playlists]);

  useEffect(() => {
    setItems([
      { kind: 'submenu', label: '我喜欢的音乐', meta: String(likedCount) },
      { kind: 'title', label: '我的歌单' },
      ...playlistArr.map((p) => ({
        kind: 'submenu' as const,
        label: p.name,
        meta: String(p.orderedTrackIDs.length),
      })),
      { kind: 'submenu', label: '歌手', meta: String(new Set(tracks.map((t) => t.artist)).size) },
      { kind: 'submenu', label: '专辑', meta: String(new Set(tracks.map((t) => t.album)).size) },
      { kind: 'submenu', label: '歌曲', meta: String(tracks.length) },
      { kind: 'action', label: '导入歌曲…' },
    ]);
  }, [likedCount, playlistArr, tracks, setItems]);

  return <ListMenu items={items} selectedIndex={selectedIndex} />;
}