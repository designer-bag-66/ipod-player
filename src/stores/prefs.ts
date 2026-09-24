// ============================================================
// 用户首选项 Store
// - 同步读写 localStorage（启动即可用，不依赖异步 IDB）
// - 主页布局 / 触感 / 选择音效 / 网易云 API 地址
// ============================================================

import { create } from 'zustand';

/** 主页呈现方式：图标网格 | 列表 */
export type HomeLayout = 'grid' | 'list';

export interface PrefsValues {
  homeLayout: HomeLayout;
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
    const { homeLayout, haptics, soundFeedback, neteaseBase } = get();
    writeStorage({ homeLayout, haptics, soundFeedback, neteaseBase });
  },
}));
