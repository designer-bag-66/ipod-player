// ============================================================
// NowPlayingBar - 屏幕底部「正在播放」卡片
// 玻璃卡片 + 封面 + 标题/歌手 + 进度条 + 时间
// 任何有 currentTrack 的页面都显示；点击跳到正在播放
// ============================================================

import { useNavigation } from '@/stores/navigation';
import { usePlayer } from '@/stores/player';

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function NowPlayingBar() {
  const currentTrack = usePlayer((s) => s.currentTrack);
  const status = usePlayer((s) => s.status);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = usePlayer((s) => s.currentTrack?.duration ?? 0);
  const push = useNavigation((s) => s.push);

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const isPlaying = status === 'playing';
  const statusText = isPlaying ? '播放中' : '已暂停';

  return (
    <button
      type="button"
      className="nowplaying-card"
      onClick={() => push({ name: 'now-playing' })}
      aria-label="正在播放"
    >
      {/* 左侧封面 */}
      <span className="nowplaying-cover" aria-hidden="true">
        {currentTrack.artworkUrl ? (
          <img src={currentTrack.artworkUrl} alt="" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
        )}
      </span>

      {/* 中间信息 */}
      <span className="nowplaying-body">
        <span className="nowplaying-title" title={currentTrack.title}>
          {currentTrack.title}
        </span>
        <span className="nowplaying-artist" title={currentTrack.artist}>
          {currentTrack.artist} · {statusText}
        </span>

        <span className="nowplaying-progress">
          <span
            className="nowplaying-progress-fill"
            style={{ transform: `scaleX(${progress})` }}
          />
        </span>

        <span className="nowplaying-times">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(duration)}</span>
        </span>
      </span>

    </button>
  );
}
