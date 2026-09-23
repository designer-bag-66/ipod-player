// ============================================================
// AlbumCover - 封面：优先用元数据封面，加载失败或缺失时用渐变占位
// ============================================================

import { useEffect, useState } from 'react';
import { coverPlaceholderText } from '@/services/metadata';

interface Props {
  src?: string;
  title: string;
  size?: number;
  rounded?: number;
}

export function AlbumCover({ src, title, size = 140, rounded = 12 }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={title}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: rounded, objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      className="cover-placeholder"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: gradientFor(title),
      }}
    >
      {coverPlaceholderText(title)}
    </div>
  );
}

function gradientFor(seed: string): string {
  // 简单 hash → HSL
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const h = Math.abs(hash) % 360;
  const h2 = (h + 40) % 360;
  return `linear-gradient(135deg, hsl(${h}, 70%, 65%), hsl(${h2}, 65%, 45%))`;
}