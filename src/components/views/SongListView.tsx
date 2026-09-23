// ============================================================
// SongListView - 歌曲列表（复用：我喜欢的音乐 / 所有歌曲 / 歌单内）
// ============================================================

import { useEffect, useMemo } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';

interface Props {
  /** 决定展示哪些歌曲 */
  filter: 'all' | 'liked' | { playlistId: string };
}

export function SongListView({ filter }: Props) {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const playTrack = usePlayer((s) => s.playTrack);

  const songs = useMemo(() => {
    if (filter === 'all') return tracks;
    if (filter === 'liked') return tracks.filter((t) => t.liked);
    const pl = playlists[filter.playlistId];
    if (!pl) return [];
    const order = pl.orderedTrackIDs;
    return order.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as typeof tracks;
  }, [filter, tracks, playlists]);

  useEffect(() => {
    setItems(
      songs.length === 0
        ? [{ kind: 'title', label: '（无歌曲）' }]
        : songs.map((t) => ({
            kind: 'track' as const,
            label: t.title,
            meta: t.artist,
            trackId: t.id,
          })),
    );
  }, [songs, setItems]);

  useEffect(() => {
    (SongListView as any).__lastPlay = (idx: number) => {
      const t = songs[idx];
      if (t) playTrack(t, songs.map((x) => x.id));
    };
  }, [songs, playTrack]);

  return <ListMenu items={items} selectedIndex={selectedIndex} />;
}

export function playSongAt(idx: number) {
  (SongListView as any).__lastPlay?.(idx);
}