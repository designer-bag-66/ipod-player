// ============================================================
// NowPlayingView - 沉浸式播放页（模糊封面底 + 大方形封面 + 标题 + 进度圆点 + 底部控制条）
// ============================================================

import type { CSSProperties, MouseEvent } from 'react';
import { usePlayer } from '@/stores/player';
import { useNavigation } from '@/stores/navigation';

const NPI = {
  shuffle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.2c1.3 0 2.5.6 3.3 1.7l4.9 6.6c.8 1.1 2 1.7 3.3 1.7H21"/><path d="M3 17h3.2c1.3 0 2.5-.6 3.3-1.7l1.3-1.8"/><path d="M14.4 9.5l1.3-1.8C16.5 6.6 17.7 6 19 6h2"/><path d="M18.4 3.6L21 6l-2.6 2.4"/><path d="M18.4 14.6L21 17l-2.6 2.4"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 5v14l-9-7z"/><path d="M6 5h2v14H6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l9-7z"/><path d="M16 5h2v14h-2z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 5h2v14H9z"/><path d="M13 5h2v14h-2z"/></svg>',
  repeat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5l3 3-3 3"/><path d="M4 12V9.5A3 3 0 0 1 7 6.5h13"/><path d="M7 20.5l-3-3 3-3"/><path d="M20 12v2.5a3 3 0 0 1-3 3H4"/></svg>',
};

function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function NowPlayingView() {
  const currentTrack = usePlayer((s) => s.currentTrack);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = currentTrack?.duration ?? 0;
  const status = usePlayer((s) => s.status);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const back = useNavigation((s) => s.back);

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 text-center">
        <div className="text-[13px]" style={{ color: 'var(--screen-text-secondary)' }}>
          还没有正在播放的歌曲
        </div>
        <div className="text-[10px] mt-1" style={{ color: 'var(--screen-text-muted)' }}>
          选一首开始播放
        </div>
      </div>
    );
  }

  const art = currentTrack.artworkUrl ? `url("${currentTrack.artworkUrl}")` : undefined;
  const artStyle = art ? ({ '--np-imm-art': art } as unknown as CSSProperties) : undefined;
  const p = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const playing = status === 'playing';
  const player = usePlayer.getState;

  const seekFromEvent = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    void player().seek(ratio * duration);
  };

  return (
    <div className="np-imm" style={artStyle}>
      <div className="np-imm-bg" />
      <div className="np-imm-scrim" />

      <div className="np-imm-nav">
        <div className="left">
          <span
            className="back"
            role="button"
            aria-label="返回"
            onClick={() => back()}
          >
            ‹
          </span>
          <span className="ttl">正在播放</span>
        </div>
        <span className="right">{currentTrack.album}</span>
      </div>

      <div className="np-imm-artwrap">
        <div className="np-imm-art" style={art ? { backgroundImage: art } : undefined} />
      </div>

      <div className="np-imm-meta">
        <div className="tx">
          <div className="np-imm-song">{currentTrack.title}</div>
          <div className="np-imm-artist">
            {currentTrack.artist} · {currentTrack.album}
          </div>
        </div>
      </div>

      <div className="np-imm-prog">
        <div className="np-imm-track" onClick={seekFromEvent}>
          <div className="np-imm-fill" style={{ width: `${p * 100}%` }} />
          <span className="np-imm-knob" style={{ left: `${p * 100}%` }} />
        </div>
        <div className="np-imm-times">
          <span>{fmt(elapsed)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <div className="np-imm-ctl">
        <button
          className={`btn${shuffle === 'on' ? ' on' : ''}`}
          aria-label="随机播放"
          onClick={() => player().toggleShuffle()}
          dangerouslySetInnerHTML={{ __html: NPI.shuffle }}
        />
        <button
          className="btn"
          aria-label="上一首"
          onClick={() => player().previous()}
          dangerouslySetInnerHTML={{ __html: NPI.prev }}
        />
        <button
          className="btn"
          aria-label="播放/暂停"
          onClick={() => player().toggle()}
          dangerouslySetInnerHTML={{ __html: playing ? NPI.pause : NPI.play }}
        />
        <button
          className="btn"
          aria-label="下一首"
          onClick={() => player().next()}
          dangerouslySetInnerHTML={{ __html: NPI.next }}
        />
        <button
          className={`btn${repeat !== 'off' ? ' on' : ''}`}
          aria-label="循环模式"
          onClick={() => player().cycleRepeat()}
          dangerouslySetInnerHTML={{ __html: NPI.repeat }}
        />
      </div>
    </div>
  );
}
