/**
 * 后端执行分发 —— REST、Agent 工具、续写批次共用同一实现。
 *
 * 放在路由层之外，避免路由文件 import 整个 services（也让 tools.js 可以直接用）。
 */
import path from 'node:path';
import { loadConfig } from '../config.js';
import { compilePrompt } from './prompt-compile.js';
import { readWorkflowCached } from '../services/workflow-paths.js';
import * as mockBackend from '../services/mock-backend.js';
import { runH3Local, runH3Nanfeng, runH3ImageLocal, jobKind } from '../services/generator.js';

/** 合法后端枚举 —— 单一真源，路由 / 工具 / 执行器共用 */
export const VALID_BACKENDS = new Set(['h3-nanfeng', 'h3-local', 'h3-image', 'mock']);

/** 加载图像生成工作流（模板随插件分发，不跟随 dataDir） */
export function loadImageWorkflow(cfg = loadConfig()) {
  return readWorkflowCached('image', cfg);
}

export async function executeBackend(job, shot, ctx, cfg, hooks) {
  /*
   * 续写上下文挂在 job.params 上，但 compilePrompt 只接收 shot ——
   * 不先挂到 shot 上，续写段的提示词顶部就没有开关句，
   * 模型会按文字重新推导姿态，接缝断裂。
   */
  const shotForCompile = job.params?.continuationTask
    ? {
      ...shot,
      continuationTask: job.params.continuationTask,
      continuationIndex: job.params?.batchIndex ?? null,
    }
    : shot;

  const promptWarnings = [];
  const prompt = job.prompt || compilePrompt(shotForCompile, promptWarnings);
  if (promptWarnings.length) {
    job.warnings = [...(job.warnings ?? []), ...promptWarnings];
  }
  const onSubmitted = hooks?.onSubmitted;

  if (job.backendId === 'h3-nanfeng') {
    return runH3Nanfeng({
      job,
      shot,
      prompt,
      cfg,
      onSubmitted,
      mode: job.params?.nanfengMode || shot.mode,
      preset: job.params?.nanfengPreset ?? shot?.nanfeng?.presets,
      extraParams: job.params?.nanfengExtra,
      continuationTask: job.params?.continuationTask,
    });
  }

  if (job.backendId === 'h3-local') {
    return runH3Local({
      workflow: ctx.h3.loadWorkflow(),
      job, shot, prompt, cfg, onSubmitted,
    });
  }

  if (job.backendId === 'h3-image' || jobKind(job) === 'image') {
    const wf = loadImageWorkflow(cfg);
    if (!wf) throw new Error('WORKFLOW_MISSING: 缺少 data/workflows/h3-image.json');
    return runH3ImageLocal({ workflow: wf, job, shot, prompt, cfg, onSubmitted });
  }

  // 只有显式 mock 才走占位后端：拼错的后端名不能静默降级成"假视频"。
  if (job.backendId === 'mock') {
    return mockBackend.runMock({ cfg, job, shot, prompt });
  }

  throw new Error(
    `UNKNOWN_BACKEND: ${JSON.stringify(job.backendId)} 不是有效后端。`
    + `可选：${[...VALID_BACKENDS].join(' / ')}`,
  );
}

/** 产物目录（dataDir/outputs） */
export function outputsDirOf(cfg) {
  return path.join(cfg.dataDir, 'outputs');
}
