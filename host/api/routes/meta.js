/**
 * 元信息域：token / monitor / meta / events / health / comfy 进程控制 /
 * 加速方案 / LoRA 目录 / 工作流诊断 / 配置。
 */
import { loadConfig, saveConfig, maskConfig, sanitizeConfigPatch, resetConfigCache } from '../../config.js';
import { getWriteToken } from '../../security.js';
import {
  PROFILES, H3_MODEL_SLOTS, NODE_TYPES, NODE_LABELS,
  ASSET_TYPES, ASSET_TYPE_LABELS, PROJECT_CATEGORY_LABELS,
} from '../../store/models.js';
import * as comfy from '../../services/comfy-client.js';
import * as comfyControl from '../../services/comfy-control.js';
import { blenderStatus } from '../../services/blender-service.js';
import { ACCEL_PLANS, ACCEL_PLAN_IDS, DEFAULT_ACCEL_PLAN } from '../../services/accel-plan.js';
import { LORA_CATEGORIES, STRENGTH_LIMITS, catalogLoras, solveLoraStack } from '../../services/lora-catalog.js';
import { workflowDiagnostics } from '../../services/workflow-paths.js';
import { nanfengSchema, nanfengPresets, nanfengGraph } from '../../bridge/index.js';
import { monitorPayload } from '../monitor.js';
import { guardNoToken } from '../archive.js';
import { readJsonBody } from '../http.js';
import { handleSse, clientCount } from '../events.js';
import { VALID_BACKENDS } from '../backend.js';

/**
 * 加速方案的对外投影（前端下拉与排障展示共用）。
 *
 * 只暴露用户需要知道的：id / 标签 / 步数 / 采样器 / shift / 提示语。
 * `stepsRange` 只在步数可调的方案上出现（蒸馏学生的步数是训练配置，改了即分布外）。
 */
export function accelPlanList({ includeLora = false } = {}) {
  return ACCEL_PLAN_IDS.map((id) => {
    const p = ACCEL_PLANS[id];
    return {
      id: p.id,
      label: p.label,
      family: p.family,
      steps: p.steps,
      ...(p.stepsRange ? { stepsRange: p.stepsRange } : {}),
      sampler: p.sampler,
      scheduler: p.scheduler,
      shift: p.shiftVideo != null ? { video: `${p.shiftVideo}/${p.shiftAudio}` } : null,
      hint: p.hint,
      isDefault: id === DEFAULT_ACCEL_PLAN,
      ...(includeLora ? { lora: p.lora || null } : {}),
    };
  });
}

