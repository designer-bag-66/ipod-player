// ============================================================
// LayoutView - 布局调整（显示框的宽/高/位置、滚轮的大小/位置）
//
// 交互（与快捷面板的亮度/音量调节一致）：
// - 列表里滚动选一个项目，轻点中央键（或点行）进入「调节态」
// - 调节态：旋转滚轮改数值；MENU 回列表；中央键确认退出
// 调节时壳（显示框 / 滚轮）实时变化，所见即所得。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/stores/navigation';
import { usePrefs } from '@/stores/prefs';
import { ListMenu } from '@/components/ui/ListMenu';
import type { MenuItem } from '@/types';

type GeomKey = 'screenW' | 'screenH' | 'screenDy' | 'wheelSize' | 'wheelDy';

interface Field {
  key: GeomKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const FIELDS: Field[] = [
  { key: 'screenW', label: '显示框宽度', unit: '%', min: 50, max: 100, step: 2 },
  { key: 'screenH', label: '显示框高度', unit: 'px', min: 200, max: 600, step: 4 },
  { key: 'screenDy', label: '显示框位置', unit: 'px', min: -100, max: 100, step: 2 },
  { key: 'wheelSize', label: '滚轮大小', unit: '%', min: 50, max: 100, step: 2 },
  { key: 'wheelDy', label: '滚轮位置', unit: 'px', min: -100, max: 100, step: 2 },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// 桥：供 main.tsx 的 SELECT / 滚轮 / MENU 分发调用
let bridge: {
  isAdjusting(): boolean;
  enter(key: GeomKey): void;
  exit(): void;
  adjust(d: number): void;
} | null = null;

export function layoutSelect(index: number) {
  const f = FIELDS[index];
  if (!f) return;
  bridge?.enter(f.key);
}

export function layoutWheel(d: number) {
  bridge?.adjust(d);
}

export function layoutIsAdjusting(): boolean {
  return bridge?.isAdjusting() ?? false;
}

/** 返回 true 表示已消费（处于调节态，退出调节）；false 交给常规返回逻辑 */
export function layoutMenu(): boolean {
  if (!bridge?.isAdjusting()) return false;
  bridge.exit();
  return true;
}

export function LayoutView() {
  const setItems = useNavigation((s) => s.setItems);
  const selectedIndex = useNavigation((s) => s.selectedIndex);
  const setIndex = useNavigation((s) => s.setIndex);

  const screenW = usePrefs((s) => s.screenW);
  const screenH = usePrefs((s) => s.screenH);
  const screenDy = usePrefs((s) => s.screenDy);
  const wheelSize = usePrefs((s) => s.wheelSize);
  const wheelDy = usePrefs((s) => s.wheelDy);
  const update = usePrefs((s) => s.update);

  const values: Record<GeomKey, number> = { screenW, screenH, screenDy, wheelSize, wheelDy };

  const [adjusting, setAdjusting] = useState<GeomKey | null>(null);

  const listItems = useMemo<MenuItem[]>(
    () =>
      FIELDS.map((f) => ({
        kind: 'action' as const,
        label: f.label,
        meta: `${values[f.key]}${f.unit}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screenW, screenH, screenDy, wheelSize, wheelDy],
  );

  useEffect(() => {
    setItems(listItems);
  }, [listItems, setItems]);

  // 桥接 main.tsx 的 SELECT / 滚轮 / MENU
  useEffect(() => {
    bridge = {
      isAdjusting: () => adjusting !== null,
      enter(key) {
        setAdjusting(key);
      },
      exit() {
        setAdjusting(null);
      },
      adjust(d) {
        const key = adjusting;
        if (!key) return;
        const f = FIELDS.find((x) => x.key === key);
        if (!f) return;
        // 从 store 读当前值，避免闭包旧值
        const cur = usePrefs.getState()[key] as number;
        update(key, clamp(Math.round(cur + d * f.step), f.min, f.max));
      },
    };
    return () => {
      bridge = null;
    };
  }, [adjusting, update]);

  const field = adjusting ? FIELDS.find((f) => f.key === adjusting) : undefined;

  // 调节态：只显示数值 + 提示，把壳露出来看变化
  if (adjusting && field) {
    return (
      <div className="qp-scrim">
        <div className="qp-card">
          <div className="qp-title">{field.label}</div>
          <div className="qp-ring-wrap">
            <div className="text-center" style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>
              {values[adjusting]}
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                {field.unit}
              </span>
            </div>
          </div>
          <div className="qp-hint">旋转滚轮调整 · MENU 返回列表 · 中央键确认</div>
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
        layoutSelect(i);
      }}
    />
  );
}
