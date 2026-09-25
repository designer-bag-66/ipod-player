import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.youripod.player',
  appName: 'iPodPlayer',
  webDir: 'dist',
  // 跟随文档 10.5 节：bundleId 用反向域，自签名/SideStore 都依赖它
  ios: {
    contentInset: 'automatic',
    // 锁屏音频元数据由 Web 端 MediaSession API 控制；Capacitor 端默认后台播放由 WKWebView 的 audio 标签处理
    backgroundColor: '#000000',
  },
  plugins: {
    // 让 WebView 里的 fetch 走原生 NSURLSession：绕过 WKWebView 的
    // 跨域(CORS)/ATS 限制，手机访问第三方 API（网易云）更稳更可诊断
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      // 不覆盖 WebView：界面从状态栏/灵动岛下方开始，避免被压住
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },
  },
};

export default config;