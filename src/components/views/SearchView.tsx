// ============================================================
// SearchView - 文档 2.1：搜索「本地曲库关键词匹配」
// 按标题、歌手、专辑过滤
// 简易实现：直接在屏幕顶部显示一个静态标题栏，搜索结果由 SELECT 触发
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';

export function SearchView() {
  const tracks = useLibrary((s) => s.tracks);
  const playTrack = usePlayer((s) => s.playTrack);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return tracks.slice(0, 50);
    const q = query.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    );
  }, [query, tracks]);

  useEffect(() => {
    setItems(
      results.length === 0
        ? [{ kind: 'title', label: '（无匹配）' }]
        : results.map((t) => ({
            kind: 'track' as const,
            label: t.title,
            meta: `${t.artist} · ${t.album}`,
            trackId: t.id,
          })),
    );
  }, [results, setItems]);

  useEffect(() => {
    (SearchView as any).__lastPlay = (idx: number) => {
      const t = results[idx];
      if (t) playTrack(t, results.map((x) => x.id));
    };
  }, [results, playTrack]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索本地曲库"
          className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
      <div className="flex-1 min-h-0">
        <ListMenu items={items} selectedIndex={selectedIndex} />
      </div>
    </div>
  );
}

export function playSearchResult(idx: number) {
  (SearchView as any).__lastPlay?.(idx);
}