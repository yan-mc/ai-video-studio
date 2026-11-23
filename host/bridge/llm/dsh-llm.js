/**
 * DSH LLM 桥接 —— 让插件能用宿主已登录的模型，无需任何外部 API Key。
 *
 * ============================================================================
 * 为什么要单开一层
 * ============================================================================
 *
 * 南风原实现要用户自己申请 API Key 填 `.env`。这在 DSH 插件里是倒退 ——
 * DSH 本身就有可用的模型（用户在设置里配好的 provider/model）。
 *
 * 这一层把 `ctx.llm.stream()` 包装成两个简单方法：
 *
 *   callText({ system, user, maxTokens })      → string
 *   callVision({ prompt, images, maxTokens })  → string
 *
 * ============================================================================
 * 依赖的 DSH 服务
 * ============================================================================
 *
 *   ctx.llm.stream(options)      ← @deepseek-ai/dsh-llm
 *   ctx.attachments.saveImages() ← @deepseek-ai/dsh-attachment-local
 *   ctx.agentDefaultModel         ← @deepseek-ai/dsh-agent-default-model
 *
 * @module nanfeng/dsh-llm
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 取 LLM 服务句柄。
 *
 * 优先级：
 *   1) `ctx.llm`      —— inject 里已声明，Cordis 会等到服务就绪再加载插件
 *   2) `ctx.jiuzhangLlm` —— host/index.js 用 ctx.get() 挂上的备份
 *
 * ⚠️ 以前只读 ctx.get('llm')，而 inject 里没有 llm，导致永远是 undefined，
 *    智能分镜永远报"DSH 未挂载 llm 服务"。现在 inject 声明了 llm，
 *    ctx.llm 才是可靠来源。
 *
 * @param {object} ctx
 * @returns {object|null}
 */
export function llmService(ctx) {
  try {
    const direct = ctx?.llm;
    if (direct?.stream) return direct;
  } catch { /* ignore */ }
  try {
    const own = ctx?.jiuzhangLlm;
    if (own?.stream) return own;
  } catch { /* ignore */ }
  return null;
}

/**
 * 取附件服务句柄（把本地图片变成 ImageAttachmentRef，才能送进模型）。
 *
 * 与 llmService 同理：工具/API 拿到的是 runtime 单例，不是 Cordis ctx，
 * 所以优先读 runtime 上挂的 `attachments`。
 *
 * @param {object} ctx
 * @returns {object|null}
 */
export function attachmentsService(ctx) {
  try {
    const direct = ctx?.attachments;
    if (direct?.saveImages || direct?.saveImage) return direct;
  } catch { /* ignore */ }
  return null;
}

/**
 * 取 DSH 的默认模型选择服务。
 *
 * 与 llmService 同理：`agentDefaultModel` 在 inject 里声明才是硬依赖，
 * 我们用 `ctx.get()` 可选取用，由 host/index.js 挂到 ctx.jiuzhangDefaultModel。
 *
 * @param {object} ctx
 * @returns {object|null}
 */
export function defaultModelService(ctx) {
  try {
    const own = ctx?.jiuzhangDefaultModel;
    if (own?.currentSelection) return own;
  } catch { /* ignore */ }
  try {
    const direct = ctx?.agentDefaultModel;
    if (direct?.currentSelection) return direct;
  } catch { /* ignore */ }
  return null;
}

/**
 * 把 provider/model 解析出来。
 *
 * 优先级：
 *   1) 插件配置里显式指定的 vision/text 模型
 *   2) DSH 的当前默认模型（agentDefaultModel.currentSelection()）
 *
 * @param {object} ctx  Cordis 上下文
 * @param {object} cfg  插件配置
 * @param {'vision'|'text'} kind
 */
export function resolveModel(ctx, cfg, kind) {
  const conf = kind === 'vision' ? cfg?.llmVision : cfg?.llmText;
  if (conf?.provider && conf?.model) {
    return { provider: conf.provider, model: conf.model };
  }

  // 回退到 DSH 默认模型
  try {
    const sel = defaultModelService(ctx)?.currentSelection?.();
    if (sel?.provider && sel?.model) return { provider: sel.provider, model: sel.model };
  } catch { /* 忽略 */ }

  throw new Error(
    'LLM_NOT_CONFIGURED: 找不到可用的模型。'
    + '请在设置里为 DSH 配置默认模型，或在插件配置里指定 llmVision / llmText。',
  );
}

/**
 * 把 DSH 的流式 chunk 收集成完整文本，并在**失败时抛错**。
 *
 * ⚠️ 这里以前是裸 for-await，只看 `text-delta`：
 *
 *   for await (const chunk of stream) {
 *     if (chunk?.type === 'text-delta') out += chunk.text;
 *   }
 *   return out;
 *
 * DSH 的 `LlmRuntime.stream` 会把 adapter 抛的错**规范化成终止性 chunk**：
 *   { type: 'finish', reason: { kind: 'error' | 'aborted', failure } }
 * 它不会 throw。于是 provider 报错时这个函数返回**空字符串**，
 * 上层以为生成成功 —— 用户看到"分镜生成完了但是空的"，无从下手。
 *
 * 现在显式检查 finish 的 reason：error/aborted 都抛，空输出也抛。
 *
 * @param {AsyncIterable<any>} stream
 * @param {string} what 用于错误信息（例如 '分镜文本' / '看图分析'）
 * @returns {Promise<string>}
 */
