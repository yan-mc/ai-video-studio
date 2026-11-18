/**
 * 独立预览服务器 —— 在**不启动 DSH** 的前提下把插件跑起来。
 *
 * 为什么需要：
 *   · Host 侧改动（host/**）在 DSH 里要重启进程才生效，而重启会杀掉
 *     使用者正在进行的对话；
 *   · 前端改动虽然刷新页面即可，但需要一个能真实渲染的环境来截图验证。
 *
 * 本脚本用最小假 ctx 挂上**完全相同的**插件模块，自己起一个 HTTP 服务：
 *   GET /jiuzhang/api/*   → handleApi()
 *   GET /jiuzhang/app/*   → serveSpa()
 * 然后就可以用浏览器打开 http://127.0.0.1:<port>/jiuzhang/app/#/render 检查。
 *
 * 用法：
 *   node tools/preview-server.mjs [--port 17000] [--data <dir>]
 *
 * ⚠️ 这是**验证工具**，不是生产入口。默认用临时数据目录，不碰真实 data/。
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* ------------------------------------------------------------ 参数解析 */

const argv = process.argv.slice(2);
function argOf(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

const PORT = Number(argOf('--port', '17000'));
const USE_TMP_DATA = !argv.includes('--data');

// 必须在 import 插件模块之前设定
const TMP = USE_TMP_DATA ? fs.mkdtempSync(path.join(os.tmpdir(), 'jz-preview-')) : '';
if (USE_TMP_DATA) {
  process.env.DSH_JZ_DATA_DIR = path.join(TMP, 'data');
  process.env.DSH_JZ_CONFIG_FILE = path.join(TMP, 'config.json');
} else {
  process.env.DSH_JZ_DATA_DIR = path.resolve(argOf('--data'));
  process.env.DSH_JZ_CONFIG_FILE = path.join(process.env.DSH_JZ_DATA_DIR, 'preview-config.json');
}

/* --------------------------------------------------------------- 假 ctx */

const prefixRoutes = [];

function makeCtx() {
  const ctx = {
    logger: {
      info: (m) => console.log('[info]', m),
      warn: (m) => console.warn('[warn]', m),
      error: (m) => console.error('[error]', m),
      debug: () => {},
    },
    webServer: {
      register(opts) {
        prefixRoutes.push(opts);
        return () => {
          const i = prefixRoutes.indexOf(opts);
          if (i >= 0) prefixRoutes.splice(i, 1);
        };
      },
    },
    effect(fn) {
      const d = fn();
      return d;
    },
    tool: () => () => {},
    tools: { define: () => () => {}, register: () => () => {} },
    on: () => () => {},
    get: () => undefined,
    emit() {},
  };
  return ctx;
}

/* ---------------------------------------------------------- 启动插件 */

const mod = await import('../host/index.js');
await mod.apply(makeCtx());

// 等 registerTools / 启动编排让出一个 tick
await new Promise((r) => setTimeout(r, 120));

/* ---------------------------------------------------------- HTTP 服务 */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  // 本机预览服务器：补上插件自己期望的 Host 头形态
  req.headers.host = req.headers.host || `127.0.0.1:${PORT}`;

  const hit = prefixRoutes.find((r) => url.pathname.startsWith(r.path));
  if (!hit) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'NOT_FOUND', path: url.pathname }));
    return;
  }
  Promise.resolve(hit.handler(req, res)).catch((e) => {
    console.error('[handler error]', e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'HANDLER_FAILED', detail: String(e?.message || e) }));
    } else {
      try { res.destroy(); } catch { /* ignore */ }
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('='.repeat(64));
  console.log('  九章工作室 · 独立预览服务器');
  console.log('='.repeat(64));
  console.log(`  SPA   : http://127.0.0.1:${PORT}/jiuzhang/app/#/render`);
  console.log(`  API   : http://127.0.0.1:${PORT}/jiuzhang/api/meta`);
  console.log(`  数据   : ${USE_TMP_DATA ? `临时目录 ${process.env.DSH_JZ_DATA_DIR}` : process.env.DSH_JZ_DATA_DIR}`);
  console.log('');
  console.log('  路由：');
  for (const r of prefixRoutes) console.log(`    ${r.path}`);
  console.log('');
  console.log('  Ctrl+C 停止');
  console.log('='.repeat(64));
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n停止中…');
  server.close(() => {
    if (USE_TMP_DATA) {
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    process.exit(0);
  });
});
