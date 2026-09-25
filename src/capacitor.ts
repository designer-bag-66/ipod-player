// ============================================================
// Capacitor 引导
// - 仅在原生 iOS（Capacitor.isNativePlatform）下启用 iOS 特性
// - 后台播放 & 锁屏控制：WKWebView 的 <audio> + MediaSession API 已经支持
// - 沉浸式状态栏由 @capacitor/status-bar 控制
// ============================================================

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  // iOS 后台播放配置（仅在 Capacitor iOS 上做软提示）
  // 真正的后台播放需要在 ios/App/App/Info.plist 中添加
  //   UIBackgroundModes: ["audio"]
  // 这里只是配置可见外观
  // 适配状态栏 / 灵动岛：不覆盖 WebView，内容从状态栏下方开始
  // （overlay:true 会让 WebView 顶到屏幕最上方，状态栏压在界面上）
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
}

// 给 WKWebView 后台音频一个 hint
// Safari iOS 要求音频元素在用户手势之后开始播放，
// 并在播放过程中不会被节流；这里只是用于文档化
export function audioUnlockHint() {
  // 创建一次性静音音频并立即播放，确保后续 audio.play() 不被拒
  const audio = new Audio();
  audio.src =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
  audio.play().catch(() => {});
}