/**
 * 换人域：/replace/*。
 *
 * 这条线完全不读 projects/ 与 shots/ —— 角色卡会顶掉手工参考图编号，
 * 换人只有三个概念：源视频、参考图、提示词。
 */
import * as R from '../../services/replace.js';
import { promptNormalizer, nanfengPresets, prompt } from '../../bridge/index.js';
import { llmStatus } from '../../services/prompt-llm.js';
import { runReplaceBatch } from '../../services/replace-runner.js';
import { createReplaceTask } from '../replace-tasks.js';
import { readJsonBody } from '../http.js';
import { emit } from '../events.js';
import { accelPlanList } from './meta.js';

const TASKS_PREFIX = '/replace/tasks/';
const RUN_PREFIX = '/replace/run/';

/**
 * 换人页需要的全部选项（预设 / 画风 / 打光 / 加速方案 / 重叠帧）。
 * 全部从服务端的单一真源取，前端不硬编码任何一份。
 */
function replaceMeta() {
  return {
    ok: true,
    defaults: R.REPLACE_DEFAULTS,
    promptFields: R.PROMPT_FIELDS,
    presets: nanfengPresets.listBuiltinPresets(),
    styles: prompt.STYLE_PRESETS.map((s) => ({ id: s.id, name: s.name, category: s.category })),
    lightings: prompt.LIGHTING_PRESETS.map((l) => ({ id: l.id, name: l.name, ratio: l.ratio, zh: l.zh })),
    accelPlans: accelPlanList(),
    contextLengths: [
      { id: '5', label: '5 帧 · 0.21s', seg: 0.21 },
      { id: '22', label: '22 帧 · 0.92s', seg: 0.92 },
      { id: '39', label: '39 帧 · 1.63s', seg: 1.63 },
      { id: '56', label: '56 帧 · 2.33s（最大）', seg: 2.33 },
    ],
    limits: {
      segmentSec: R.REPLACE_DEFAULTS.segmentSec,
      maxSourceSec: R.REPLACE_DEFAULTS.maxSourceSec,
      maxSegments: R.REPLACE_DEFAULTS.maxSegments,
      refImages: 9,
    },
  };
}

/** 预览用模板：`<Picture N>` 的编号与参考图选择顺序一一对应 */
function buildPromptTemplate(refCount) {
  const roles = [];
  for (let i = 0; i < refCount; i += 1) {
    const suffix = refCount > 1 ? i + 1 : '';
    roles.push({
      pictureIndex: i + 1,
      sourceDesc: `〔原角色${suffix}特征：发色/发型/服装/配饰〕`,
      targetDesc: `〔目标角色${suffix}特征：发色/发型/服装/配饰〕`,
    });
  }
  return R.buildReplacePrompt({
    roles,
    shotBeats: '〔分段动作可选。每行一个 [Shot N]，不写就整段复刻原视频。〕',
  });
}

