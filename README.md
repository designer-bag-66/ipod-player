# iPodPlayer

> 仿 iPod Click Wheel 的音乐播放器（曲库走网易云在线），Web + Capacitor + iPhone 自用版。
> 实现细节按 [`iPod-Click-Wheel-iPhone原生版开发文档.docx`](../../) 第 2-7 节、第 10 节「自用部署方案（路线 B）」。

---

## 1. 准备环境（Windows 上完成全部开发）

按文档 10.4 节：

1. [Node.js LTS](https://nodejs.org/) （v18+）
2. [Git for Windows](https://git-scm.com/download/win)
3. [VS Code](https://code.visualstudio.com/) （可选）
4. GitHub 账号（用来跑免费的 macOS runner 打 IPA）
5. Apple ID（免费即可，用来签名 / 侧载）

## 2. 本地开发

```bash
npm install
npm run dev          # http://localhost:5173
```

打开浏览器即可看到 iPod 外壳。**纯 Web 环境也能跑通 M1-M4**。

## 3. 项目结构（文档 3.1）

```
ipod-player/
├── src/
│   ├── components/
│   │   ├── shell/        # IPodShell / Screen / ClickWheel
│   │   ├── views/        # Home / SongList / PlayQueue / NowPlaying / Search / Settings / Netease
│   │   └── ui/           # ListMenu / ProgressBar
│   ├── stores/           # zustand: player / navigation / auth / prefs / design
│   ├── services/         # storage (IndexedDB 键值) / netease (在线曲库)
│   ├── styles/globals.css# Tailwind v4 + iPod 视觉
│   ├── types/            # Track / PlayerState / Screen
│   ├── utils/angle.ts    # 文档 4.3 手势算法
│   ├── main.tsx          # App + 路由 + Click Wheel 事件分发
│   └── capacitor.ts      # Capacitor iOS 引导
├── .github/workflows/ios-build.yml   # 文档 10.6
├── capacitor.config.ts
```

## 4. 里程碑对照（文档 5 节）

| 里程碑 | 文档要求 | 本仓库实现位置 |
|--------|---------|--------------|
| **M1 界面骨架** | SwiftUI 主页、圆盘、菜单、基本动画 | `src/components/shell/*` + `src/components/views/*` |
| ~~**M2 本地曲库**~~ | 已移除，改为网易云在线曲库 | `src/services/netease.ts` + `src/components/views/NeteaseView.tsx` |
| **M3 真正播放** | AVPlayer / HTMLAudioElement、队列、进度、模式 | `src/stores/player.ts` |
| **M4 系统集成** | 后台音频、锁屏信息、耳机控制 | Web 端 `MediaSession API`；iOS 端需要补 Info.plist 的 `UIBackgroundModes: [audio]` |
| **M5 自用安装** | 真机签名 / 侧载 | 文档 10.6 + 10.7（GitHub Actions + SideStore） |

## 5. Click Wheel 手势（文档 4.3）

```
delta     = normalizeAngle(currentAngle - previousAngle)
accumulator += delta
while abs(accumulator) >= stepAngle:    # stepAngle = 20°
    selection += sign(accumulator)
    accumulator -= sign(accumulator) * stepAngle
```

实现见 [`src/utils/angle.ts`](src/utils/angle.ts) + [`src/components/shell/ClickWheel.tsx`](src/components/shell/ClickWheel.tsx)。

## 6. 打包成 iOS（路线 B，文档 10.5–10.7）

### 6.1 本地一次性准备

```bash
npm install
npm run build                   # 构建 web 产物到 dist/
npx cap add ios                 # 生成 ios/ 工程
npx cap sync ios
```

> 注：以上 `cap add ios` 步骤在 Windows 上能生成工程结构，
> 但最终 `xcodebuild` 必须在 macOS 上跑（用 GitHub Actions 免费额度）。

### 6.2 GitHub Actions 云端打包

1. 把仓库推到 GitHub。
2. 默认 workflow（`.github/workflows/ios-build.yml`）会在 push 时自动跑。
3. 完成后在 Actions 页面下载 `ipodplayer-ipa` artifact，得到 `App.ipa`。

### 6.3 用 SideStore 装到自己 iPhone（文档 10.7）

按 [SideStore 官方文档](https://docs.sidestore.io/) 三步走：

1. 用 PlumeImpactor（Windows，一次性）把 SideStore 装到 iPhone。
2. iPhone 上启动 SideStore，登录免费 Apple ID。
3. 把 `App.ipa` 拷到 iPhone，在 SideStore 里导入并签名。

7 天后 SideStore 自动续签，不需要电脑在线（需保持 VPN 或同局域网）。

## 7. iOS 后台播放补丁（文档 10.9）

后台播放需要 `ios/App/App/Info.plist` 里有：

```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

因为 `ios/` 在 `.gitignore` 里、每次 CI 都重新生成工程，所以**这个键由
`.github/workflows/ios-build.yml` 的 `Patch Info.plist (background audio)`
步骤用 PlistBuddy 自动注入**，不需要手动改。

加入后 WKWebView 的 `<audio>` 在锁屏、来电插队后会自动继续。

## 9. 验收清单（文档 6 节，对应到 Web/移动）

- 圆盘顺时针/逆时针连续 20 次：列表高亮逐项变化。
- 中央键 / MENU / 上一首 / 下一首 / 播放暂停：均能触发，无误触。
- 搜索网易云关键词：结果可播放，整份结果即播放队列。
- 拖动进度条：播放器 seek 同步。
- 退出重开：登录态与设置（循环模式 / 音量等）保留。
- iOS 真机：锁屏 → 控件显示当前曲目；来电话 → 自动暂停；挂断 → 自动恢复。

## 10. 已知限制

- 免费 Apple ID 同时只能签 3 个 App（文档 10.9），多余 App 可改用 LiveContainer。
- 模拟器 / 普通浏览器无完整 MediaSession 体验，仍可在 Web 端完成 M1-M3 调试。
- Capacitor 是 Web 容器，长列表虚拟化、动画与原生 SwiftUI 有差距，UI 已在中等密度数据下验证。

---

按文档第 1 节「使用方式与所需条件」和第 10 节「自用部署方案」实现。文档原文中 Path A（SwiftUI 原生 + Mac）见 `iPod-Click-Wheel-播放器开发文档.docx`；本仓库实现 Path B（Web + Capacitor + SideStore，Windows 全程可完成）。