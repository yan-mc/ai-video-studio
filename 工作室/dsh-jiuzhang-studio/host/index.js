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
import { recoverInterruptedJobs, runtimeStats, runJob } from './services/job-runner.js';
import { jobs as jobsStore, newJob } from './services/job-store.js';
import { runH3Local, runH3ImageLocal } from './services/generator.js';
import { buildBreakdownPrompt, breakdownLevel } from './services/breakdown.js';
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
import { createVaultService } from './services/character-vault.js';
import { createExtrasService } from './services/extras.js';
import { initRuntime, attachControllers, disposeRuntime } from './runtime.js';

export const inject = ['tools', 'webServer'];

const API_PREFIX = '/luoshu/api';
const APP_PREFIX = '/luoshu/app';
const ASSET_PREFIX = '/luoshu/assets';

export function apply(ctx) {
  const root = path.resolve(import.meta.dirname, '..');

  /** 加载 H3-Image 工作流（画布 Agent 的 generate_image 用） */
  let _imgWf = null;
  function loadImageWorkflowForGen() {
    if (_imgWf) return _imgWf;
    try {
      const f = path.join(root, 'data', 'workflows', 'h3-image.json');
      if (!fs.existsSync(f)) return null;
      _imgWf = JSON.parse(fs.readFileSync(f, 'utf8'));
      return _imgWf;
    } catch { return null; }
  }

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
  const vault = createVaultService({ cfg });
  const canvasAgent = createCanvasAgent({
    cfg,
    // ⚠️ 必须注入 runGenerate：旧实现没传 → generate_image / generate_video
    //    恒抛 GENERATE_UNAVAILABLE，画布 AI 助手的"花钱"工具全废。
    runGenerate: async ({ kind, prompt, options = {} }) => {
      const workflow = kind === 'video' ? h3.loadWorkflow() : loadImageWorkflowForGen();
      if (!workflow) throw new Error('WORKFLOW_MISSING');
      const job = newJob({
        projectId: options.projectId ?? null,
        shotId: null,
        backendId: kind === 'video' ? 'h3-local' : 'h3-image',
        prompt: String(prompt ?? ''),
        params: {
          kind,
          imageSizeId: options.sizeId ?? 'sq-2048',
          seed: Number.isFinite(Number(options.seed)) ? Number(options.seed) : undefined,
        },
        mode: kind === 'video' ? 'ref2va' : 't2i',
      });
      if (kind === 'image') job.kind = 'image';
      await jobsStore().upsert(job);
      runJob(job, async (running) => (kind === 'video'
        ? runH3Local({ workflow, job: running, shot: options.shot ?? {}, prompt: String(prompt ?? ''), cfg })
        : runH3ImageLocal({
          workflow,
          job: running,
          prompt: String(prompt ?? ''),
          shot: { refs: { images: options.refImages ?? [] }, imageSizeId: options.sizeId ?? 'sq-2048' },
          cfg,
        }))).catch(() => {});
      return { jobId: job.id, status: job.status, backendId: job.backendId };
    },
    // 画布 AI 助手调用技能 → 分发到真实服务（旧实现只回一句"已转交"的空壳）
    runSkill: async ({ skill, args }) => {
      switch (skill) {
        case 'script':
        case 'script-stage': {
          const projectId = String(args.projectId ?? '');
          if (!projectId) throw new Error('PROJECT_REQUIRED');
          const stage = String(args.stage ?? 'outline');
          return await script.runStage(projectId, stage, args);
        }
        case 'script-all': {
          const projectId = String(args.projectId ?? '');
          if (!projectId) throw new Error('PROJECT_REQUIRED');
          return await script.runAll(projectId, args);
        }
        case 'comic':
        case 'comic-plan': {
          const projectId = String(args.projectId ?? '');
          if (!projectId) throw new Error('PROJECT_REQUIRED');
          return await comic.planPrompts(projectId, args);
        }
        case 'mw':
        case 'model-workbench': return mw.createJob(args);
        case 'prompt':
        case 'h3-prompt': {
          const lv = breakdownLevel(args.level ?? 'standard');
          const prompt = buildBreakdownPrompt(args, lv.id);
          return { prompt, level: lv.id, chars: prompt.length };
        }
        default:
          throw new Error(`SKILL_NOT_FOUND: 未知技能 ${JSON.stringify(skill)}`);
      }
    },
  });
  const extras = createExtrasService({ cfg });
  attachControllers({ previz, h3, post, assets, script, comic, mw, director, canvasAgent, extras, vault });

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






