// ============================================================
// 设计源（Design Source）
//
// 目标：让 App 的外观由 design/ipod-ui-lab.html 导出的设计 JSON 驱动，
// 而不是把配色/尺寸散落写死在 CSS 里。
//
// 取值优先级（后者覆盖前者）：
//   1. DEFAULT_DESIGN（代码内置，保证永不空）
//   2. src/design/design.json（随仓库内的设计文件，可被设计台导出覆盖）
//   3. localStorage['ipod_design']（在 App「设置 → 设计源」里粘贴的设计）
//
// 应用方式：把设计文档换算成一组 CSS 变量写到 <html> 的行内样式上，
// globals.css 全部通过 var(--x, 兜底值) 消费；customCss 注入到独立 <style>。
// ============================================================

import { create } from 'zustand';
import bundled from './design.json';

export type BgMode = 'metal' | 'solid' | 'gradient';
export type HomeLayoutMode = 'grid3' | 'grid2' | 'list';

export interface DesignTokens {
  shellBg: string;
  bezelBg: string;
  surfaceBg: string;
  bgMode: BgMode;
  grad1: string;
  grad2: string;
  waveOpacity: number;
  waveOn: boolean;
  metal1: string;
  metal2: string;
  metal3: string;
  metal4: string;
  text1: string;
  text2: string;
  text3: string;
  titleSize: number;
  titleWeight: number;
  letterSpacing: number;
  sel1: string;
  sel2: string;
  selText: string;
  selColor: string;
  glassAlpha: number;
  cardBlur: number;
  cardBorder: number;
  qpBg: string;
  qpText: string;
  ringFill: string;
  ringTrack: string;
  ringTrackAlpha: number;
  ringValColor: string;
  ringIconColor: string;
  prog1: string;
  prog2: string;
  npTint: string;
  npInk: string;
  npArt1: string;
  npArt2: string;
  npKnob: string;
  wheel1: string;
  wheel2: string;
  wheel3: string;
  wheelLabel: string;
  wheelCenter: string;
}

export interface DesignLayout {
  shellWidth: number;
  /** 外壳宽度上限 px（评审板预览时会临时放开） */
  shellMax: number;
  shellPadding: number;
  screenGap: number;
  screenRatio: string;
  /** 屏幕固定高度 px；0 = 跟随 screenRatio */
  screenH: number;
  /** 屏幕上边距 px */
  screenMt: number;
  /** 滚轮下边距 px */
  wheelMb: number;
  /** 快捷面板（MENU）：标题 / 底部提示 / 尺寸 */
  qpTitle: string;
  qpHint: string;
  adjHint: string;
  qpRadius: number;
  qpCircle: number;
  qpIcon: number;
  qpLabelSize: number;
  qpTitleSize: number;
  qpHintSize: number;
  qpOpacity: number;
  qpBlur: number;
  qpScrim: number;
  qpScrimBlur: number;
  /** 亮度 / 音量调节的环形控件 */
  ringSize: number;
  ringWidth: number;
  ringIconSize: number;
  ringValSize: number;
  bezelRadius: number;
  statusbarStyle: 'center' | 'split';
  showClock: boolean;
  homeTitle: string;
  homeSub: string;
  showHomeTitle: boolean;
  homeLayout: HomeLayoutMode;
  gridCols: number;
  gridGap: number;
  gridPadX: number;
  showIconLabel: boolean;
  iconSize: number;
  iconRadius: number;
  iconAlpha: number;
  iconLabelSize: number;
  iconSelStyle: string;
  rowHeight: number;
  rowRadius: number;
  rowFont: number;
  listPadX: number;
  listIndex: boolean;
  listChevron: boolean;
  listDivider: boolean;
  npLayout: string;
  npCoverSize: number;
  npCardShow: boolean;
  npRadius: number;
  npAlpha: number;
  npCardBottom: number;
  npCardProgress: boolean;
  npCardTime: boolean;
  progressHeight: number;
  npArtSize: number;
  npArtRadius: number;
  npArtBlur: number;
  npTitleSize: number;
  npTitleWeight: number;
  npMetaSize: number;
  npKnobShow: boolean;
  npKnobSize: number;
  npCtlSize: number;
  wheelSize: number;
  wheelCenterSize: number;
  wheelShowLabels: boolean;
  wheelLabelStyle: 'icon' | 'text';
}

