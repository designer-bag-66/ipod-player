// ============================================================
// 网易云登录态 Store
// - localStorage 持久化 cookie
// - 提供「手机号 + 短信验证码」登录流程（替代原扫码登录）
// ============================================================

import { create } from 'zustand';
import {
  hasCookie,
  fetchAccount,
  sendCellphoneCode,
  loginCellphone,
  clearCookie,
  checkApiAvailable,
  getLastApiError,
  loadCachedUser,
  saveCachedUser,
  clearCachedUser,
  restoreSession,
  fetchUserPlaylists,
  type NetEaseUser,
} from '@/services/netease';

/** 登录就绪后后台预取歌单，用户点进「我的歌单」时直接出内容 */
function prefetchPlaylists(user: NetEaseUser | null): void {
  const uid = user?.account?.id;
  if (!uid) return;
  void fetchUserPlaylists(uid).catch(() => {});
}

type CodeStatus = 'idle' | 'sending' | 'sent' | 'verifying' | 'error';

interface AuthState {
  apiOnline: boolean;
  user: NetEaseUser | null;
  errorMessage: string;

  /** 手机号登录表单态 */
  phone: string;
  code: string;
  codeStatus: CodeStatus;
  codeError: string;
  sentAt: number;
  loginDebug: string;

  bootstrap(): Promise<void>;
  setPhone(p: string): void;
  setCode(c: string): void;
  sendCode(): Promise<void>;
  verifyCode(): Promise<void>;
  /** 轮盘 SELECT 触发的主操作：未发码→发码；已发码→验证 */
  primaryAction(): Promise<void>;
  /** 重新拉取账户（用于歌单页补救） */
  refreshAccount(): Promise<void>;
  logout(): void;
}

let retryTimer: number | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  apiOnline: false,
  user: null,
  errorMessage: '',
  phone: '',
  code: '',
  codeStatus: 'idle',
  codeError: '',
  sentAt: 0,
  loginDebug: '',

  async bootstrap() {
    // 先从原生存储恢复登录态（localStorage 在 iOS 切后台后可能被回收）
    try {
      const restored = await restoreSession();
      if (restored.user && !get().user) {
        set({ user: restored.user });
        prefetchPlaylists(restored.user);
      }
    } catch (err) {
      console.warn('[auth] restoreSession failed', err);
    }

    const online = await checkApiAvailable();
    if (!online) {
      const reason = getLastApiError();
      // 离线时用缓存维持登录态，避免刚登录又被判定未登录
      const cached = loadCachedUser();
      if (cached && hasCookie()) set({ user: cached });
      set({ apiOnline: false, errorMessage: `网易云 API 不可达（${reason || '未知原因'}）` });
      // 5 秒后自动重试，直到服务可达
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void get().bootstrap();
      }, 5000);
      return;
    }
    if (retryTimer) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    set({ apiOnline: true, errorMessage: '' });

    if (hasCookie()) {
      // 冷启动/网络抖动可能让首次请求拿不到资料，重试最多 3 次
      let user: NetEaseUser | null = null;
      for (let i = 0; i < 3 && !user; i++) {
        try {
          user = await fetchAccount();
        } catch (err) {
          console.warn('[auth] bootstrap fetchAccount failed', err);
        }
        if (!user) {
          await new Promise((r) => window.setTimeout(r, 1500));
        }
      }

      if (user) {
        saveCachedUser(user);
        set({ user });
        prefetchPlaylists(user);
        return;
      }

      // 拉取失败不再清除 cookie（否则用户会被踢出），用缓存维持登录态
      const cached = loadCachedUser();
      if (cached) {
        set({ user: cached });
        prefetchPlaylists(cached);
      }
    }
  },

  setPhone(p: string) {
    set({ phone: p.replace(/\D/g, '').slice(0, 11) });
  },

  setCode(c: string) {
    set({ code: c.replace(/\D/g, '').slice(0, 6) });
  },

  async sendCode() {
    const phone = get().phone;
    if (!/^1\d{10}$/.test(phone)) {
      set({ codeStatus: 'error', codeError: '请输入 11 位手机号' });
      return;
    }
    set({ codeStatus: 'sending', codeError: '', loginDebug: '发送验证码…' });
    try {
      const r = await sendCellphoneCode(phone);
      if (r.code === 200) {
        set({ codeStatus: 'sent', sentAt: Date.now(), loginDebug: '验证码已发送' });
      } else {
        set({ codeStatus: 'error', codeError: r.message || `发送失败（code=${r.code}）` });
      }
    } catch (err) {
      set({ codeStatus: 'error', codeError: String(err) });
    }
  },

  async verifyCode() {
    const { phone, code } = get();
    if (!/^\d{4,6}$/.test(code)) {
      set({ codeStatus: 'error', codeError: '请输入短信验证码' });
      return;
    }
    set({ codeStatus: 'verifying', codeError: '', loginDebug: '登录中…' });
    try {
      const r = await loginCellphone(phone, code);
      if (r.code === 200) {
        let user: NetEaseUser | null = null;
        if (r.profile && r.account) {
          user = { account: { id: r.account.id }, profile: r.profile };
        } else if (hasCookie()) {
          user = await fetchAccount();
        }
        if (user) {
          saveCachedUser(user);
          set({ user, codeStatus: 'sent', loginDebug: '登录成功' });
          prefetchPlaylists(user);
          console.log('[auth] login via cellphone', user);
        } else {
          set({ codeStatus: 'error', codeError: '登录成功，但获取用户信息失败，请重试' });
        }
      } else {
        set({ codeStatus: 'error', codeError: r.message || `登录失败（code=${r.code}）` });
      }
    } catch (err) {
      set({ codeStatus: 'error', codeError: String(err) });
    }
  },

  async primaryAction() {
    const st = get().codeStatus;
    if (st === 'sent' || st === 'verifying') await get().verifyCode();
    else await get().sendCode();
  },

  async refreshAccount() {
    if (!hasCookie()) {
      set({ codeError: '登录已失效，请重新登录' });
      return;
    }
    try {
      const user = await fetchAccount();
      if (user) {
        set({ user, codeError: '' });
      } else {
        set({ codeError: '仍然无法获取用户信息，请重新登录' });
      }
    } catch (err) {
      set({ codeError: String(err) });
    }
  },

  logout() {
    clearCookie();
    clearCachedUser();
    set({ user: null, phone: '', code: '', codeStatus: 'idle', codeError: '', loginDebug: '' });
  },
}));
