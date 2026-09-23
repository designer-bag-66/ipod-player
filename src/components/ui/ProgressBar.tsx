// ============================================================
// ProgressBar - 可点击/拖动的进度条
// ============================================================

import { useRef } from 'react';

interface Props {
  elapsed: number;
  duration: number;
  onSeek: (elapsed: number) => void;
}

export function formatTime(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ProgressBar({ elapsed, duration, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const pct = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  function handlePointer(e: React.PointerEvent) {
    if (!ref.current || duration <= 0) return;
    const rect = ref.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }

  return (
    <div className="w-full">
      <div
        ref={ref}
        className="progress-track"
        onPointerDown={handlePointer}
        onPointerMove={(e) => {
          if (e.buttons > 0) handlePointer(e);
        }}
      >
        <div className="progress-fill" style={{ right: `${(1 - pct) * 100}%` }} />
      </div>
      <div
        className="flex justify-between text-[10px] mt-1 font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>{formatTime(elapsed)}</span>
        <span>-{formatTime(Math.max(0, duration - elapsed))}</span>
      </div>
    </div>
  );
}