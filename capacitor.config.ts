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
    StatusBar: {
      // 沉浸到 iPod 屏幕内
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
  },
};

export default config;