export async function handleReplace(req, res, R2) {
  const { route, cfg, ctx, json, safeId } = R2;

  if (req.method === 'GET' && route === '/replace/meta') {
    return json(200, replaceMeta());
  }

  if (req.method === 'POST' && route === '/replace/prompt-template') {
    const body = await readJsonBody(req);
    const refCount = Math.max(1, Math.min(9, Number(body.refCount) || 1));
    const text = buildPromptTemplate(refCount);
    return json(200, { ok: true, prompt: text, chars: text.length, refCount });
  }

  if (req.method === 'POST' && route === '/replace/preview-prompt') {
    const body = await readJsonBody(req);
    try {
      const text = R.buildReplacePrompt({
        roles: body.roles ?? [],
        shotBeats: body.shotBeats ?? '',
        extraNote: body.extraNote ?? '',
      });
      return json(200, { ok: true, prompt: text, chars: text.length });
    } catch (e) {
      return json(400, { error: String(e?.message || e) });
    }
  }

  /*
   * 提示词编译：三层降级（规则引擎 → 本地模型补翻译 → 原文兜底）。
   * 异常一律冒泡给顶层映射，不在这里 catch 成 500 ——
   * 否则 NANFENG_CONSTRAINT 这类 400 语义会被压成「服务端炸了」。
   */
  if (req.method === 'POST' && route === '/replace/compile-prompt') {
    const body = await readJsonBody(req);
    const raw = String(body.prompt ?? '');
    if (!raw.trim()) return json(400, { error: 'EMPTY_PROMPT', detail: '提示词为空' });

    const r = await promptNormalizer.normalizePrompt(raw, cfg, { useLlm: body.useLlm !== false });
    return json(200, {
      ok: true,
      prompt: r.prompt,
      chars: r.prompt.length,
      translated: r.translated,
      needsTranslate: r.parts.needsTranslate,
      warnings: r.warnings,
      parts: {
        trigger: r.parts.trigger.length,
        summary: r.parts.summary.length,
        subjects: r.parts.subjects.length,
        video: r.parts.video.length,
        shots: r.parts.shots.length,
        guards: r.parts.guards.length,
        stray: r.parts.stray.length,
      },
    });
  }

  if (req.method === 'GET' && route === '/replace/llm-status') {
    return json(200, { ok: true, ...llmStatus(cfg) });
  }

  /** 分析源视频 → 算分段（用户选完视频就能看到"会切成几段"） */
  if (req.method === 'POST' && route === '/replace/plan') {
    const body = await readJsonBody(req);
    const abs = R.resolveReplaceInput(body.sourceRel, cfg);
    const useCont = Boolean(body.continuation);
    const plan = await R.planSourceSegments(abs, cfg, {
      segmentSec: Number(body.segmentSec) || undefined,
      // 续写模式必须一起传：漏了会让预览显示"独立重绘"的分段，与实际执行不符
      continuation: useCont,
      contextLength: useCont ? String(body.contextLength ?? R.REPLACE_DEFAULTS.contextLength) : undefined,
      segmentCount: Number(body.segmentCount) || undefined,
    });
    return json(200, { ok: true, ...plan });
  }

  if (req.method === 'GET' && route === '/replace/tasks') {
    const list = await R.replaceStore(cfg).list();
    return json(200, list.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }

  if (req.method === 'POST' && route === '/replace/tasks') {
    const body = await readJsonBody(req);
    return json(200, await createReplaceTask(body, cfg));
  }

  if (req.method === 'DELETE' && route.startsWith(TASKS_PREFIX)) {
    const id = safeId(decodeURIComponent(route.slice(TASKS_PREFIX.length)));
    await R.replaceStore(cfg).remove(id);
    return json(200, { ok: true, removed: id });
  }

  if (req.method === 'GET' && route.startsWith(TASKS_PREFIX)) {
    const id = safeId(decodeURIComponent(route.slice(TASKS_PREFIX.length).split('/')[0] ?? ''));
    const task = await R.replaceStore(cfg).get(id);
    if (!task) return json(404, { error: 'REPLACE_NOT_FOUND' });
    return json(200, task);
  }

  /** 启动执行（异步：立刻返回，进度靠轮询 GET /replace/tasks/:id） */
  if (req.method === 'POST' && route.startsWith(RUN_PREFIX)) {
    const id = safeId(decodeURIComponent(route.slice(RUN_PREFIX.length)));
    const store = R.replaceStore(cfg);
    const task = await store.get(id);
    if (!task) return json(404, { error: 'REPLACE_NOT_FOUND' });
    if (task.status === 'running' || task.status === 'cutting' || task.status === 'joining') {
      return json(409, { error: 'REPLACE_ALREADY_RUNNING' });
    }

    await store.upsert({ ...task, status: 'queued', error: null, updatedAt: Date.now() });
    // 不 await：批次要跑几十分钟，HTTP 不能挂着
    runReplaceBatch({
      replaceId: id,
      cfg,
      onProgress: (evt) => emit({ type: 'replace-progress', replaceId: id, ...evt }),
    }).catch((e) => {
      ctx?.logger?.warn?.(`[jiuzhang] 换人批次失败 ${id}: ${String(e?.message || e)}`);
    });
    return json(200, { ok: true, replaceId: id, status: 'queued' });
  }

  return false;
}

