import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 九章工作室 SPA 构建配置。
 *
 * 为什么 `base: './'`：SPA 由 Host 以 `/luoshu/app` 前缀挂载（见 host/static.js 的
 * serveSpa），构建时无法预知部署前缀与 DSH 随机端口，只有相对基路径能同时适配。
 *
 * 为什么 outDir 指向插件目录：构建产物直接落进 dsh-jiuzhang-studio/app-dist，
 * Host 静态服务直接从那里读，免去二次拷贝（也就免去"忘了拷贝"的失败模式）。
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../app-dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    // 单包体积主要是 React + 画布库；900KB 阈值略放宽避免误报
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5273,
    strictPort: false,
    // 开发期直连 DSH Host（用户按实际端口改），生产同源不需要代理
    proxy: {
      '/luoshu/api': {
        target: 'http://127.0.0.1:7983',
        changeOrigin: false,
      },
    },
  },
});
