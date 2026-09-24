// ============================================================
// ListMenu - 通用列表项渲染（文档 4.4 页面导航的核心 UI）
//
// 行为：
// - 选中项保持高亮色（蓝色渐变）
// - 切换 selectedIndex 时，列表平滑滚动，使选中行居中
// - 行高度固定以便滚动计算稳定
// - onPick：触摸点按某一行（手机上可不用轮盘直接点）
// - indexAttr：给每行加 data-<x>-index 属性（主页列表模式复用飞入动画定位）
// ============================================================

import { useLayoutEffect, useRef } from 'react';
import clsx from 'clsx';
import { playTick } from '@/services/sound';
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
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());

  // 渲染完成后，把选中的行滚动到可视区中央
  useLayoutEffect(() => {
    const c = containerRef.current;
    const row = rowRefs.current.get(selectedIndex);
    if (!c || !row) return;
    const target = row.offsetTop - c.clientHeight / 2 + row.offsetHeight / 2;
    c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [selectedIndex, items]);

  return (
    <div ref={containerRef} className="list-scroll no-scrollbar">
      {items.length === 0 && <div className="empty-hint">（空）</div>}
      <div className="list-inner">
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
              className={clsx('list-row', selected && 'selected', onPick && 'list-row-tappable')}
              onClick={
                onPick
                  ? () => {
                      playTick('select');
                      onPick(i);
                    }
                  : undefined
              }
            >
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
