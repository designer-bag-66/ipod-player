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
  loadCachedUser,
  saveCachedUser,
  clearCachedUser,
  restoreSession,
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
  /** 调试信息：登录流程实时状态（显示在登录页，便于排查） */
  loginDebug: string;

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
/** 轮询连续失败计数：偶发超时不打断登录流程 */
let pollFailCount = 0;

export const useAuth = create<AuthState>((set, get) => ({
  apiOnline: false,
  user: null,
  qrImg: '',
  qrStatus: 'idle',
  errorMessage: '',
  lastCheck: 0,
  accountError: '',
  loginDebug: '',

  async bootstrap() {
    // 先从原生存储恢复登录态（localStorage 在 iOS 切后台后可能被回收）
    try {
      const restored = await restoreSession();
      if (restored.user && !get().user) {
        set({ user: restored.user });
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
        return;
      }

      // 拉取失败不再清除 cookie（否则用户会被踢出），用缓存维持登录态
      const cached = loadCachedUser();
      if (cached) set({ user: cached });
    }
  },

  async startLogin() {
    pollFailCount = 0;
    set({ qrStatus: 'idle', qrImg: '', errorMessage: '', accountError: '', loginDebug: '生成二维码…' });
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
      pollFailCount = 0;
      set({
        lastCheck: Date.now(),
        loginDebug: `轮询 code=${r.code} ${r.message ?? ''} cookieLen=${r.cookie?.length ?? 0}`,
      });
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
          set({ user, qrStatus: 'success', accountError: '', loginDebug: '登录成功（QR profile）' });
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
            saveCachedUser(user);
            set({ user, qrStatus: 'success', accountError: '', loginDebug: '登录成功（cookie）' });
            console.log('[auth] login via cookie', user);
          } else {
            // cookie 已存但 fetch 失败 —— 保留 cookie，让 UI 显式提示可重试
            set({
              qrStatus: 'success',
              accountError: '扫码成功但获取用户信息失败，请按 SELECT 重试',
              loginDebug: `802 已确认 cookieLen=${r.cookie?.length ?? 0} err=${errMsg || '无 profile'}`,
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
      // 偶发超时/网络抖动不打断轮询，连续失败 3 次才提示错误
      pollFailCount += 1;
      console.warn(`[auth] poll failed x${pollFailCount}`, err);
      set({ loginDebug: `轮询失败 x${pollFailCount}: ${String((err as any)?.message ?? err)}` });
      if (pollFailCount >= 3) {
        set({ qrStatus: 'error', errorMessage: String(err) });
      }
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
    pollFailCount = 0;
    set({ qrImg: '', qrStatus: 'idle', errorMessage: '', accountError: '', loginDebug: '' });
  },

  logout() {
    clearCookie();
    clearCachedUser();
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    qrKey = '';
    set({ user: null, qrImg: '', qrStatus: 'idle', accountError: '' });
  },
}));

let pollRunning = false;

async function poll() {
  if (pollRunning) return; // 避免上一轮未返回时叠加请求
  pollRunning = true;
  try {
    await useAuth.getState().pollLogin();
  } finally {
    pollRunning = false;
  }
}