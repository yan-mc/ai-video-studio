/**
 * 九章工作室 —— DSH Host 插件入口
 *
 * 职责：
 *  1) 注册 Agent 工具（studio 系列，供模型调用）
 *  2) 注册 /jiuzhang/api（handler 前缀路由，带自查安全）
 *  3) 注册 /jiuzhang/app（SPA 静态）
 *  4) 注册 /jiuzhang/assets（3D 资产静态，带 Range）
 *  5) Blender 预演渲染（子进程，见 services/blender-service.js）
 *
 * 注意：控制器不挂到 ctx 上（Cordis 禁止未 provide 的属性），
 * 统一放 host/runtime.js 模块级单例，工具与 API 从那里取。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resetConfigCache, wireConfigInvalidation } from './config.js';
import { handleApi } from './api/index.js';
import { serveSpa, serveStatic } from './static.js';
import { recoverInterruptedJobs, runtimeStats, runJob } from './services/job-runner.js';
import { jobs as jobsStore, newJob } from './services/job-store.js';
import { runH3Local, runH3ImageLocal } from './services/generator.js';
import { buildBreakdownPrompt } from './services/breakdown.js';
import { registerTools } from './tools.js';
import { createH3Workshop } from './services/h3-workshop.js';
import { createPostService } from './services/post.js';
import { createEditService } from './services/edit.js';
import { createAssetService } from './services/asset-service.js';
import { createCanvasAgent } from './services/canvas-agent.js';
import { createVaultService } from './services/character-vault.js';
import { createExtrasService } from './services/extras.js';
import { initRuntime, attachControllers, disposeRuntime } from './runtime.js';
import { readWorkflowCached } from './services/workflow-paths.js';
import { registerSkillProvider } from './skills.js';

/**
 * 依赖的 Host 服务。
 *
 * `llm` / `agentDefaultModel` / `attachments` 用于智能分镜：
 *   · llm              → 调模型（文本 + 视觉）
 *   · agentDefaultModel→ 读用户当前默认模型
 *   · attachments      → 把本地图片变成 ImageAttachmentRef 喂给模型
 *
 * 放进 inject 是**安全的** —— Cordis 的语义是"等待服务就绪"，
 * 不是"缺服务就崩"；没有这些服务的 profile 里插件会保持 inactive。
 *
 * ⚠️ 光声明 inject 不够：工具/API 读的是 getRuntime() 这个模块级单例，
 *    不是 Cordis ctx。所以 index.js 还必须把服务传进 initRuntime()。
 */
export const inject = ['tools', 'webServer', 'llm', 'agentDefaultModel', 'attachments'];

/**
 * `skills` 是**可选**依赖 —— 用 ctx.get() 取而不是写进 inject。
 *
 * 理由：没有 skills 服务的 profile 里插件也该正常工作（只是 agent 看不到
 * 本插件自带的提示词规范）。写进 inject 会把整个插件变成硬依赖，
 * 缺技能服务的环境下插件直接 failed，页面和工具全没了。
 */
const API_PREFIX = '/jiuzhang/api';
const APP_PREFIX = '/jiuzhang/app';
const ASSET_PREFIX = '/jiuzhang/assets';

