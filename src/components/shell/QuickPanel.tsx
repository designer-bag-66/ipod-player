// ============================================================
// QuickPanel - 主页按 MENU 呼出的快捷面板
//
// 两种形态（尺寸/配色/文案全部来自设计源）：
// 1. 面板态：卡片标题 + 若干圆形按钮（默认「亮度 / 音量」）+ 底部提示
// 2. 调节态：卡片标题 + 环形进度（圈内图标 + 圈下百分比）+ 底部提示
//
// 项的个数与文案由设计源 quickLabels 决定，第 1 项=亮度、第 2 项=音量。
//
// 交互（由 App.tsx 驱动）：
// - 轮盘滑动：面板态换选中项；调节态改数值（每格 ±5%）
// - 轻点中央键：面板态进入该项；调节态退出调节
// - MENU：调节态回到面板；面板态关闭面板
// ============================================================

import clsx from 'clsx';
import { useDesign } from '@/design';

export type QuickAdjust = 'none' | 'bright' | 'vol';

interface Props {
  open: boolean;
  row: number;
  adjusting: QuickAdjust;
  brightness: number; // 0.3 ~ 1
  volume: number; // 0 ~ 1
}

export function QuickPanel({ open, row, adjusting, brightness, volume }: Props) {
  const qpTitle = useDesign((s) => s.doc.layout.qpTitle);
  const qpHint = useDesign((s) => s.doc.layout.qpHint);
  const adjHint = useDesign((s) => s.doc.layout.adjHint);
  const ringWidth = useDesign((s) => s.doc.layout.ringWidth);
  const ringSize = useDesign((s) => s.doc.layout.ringSize);
  const labels = useDesign((s) => s.doc.quickLabels);

  if (!open) return null;

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // 第 1 项 = 亮度（太阳），第 2 项 = 音量（喇叭）
  const ICONS = [<IconSun key="s" />, <IconVolume key="v" />];
  const panelLabels = labels.length ? labels : ['亮度', '音量'];
  const rows = panelLabels.map((label, i) => ({
    key: i === 0 ? 'bright' : 'vol',
    label,
    icon: ICONS[i] ?? <IconSun key={`f${i}`} />,
  }));

  // ---- 调节态：环形进度 ----
  if (adjusting !== 'none') {
    const isBright = adjusting === 'bright';
    const value = isBright ? brightness : volume;
    const title =
      (isBright ? rows[0]?.label : rows[1]?.label) ?? (isBright ? '亮度' : '音量');
    // 把 px 宽度换算成 viewBox(100) 里的单位
    const strokeUnits = (ringWidth / Math.max(1, ringSize)) * 100;

    return (
      <div className="qp-scrim">
        <div className="qp-card">
          <div className="qp-title">{title}</div>
          <div className="qp-ring-wrap">
            <div className="qp-ring">
              <RingSvg value={value} strokeUnits={strokeUnits} />
              <div className="qp-ring-center">
                <span className="qp-ring-icon">{isBright ? <IconSun /> : <IconVolume />}</span>
                <span className="qp-ring-val">{pct(value)}</span>
              </div>
            </div>
          </div>
          <div className="qp-hint">{adjHint}</div>
        </div>
      </div>
    );
  }

  // ---- 面板态：圆形按钮 ----
  return (
    <div className="qp-scrim">
      <div className="qp-card">
        <div className="qp-title">{qpTitle}</div>
        <div className="qp-row">
          {rows.map((it, i) => (
            <div key={it.key} className={clsx('qp-item', i === row && 'selected')}>
              <div className="qp-circle">{it.icon}</div>
              <span className="qp-label">{it.label}</span>
            </div>
          ))}
        </div>
        <div className="qp-hint">{qpHint}</div>
      </div>
    </div>
  );
}

/** 环形进度：viewBox 固定 100×100，环宽由设计源的 ringWidth/ringSize 换算 */
function RingSvg({ value, strokeUnits }: { value: number; strokeUnits: number }) {
  const radius = 50 - strokeUnits / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  const offset = circumference * (1 - clamped);

  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <circle className="qp-ring-track" cx="50" cy="50" r={radius} strokeWidth={strokeUnits} />
      <circle
        className="qp-ring-fill"
        cx="50"
        cy="50"
        r={radius}
        strokeWidth={strokeUnits}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

/* ---------------- 图标（用 currentColor，尺寸跟随 font-size） ---------------- */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** 亮度：太阳 */
function IconSun() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Svg>
  );
}

/** 音量：喇叭 + 声波 */
function IconVolume() {
  return (
    <Svg>
      <path d="M11 5 7 9H4v6h3l4 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a9 9 0 0 1 0 12" />
    </Svg>
  );
}
