/**
 * 九章工作室 —— DSH Host 插件入口
 *
 * 职责：
 *  1) 注册 Agent 工具（studio 系列，供模型调用）
 *  2) 注册 /luoshu/api（handler 前缀路由，带自查安全）
 *  3) 注册 /luoshu/app（SPA 静态）
 *  4) 注册 /luoshu/assets（3D 资产静态，带 Range）
 *  5) previz 子进程管理
 *
 * 注意：控制器不挂到 ctx 上（Cordis 禁止未 provide 的属性），
 * 统一放 host/runtime.js 模块级单例，工具与 API 从那里取。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resetConfigCache } from './config.js';
import { handleApi } from './api/index.js';
import { serveSpa, serveStatic } from './static.js';
import { recoverInterruptedJobs, runtimeStats } from './services/job-runner.js';
import { registerTools } from './tools.js';
import { createH3Workshop } from './services/h3-workshop.js';
import { createPrevizController } from './services/previz-controller.js';
import { createPostService } from './services/post.js';
import { createAssetService } from './services/asset-service.js';
import { createScriptService } from './services/script-service.js';
import { createComicService } from './services/comic-service.js';
import { createModelWorkbench } from './services/model-workbench.js';
import { createDirectorController } from './services/director3d.js';
import { createCanvasAgent } from './services/canvas-agent.js';
import { initRuntime, attachControllers, disposeRuntime } from './runtime.js';

export const inject = ['tools', 'webServer'];

const API_PREFIX = '/luoshu/api';
const APP_PREFIX = '/luoshu/app';
const ASSET_PREFIX = '/luoshu/assets';

export function apply(ctx) {
  const root = path.resolve(import.meta.dirname, '..');

  /* --------------------------- 运行时初始化 --------------------------- */

  resetConfigCache();
  const cfg = loadConfig();
  initRuntime({ root, cfg, webServer: ctx.webServer });

  const previz = createPrevizController({ root, cfg });
  const h3 = createH3Workshop({ root, cfg });
  const post = createPostService({ cfg });
  const assets = createAssetService({ cfg });
  const script = createScriptService({ cfg });
  const comic = createComicService({ cfg });
  const mw = createModelWorkbench({ cfg });
  const director = createDirectorController({ cfg, root });
  const canvasAgent = createCanvasAgent({ cfg });
  attachControllers({ previz, h3, post, assets, script, comic, mw, director, canvasAgent });

  /* ---------------------------- HTTP 路由 ---------------------------- */

  ctx.effect(() => {
    const disposeApi = ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: (req, res) => {
        handleApi(req, res).catch((err) => {
          ctx.logger?.warn?.(`[jiuzhang] API 处理失败：${String(err?.message || err)}`);
          try { res.destroy(); } catch { /* ignore */ }
        });
      },
    });
    const disposeApp = ctx.webServer.register({
      kind: 'prefix',
      path: APP_PREFIX,
      handler: (req, res) => {
        serveSpa(req, res, { prefix: APP_PREFIX, distDir: path.join(root, 'app-dist') })
          .catch(() => { try { res.destroy(); } catch { /* ignore */ } });
      },
    });
    const disposeAsset = ctx.webServer.register({
      kind: 'prefix',
      path: ASSET_PREFIX,
      handler: (req, res) => {
        serveStatic(req, res, { prefix: ASSET_PREFIX, baseDir: path.join(root, 'app-dist') })
          .catch(() => { try { res.destroy(); } catch { /* ignore */ } });
      },
    });
    return () => { disposeApi(); disposeApp(); disposeAsset(); };
  });

  /* ------------------------------ 工具 ------------------------------ */

  ctx.effect(() => registerTools(ctx));

  /* --------------------------- 启动编排 --------------------------- */

  ctx.effect(() => {
    (async () => {
      try {
        const c = loadConfig();
        fs.mkdirSync(c.dataDir, { recursive: true });
        const recovered = await recoverInterruptedJobs();
        if (recovered.recovered) {
          ctx.logger?.info?.(`[jiuzhang] 恢复扫描：标记 ${recovered.recovered} 个中断任务`);
        }
        if (c.previzAutoStart) {
          try { await previz.start(); } catch (e) { ctx.logger?.warn?.(`[jiuzhang] 预演引擎启动失败：${e.message}`); }
        }
      } catch (e) {
        ctx.logger?.warn?.(`[jiuzhang] 启动编排失败：${String(e?.message || e)}`);
      }
    })();

    return () => {
      try { previz.stop(); } catch { /* ignore */ }
      try { h3.dispose(); } catch { /* ignore */ }
      disposeRuntime();
    };
  });

  ctx.logger?.info?.(
    `[jiuzhang] 已挂载：${API_PREFIX} · ${APP_PREFIX} · ${ASSET_PREFIX}；`
    + `后端=${cfg.defaultBackend} 并发=${cfg.maxConcurrentLocal} 运行统计=${JSON.stringify(runtimeStats())}`,
  );
}




