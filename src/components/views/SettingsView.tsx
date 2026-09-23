// ============================================================
// SettingsView - 设置（文档 4.4）
// 触感、播放选项、音效、曲库管理、导入歌曲、关于
// 所有开关实时反映状态，SELECT 循环切换
// ============================================================

import { useEffect, useRef } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer, EQ_LABELS, EQ_ORDER } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { ListMenu } from '@/components/ui/ListMenu';
import { clearAll } from '@/services/storage';

export function SettingsView() {
  const tracks = useLibrary((s) => s.tracks);
  const playlists = useLibrary((s) => s.playlists);
  const importFiles = useLibrary((s) => s.importFiles);
  const importing = useLibrary((s) => s.importing);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const volume = usePlayer((s) => s.volume);
  const eq = usePlayer((s) => s.eq);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems([
      { kind: 'action', label: '导入歌曲…', meta: importing ? `${importing.done}/${importing.total}` : '' },
      { kind: 'toggle', label: '触感反馈', value: true },
      { kind: 'toggle', label: '随机播放', value: shuffle === 'on' },
      { kind: 'action', label: '循环模式', meta: repeatLabel(repeat) },
      { kind: 'action', label: '音效', meta: EQ_LABELS[eq] },
      { kind: 'action', label: '音量', meta: `${Math.round(volume * 100)}%` },
      { kind: 'title', label: `曲库：${tracks.length} 首` },
      { kind: 'title', label: `歌单：${Object.keys(playlists).length} 个` },
      { kind: 'action', label: '清空曲库', meta: '⚠' },
      { kind: 'title', label: '关于' },
      { kind: 'title', label: 'iPodPlayer v0.1 · 自用版' },
    ]);
  }, [tracks.length, playlists, importing, shuffle, repeat, volume, eq, setItems]);

  useEffect(() => {
    (SettingsView as any).__action = async (idx: number) => {
      const p = usePlayer.getState();
      switch (idx) {
        case 0:
          fileInputRef.current?.click();
          return 'open-import';
        case 2:
          p.toggleShuffle();
          return 'rerender';
        case 3:
          p.cycleRepeat();
          return 'rerender';
        case 4: {
          const next = EQ_ORDER[(EQ_ORDER.indexOf(p.eq) + 1) % EQ_ORDER.length];
          p.setEq(next);
          return 'rerender';
        }
        case 5:
          p.setVolume(p.volume >= 0.999 ? 0 : Math.min(1, p.volume + 0.1));
          return 'rerender';
        case 8:
          if (confirm('确认清空曲库？此操作不可撤销。')) {
            await clearAll();
            window.location.reload();
          }
          return 'rerender';
      }
    };
  }, []);

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
