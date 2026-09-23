// ============================================================
// NowPlayingView - 文档 4.4 + 7（accept）：封面、信息、进度、播放模式
// ============================================================

import { useEffect, useState } from 'react';
import { usePlayer } from '@/stores/player';
import { useLibrary } from '@/stores/library';
import { AlbumCover } from '@/components/ui/AlbumCover';
import { ProgressBar } from '@/components/ui/ProgressBar';

export function NowPlayingView() {
  const currentTrack = usePlayer((s) => s.currentTrack);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = currentTrack?.duration ?? 0;
  const status = usePlayer((s) => s.status);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggleLiked = useLibrary((s) => s.toggleLiked);
  const [tick, setTick] = useState(0);

  // 让封面在播放时有缓慢旋转的呼吸感（受 status 控制）
  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 text-center">
        <div
          className="text-3xl mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          ♪
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          曲库中没有正在播放的歌曲
        </div>
        <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          在「音乐 → 歌曲」里选一首开始播放
        </div>
      </div>
    );
  }

  return (
    <div className="np-bg h-full p-3 flex flex-col gap-2">
      <div className="flex-1 flex items-center justify-center">
        <div
          className="transition-transform"
          style={{
            transform: `scale(${1 + Math.sin(tick / 3) * 0.01})`,
          }}
        >
          <AlbumCover src={currentTrack.artworkUrl} title={currentTrack.title} size={140} />
        </div>
      </div>

      <div className="glass-card-strong rounded-xl px-3 py-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className="text-[15px] font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {currentTrack.title}
            </div>
            <div
              className="text-[11px] truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {currentTrack.artist} — {currentTrack.album}
            </div>
          </div>
          <button
            onClick={() => toggleLiked(currentTrack.id)}
            className="text-xl shrink-0"
            style={{ color: currentTrack.liked ? '#ff3b30' : 'var(--text-muted)' }}
            aria-label="喜欢"
          >
            {currentTrack.liked ? '♥' : '♡'}
          </button>
        </div>

        <ProgressBar elapsed={elapsed} duration={duration} onSeek={(t) => usePlayer.getState().seek(t)} />

        <div
          className="flex justify-between text-[10px] mt-2 font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>{(shuffle === 'on') ? '🔀 随机' : '→ 顺序'}</span>
          <span>
            {repeat === 'off' ? '不循环' : repeat === 'all' ? '🔁 全部' : '🔂 单曲'}
          </span>
        </div>
      </div>
    </div>
  );
}