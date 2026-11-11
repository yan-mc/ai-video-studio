/**
 * SPA 入口。
 *
 * 顺序很关键：先挂设计令牌/基础样式，再由 ThemeProvider 把 data-* 属性
 * 同步到 <html>，最后渲染。这样首帧就是正确主题，不会有闪色。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import './ui/tokens.css';
import './ui/base.css';
import './ui/components.css';
// React Flow 的画布基础样式（连线/手柄/背景）。放在设计令牌之后，
// 保证画布组件用 var(--jz-*) 覆盖默认配色时优先级正确。
// 画布实现若再次 import 同一文件，Vite 会去重，不会产生重复样式。
import '@xyflow/react/dist/style.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root 容器不存在，index.html 被改坏了');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);