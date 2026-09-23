// ============================================================
// QuickPanel - 主菜单 MENU 快捷面板
// 播放列表 / 亮度 / 音量，滚轮选择行，SELECT 进入调节模式
// ============================================================

import clsx from 'clsx';

export type QuickAdjust = 'none' | 'bright' | 'vol';

interface Props {
  open: boolean;
  row: number;
  adjusting: QuickAdjust;
  brightness: number; // 0.3 ~ 1
  volume: number; // 0 ~ 1
}

export function QuickPanel({ open, row, adjusting, brightness, volume }: Props) {
  if (!open) return null;

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const rows = [
    { label: '播放列表', meta: '' },
    {
      label: '亮度',
      meta: adjusting === 'bright' ? `◀ ${pct(brightness)} ▶` : pct(brightness),
    },
    {
      label: '音量',
      meta: adjusting === 'vol' ? `◀ ${pct(volume)} ▶` : pct(volume),
    },
  ];

  return (
    <div className="absolute inset-0 z-20 flex items-end">
      <div className="glass-card-strong rounded-xl mx-2 mb-2 w-[calc(100%-1rem)] px-1 py-1">
        {rows.map((r, i) => (
          <div key={r.label} className={clsx('list-row', i === row && 'selected')}>
            <span className="list-title">{r.label}</span>
            <span className="list-meta">{r.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