async function collectStream(stream, what) {
  let out = '';
  for await (const chunk of stream) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') {
      out += chunk.text;
      continue;
    }
    if (chunk?.type === 'finish') {
      const kind = chunk.reason?.kind;
      if (kind === 'error') {
        const f = chunk.reason?.failure;
        const detail = typeof f === 'string'
          ? f
          : (f?.message ?? f?.error ?? JSON.stringify(f ?? {}));
        throw new Error(`LLM_FAILED: ${what}生成失败（模型返回错误）：${String(detail).slice(0, 500)}`);
      }
      if (kind === 'aborted') {
        throw new Error(`LLM_ABORTED: ${what}生成被中断`);
      }
    }
  }
  if (!out.trim()) {
    throw new Error(`LLM_EMPTY: ${what}生成结果为空（模型没有返回任何文本）`);
  }
  return out;
}

/**
 * 调一次文本生成，返回完整字符串。
 *
 * @param {object} ctx
 * @param {object} cfg
 * @param {object} opts
 * @param {string} [opts.system]
 * @param {string} opts.user
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @returns {Promise<string>}
 */
export async function callText(ctx, cfg, { system, user, maxTokens, temperature = 0 }) {
  const { provider, model } = resolveModel(ctx, cfg, 'text');
  const svc = llmService(ctx);
  if (!svc) throw new Error('LLM_UNAVAILABLE: DSH 未挂载 llm 服务');
  const messages = [{ role: 'user', content: [{ type: 'text', text: user }] }];

  const stream = svc.stream({
    provider,
    model,
    messages,
    ...(system ? { system } : {}),
    ...(Number.isFinite(maxTokens) ? { maxTokens } : {}),
    temperature,
  });
  return collectStream(stream, '文本');
}

/**
 * 调一次视觉理解，返回对图的描述。
 *
 * 图片要变成 DSH 的 `ImageAttachmentRef`。两条路：
 *   · 走 ctx.attachments.saveImage({ data }) 拿到 ref
 *   · 直接读文件 → 转 base64 → 交 saveImage
 *
 * @param {object} ctx
 * @param {object} cfg
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {Array<{absPath:string, mediaType:string, name?:string}>} opts.images
 * @param {number} [opts.maxTokens]
 * @returns {Promise<string>}
 */
export async function callVision(ctx, cfg, { prompt, images, maxTokens = 4096 }) {
  const { provider, model } = resolveModel(ctx, cfg, 'vision');

  // 把本地文件变成附件引用。
  // DSH 的 saveImage 签名是 { data: Uint8Array, mediaType, name }，
  // 返回 ImageAttachmentRef；batch 用 saveImages 更省一次往返。
  const att = attachmentsService(ctx);
  if (!att) {
    throw new Error(
      'ATTACHMENTS_UNAVAILABLE: DSH 未挂载 attachments 服务，无法把图片送进模型。'
      + '（纯文本分镜仍可用，action=analyze/generate 带 imageRels 时才需要它）',
    );
  }
  const inputs = images.map((img) => ({
    data: fs.readFileSync(img.absPath),
    mediaType: img.mediaType ?? guessMediaType(img.absPath),
    name: img.name ?? path.basename(img.absPath),
  }));
  const refs = inputs.length ? await att.saveImages(inputs) : [];

  const content = [{ type: 'text', text: prompt }];
  for (const ref of refs) content.push({ type: 'image', attachment: ref });

  const svc = llmService(ctx);
  if (!svc) throw new Error('LLM_UNAVAILABLE: DSH 未挂载 llm 服务');

  const stream = svc.stream({
    provider,
    model,
    messages: [{ role: 'user', content }],
    maxTokens,
    temperature: 0,
  });
  return collectStream(stream, '看图分析');
}

/** 按扩展名猜 MIME */
export function guessMediaType(p) {
  const ext = path.extname(String(p)).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

/**
 * 探测当前环境是否具备 LLM 能力（供 /health 与前端显示）。
 *
 * @param {object} ctx
 * @param {object} cfg
 */
export function llmStatus(ctx, cfg) {
  const out = {
    available: false,
    text: null,
    vision: null,
    /** 能否把图片送进模型（依赖 attachments 服务） */
    attachments: false,
    reason: '',
  };
  try {
    if (!llmService(ctx)) {
      out.reason = 'ctx.llm 不可用（DSH 未挂载 llm 服务）';
      return out;
    }
    out.text = resolveModel(ctx, cfg, 'text');
    out.vision = resolveModel(ctx, cfg, 'vision');
    out.attachments = Boolean(attachmentsService(ctx));
    out.available = true;
    if (!out.attachments) {
      out.reason = 'attachments 服务不可用：纯文本分镜可用，带参考图的看图分析不可用';
    }
  } catch (e) {
    out.reason = String(e?.message || e);
  }
  return out;
}