export interface DesignIcon {
  icon: string;
  label: string;
  /** 可选的图标颜色（例如「我喜欢的」用红心） */
  color?: string;
}

export interface DesignDoc {
  version?: number;
  exportedAt?: string;
  note?: string;
  tokens: DesignTokens;
  layout: DesignLayout;
  icons: DesignIcon[];
  quickLabels: string[];
  customCss: string;
}

/** 兜底默认：与当前 App 的既有外观一致，缺少设计文件时不会变形 */
export const DEFAULT_DESIGN: DesignDoc = {
  version: 5,
  tokens: {
    shellBg: '#000000',
    bezelBg: '#0a0a0c',
    surfaceBg: '#d8d8de',
    bgMode: 'gradient',
    grad1: '#fad0c4',
    grad2: '#8fd3f4',
    waveOpacity: 1,
    waveOn: true,
    metal1: '#f0f0f4',
    metal2: '#d5d5de',
    metal3: '#b8b8c5',
    metal4: '#9a9aa8',
    text1: '#1a1a1f',
    text2: '#4b4b55',
    text3: '#6b6b76',
    titleSize: 18,
    titleWeight: 400,
    letterSpacing: 0.01,
    sel1: '#4c8eff',
    sel2: '#2563eb',
    selText: '#ffffff',
    selColor: '#ffffff',
    glassAlpha: 0.3,
    cardBlur: 18,
    cardBorder: 1,
    qpBg: '#2a2a2e',
    qpText: '#ffffff',
    ringFill: '#e8dfc9',
    ringTrack: '#ffffff',
    ringTrackAlpha: 0.16,
    ringValColor: '#ffffff',
    ringIconColor: '#ffffff',
    prog1: '#22d3ee',
    prog2: '#34d399',
    npTint: '#191715',
    npInk: '#2f2d28',
    npArt1: '#f1e9db',
    npArt2: '#ddd0b8',
    npKnob: '#5eead4',
    wheel1: '#BC2420',
    wheel2: '#B0211D',
    wheel3: '#9E1E1B',
    wheelLabel: '#0A0A0A',
    wheelCenter: '#0A0A0A',
  },
  layout: {
    shellWidth: 90,
    shellMax: 420,
    shellPadding: 15,
    screenGap: 94,
    screenRatio: '7 / 9',
    screenH: 432,
    screenMt: 0,
    wheelMb: 20,
    qpTitle: '操作',
    qpHint: '滚动选择 · CENTER 应用 · MENU',
    adjHint: '滚动调整 · 中央键确认 · 菜单键返回',
    qpRadius: 26,
    qpCircle: 74,
    qpIcon: 30,
    qpLabelSize: 13,
    qpTitleSize: 13,
    qpHintSize: 10,
    qpOpacity: 0.58,
    qpBlur: 26,
    qpScrim: 0.22,
    qpScrimBlur: 2,
    ringSize: 190,
    ringWidth: 14,
    ringIconSize: 26,
    ringValSize: 34,
    bezelRadius: 13,
    statusbarStyle: 'center',
    showClock: false,
    homeTitle: '音乐资料',
    homeSub: 'Music Library',
    showHomeTitle: false,
    homeLayout: 'list',
    gridCols: 3,
    gridGap: 14,
    gridPadX: 16,
    showIconLabel: true,
    iconSize: 54,
    iconRadius: 16,
    iconAlpha: 0.55,
    iconLabelSize: 11,
    iconSelStyle: 'glow',
    rowHeight: 60,
    rowRadius: 15,
    rowFont: 26,
    listPadX: 14,
    listIndex: false,
    listChevron: false,
    listDivider: false,
    npLayout: 'immersive',
    npCoverSize: 132,
    npCardShow: true,
    npRadius: 22,
    npAlpha: 0.55,
    npCardBottom: 12,
    npCardProgress: true,
    npCardTime: true,
    progressHeight: 5,
    npArtSize: 170,
    npArtRadius: 24,
    npArtBlur: 0.5,
    npTitleSize: 16,
    npTitleWeight: 500,
    npMetaSize: 10,
    npKnobShow: true,
    npKnobSize: 13,
    npCtlSize: 22,
    wheelSize: 90,
    wheelCenterSize: 42,
    wheelShowLabels: true,
    wheelLabelStyle: 'icon',
  },
  icons: [
    { icon: '📑', label: '歌单' },
    { icon: '📀', label: '专辑' },
    { icon: '♥', label: '我喜欢的', color: '#ff3b30' },
    { icon: '🔍', label: '搜索' },
    { icon: '⚙️', label: '设置' },
  ],
  quickLabels: ['亮度', '音量'],
  customCss: '',
};

