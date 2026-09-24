// ============================================================
// 用户首选项 Store
// - 同步读写 localStorage（启动即可用，不依赖异步 IDB）
// - 主页布局 / 主页列表字号 / 主页列表位置 / 触感 / 选择音效 / 网易云 API 地址
// ============================================================

import { create } from 'zustand';

/** 主页呈现方式：图标网格 | 列表 */
export type HomeLayout = 'grid' | 'list';

/** 主页列表字号档位 */
export type HomeListSize = 'sm' | 'md' | 'lg' | 'xl';

/** 主页列表垂直位置 */
export type HomeListPos = 'top' | 'mid' | 'bottom';

export interface HomeListSizeSpec {
  /** 行高 px */
  row: number;
  /** 字号 px */
  font: number;
  /** 圆角 px */
  radius: number;
}

// 屏幕内容区高约 260~340px（7:9 屏幕减状态栏与标题），6 行需放得下：
// 「标准」按 ~270px 可用高度设计，正好容纳 6 行不滚动
export const HOME_LIST_SIZE: Record<HomeListSize, HomeListSizeSpec> = {
  sm: { row: 34, font: 12, radius: 11 },
  md: { row: 40, font: 14, radius: 13 },
  lg: { row: 48, font: 16, radius: 15 },
  xl: { row: 56, font: 18, radius: 17 },
};

export const HOME_LIST_SIZE_ORDER: HomeListSize[] = ['sm', 'md', 'lg', 'xl'];
export const HOME_LIST_POS_ORDER: HomeListPos[] = ['top', 'mid', 'bottom'];

export const HOME_LIST_SIZE_LABELS: Record<HomeListSize, string> = {
  sm: '小',
  md: '标准',
  lg: '大',
  xl: '特大',
};

export const HOME_LIST_POS_LABELS: Record<HomeListPos, string> = {
  top: '偏上',
  mid: '居中',
  bottom: '偏下',
};

/** 列表行间距（flex gap，px） */
export const HOME_LIST_GAP = 2;

export interface PrefsValues {
  homeLayout: HomeLayout;
  /** 主页列表：行高 / 字号 */
  homeListSize: HomeListSize;
  /** 主页列表：整体靠上 / 居中 / 靠下 */
  homeListPos: HomeListPos;
  /** 轮盘震动反馈 */
  haptics: boolean;
  /** 轮盘选择/滚动音效 */
  soundFeedback: boolean;
  /** 自定义网易云 API 地址；空串 = 使用内置地址 */
  neteaseBase: string;
}

const KEY = 'ipod_prefs';

const DEFAULTS: PrefsValues = {
  homeLayout: 'list',
  homeListSize: 'md',
  homeListPos: 'mid',
  haptics: true,
  soundFeedback: true,
  neteaseBase: '',
};

interface PrefsState extends PrefsValues {
  loaded: boolean;
  init(): void;
  update<K extends keyof PrefsValues>(key: K, value: PrefsValues[K]): void;
}

function readStorage(): Partial<PrefsValues> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<PrefsValues>) : {};
  } catch {
    return {};
  }
}

function writeStorage(v: PrefsValues) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  init() {
    const saved = readStorage();
    set({ ...DEFAULTS, ...saved, loaded: true });
  },

  update(key, value) {
    set({ [key]: value } as unknown as Partial<PrefsState>);
    const s = get();
    // 显式列出全部字段，避免新加的首选项漏存
    writeStorage({
      homeLayout: s.homeLayout,
      homeListSize: s.homeListSize,
      homeListPos: s.homeListPos,
      haptics: s.haptics,
      soundFeedback: s.soundFeedback,
      neteaseBase: s.neteaseBase,
    });
  },
}));
