// ============================================================
// SettingsView - 设置（文档 4.4）
// 导入、主页布局、触感、选择音效、播放选项、音效、音量、网易云 API、曲库管理、关于
// 动作通过 label 分派（而非下标），新增条目不会打乱既有行为
// ============================================================

import { useEffect, useMemo, useRef } from 'react';
import { useLibrary } from '@/stores/library';
import { usePlayer, EQ_LABELS, EQ_ORDER } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import {
  usePrefs,
  HOME_LIST_SIZE_LABELS,
  HOME_LIST_SIZE_ORDER,
  HOME_LIST_POS_LABELS,
  HOME_LIST_POS_ORDER,
} from '@/stores/prefs';
import { ListMenu } from '@/components/ui/ListMenu';
import type { MenuItem } from '@/types';
import { clearAll } from '@/services/storage';
import { setVolumeLevel } from '@/services/system';
import { playTick } from '@/services/sound';

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
  const setIndex = useNavigation((s) => s.setIndex);
  const push = useNavigation((s) => s.push);

  const homeLayout = usePrefs((s) => s.homeLayout);
  const homeListSize = usePrefs((s) => s.homeListSize);
  const homeListPos = usePrefs((s) => s.homeListPos);
  const haptics = usePrefs((s) => s.haptics);
  const soundFeedback = usePrefs((s) => s.soundFeedback);
  const update = usePrefs((s) => s.update);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 仅在主页为列表布局时才显示尺寸/位置调节
  // 必须是稳定引用，否则下面的 setItems effect 会每次渲染都重跑
  const listLayoutItems = useMemo<MenuItem[]>(
    () =>
      homeLayout === 'list'
        ? [
            { kind: 'action', label: '列表字号', meta: HOME_LIST_SIZE_LABELS[homeListSize] },
            { kind: 'action', label: '列表位置', meta: HOME_LIST_POS_LABELS[homeListPos] },
          ]
        : [],
    [homeLayout, homeListSize, homeListPos],
  );

  useEffect(() => {
    setItems([
      {
        kind: 'action',
        label: '导入歌曲…',
        meta: importing ? `${importing.done}/${importing.total}` : '',
      },
      { kind: 'action', label: '主页布局', meta: homeLayout === 'list' ? '列表' : '网格' },
      ...listLayoutItems,
      { kind: 'toggle', label: '触感反馈', value: haptics },
      { kind: 'toggle', label: '选择音效', value: soundFeedback },
      { kind: 'toggle', label: '随机播放', value: shuffle === 'on' },
      { kind: 'action', label: '循环模式', meta: repeatLabel(repeat) },
      { kind: 'action', label: '音效', meta: EQ_LABELS[eq] },
      { kind: 'action', label: '音量', meta: `${Math.round(volume * 100)}%` },
      { kind: 'action', label: '网易云 API 地址' },
      { kind: 'title', label: `曲库：${tracks.length} 首` },
      { kind: 'title', label: `歌单：${Object.keys(playlists).length} 个` },
      { kind: 'action', label: '清空曲库', meta: '⚠' },
      { kind: 'title', label: '关于' },
      { kind: 'title', label: 'iPodPlayer v0.1 · 自用版' },
    ]);
  }, [
    tracks.length,
    playlists,
    importing,
    shuffle,
    repeat,
    volume,
    eq,
    homeLayout,
    homeListSize,
    homeListPos,
    listLayoutItems,
    haptics,
    soundFeedback,
    setItems,
  ]);

  useEffect(() => {
    (SettingsView as any).__action = async (label: string) => {
      const p = usePlayer.getState();
      // 一律从 store 读当前值：避免闭包拿到旧值导致「点第二次没反应」
      const prefs = usePrefs.getState();
      switch (label) {
        case '导入歌曲…':
          fileInputRef.current?.click();
          return;
        case '主页布局':
          update('homeLayout', prefs.homeLayout === 'list' ? 'grid' : 'list');
          return;
        case '列表字号': {
          const i = HOME_LIST_SIZE_ORDER.indexOf(prefs.homeListSize);
          update('homeListSize', HOME_LIST_SIZE_ORDER[(i + 1) % HOME_LIST_SIZE_ORDER.length]);
          return;
        }
        case '列表位置': {
          const i = HOME_LIST_POS_ORDER.indexOf(prefs.homeListPos);
          update('homeListPos', HOME_LIST_POS_ORDER[(i + 1) % HOME_LIST_POS_ORDER.length]);
          return;
        }
        case '触感反馈':
          update('haptics', !prefs.haptics);
          return;
        case '选择音效': {
          const next = !prefs.soundFeedback;
          update('soundFeedback', next);
          if (next) playTick('select'); // 开启时立刻听到一次
          return;
        }
        case '随机播放':
          p.toggleShuffle();
          return;
        case '循环模式':
          p.cycleRepeat();
          return;
        case '音效':
          p.setEq(EQ_ORDER[(EQ_ORDER.indexOf(p.eq) + 1) % EQ_ORDER.length]);
          return;
        case '音量':
          void setVolumeLevel(p.volume >= 0.999 ? 0 : Math.min(1, p.volume + 0.1));
          return;
        case '网易云 API 地址':
          push({ name: 'settings.netease' });
          return;
        case '清空曲库':
          if (confirm('确认清空曲库？此操作不可撤销。')) {
            await clearAll();
            window.location.reload();
          }
          return;
      }
    };
  }, [homeLayout, homeListSize, homeListPos, haptics, soundFeedback, update, push]);

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
      <ListMenu
        items={items}
        selectedIndex={selectedIndex}
        onPick={(i) => {
          setIndex(i);
          settingsAction(items[i]?.label);
        }}
      />
    </>
  );
}

function repeatLabel(r: 'off' | 'all' | 'one'): string {
  return r === 'off' ? '关' : r === 'all' ? '全部' : '单曲';
}

export function settingsAction(label?: string) {
  return (SettingsView as any).__action?.(label);
}
