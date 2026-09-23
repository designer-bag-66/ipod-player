// ============================================================
// AlbumsView - 专辑列表（按专辑聚合）
// ============================================================

import { useEffect, useMemo } from 'react';
import { useLibrary } from '@/stores/library';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';

export function AlbumsView() {
  const tracks = useLibrary((s) => s.tracks);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);

  const albums = useMemo(() => {
    const m = new Map<string, { artist: string; count: number }>();
    for (const t of tracks) {
      const cur = m.get(t.album) ?? { artist: t.artist, count: 0 };
      m.set(t.album, { artist: cur.artist, count: cur.count + 1 });
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  useEffect(() => {
    setItems(
      albums.length === 0
        ? [{ kind: 'title', label: '（暂无专辑）' }]
        : albums.map(([name, info]) => ({
            kind: 'submenu' as const,
            label: name,
            meta: `${info.artist} · ${info.count}`,
          })),
    );
  }, [albums, setItems]);

  return <ListMenu items={items} selectedIndex={selectedIndex} />;
}