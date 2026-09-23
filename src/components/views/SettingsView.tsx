// ============================================================
// SettingsView - 设置（文档 4.4）
// 触感、播放选项、曲库管理、导入歌曲、关于
// ============================================================

import { useEffect, useRef } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';
import { clearAll } from '@/services/storage';

export function SettingsView() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const importFiles = useLibrary((s) => s.importFiles);
  const importing = useLibrary((s) => s.importing);
  const removeAll = useLibrary((s) => s.removeTrack);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems([
      { kind: 'action', label: '导入歌曲…', meta: importing ? `${importing.done}/${importing.total}` : '' },
      { kind: 'toggle', label: '触感反馈', value: true },
      { kind: 'toggle', label: '随机播放', value: usePlayer.getState().shuffle === 'on' },
      { kind: 'action', label: '循环模式', meta: repeatLabel(usePlayer.getState().repeat) },
      { kind: 'action', label: '音量', meta: `${Math.round(usePlayer.getState().volume * 100)}%` },
      { kind: 'title', label: `曲库：${tracks.length} 首` },
      { kind: 'title', label: `歌单：${Object.keys(playlists).length} 个` },
      { kind: 'action', label: '清空曲库', meta: '⚠' },
      { kind: 'title', label: '关于' },
      { kind: 'title', label: 'iPodPlayer v0.1 · 自用版' },
    ]);
  }, [tracks.length, playlists, importing, setItems]);

  useEffect(() => {
    (SettingsView as any).__action = async (idx: number) => {
      switch (idx) {
        case 0:
          fileInputRef.current?.click();
          return 'open-import';
        case 2:
          usePlayer.getState().toggleShuffle();
          return 'rerender';
        case 3:
          usePlayer.getState().cycleRepeat();
          return 'rerender';
        case 4:
          usePlayer.getState().setVolume(
            usePlayer.getState().volume >= 1 ? 0 : Math.min(1, usePlayer.getState().volume + 0.1),
          );
          return 'rerender';
        case 7:
          if (confirm('确认清空曲库？此操作不可撤销。')) {
            await clearAll();
            window.location.reload();
          }
          return 'rerender';
      }
    };
  }, [importFiles, removeAll]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={async (e) => {
          if (e.target.files?.length) {
            await importFiles(e.target.files);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
      <ListMenu items={items} selectedIndex={selectedIndex} />
    </>
  );
}

function repeatLabel(r: 'off' | 'all' | 'one'): string {
  return r === 'off' ? '关' : r === 'all' ? '全部' : '单曲';
}

export function settingsAction(idx: number) {
  return (SettingsView as any).__action?.(idx);
}