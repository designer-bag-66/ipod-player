// ============================================================
// 音频元数据读取（文档 4.1）
// 浏览器端使用 music-metadata 解析 ID3 / iTunes / Vorbis 标签
// ============================================================

import { parseBuffer } from 'music-metadata';

export interface ParsedMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork?: Blob;
}

async function blobToArrayBuffer(blob: Blob): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const buffer = await blob.arrayBuffer();
  return { buffer, mimeType: blob.type || 'audio/mpeg' };
}

/**
 * 从音频 Blob 解析元数据。返回的 artwork 是 JPEG/PNG Blob，
 * 调用方负责进一步转为 objectURL 存入曲库。
 */
export async function readMetadata(
  blob: Blob,
  fallbackFileName: string,
): Promise<ParsedMetadata> {
  try {
    const { buffer, mimeType } = await blobToArrayBuffer(blob);
    const meta = await parseBuffer(new Uint8Array(buffer), mimeType);
    const title = meta.common.title?.trim();
    const artist = meta.common.artist?.trim();
    const album = meta.common.album?.trim();

    // 内嵌封面优先取第一张
    const picture = meta.common.picture?.[0];
    const artwork = picture
      ? new Blob([picture.data as unknown as BlobPart], {
          type: picture.format || 'image/jpeg',
        })
      : undefined;

    return {
      title: title || stripExt(fallbackFileName),
      artist: artist || '未知艺人',
      album: album || '未知专辑',
      duration: meta.format.duration ?? 0,
      artwork,
    };
  } catch (err) {
    console.warn('[metadata] parse failed, using fallback', err);
    return {
      title: stripExt(fallbackFileName),
      artist: '未知艺人',
      album: '未知专辑',
      duration: 0,
    };
  }
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** 简易「首字符大写」用于封面占位 */
export function coverPlaceholderText(title: string): string {
  const ch = title.trim();
  if (!ch) return '♪';
  // 取首个 CJK / 拉丁字符
  const c = [...ch][0];
  return c.toUpperCase();
}