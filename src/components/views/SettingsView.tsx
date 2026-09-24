// ============================================================
// SettingsView - 设置
//
// 目前保留：触感反馈 / 选择音效（都是可调档位：关 · 弱 · 中 · 强）
//           循环模式 / 网易云（登录·退出·API 地址）/ 设计源状态 / 关于
//
// 已按需求移除：导入歌曲、主页布局、列表字号、列表位置、随机播放、
//              音效(EQ)、音量、粘贴·复制·恢复设计 JSON、
//              曲库·歌单统计与清空曲库（本地曲库已整体移除）
//
// 动作通过 label 分派（而非下标），新增/删除条目不会打乱既有行为
// ============================================================

import { useEffect } from 'react';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';
import { useAuth } from '@/stores/auth';
import { FEEDBACK_LABELS, FEEDBACK_ORDER, usePrefs } from '@/stores/prefs';
import { useDesign } from '@/design';
import { ListMenu } from '@/components/ui/ListMenu';
import { haptic } from '@/services/haptic';
import { playTick } from '@/services/sound';

export function SettingsView() {
  const repeat = usePlayer((s) => s.repeat);
  const setItems = useNavigation((s) => s.setItems);
  const items = useNavigation((s) => s.items);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const setIndex = useNavigation((s) => s.setIndex);
  const push = useNavigation((s) => s.push);

  const haptics = usePrefs((s) => s.haptics);
  const soundFeedback = usePrefs((s) => s.soundFeedback);
  const update = usePrefs((s) => s.update);

  // 网易云的登录 / 退出统一收在这里
  const neUser = useAuth((s) => s.user);
  const apiOnline = useAuth((s) => s.apiOnline);

  const designSource = useDesign((s) => s.source);

  const sourceLabel =
    designSource === 'local'
      ? '本地覆盖 ⚠ 会遮蔽设计文件'
      : designSource === 'file'
        ? '内置文件'
        : '默认';

  useEffect(() => {
    setItems([
      { kind: 'action', label: '布局调整…', meta: '显示框 / 滚轮' },
      { kind: 'action', label: '触感反馈', meta: FEEDBACK_LABELS[haptics] },
      { kind: 'action', label: '选择音效', meta: FEEDBACK_LABELS[soundFeedback] },
      { kind: 'action', label: '循环模式', meta: repeatLabel(repeat) },
      { kind: 'title', label: neUser ? `网易云：${neUser.profile.nickname}` : '网易云：未登录' },
      neUser
        ? { kind: 'action', label: '退出网易云账号' }
        : { kind: 'action', label: '登录网易云账号', meta: apiOnline ? '' : '离线' },
      { kind: 'action', label: '网易云 API 地址' },
      { kind: 'title', label: `设计源：${sourceLabel}` },
      { kind: 'title', label: '关于' },
      { kind: 'title', label: 'iPodPlayer v0.1 · 自用版' },
    ]);
  }, [
    repeat,
    haptics,
    soundFeedback,
    sourceLabel,
    neUser,
    apiOnline,
    setItems,
  ]);

  useEffect(() => {
    (SettingsView as any).__action = async (label: string) => {
      const p = usePlayer.getState();
      // 一律从 store 读当前值：避免闭包拿到旧值导致「点第二次没反应」
      const prefs = usePrefs.getState();
      switch (label) {
        case '布局调整…':
          push({ name: 'layout' });
          return;
        case '触感反馈': {
          const next =
            FEEDBACK_ORDER[(FEEDBACK_ORDER.indexOf(prefs.haptics) + 1) % FEEDBACK_ORDER.length];
          update('haptics', next);
          if (next !== 'off') void haptic(); // 立刻感受一次当前强度
          return;
        }
        case '选择音效': {
          const next =
            FEEDBACK_ORDER[
              (FEEDBACK_ORDER.indexOf(prefs.soundFeedback) + 1) % FEEDBACK_ORDER.length
            ];
          update('soundFeedback', next);
          if (next !== 'off') playTick('select'); // 立刻听一次当前强度
          return;
        }
        case '循环模式':
          p.cycleRepeat();
          return;
        case '登录网易云账号':
          push({ name: 'netease.login' });
          return;
        case '退出网易云账号':
          if (confirm('退出网易云账号？')) {
            useAuth.getState().logout();
          }
          return;
        case '网易云 API 地址':
          push({ name: 'settings.netease' });
          return;
      }
    };
  }, [update, push]);

  return (
    <ListMenu
      items={items}
      selectedIndex={selectedIndex}
      onPick={(i) => {
        setIndex(i);
        settingsAction(items[i]?.label);
      }}
    />
  );
}

function repeatLabel(r: 'off' | 'all' | 'one'): string {
  return r === 'off' ? '关' : r === 'all' ? '全部' : '单曲';
}

export function settingsAction(label?: string) {
  return (SettingsView as any).__action?.(label);
}
