import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 九章工作室 SPA 构建配置。
 *
 * 为什么 `base: './'`：SPA 由 Host 以 `/jiuzhang/app` 前缀挂载（见 host/static.js 的
 * serveSpa），构建时无法预知部署前缀与 DSH 随机端口，只有相对基路径能同时适配。
 *
 * 为什么 outDir 指向插件目录：构建产物直接落进 dsh-jiuzhang-studio/app-dist，
 * Host 静态服务直接从那里读，免去二次拷贝（也就免去"忘了拷贝"的失败模式）。
 *
 * ⚠️ 必须显式写 `root`。
 *    Vite 的 root 默认是 process.cwd()，而本仓库的构建入口有两处：
 *      · 插件根目录的 `pnpm run build`  → `vite build --config app-src/vite.config.ts`
 *      · app-src 里的 `npm run build`
 *    只写相对路径的话，从插件根目录跑时 root=插件根，index.html 在
 *    app-src/index.html，Vite 会报 `Could not resolve entry module "index.html"`。
 *    写死 root 到本配置文件所在目录，两种入口都能跑通。
 */
const DEV_HOST_PORT = process.env.DSH_PORT || process.env.DSH_HOST_PORT || '7983';

/** 配置文件自身所在目录 = app-src（Node 20.11+ / 24 均支持 import.meta.dirname） */
const APP_ROOT = import.meta.dirname;

/**
 * 读插件根目录 package.json 的 version，构建时注入 `__APP_VERSION__`。
 *
 * ⚠️ 为什么要在构建期注入：
 *    设置页「关于」以前把版本号**硬编码**成 '0.1.0'，而 package.json 早已是
 *    2.x —— 界面显示的版本落后两个大版本，用户报 bug 时给的是错版本号。
 *    版本号只有一个真源（package.json），这里读它、不让人手抄。
 */
function pluginVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, '..', 'package.json'), 'utf8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

export default defineConfig({
  root: APP_ROOT,
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pluginVersion()),
  },
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
    // 开发期直连 DSH Host。DSH 默认 `--port 0`（随机端口），
    // 所以这里从环境变量取，取不到才用 7983 这个常见默认值。
    //   PowerShell: $env:DSH_PORT = '7983'; npm run dev
    proxy: {
      '/jiuzhang/api': {
        target: `http://127.0.0.1:${DEV_HOST_PORT}`,
        changeOrigin: false,
      },
    },
  },
});
