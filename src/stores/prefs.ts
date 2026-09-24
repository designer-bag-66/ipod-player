// ============================================================
// 用户首选项 Store
// - 同步读写 localStorage（启动即可用，不依赖异步 IDB）
// - 主页列表字号倍率 / 列表位置 / 触感强度 / 音效强度 / 网易云 API 地址
//   （主页布局与配色尺寸改由「设计源」src/design 控制）
// ============================================================

import { create } from 'zustand';

/** 主页呈现方式：图标网格 | 列表 */
export type HomeLayout = 'grid' | 'list';

// ---------------- 反馈强度（触感 / 音效共用） ----------------

/** 反馈强度档位：关 / 弱 / 中 / 强 */
export type FeedbackLevel = 'off' | 'low' | 'mid' | 'high';

export const FEEDBACK_ORDER: FeedbackLevel[] = ['off', 'low', 'mid', 'high'];

export const FEEDBACK_LABELS: Record<FeedbackLevel, string> = {
  off: '关',
  low: '弱',
  mid: '中',
  high: '强',
};

/** 档位 → 倍率：音效音量、震动强度都乘它 */
export const FEEDBACK_SCALE: Record<FeedbackLevel, number> = {
  off: 0,
  low: 0.5,
  mid: 1,
  high: 1.8,
};

/** 旧版本这两个字段是 boolean 开关，读到时转成档位 */
function toFeedbackLevel(v: unknown): FeedbackLevel {
  if (v === true) return 'mid';
  if (v === false) return 'off';
  return FEEDBACK_ORDER.includes(v as FeedbackLevel) ? (v as FeedbackLevel) : 'mid';
}

/** 主页列表字号档位 */
export type HomeListSize = 'sm' | 'md' | 'lg' | 'xl';

/** 主页列表垂直位置 */
export type HomeListPos = 'top' | 'mid' | 'bottom';

/**
 * 主页列表字号：只作为设计源行高 / 字号的「倍率」。
 * 绝对值（rowHeight / rowFont / rowRadius）由 src/design/design.json 决定，
 * 这里只做整体放大 / 缩小，落到 CSS 变量 --hl-scale 上。
 */
export const HOME_LIST_SCALE: Record<HomeListSize, number> = {
  sm: 0.78,
  md: 1,
  lg: 1.15,
  xl: 1.3,
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
  /** 主页列表：行高 / 字号倍率（绝对值见设计源 rowHeight / rowFont） */
  homeListSize: HomeListSize;
  /** 主页列表：整体靠上 / 居中 / 靠下 */
  homeListPos: HomeListPos;
  /** 触感反馈强度 */
  haptics: FeedbackLevel;
  /** 选择音效强度 */
  soundFeedback: FeedbackLevel;
  /** 自定义网易云 API 地址；空串 = 使用内置地址 */
  neteaseBase: string;
}

const KEY = 'ipod_prefs';

const DEFAULTS: PrefsValues = {
  homeListSize: 'md',
  homeListPos: 'mid',
  haptics: 'mid',
  soundFeedback: 'mid',
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
    set({
      ...DEFAULTS,
      ...saved,
      // 这两个旧版本存的是 boolean 开关，统一转成档位
      haptics: toFeedbackLevel(saved.haptics),
      soundFeedback: toFeedbackLevel(saved.soundFeedback),
      loaded: true,
    });
  },

  update(key, value) {
    set({ [key]: value } as unknown as Partial<PrefsState>);
    const s = get();
    // 显式列出全部字段，避免新加的首选项漏存
    writeStorage({
      homeListSize: s.homeListSize,
      homeListPos: s.homeListPos,
      haptics: s.haptics,
      soundFeedback: s.soundFeedback,
      neteaseBase: s.neteaseBase,
    });
  },
}));
