// ============================================================
// 预览用示例数据（只为「界面评审板」public/board.html 服务）
//
// 不带 ?demo=1 时，本文件只在被 services/netease 引用处做一次字符串比较，
// 不产生任何副作用，也不影响正常使用。
//
// 本文件**不 import 任何 store**，避免与 services/netease 形成循环引用。
// 本地曲库已移除，示例数据全部改成网易云曲目。
// ============================================================

import type { NetEasePlaylistSummary, NetEaseTrack, NetEaseUser } from '@/services/netease';

export interface PreviewConfig {
  /** 是否处于预览模式（?demo=1） */
  active: boolean;
  /** 要直达的页面名（?screen=xxx） */
  screen: string;
  /** 是否直接打开主页快捷面板（?quick=1） */
  quick: boolean;
  /** 快捷面板的初始形态：panel / 亮度调节 / 音量调节 */
  quickAdjust: 'none' | 'bright' | 'vol';
  /** 是否注入「已登录网易云」状态（?user=0 可关闭） */
  seedUser: boolean;
}

export const PREVIEW: PreviewConfig = (() => {
  if (typeof window === 'undefined') {
    return { active: false, screen: 'home', quick: false, quickAdjust: 'none', seedUser: true };
  }
  const q = new URLSearchParams(window.location.search);
  const quickRaw = q.get('quick');
  return {
    active: q.get('demo') === '1',
    screen: q.get('screen') ?? 'home',
    quick: quickRaw === '1' || quickRaw === 'panel' || quickRaw === 'bright' || quickRaw === 'vol',
    quickAdjust: quickRaw === 'bright' ? 'bright' : quickRaw === 'vol' ? 'vol' : 'none',
    seedUser: q.get('user') !== '0',
  };
})();

// ---------------- 网易云示例 ----------------

export const DEMO_USER: NetEaseUser = {
  account: { id: 10001 },
  profile: { userId: 10001, nickname: '示例用户', avatarUrl: '' },
};

export const DEMO_NE_PLAYLISTS: NetEasePlaylistSummary[] = [
  { id: 101, name: '我喜欢的音乐', coverImgUrl: '', trackCount: 42 },
  { id: 102, name: '华语流行精选', coverImgUrl: '', trackCount: 28 },
  { id: 103, name: '深夜驾车', coverImgUrl: '', trackCount: 15 },
  { id: 104, name: '回到 2000 年', coverImgUrl: '', trackCount: 36 },
];

const RAW_NE: Array<[number, string, string, string, number]> = [
  [1001, '晴天', '周杰伦', '叶惠美', 269000],
  [1002, '稻香', '周杰伦', '魔杰座', 223000],
  [1003, '七里香', '周杰伦', '七里香', 299000],
  [1004, '夜空中最亮的星', '逃跑计划', '世界', 251000],
  [1005, '平凡之路', '朴树', '猎户星座', 301000],
  [1006, '起风了', '买辣椒也用券', '起风了', 325000],
];

export const DEMO_NE_TRACKS: NetEaseTrack[] = RAW_NE.map(([id, name, artist, album, dt]) => ({
  id,
  name,
  ar: [{ id: id * 10, name: artist }],
  al: { id: id * 100, name: album, picUrl: '' },
  dt,
}));

export const DEMO_NE_PLAYLIST: NetEasePlaylistSummary = {
  id: 101,
  name: '我喜欢的音乐',
  coverImgUrl: '',
  trackCount: DEMO_NE_TRACKS.length,
};
