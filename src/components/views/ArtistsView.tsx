// ============================================================
// ArtistsView - 歌手列表（按曲库聚合）
// ============================================================

import { useEffect, useMemo } from 'react';
import { useLibrary } from '@/stores/library';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';

export function ArtistsView() {
  const tracks = useLibrary((s) => s.tracks);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);

  const artists = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tracks) {
      m.set(t.artist, (m.get(t.artist) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  useEffect(() => {
    setItems(
      artists.length === 0
        ? [{ kind: 'title', label: '（暂无艺人）' }]
        : artists.map(([name, count]) => ({
            kind: 'submenu' as const,
            label: name,
            meta: String(count),
          })),
    );
  }, [artists, setItems]);

  return <ListMenu items={items} selectedIndex={selectedIndex} />;
}