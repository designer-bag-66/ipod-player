// ============================================================
// PlayQueueView - 当前播放列表
//
// 显示播放器**当前队列**里的歌（队列全部是在线曲目，id 形如 netease:<id>），
// 点任意一首直接跳过去播。队列为空时给出提示。
// 从主页「▶ 播放列表」进入；从播放页按 MENU 返回也是这一页。
// ============================================================

import { useEffect, useMemo } from 'react';
import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';
import { ListMenu } from '@/components/ui/ListMenu';
import {
  lookupNeteaseTrack,
  neteaseArtwork,
  rememberNeteaseTracks,
  type NetEaseTrack,
} from '@/services/netease';
import type { MenuItem } from '@/types';

/** 播放队列里的第 index 首（供轮盘 SELECT 与列表点按共用） */
export function selectQueueItem(index: number) {
  const player = usePlayer.getState();
  const id = player.queue[index];
  if (!id) return;

  const ne = lookupNeteaseTrack(id);
  if (!ne) return;
  // 队列里的曲目要整体交给播放器，next()/previous() 才还原得出
  const neQueue = player.queue
    .map((x) => lookupNeteaseTrack(x))
    .filter(Boolean) as NetEaseTrack[];
  rememberNeteaseTracks(neQueue);
  void player.playNeteaseTrack(ne, neQueue);
}

export function PlayQueueView() {
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const setIndex = useNavigation((s) => s.setIndex);
  const setItems = useNavigation((s) => s.setItems);

  const queue = usePlayer((s) => s.queue);

  const listItems = useMemo<MenuItem[]>(
    () =>
      queue.map((id) => {
        const ne = lookupNeteaseTrack(id);
        // 查表里没有的（例如 App 重启后队列还在、内存表已清）退化成占位行
        return {
          kind: 'action' as const,
          label: ne?.name ?? '未知歌曲',
          meta: ne ? (ne.ar ?? []).map((a) => a.name).join('/') : '',
          artwork: { url: ne ? neteaseArtwork(ne) : undefined },
        };
      }),
    [queue],
  );

  useEffect(() => {
    setItems(listItems);
  }, [listItems, setItems]);

  // 进列表时把选中项落在「正在播的那首」上，一眼能看出播到哪儿了
  useEffect(() => {
    const i = usePlayer.getState().currentIndex;
    if (i >= 0) setIndex(i);
    // 只在挂载时对齐一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queue.length === 0) {
    return (
      <div className="text-center mt-6 px-3">
        <div
          className="text-[10px] leading-relaxed"
          style={{ color: 'var(--screen-text-secondary)' }}
        >
          当前没有播放中的歌曲
        </div>
      </div>
    );
  }

  return (
    <ListMenu
      items={listItems}
      selectedIndex={selectedIndex}
      onPick={(i) => {
        setIndex(i);
        selectQueueItem(i);
      }}
    />
  );
}