export async function handleMeta(req, res, R) {
  const { route, url, cfg, json } = R;

  // /token 必须免 token：SPA 与客户端启动时用它取写令牌。
  // 同时回 origin —— Desktop 窗口是 dsh-app://app，拿不到真实端口。
  if (req.method === 'GET' && route === '/token') {
    if (!guardNoToken(req)) return json(403, { error: 'FORBIDDEN_ORIGIN' });
    let origin = '';
    try { origin = R.ctx.webServer?.getOrigin?.() || ''; } catch { /* 可能未绑定 */ }
    return json(200, { token: getWriteToken(), origin });
  }

  if (req.method === 'GET' && route === '/monitor') {
    return json(200, await monitorPayload(R.ctx));
  }

  if (req.method === 'GET' && route === '/meta') {
    return json(200, {
      profiles: PROFILES,
      h3Slots: H3_MODEL_SLOTS,
      nodeTypes: NODE_TYPES.map((t) => ({ type: t, label: NODE_LABELS[t] })),
      assetTypes: ASSET_TYPES.map((t) => ({ type: t, label: ASSET_TYPE_LABELS[t] })),
      assetTypeLabels: ASSET_TYPE_LABELS,
      projectCategories: PROJECT_CATEGORY_LABELS,
      defaultBackend: cfg.defaultBackend,
      defaultProfile: cfg.defaultProfile,
      backends: [...VALID_BACKENDS],
    });
  }

  // SSE 长连接：不经过 sendJson，保持连接持续写 `data: <json>\n\n`
  if (req.method === 'GET' && route === '/events') {
    handleSse(req, res);
    return true;
  }

  if (req.method === 'GET' && route === '/nanfeng/schema') {
    const enriched = typeof nanfengSchema.enrichSchema === 'function'
      ? nanfengSchema.enrichSchema()
      : {
        paramCount: nanfengSchema.PARAM_COUNT,
        groups: nanfengSchema.GROUPS,
        params: nanfengSchema.PARAMS,
      };
    return json(200, {
      ...enriched,
      // 前端「无效参数」提示条要用
      inert: typeof nanfengSchema.inertParams === 'function' ? nanfengSchema.inertParams() : [],
    });
  }

  if (req.method === 'GET' && route === '/nanfeng/presets') {
    return json(200, {
      default: nanfengPresets.DEFAULT_PRESET,
      presets: nanfengPresets.listBuiltinPresets(),
      /*
       * V8.1 完整 Sigma 序列。`H3完整Sigma序列` 是 D 组的有效参数
       * （别和 F 组的死参数 `手动西格玛` 搞混）：开潜空间二采时，
       * 值的个数必须 = 一采步数 + 二采步数 + 1。
       */
      sigmas: Object.entries(nanfengPresets.SIGMA_PRESETS).map(([id, p]) => ({
        id, label: p.label, value: p.value,
        requiredSteps: p.requiredSteps ?? null,
        warning: p.warning ?? null,
      })),
      accelPlans: accelPlanList({ includeLora: true }),
    });
  }

  /** 某预设合并后的完整参数（前端"预览将提交什么"） */
  if (req.method === 'GET' && route.startsWith('/nanfeng/presets/')) {
    const id = R.safeId(decodeURIComponent(route.slice('/nanfeng/presets/'.length)));
    const { params, meta } = nanfengPresets.builtinPreset(id);
    if (!meta) return json(404, { error: 'PRESET_NOT_FOUND', id });
    return json(200, {
      ...meta,
      params: nanfengGraph.coerceTypes(nanfengGraph.mergeParams(params)),
    });
  }

  if (req.method === 'GET' && route === '/health') {
    const h3 = await comfy.health(cfg);
    // 工作流模板是否就位 —— 首装最容易踩的坑，直接在健康检查里暴露
    const wfH3 = workflowDiagnostics('h3', cfg);
    const wfImg = workflowDiagnostics('image', cfg);
    return json(200, {
      ok: true,
      h3,
      blender: blenderStatus(),
      accel: { current: cfg.accelPlan, plans: accelPlanList() },
      workflows: {
        h3: { exists: wfH3.exists, dir: wfH3.dir },
        image: { exists: wfImg.exists, dir: wfImg.dir },
        ok: wfH3.exists && wfImg.exists,
      },
      events: { clients: clientCount() },
    });
  }

  /*
   * ComfyUI 进程控制。本地「取消」只对正在跑的那单发 /interrupt，
   * 已排队未开始的任务不会被清掉；重启能一次性清队列、显存碎片与节点缓存。
   */
  if (req.method === 'GET' && route === '/comfy/status') {
    return json(200, { ok: true, ...(await comfyControl.comfyStatus()) });
  }

  if (req.method === 'POST' && route === '/comfy/stop') {
    const body = await readJsonBody(req).catch(() => ({}));
    const r = await comfyControl.withLock(
      () => comfyControl.stopComfy({ purge: body?.purge !== false }),
    );
    return json(r.ok ? 200 : 500, r);
  }

  if (req.method === 'POST' && route === '/comfy/start') {
    const r = await comfyControl.withLock(() => comfyControl.startComfy());
    return json(r.ok ? 200 : 500, r);
  }

  if (req.method === 'POST' && route === '/comfy/restart') {
    const body = await readJsonBody(req).catch(() => ({}));
    const r = await comfyControl.withLock(
      () => comfyControl.restartComfy({ purge: body?.purge !== false }),
    );
    return json(r.ok ? 200 : 500, r);
  }

  if (req.method === 'GET' && route === '/accel/plans') {
    return json(200, {
      ok: true,
      current: cfg.accelPlan,
      plans: accelPlanList(),
    });
  }

  /*
   * LoRA 目录 —— 前端选择器的数据源。
   *
   * 归类依据是 ComfyUI 的 `loras` 列表（object_info 是唯一权威）；
   * ComfyUI 会递归扫描子目录，所以 `00_turbo/xxx.safetensors` 天然带分类信息。
   * `probed:false` 表示"没探测到"（ComfyUI 不可达），不是"一个都没装"。
   */
  if (req.method === 'GET' && route === '/lora/catalog') {
    const { probed, probeError } = await probeLoraFiles(cfg);
    const items = catalogLoras(probed ?? []);
    return json(200, {
      ok: true,
      probed: probed != null,
      ...(probeError ? { probeError } : {}),
      categories: LORA_CATEGORIES,
      limits: STRENGTH_LIMITS,
      items,
      byCategory: countByCategory(items),
      total: items.length,
    });
  }

  // 把候选 LoRA 摊开校验一遍（前端"将提交"面板用它做实时预演）
  if (req.method === 'POST' && route === '/lora/solve') {
    const body = await readJsonBody(req);
    const requested = Array.isArray(body.items) ? body.items : [];
    const solved = solveLoraStack(requested, { maxSlots: Number(body.maxSlots) || 8 });
    return json(200, { ok: true, ...solved });
  }

  if (req.method === 'GET' && route === '/workflows/diagnostics') {
    return json(200, {
      h3: workflowDiagnostics('h3', cfg),
      image: workflowDiagnostics('image', cfg),
    });
  }

  if (req.method === 'GET' && route === '/config') return json(200, maskConfig(cfg));
  if (req.method === 'POST' && route === '/config') {
    const body = await readJsonBody(req);
    // sanitizeConfigPatch 对 comfyUrl 做 SSRF 校验，不合法时抛 INVALID_COMFY_URL
    let patch;
    try {
      patch = sanitizeConfigPatch(body);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.startsWith('INVALID_COMFY_URL')) {
        return json(400, { error: 'INVALID_COMFY_URL', detail: msg });
      }
      throw e;
    }
    resetConfigCache();
    saveConfig(patch);
    return json(200, maskConfig(loadConfig()));
  }

  return false;
}

/** 探测 ComfyUI 的 loras 列表；返回 { probed: string[]|null, probeError } */
export async function probeLoraFiles(cfg) {
  try {
    const mf = await comfy.listModelFiles(cfg);
    if (mf?.ok) return { probed: mf.loras };
    return { probed: null, probeError: mf?.reason || 'ComfyUI 不可达' };
  } catch (e) {
    return { probed: null, probeError: String(e?.message || e) };
  }
}

/** 按分类统计条数 */
export function countByCategory(items) {
  const byCategory = {};
  for (const it of items) byCategory[it.categoryId] = (byCategory[it.categoryId] ?? 0) + 1;
  return byCategory;
}
