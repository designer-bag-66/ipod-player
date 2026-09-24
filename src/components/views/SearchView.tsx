// ============================================================
// SearchView - 搜索网易云在线歌曲
//
// 输入关键词 → /cloudsearch 拿歌曲 → 点按直接播放（整个结果就是播放队列）。
// 输入做了防抖，避免每敲一个字就发一次请求。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { ListMenu } from '@/components/ui/ListMenu';
import {
  searchSongs,
  neteaseArtwork,
  rememberNeteaseTracks,
  type NetEaseTrack,
} from '@/services/netease';
import type { MenuItem } from '@/types';

/** 停止输入多久后才发请求 */
const DEBOUNCE_MS = 350;

export function SearchView() {
  const setItems = useNavigation((s) => s.setItems);
  const selectedIndex = useNavigation((s) => s.selectedIndex);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NetEaseTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  /** 本轮是否已搜过：用来区分「还没搜」和「搜了但没结果」 */
  const [done, setDone] = useState(false);

  useEffect(() => {
    const kw = query.trim();
    if (!kw) {
      setResults([]);
      setError('');
      setDone(false);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError('');
      searchSongs(kw)
        .then((list) => {
          if (cancelled) return;
          rememberNeteaseTracks(list); // 登记进查表，播放 / 切歌才能还原曲目
          setResults(list);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('[SearchView] 搜索失败', err);
          setError(String(err?.message ?? err));
          setResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setSearching(false);
          setDone(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const listItems = useMemo<MenuItem[]>(() => {
    if (searching) return [{ kind: 'title', label: '搜索中…' }];
    if (error) return [{ kind: 'title', label: `搜索失败：${error.slice(0, 40)}` }];
    if (!done) return [{ kind: 'title', label: '输入关键词搜索在线歌曲' }];
    if (results.length === 0) return [{ kind: 'title', label: '（无匹配）' }];
    return results.map((t) => ({
      kind: 'track' as const,
      label: t.name,
      meta: (t.ar ?? []).map((a) => a.name).join('/') || t.al?.name || '',
      trackId: `netease:${t.id}`,
      artwork: { url: neteaseArtwork(t) },
    }));
  }, [searching, error, done, results]);

  useEffect(() => {
    setItems(listItems);
  }, [listItems, setItems]);

  // 供 main.tsx 的 SELECT 分发调用
  useEffect(() => {
    (SearchView as any).__lastPlay = (idx: number) => {
      const list = results;
      const t = list[idx];
      if (!t) return;
      rememberNeteaseTracks(list); // 整个结果列表就是播放队列
      void usePlayer.getState().playNeteaseTrack(t, list);
    };
  }, [results]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索在线歌曲"
          className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-1, #1a1a1f)',
          }}
        />
      </div>
      <div className="flex-1 min-h-0">
        <ListMenu
          items={listItems}
          selectedIndex={selectedIndex}
          onPick={(i) => playSearchResult(i)}
        />
      </div>
    </div>
  );
}

/** 播放搜索结果第 idx 首（供轮盘 SELECT 与列表点按共用） */
export function playSearchResult(idx: number) {
  (SearchView as any).__lastPlay?.(idx);
}
