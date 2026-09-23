// ============================================================
// 网易云登录态 Store
// - localStorage 持久化 cookie
// - 提供 QR 扫码登录流程
// ============================================================

import { create } from 'zustand';
import {
  hasCookie,
  fetchAccount,
  loginQrKey,
  loginQrCreate,
  loginQrCheck,
  clearCookie,
  checkApiAvailable,
  getLastApiError,
  type NetEaseUser,
} from '@/services/netease';

export type QrStatus =
  | 'idle'
  | 'ready'
  | 'scanned'
  | 'success'
  | 'expired'
  | 'error';

interface AuthState {
  apiOnline: boolean;
  user: NetEaseUser | null;
  qrImg: string;
  qrStatus: QrStatus;
  errorMessage: string;
  lastCheck: number;

  /** 调试信息：扫码成功但 fetchAccount 失败时记录原因 */
  accountError: string;

  bootstrap(): Promise<void>;
  startLogin(): Promise<void>;
  pollLogin(): Promise<void>;
  resetLogin(): void;
  /** 重新拉取账户（用于登录页或播放页补救） */
  refreshAccount(): Promise<void>;
  logout(): void;
}

let pollTimer: number | null = null;
let retryTimer: number | null = null;
let qrKey = '';

export const useAuth = create<AuthState>((set, get) => ({
  apiOnline: false,
  user: null,
  qrImg: '',
  qrStatus: 'idle',
  errorMessage: '',
  lastCheck: 0,
  accountError: '',

  async bootstrap() {
    const online = await checkApiAvailable();
    if (!online) {
      const reason = getLastApiError();
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
      try {
        const user = await fetchAccount();
        if (user) {
          set({ user });
          return;
        }
      } catch (err) {
        console.warn('[auth] bootstrap fetchAccount failed', err);
      }
      clearCookie();
    }
  },

  async startLogin() {
    set({ qrStatus: 'idle', qrImg: '', errorMessage: '', accountError: '' });
    try {
      qrKey = await loginQrKey();
      const { qrimg } = await loginQrCreate(qrKey);
      set({ qrImg: qrimg, qrStatus: 'ready', lastCheck: Date.now() });

      if (pollTimer) window.clearInterval(pollTimer);
      poll();
      pollTimer = window.setInterval(poll, 2000);
    } catch (err) {
      console.error('[auth] startLogin failed', err);
      set({ qrStatus: 'error', errorMessage: String(err) });
    }
  },

  async pollLogin() {
    if (!qrKey) return;
    try {
      const r = await loginQrCheck(qrKey);
      set({ lastCheck: Date.now() });
      if (r.code === 800) {
        // 等待扫码
      } else if (r.code === 801) {
        set({ qrStatus: 'scanned' });
      } else if (r.code === 802) {
        // 成功 —— 停掉轮询
        if (pollTimer) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        // 如果响应里直接给了 profile，直接用
        if (r.profile) {
          const user: NetEaseUser = {
            account: { id: r.profile.userId },
            profile: r.profile,
          };
          set({ user, qrStatus: 'success', accountError: '' });
          console.log('[auth] login via QR profile', user);
        } else {
          // 否则用 cookie 拉一次 account
          let user: NetEaseUser | null = null;
          let errMsg = '';
          try {
            user = await fetchAccount();
          } catch (err: any) {
            errMsg = String(err);
            console.error('[auth] fetchAccount error', err);
          }
          if (user) {
            set({ user, qrStatus: 'success', accountError: '' });
            console.log('[auth] login via cookie', user);
          } else {
            // cookie 已存但 fetch 失败 —— 保留 cookie，让 UI 显式提示可重试
            set({
              qrStatus: 'success',
              accountError: '扫码成功但获取用户信息失败，请按 SELECT 重试',
            });
            console.warn('[auth] 802 but no user', r);
          }
        }
      } else if (r.code === 803) {
        set({ qrStatus: 'expired' });
        if (pollTimer) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    } catch (err) {
      console.error('[auth] poll failed', err);
      set({ qrStatus: 'error', errorMessage: String(err) });
    }
  },

  async refreshAccount() {
    if (!hasCookie()) {
      set({ accountError: 'cookie 已失效，请重新扫码' });
      return;
    }
    try {
      const user = await fetchAccount();
      if (user) {
        set({ user, qrStatus: 'success', accountError: '' });
      } else {
        set({ accountError: '仍然无法获取用户信息，请检查网络或重新扫码' });
      }
    } catch (err) {
      set({ accountError: String(err) });
    }
  },

  resetLogin() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    qrKey = '';
    set({ qrImg: '', qrStatus: 'idle', errorMessage: '', accountError: '' });
  },

  logout() {
    clearCookie();
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    qrKey = '';
    set({ user: null, qrImg: '', qrStatus: 'idle', accountError: '' });
  },
}));

async function poll() {
  await useAuth.getState().pollLogin();
}