/** 「粘贴设计 JSON」写入的完整设计 */
const STORAGE_KEY = 'ipod_design';
/**
 * App 内的小改动（例如设置里的「主页布局」）。
 * 只存被改过的字段——早期版本会把整份文档写进 STORAGE_KEY，
 * 结果永久遮蔽了设计文件，之后设计文件怎么改都不生效。
 */
const PATCH_KEY = 'ipod_design_patch';

/** 深合并：默认值 + 设计文件 + 本地覆盖，旧版本缺字段也不会崩 */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const out = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(patch as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)?.[k];
    const p = (patch as Record<string, unknown>)[k];
    if (p === undefined || p === null) continue;
    if (Array.isArray(p)) out[k] = p;
    else if (typeof p === 'object' && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = deepMerge(b, p);
    } else {
      out[k] = p;
    }
  }
  return out as T;
}

/** 把任意来源（文件 / 粘贴）的 JSON 规范成完整的设计文档 */
export function normalizeDesign(raw: unknown): DesignDoc {
  const doc = deepMerge(DEFAULT_DESIGN, raw);
  if (!Array.isArray(doc.icons) || doc.icons.length === 0) {
    doc.icons = DEFAULT_DESIGN.icons.map((i) => ({ ...i }));
  }
  doc.icons = doc.icons.map((it) => ({
    icon: it?.icon ?? '⭐',
    label: it?.label ?? '项目',
    ...(it?.color ? { color: it.color } : {}),
  }));
  if (doc.tokens.bgMode !== 'metal' && doc.tokens.bgMode !== 'solid' && doc.tokens.bgMode !== 'gradient') {
    doc.tokens.bgMode = 'gradient';
  }
  if (!['grid3', 'grid2', 'list'].includes(doc.layout.homeLayout)) doc.layout.homeLayout = 'list';
  if (typeof doc.customCss !== 'string') doc.customCss = '';
  return doc;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = String(hex || '#000').replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** 设计文档 → CSS 变量（变量名与设计台保持一致） */
export function designToVars(d: DesignDoc): Record<string, string> {
  const t = d.tokens;
  const l = d.layout;
  return {
    '--shell-bg': t.shellBg,
    '--bezel-bg': t.bezelBg,
    '--surface-bg': t.surfaceBg,
    '--grad-1': t.grad1,
    '--grad-2': t.grad2,
    '--wave-op': String(t.waveOpacity),
    '--wave-on': t.waveOn ? '1' : '0',
    '--metal-1': t.metal1,
    '--metal-2': t.metal2,
    '--metal-3': t.metal3,
    '--metal-4': t.metal4,
    '--text-1': t.text1,
    '--text-2': t.text2,
    '--text-3': t.text3,
    '--title-size': `${t.titleSize}px`,
    '--title-weight': String(t.titleWeight),
    '--title-ls': `${t.letterSpacing}em`,
    '--sel-1': t.sel1,
    '--sel-2': t.sel2,
    '--sel-text': t.selText,
    '--sel-color': t.selColor,
    '--glass-alpha': String(t.glassAlpha),
    '--card-blur': `${t.cardBlur}px`,
    '--card-border': `${t.cardBorder}px`,
    '--prog-1': t.prog1,
    '--prog-2': t.prog2,
    '--np-tint': t.npTint,
    '--np-ink': hexToRgba(t.npInk, 0.8),
    '--np-art-1': t.npArt1,
    '--np-art-2': t.npArt2,
    '--np-knob': t.npKnob,
    '--wheel-1': t.wheel1,
    '--wheel-2': t.wheel2,
    '--wheel-3': t.wheel3,
    '--wheel-label-c': t.wheelLabel,
    '--wheel-center-c': t.wheelCenter,
    '--screen-ratio': l.screenRatio,
    '--bezel-radius': `${l.bezelRadius}%`,
    '--shell-w': String(l.shellWidth),
    '--shell-max': `${l.shellMax}px`,
    '--shell-pad': `${l.shellPadding}px`,
    '--screen-gap': `${l.screenGap}px`,
    '--screen-h': l.screenH > 0 ? `${l.screenH}px` : '',
    '--screen-mt': `${l.screenMt}px`,
    '--wheel-mb': `${l.wheelMb}px`,
    '--cols': String(l.homeLayout === 'grid2' ? 2 : l.gridCols),
    '--grid-gap': `${l.gridGap}px`,
    '--grid-pad': `${l.gridPadX}px`,
    '--icon-size': `${l.iconSize}px`,
    '--icon-radius': `${l.iconRadius}px`,
    '--icon-alpha': String(l.iconAlpha),
    '--icon-label-size': `${l.iconLabelSize}px`,
    '--row-h': `${l.rowHeight}px`,
    '--row-radius': `${l.rowRadius}px`,
    '--row-font': `${l.rowFont}px`,
    '--list-pad-x': `${l.listPadX}px`,
    '--prog-h': `${l.progressHeight}px`,
    '--np-cover': `${l.npCoverSize}px`,
    '--np-radius': `${l.npRadius}px`,
    '--np-bottom': `${l.npCardBottom}%`,
    '--np-art-size': `${l.npArtSize}px`,
    '--np-art-radius': `${l.npArtRadius}px`,
    '--np-art-blur': String(l.npArtBlur),
    '--np-title-size': `${l.npTitleSize}px`,
    '--np-title-weight': String(l.npTitleWeight),
    '--np-meta-size': `${l.npMetaSize}px`,
    '--np-knob-size': `${l.npKnobSize}px`,
    '--np-ctl-size': `${l.npCtlSize}px`,
    '--wheel-size': `${l.wheelSize}%`,
    '--wheel-center-size': `${l.wheelCenterSize}%`,
    /* 快捷面板（MENU） */
    '--qp-bg': hexToRgba(t.qpBg, l.qpOpacity),
    '--qp-text': t.qpText,
    '--qp-radius': `${l.qpRadius}px`,
    '--qp-blur': `${l.qpBlur}px`,
    '--qp-scrim': String(l.qpScrim),
    '--qp-scrim-blur': `${l.qpScrimBlur}px`,
    '--qp-title-size': `${l.qpTitleSize}px`,
    '--qp-hint-size': `${l.qpHintSize}px`,
    '--qp-label-size': `${l.qpLabelSize}px`,
    '--qp-circle': `${l.qpCircle}px`,
    '--qp-icon': `${l.qpIcon}px`,
    /* 亮度 / 音量环形调节 */
    '--ring-size': `${l.ringSize}px`,
    '--ring-width': `${l.ringWidth}px`,
    '--ring-fill': t.ringFill,
    '--ring-track': hexToRgba(t.ringTrack, t.ringTrackAlpha),
    '--ring-icon': `${l.ringIconSize}px`,
    '--ring-icon-c': t.ringIconColor,
    '--ring-val-size': `${l.ringValSize}px`,
    '--ring-val-c': t.ringValColor,
  };
}

const CUSTOM_STYLE_ID = 'ipod-design-custom';

/** 把设计文档写到 DOM：CSS 变量 + 自定义 CSS */
export function applyDesign(doc: DesignDoc): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = designToVars(doc);
  for (const [k, v] of Object.entries(vars)) {
    if (v == null || v === '' || v.includes('undefined') || v.includes('NaN')) {
      root.style.removeProperty(k);
    } else {
      root.style.setProperty(k, v);
    }
  }
  let el = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = CUSTOM_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = doc.customCss || '';
}