export function apply(ctx) {
  const root = path.resolve(import.meta.dirname, '..');

  /**
   * 把 llm / agentDefaultModel 服务暴露给子模块。
   *
   * Cordis 的 `ctx.llm` 只有把 llm 写进 inject 才存在；写进去就等于硬依赖，
   * 缺模型服务的环境会让整个插件 failed。智能分镜只是可选功能，
   * 所以用 `ctx.get(name)` 可选取用，再挂到自有属性上供
   * services/nanfeng/dsh-llm.js 读取。
   *
   * 取不到时不影响插件加载 —— llmStatus() 会把原因报给前端。
   */
  try {
    const llm = ctx.get?.('llm');
    if (llm) ctx.jiuzhangLlm = llm;
  } catch { /* 取不到就靠 llmStatus 报告 */ }
  try {
    const dm = ctx.get?.('agentDefaultModel');
    if (dm) ctx.jiuzhangDefaultModel = dm;
  } catch { /* 同上 */ }

  // 配置变更 → 重建各模块缓存（ComfyUI 探活、工作流目录、存储句柄等）
  wireConfigInvalidation().catch(() => { /* 个别模块加载失败不影响主流程 */ });

  /**
   * 把插件自带的 skills/ 注册进 DSH 的 skill 目录。
   *
   * ⚠️ 为什么不能只靠文件系统自动发现：
   *    dsh-skill-filesystem 只扫 skill 根的**一层**，而本插件的提示词规范放在
   *    `skills/prompt/<name>/SKILL.md`（两层），自动发现永远看不到它们。
   *    另外它要求 name 是 kebab-case，`name: H3官方提示词` 会被静默丢弃。
   *    所以这里注册自有 provider，深度与命名都在本文件里校验并 warn。
   *
   * 注册失败不能影响插件加载 —— 用 try/catch 兜住并只记日志。
   */
  ctx.effect(() => {
    try {
      return registerSkillProvider(ctx, root);
    } catch (e) {
      ctx.logger?.warn?.(`[jiuzhang] skill provider 注册失败：${String(e?.message || e)}`);
      return () => {};
    }
  });

  /** 加载 H3-Image 工作流（画布 Agent 的 generate_image 用） */
  let _imgWf = null;
  function loadImageWorkflowForGen() {
    if (_imgWf) return _imgWf;
    try {
      // 工作流模板随插件分发，**不跟随 dataDir**（见 services/workflow-paths.js）
      const wf = readWorkflowCached('image', loadConfig());
      if (!wf) return null;
      _imgWf = wf;
      return _imgWf;
    } catch { return null; }
  }

  /* --------------------------- 运行时初始化 --------------------------- */

  resetConfigCache();
  const cfg = loadConfig();
  /**
   * 把 Host 服务一并放进 runtime。
   *
   * ⚠️ 工具和 API 拿到的是 `getRuntime()` 这个对象（见 tools.js 的 `const z = getRuntime()`），
   *    不是 Cordis ctx。所以 llm 必须挂在 runtime 上，否则 `z.llm` 恒为 undefined。
   */
  initRuntime({
    root,
    cfg,
    webServer: ctx.webServer,
    llm: ctx.llm,
    agentDefaultModel: ctx.agentDefaultModel,
    attachments: ctx.attachments,
  });

  /**
   * ⚠️ 服务工厂必须拿**读取函数**而不是配置快照。
   *
   * 历史缺陷（配置分裂脑）：saveConfig 是**替换**缓存对象（config.js 的
   * `cache = next`），而这里在启动时 `const cfg = loadConfig()` 拿到的是
   * 旧对象并捕获进每个服务闭包。于是 POST /config 改 dataDir 之后：
   *   · 读 loadConfig() 的模块（projects/jobs/assets-index）已经切到新目录；
   *   · 素材/后处理/剧本/漫画/模特/角色卡仍写旧目录。
   * 用户看到"项目还在、内容空了"。
   *
   * 现在统一传 `getCfg: loadConfig`，服务内部每次现取；
   * 同时保留 `cfg` 字段兼容尚未改造的服务（它们只读不写路径，风险较低）。
   */
  const getCfg = () => loadConfig();

  const h3 = createH3Workshop({ root, cfg, getCfg });
  const post = createPostService({ cfg, getCfg });
  const edit = createEditService({ cfg, getCfg });
  const assets = createAssetService({ cfg, getCfg });
  const vault = createVaultService({ cfg, getCfg });
  const canvasAgent = createCanvasAgent({
    cfg,
    getCfg,
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
      runJob(job, async (running, hooks) => (kind === 'video'
        ? runH3Local({ workflow, job: running, shot: options.shot ?? {}, prompt: String(prompt ?? ''), cfg, onSubmitted: hooks?.onSubmitted })
        : runH3ImageLocal({
          workflow,
          job: running,
          prompt: String(prompt ?? ''),
          shot: { refs: { images: options.refImages ?? [] }, imageSizeId: options.sizeId ?? 'sq-2048' },
          cfg,
          onSubmitted: hooks?.onSubmitted,
        }))).catch(() => {});
      return { jobId: job.id, status: job.status, backendId: job.backendId };
    },
    // 画布 AI 助手调用技能 → 分发到真实服务（旧实现只回一句"已转交"的空壳）
    //
    // ⚠️ 阶段 3 已删除 script / comic / mw 三个模块。这里的 case 必须同步删除 ——
    //    残留的 `script.runStage()` 会在插件加载时抛 "script is not defined"，
    //    导致整个插件 fiber failed（工具、页面全部不可用）。
    runSkill: async ({ skill, args }) => {
      switch (skill) {
        case 'prompt':
        case 'h3-prompt': {
          /**
           * ⚠️ 立绘拆解现在只有**一个可编辑的提示词**，没有档位。
           *
           * 历史实现这里会 `breakdownLevel(args.level ?? 'standard')` 再按档位
           * 拼装正文；档位已移除（见 services/breakdown.js 文件头）。
           * 画布 AI 调用本技能时想改内容直接传 `args.prompt` 整段即可；
           * 不传就是默认三视图设定卡。
           *
           * ⚠️ 这里曾经漏改，导致 `breakdownLevel is not a function`
           *    在 apply() 期间抛出 → 整个插件 fiber failed（所有页面与工具
           *    同时 404）。删掉一个导出时，**必须**全仓库 grep 它的调用点。
           */
          const prompt = buildBreakdownPrompt(args);
          return { prompt, chars: prompt.length };
        }
        default:
          throw new Error(`SKILL_NOT_FOUND: 未知技能 ${JSON.stringify(skill)}`);
      }
    },
  });
  const extras = createExtrasService({ cfg });
  attachControllers({ h3, post, edit, assets, canvasAgent, extras, vault });

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
    // 3D 资产静态服务。
    //
    // ⚠️ 原来 baseDir 指向 `app-dist`（SPA 构建产物），语义与 README 宣称的
    //    "3D 资产静态" 不符，而且前端从未引用过这个前缀。
    //    现在改成服务 `<dataDir>/assets`（glb/gltf/fbx/obj 都落在这里），
    //    这样画布/预演页面要直接内联加载 3D 模型时有个稳定的同源地址。
    const disposeAsset = ctx.webServer.register({
      kind: 'prefix',
      path: ASSET_PREFIX,
      handler: (req, res) => {
        serveStatic(req, res, { prefix: ASSET_PREFIX, baseDir: path.join(loadConfig().dataDir, 'assets') })
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
      } catch (e) {
        ctx.logger?.warn?.(`[jiuzhang] 启动编排失败：${String(e?.message || e)}`);
      }
    })();

    return () => {
      try { h3.dispose(); } catch { /* ignore */ }
      disposeRuntime();
    };
  });

  ctx.logger?.info?.(
    `[jiuzhang] 已挂载：${API_PREFIX} · ${APP_PREFIX} · ${ASSET_PREFIX}；`
    + `后端=${cfg.defaultBackend} 并发=${cfg.maxConcurrentLocal} 运行统计=${JSON.stringify(runtimeStats())}`,
  );
}






