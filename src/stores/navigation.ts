// ============================================================
// 导航 Store
// - 维护当前页面栈（Screen）
// - 维护每个 Screen 的选中索引与列表条目
// - 主页 selectedIndex 单独保存到 homeIndex，离开主页后返回仍能恢复
// ============================================================

import { create } from 'zustand';
import type { Screen, MenuItem } from '@/types';

interface NavState {
  stack: Screen[];
  push(s: Screen): void;
  back(): boolean; // 返回 true 表示成功弹出
  home(): void;
  current(): Screen;

  /** 当前 Screen 的列表条目（由各视图注册） */
  items: MenuItem[];
  selectedIndex: number;
  setItems(items: MenuItem[]): void;
  moveIndex(delta: number): void;
  setIndex(i: number): void;

  /** 主页图标选中索引（独立保存，以便返回主页后恢复） */
  homeIndex: number;
  setHomeIndex(i: number): void;
}

export const useNavigation = create<NavState>((set, get) => ({
  stack: [{ name: 'home' }],
  items: [],
  selectedIndex: 0,
  homeIndex: 0,

  push(s) {
    set((st) => ({ stack: [...st.stack, s], selectedIndex: 0 }));
  },

  back() {
    const { stack } = get();
    if (stack.length <= 1) return false;
    // 不重置 selectedIndex，让每个屏幕保留自己上次的选中位置
    set({ stack: stack.slice(0, -1) });
    return true;
  },

  home() {
    set({ stack: [{ name: 'home' }], selectedIndex: 0 });
  },

  current() {
    return get().stack[get().stack.length - 1];
  },

  setItems(items) {
    // 保留当前选中位置（仅在新列表更短时回落到 0）
    // 这样在设置页切换开关时不会把选中项弹回顶部
    set((st) => ({
      items,
      selectedIndex: st.selectedIndex < items.length ? st.selectedIndex : 0,
    }));
  },

  moveIndex(delta) {
    const { items, selectedIndex } = get();
    if (items.length === 0) return;
    const next = (selectedIndex + delta + items.length) % items.length;
    set({ selectedIndex: next });
  },

  setIndex(i) {
    const { items } = get();
    if (i >= 0 && i < items.length) set({ selectedIndex: i });
    else if (items.length === 0 && i === 0) set({ selectedIndex: 0 });
  },

  setHomeIndex(i) {
    set({ homeIndex: i });
  },
}));