// ============================================================
// ListMenu - 通用列表项渲染（文档 4.4 页面导航的核心 UI）
//
// 行为：
// - 选中项保持高亮色（颜色来自设计源 --sel-1 / --sel-2 / --sel-text）
// - 切换 selectedIndex 时，列表平滑滚动，使选中行居中
// - 行高 / 圆角 / 字号 / 左右内边距全部由设计源 CSS 变量决定
// - onPick：触摸点按某一行（手机上可不用轮盘直接点）
// - indexAttr：给每行加 data-<x>-index 属性（主页列表模式复用飞入动画定位）
// - 序号 / 箭头 / 分隔线由设计源 listIndex / listChevron / listDivider 控制
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { haptic } from '@/services/haptic';
import { playTick } from '@/services/sound';
import { useDesign } from '@/design';
import type { MenuItem } from '@/types';

interface Props {
  items: MenuItem[];
  selectedIndex: number;
  onPick?: (index: number) => void;
  /** 例如 'home-icon' → 每行带 data-home-icon-index */
  indexAttr?: string;
}

export function ListMenu({ items, selectedIndex, onPick, indexAttr }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());

  const showIndex = useDesign((s) => s.doc.layout.listIndex);
  const showChevron = useDesign((s) => s.doc.layout.listChevron);
  const showDivider = useDesign((s) => s.doc.layout.listDivider);

  /** 滚动区尺寸变化时重算（底部播放卡片让出空间后滚动区会变矮） */
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    const c = containerRef.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  /**
   * 选中行始终滚到可视区正中。
   *
   * 只做到「滚到中间」还不够：内容如果只比可视区高一点点，最后几行没有足够
   * 的滚动余量，永远到不了中间（会被底部卡片压住）。所以先给列表底部补出
   * 「半个可视高度 - 半行高」的余量，让任意一行都能滚到正中。
   * 内容本来就放得下时不补，保留「列表位置」的效果。
   */
  useLayoutEffect(() => {
    const c = containerRef.current;
    const inner = innerRef.current;
    if (!c || !inner) return;

    const row = rowRefs.current.get(selectedIndex);

    // 先按自然高度判断是否需要滚动
    inner.style.paddingBottom = '';
    const needScroll = inner.scrollHeight > c.clientHeight;
    const rowH = row?.offsetHeight ?? 0;
    inner.style.paddingBottom = needScroll
      ? `${Math.max(0, c.clientHeight / 2 - rowH / 2)}px`
      : '';

    if (!row) return;
    const target = row.offsetTop - c.clientHeight / 2 + row.offsetHeight / 2;
    c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [selectedIndex, items, layoutTick]);

  return (
    <div ref={containerRef} className="list-scroll no-scrollbar">
      {items.length === 0 && <div className="empty-hint">（空）</div>}
      <div ref={innerRef} className="list-inner">
        {items.map((item, i) => {
          const selected = i === selectedIndex;
          const dataAttr = indexAttr ? { [`data-${indexAttr}-index`]: i } : {};
          return (
            <div
              key={i}
              ref={(el) => {
                if (el) rowRefs.current.set(i, el);
                else rowRefs.current.delete(i);
              }}
              {...dataAttr}
              className={clsx(
                'list-row',
                selected && 'selected',
                showDivider && 'has-divider',
                onPick && 'list-row-tappable',
                // 分组说明行（不可操作）：不跟随列表字号放大，避免撑爆换行
                item.kind === 'title' && 'list-row-group',
              )}
              onClick={
                onPick
                  ? () => {
                      // 触摸点按也给一份反馈（以前只有转盘手势才有震动）
                      void haptic();
                      playTick('select');
                      onPick(i);
                    }
                  : undefined
              }
            >
              {showIndex && <span className="list-index">{i + 1}</span>}
              {item.kind !== 'title' && item.artwork && (
                <span className="list-row-art" aria-hidden>
                  {item.artwork.url ? <img src={item.artwork.url} alt="" loading="lazy" /> : '♪'}
                </span>
              )}
              {item.kind !== 'title' && !item.artwork && item.icon && (
                <span
                  className="list-row-icon"
                  aria-hidden
                  style={item.iconColor ? { color: item.iconColor } : undefined}
                >
                  {item.icon}
                </span>
              )}
              {item.kind === 'track' || item.kind === 'submenu' || item.kind === 'action' || item.kind === 'toggle' ? (
                <>
                  <span className="list-title">{item.label}</span>
                  {item.meta && (
                    <span className="list-meta">
                      {item.kind === 'toggle'
                        ? item.value
                          ? '开'
                          : '关'
                        : item.meta}
                    </span>
                  )}
                </>
              ) : (
                <span className="list-title" style={{ fontWeight: 600 }}>
                  {item.label}
                </span>
              )}
              {showChevron && <span className="list-chevron">›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