export type DesignSource = 'default' | 'file' | 'local';

export interface DesignState {
  doc: DesignDoc;
  source: DesignSource;
  ready: boolean;
  /** 启动时调用：读取「设计文件 + 本地覆盖」并应用 */
  init(): void;
  /** 应用一段设计 JSON（设置页粘贴用），成功会写入 localStorage */
  applyJson(text: string): { ok: boolean; error?: string };
  /** 改单个布局项（例如设置页切换「主页布局」），写入本地覆盖 */
  patchLayout<K extends keyof DesignLayout>(key: K, value: DesignLayout[K]): void;
  /** 清除本地覆盖，回到仓库里的设计文件 */
  reset(): void;
}

function readLocal(): DesignDoc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as any;

    // 新版格式：{ __pasted: true, doc }
    if (obj && obj.__pasted && obj.doc) return normalizeDesign(obj.doc);

    // 旧版格式：早期「设置 → 主页布局」会把整份文档写进这里，
    // 从此永久遮蔽设计文件。识别出来后降级成补丁（只保留 homeLayout）。
    const homeLayout = obj?.layout?.homeLayout;
    if (homeLayout) writePatch({ layout: { homeLayout } });
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

/** App 内改动的补丁（浅层覆盖到 layout 上） */
function readPatch(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PATCH_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writePatch(patch: Record<string, unknown> | null): void {
  try {
    if (patch) localStorage.setItem(PATCH_KEY, JSON.stringify(patch));
    else localStorage.removeItem(PATCH_KEY);
  } catch {
    /* ignore */
  }
}

export function exportDesignJson(doc: DesignDoc): string {
  return JSON.stringify({ ...doc, exportedAt: new Date().toISOString() }, null, 2);
}

export const useDesign = create<DesignState>((set, get) => ({
  doc: DEFAULT_DESIGN,
  source: 'default',
  ready: false,

  init() {
    const pasted = readLocal();
    const patch = readPatch();
    // 优先级：内置默认 → 设计文件 → 粘贴的完整设计 → App 内补丁
    let doc = normalizeDesign(bundled);
    if (pasted) doc = normalizeDesign(deepMerge(doc, pasted));
    if (patch) doc = normalizeDesign(deepMerge(doc, patch));
    applyDesign(doc);
    set({ doc, source: pasted ? 'local' : 'file', ready: true });
  },

  applyJson(text) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'JSON 解析失败，请确认复制完整' };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '内容不是设计对象' };
    }
    const obj = parsed as Record<string, unknown>;
    if (!obj.tokens && !obj.layout) {
      return { ok: false, error: '缺少 tokens / layout 字段，可能不是设计台导出的 JSON' };
    }
    const doc = normalizeDesign(parsed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ __pasted: true, doc }));
      // 新粘贴的设计整份生效，清掉之前的 App 内补丁
      writePatch(null);
    } catch {
      /* 存储失败也不影响本次生效 */
    }
    applyDesign(doc);
    set({ doc, source: 'local', ready: true });
    return { ok: true };
  },

  patchLayout(key, value) {
    // 只记「被改动的那一项」，绝不写整份文档（否则会遮蔽设计文件）
    const existing = readPatch() ?? {};
    const layoutPatch = {
      ...((existing.layout as Record<string, unknown> | undefined) ?? {}),
      [key]: value,
    };
    writePatch({ ...existing, layout: layoutPatch });

    const next = normalizeDesign({
      ...get().doc,
      layout: { ...get().doc.layout, [key]: value },
    });
    applyDesign(next);
    set({ doc: next, ready: true });
  },

  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PATCH_KEY);
    } catch {
      /* ignore */
    }
    const base = normalizeDesign(bundled);
    applyDesign(base);
    set({ doc: base, source: 'file', ready: true });
  },
}));
