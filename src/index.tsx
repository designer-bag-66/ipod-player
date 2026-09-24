import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { App } from './main';
import { initCapacitor } from './capacitor';
import { useDesign } from './design';
import { applyPreview } from './dev/preview';

initCapacitor();

// 先应用设计源（CSS 变量 + customCss），避免首帧闪一下兜底样式
useDesign.getState().init();

// 预览模式：按 URL 参数注入示例数据并直达页面（界面评审板用；不带 ?demo=1 时直接返回）
applyPreview();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);