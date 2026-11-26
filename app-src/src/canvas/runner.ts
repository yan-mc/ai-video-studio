/**
 * 节点生成执行器 —— 把画布节点真正接到后端。
 *
 * 修复审查确认的核心断点（G2/G3）：
 *  - 原先 runNode 只翻转前端状态 + toast，从不调用任何 API；
 *  - data.result 没有写入方，所有预览区永远空态。
 *
 * 本模块职责：
 *  1) 把节点参数映射成后端能吃的 shot 结构；
 *  2) 调 /projects/:id/shots → /generate；
 *  3) 轮询 /jobs 直到终态，把产物写回节点 data.result。
 *
 * 设计原则：
 *  - 只对**后端真的支持**的节点类型发起生成；不支持的明确报错，不假装成功。
 *  - 失败要有可读原因，不能静默停在"生成中"。
 */
import { api, describeError } from '../api/client';
import { fileUrl } from '../api/url';
import type { JobOutput } from '../api/types';
import type { CanvasNodeData } from './types';
import type { CanvasFlowNode } from './types';

/** 能真正触发后端生成的节点类型 → 后端能力映射 */
// 注意：值只表示"这类节点走哪条生成路线"，不表示具体后端。
// 具体后端在 runNodeGeneration 里按节点类型分发：
//   - realtime  → 走 /image/generate（H3-Image 文生图）
//   - imageEdit → 走 /breakdown/generate（参考图编辑）
//   - video     → 走 /generate（H3 本地 / mock 占位）
/**
 * 哪些节点能发起生成、以及走哪条路线。
 *
 * ⚠️ 这是**唯一真源**：nodeRegistry 的 `capabilities.generative` 必须与这里一致，
 *    否则就会出现"有运行按钮但点了报暂不支持"或"有能力却永远走不到"。
 *    `validateRegistry()` 会双向校验两边。
 *
 * audio / text 路线没有本地后端，会明确提示而不是假装成功。
 */
export const GENERATIVE_NODE_MAP = Object.freeze({
  videoGeneratorNode: 'video',
  imageNode: 'image',            // AI 图片生成
  storyboardGenNode: 'image',    // 分镜生成（逐格出图）
  panoramaNode: 'image',         // 全景生成（唯一真正出图的全景节点）
  backgroundMusicNode: 'audio',  // 背景音乐（暂无后端，会明确提示）
  // 以下节点接的是 LLM / 语音服务，不是本地扩散模型：
  aiTextNode: 'text',
  agentGenNode: 'text',
  episodeSubCanvasNode: 'text',
  aiVoiceGenerationNode: 'audio',
  extractVoiceNode: 'audio',
  extractCharacterNode: 'extract',
  extractSceneNode: 'extract',
  extractItemNode: 'extract',
} as const);

export type GenerativeNodeType = keyof typeof GENERATIVE_NODE_MAP;
export type GenerativeRoute = (typeof GENERATIVE_NODE_MAP)[GenerativeNodeType];

export function isBackendSupported(nodeType: string): nodeType is GenerativeNodeType {
  return nodeType in GENERATIVE_NODE_MAP;
}

/** 这个节点走哪条生成路线 */
export function routeFor(nodeType: string): GenerativeRoute | null {
  return (GENERATIVE_NODE_MAP as Record<string, GenerativeRoute>)[nodeType] ?? null;
}

/** 从节点参数里安全取数字 */
function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 从节点参数里安全取字符串 */
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/**
 * 把 upstream 节点里已产出的图片收集起来（用于参考图）。
 *
 * 只收后端能解析的路径：http(s) URL、data URL、dataDir 相对路径（如 assets/x.png）。
 * **必须排除 `blob:`** —— 它只在本浏览器进程内有效，后端 `resolveRefImages`
 * 既当不了绝对路径也当不了相对路径，会被静默丢弃，表现为"参考图没生效"。
 */
export function collectUpstreamImages(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
  edges: { source: string; target: string }[],
): string[] {
  const sourceIds = edges.filter((e) => e.target === node.id).map((e) => e.source);
  const out: string[] = [];
  const usable = (u: string) => Boolean(u) && !u.startsWith('blob:') && !u.startsWith('file:')
    && !u.startsWith('/jiuzhang/api/');   // 同源读取地址只是浏览器用的，后端要 rel 路径
  for (const id of sourceIds) {
    const up = allNodes.find((n) => n.id === id);
    const r = up?.data?.result as { url?: string; urls?: string[]; rel?: string; path?: string } | undefined;
    // 优先后端相对路径（rel），其次 http/data URL
    if (r?.rel) out.push(r.rel);
    if (r?.path && usable(String(r.path))) out.push(String(r.path));
    if (r?.url && usable(r.url)) out.push(r.url);
    if (Array.isArray(r?.urls)) out.push(...r.urls.filter(usable));
    // 上传节点：fileUrl 是后端 rel 路径
    const p = up?.data?.params as { fileUrl?: string; sourcePath?: string } | undefined;
    if (p?.fileUrl) out.push(p.fileUrl);
  }
  return [...new Set(out.filter(usable))].slice(0, 9);   // H3 ref_images 上限 9
}

/** 画布 mode（t2v/i2v/…）→ H3 编译器认识的 mode（t2va/i2va/…） */
const CANVAS_MODE_MAP: Record<string, string> = {
  t2v: 't2va', T2V: 't2va',
  i2v: 'i2va', I2V: 'i2va',
  fl2v: 'fl2va', FL2V: 'fl2va',
  ref: 'ref2va', REF: 'ref2va', ref2v: 'ref2va', ref2va: 'ref2va',
  l2v: 'l2va', L2V: 'l2va',
};

/** 把画布 mode 归一成 H3 编译器认识的枚举 */
export function h3Mode(raw: unknown, hasRefImages: boolean): string {
  const s = String(raw ?? '').trim();
  // 带 "h3:" 前缀的档位（如 h3:T2V）取后半段
  const bare = s.includes(':') ? s.slice(s.indexOf(':') + 1) : s;
  const mapped = CANVAS_MODE_MAP[bare] ?? CANVAS_MODE_MAP[bare.toUpperCase()];
  if (mapped) return mapped;
  // 未识别：有图走全参考，无图走文生
  return hasRefImages ? 'ref2va' : 't2va';
}

/**
 * 节点参数 → 后端 shot 结构。
 * 这是"画布节点"与"镜头卡"的桥。
 *
 * ⚠️ 键名必须与 nodeRegistry 的 UI 键一致：
 *   UI 用 aspectRatio / referenceImages / firstFrameUrl，
 *   后端 shot 用 ratio / refs.images / previz.firstFramePath。
 *   旧实现直接读 p['ratio']，而 UI 写的是 aspectRatio → 画幅恒为 16:9；
 *   参考图与首尾帧则被整体丢弃，只有"上游连线"能传图。
 */
export function nodeToShot(node: CanvasFlowNode, projectId: string) {
  const p = (node.data?.params ?? {}) as Record<string, unknown>;
  const d = node.data ?? ({} as CanvasNodeData);

  const backend = str(p['backend'], 'h3-local');
  const durationSec = Math.min(15, Math.max(1, num(p['durationSec'] ?? p['duration'], 5)));
  const ratio = str(p['aspectRatio'] ?? p['ratio'], '16:9');
  const profile = str(p['profile'], 'P12-draft');

  // 手填的参考图（UI 是换行分隔的 list）
  const manualImages = toList(p['referenceImages']);

  /**
   * ⚠️ 这两个参数以前是**纯装饰**。
   *
   * `motionLoraStrength`（动作 LoRA 强度）在 nodeRegistry 里声明了滑条、
   * 在节点上画了进度条，但 nodeToShot 的返回值里**没有这个键**，
   * host/ 全仓库 grep 零命中 —— 拖到 0 还是 2，提交出去的 body 完全一样。
   *
   * `steps` / `firstPassSteps` 同理（后端 `/generate` 接受 body.steps）。
   *
   * 现在把两者映射到南风的真实参数：
   *   · motionLoraStrength → 语义 LoRA 强度（`nanfeng.loras` 里的 strength）
   *   · steps              → H3 一采步数（二采开启时上游只读这两个）
   *
   * 注意：加速学生（DMAD）的强度恒为 1.0，**不**受这个滑条影响 ——
   * 它是学生本体，压强度会让低步数去噪不足。滑条只作用在语义 LoRA 上。
   */
  const steps = num(p['steps'], 0);
  const motionLora = p['motionLoraStrength'] != null ? num(p['motionLoraStrength'], 1) : null;
  const semanticLoras = toList(p['loras'] ?? p['semanticLoras']);

  return {
    title: str(d.title, `画布镜头 ${new Date().toLocaleTimeString('zh-CN')}`),
    mode: h3Mode(p['mode'], manualImages.length > 0),
    durationSec,
    ratio,
    profile,
    backend,
    style: str(p['style'], ''),
    description: str(p['prompt'] ?? p['positivePrompt'] ?? p['description'], ''),
    camera: str(p['camera'], ''),
    dialogue: str(p['dialogue'], ''),
    sound: str(p['sound'], ''),
    music: str(p['music'], ''),
    prompt: str(p['prompt'] ?? p['positivePrompt'], ''),
    refs: {
      images: manualImages,
      videos: toList(p['referenceVideos']),
      audios: toList(p['referenceAudios']),
    },
    // 加速方案（画布上不选时跟随全局默认）
    ...(str(p['accelPlan']) ? { accelPlan: str(p['accelPlan']) } : {}),
    // 南风参数覆盖：步数 + 语义 LoRA 强度
    ...(steps > 0 || motionLora != null || semanticLoras.length
      ? {
        nanfeng: {
          ...(steps > 0 ? { overrides: { 采样步数: steps, H3一采步数: steps } } : {}),
          /**
           * ⚠️ 字段名必须是 `name`，不是 `file`。
           *
           * 后端 `solveLoraStack`（host/services/lora-catalog.js）只认
           * `{ name, strength }`，并且它的入参归一化是
           *   `.filter((x) => x && typeof x.name === 'string' && x.name.trim())`
           * —— 传 `{ file }` 的条目会在**静默中**被整条丢弃：
           * 不报错、不进 rejected、总强度按 0 计，最终只有加速学生上机。
           * 画布上拖着「语义 LoRA」以为生效了，实际一帧都没用上。
           *
           * 这个 bug 在修复前实测：`{file:'20_motion\\X.safetensors'}` →
           * accepted 为空；换成 `{name:...}` 才正常进 LoRA2 槽。
           */
          ...(semanticLoras.length
            ? {
              loras: semanticLoras.map((file) => ({
                name: file,
                ...(motionLora != null ? { strength: motionLora } : {}),
              })),
            }
            : {}),
        },
      }
      : {}),
    // 首尾帧：后端读 shot.previz.firstFramePath / lastFramePath
    ...(str(p['firstFrameUrl']) || str(p['lastFrameUrl'])
      ? {
        previz: {
          ...(str(p['firstFrameUrl']) ? { firstFramePath: str(p['firstFrameUrl']) } : {}),
          ...(str(p['lastFrameUrl']) ? { lastFramePath: str(p['lastFrameUrl']) } : {}),
        },
      }
      : {}),
    projectId,
  };
}

/** 把 list/textarea 参数拆成去空的字符串数组 */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[\n,，;；]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 画布「AI 图片」节点的尺寸下拉（768/1024/1536/2048 像素）→ 后端 IMAGE_SIZES id。
 *
 * 两套坐标系不同：UI 是短边像素，后端是 `sq-2048` / `p-4x3` 这种"形状+百万像素"的 id。
 * 这里按最接近的像素值取，取不到退回 sq-2048。
 */
function pixelToSizeId(px: number): string {
  const n = Number(px);
  if (n >= 2048) return 'sq-2048';
  if (n >= 1536) return 'h-16x9';       // 1536 长边 → 16:9 档
  if (n >= 1024) return 'sq-1024';
  return 'sq-768';
}

export interface RunOptions {
  projectId: string;
  node: CanvasFlowNode;
  allNodes: CanvasFlowNode[];
  edges: { source: string; target: string }[];
  onProgress?: (pct: number, note?: string) => void;
  /** 轮询间隔与超时（测试可缩短） */
  pollMs?: number;
  timeoutMs?: number;
}

export interface RunResult {
  jobId: string;
  status: 'completed' | 'failed' | 'cancelled';
  outputs: JobOutput[];
  error?: string;
}

/** 轮询任务直到终态（图像/视频共用） */
async function waitJob(
  jobId: string,
  onProgress?: (pct: number, note?: string) => void,
  opts?: { pollMs?: number; timeoutMs?: number },
): Promise<{ status: string; outputs?: JobOutput[]; error?: string }> {
  const pollMs = opts?.pollMs ?? 2500;
  const timeoutAt = Date.now() + (opts?.timeoutMs ?? 40 * 60 * 1000);
  let last: string = 'queued';

  while (Date.now() < timeoutAt) {
    await new Promise((r) => setTimeout(r, pollMs));
    let cur: { id: string; status: string; outputs?: JobOutput[]; error?: string } | null;
    try {
      /**
       * 单任务查询，**不要**拉全量列表再 find。
       *
       * 历史实现是 `listJobs().find(...)`：每次响应 300 KB 级（126 条任务 ×
       * prompt 全文 + 221 参数快照），单节点执行 30 分钟按 2.5s 轮询
       * ≈ 450 MB 纯流量浪费，还会把 jobs.json 全量读盘一遍。
       */
      cur = await api.getJob(jobId) as { id: string; status: string; outputs?: JobOutput[]; error?: string };
    } catch {
      continue;
    }
    if (!cur) continue;
    last = cur.status;

    if (cur.status === 'running') onProgress?.(60, '生成中');
    if (cur.status === 'queued') onProgress?.(40, '排队中');

    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(cur.status)) {
      return { status: cur.status === 'interrupted' ? 'cancelled' : cur.status, outputs: cur.outputs, error: cur.error };
    }
  }
  throw new Error(`GENERATE_TIMEOUT: 超时（最后状态 ${last}）`);
}

/**
 * 执行一次节点生成。
 * @throws 当节点类型不支持 / 后端拒绝 / 超时
 */
export async function runNodeGeneration(opts: RunOptions): Promise<RunResult> {
  const { projectId, node, allNodes, edges, onProgress } = opts;
  const type = node.type ?? '';

  if (!isBackendSupported(type)) {
    throw new Error(`NODE_NOT_GENERATIVE: 「${type}」没有后端生成能力`);
  }

  const route = routeFor(type);
  onProgress?.(5, '准备输入');

  // 1) 收集上游参考图
  const images = collectUpstreamImages(node, allNodes, edges);

  /* ---------------- 图像路线：走 H3-Image ---------------- */
  if (route === 'image') {
    const p = (node.data?.params ?? {}) as Record<string, unknown>;
    const prompt = str(p['prompt'] ?? p['description'], '') || str(node.data?.title, '未命名图片');

    /**
     * ⚠️ UI 的键名是 `size`，不是 `sizeId`。
     *
     * nodeRegistry 的 imageNode 用 `key:'size'`（768/1024/1536/2048 四档），
     * 而这里以前读 `p['sizeId']` —— 永远 undefined → 恒兜底 'sq-2048'，
     * 用户在画布上选任何尺寸都无效。
     *
     * 两个来源都要认：`sizeId`（后端 IMAGE_SIZES 的 id，如 sq-2048）
     * 与 `size`（画布下拉的像素值）。像素值映射到最接近的后端档位。
     */
    const sizeId = str(p['sizeId']) || pixelToSizeId(num(p['size'], 2048));

    /**
     * 手填参考图也要带上（UI 的 referenceImages 是换行分隔 list）。
     *
     * ⚠️ 上限从 9 改成 16：图像节点用的是 `MiniMaxH3ImageConditioning` 的
     *    AUTOGROW 输入（最多 100 槽），与视频的 `图片1..9` 槽位是**两套上限**。
     *    以前这里照抄视频的 9，用户在画布上挂到第 10 张就被静默丢。
     *
     * ⚠️ 顺序即语义：上游连线来的图在前、手填在后 ——
     *    第 1 张是"被编辑的原图"，会决定输出画布尺寸。
     */
    const manualRefs = toList(p['referenceImages']);
    const allRefs = [...new Set([...images, ...manualRefs])].slice(0, 16);

    onProgress?.(25, '提交图像生成');
    const job = await api.imageGenerate({
      prompt,
      sizeId,
      ...(p['seed'] ? { seed: Number(p['seed']) } : {}),
      ...(allRefs.length ? { refImages: allRefs } : {}),
      projectId,
    });
    const jobId = job.id;
    if (!jobId) throw new Error('IMAGE_JOB_FAILED: 后端没有返回任务号');

    onProgress?.(40, '出图中');
    const final = await waitJob(jobId, onProgress, opts);
    if (final.status !== 'completed') {
      return { jobId, status: final.status as never, outputs: [], error: final.error };
    }
    const outs = (final.outputs ?? []).map((o) => ({ ...o, url: assetUrlFromPath(o.path, o.rel) }));
    onProgress?.(100, '完成');
    return { jobId, status: 'completed', outputs: outs };
  }

  /* ---------------- 音频路线：暂无后端 ---------------- */
  if (route === 'audio') {
    throw new Error('AUDIO_BACKEND_MISSING: 音频生成后端尚未接入');
  }

  /* ---------------- 文本 / 抽取路线：走 LLM，不是本地扩散模型 ---------------- */
  // 这些节点接的是 LLM 服务（剧本抽取、AI 文本、剧集子画布），
  // 绝不能掉进下面的视频分支 —— 否则会用一句话当提示词去跑 H3，既慢又毫无意义。
  if (route === 'text' || route === 'extract') {
    throw new Error(
      `${route.toUpperCase()}_BACKEND_MISSING: 该节点走 LLM 服务，尚未接入画布生成通道`
      + `（现有实现只覆盖 image / video 两条本地扩散路线）`,
    );
  }

  /* ---------------- 视频路线 ---------------- */
  // 2) 组装 shot
  const shotInput = nodeToShot(node, projectId);
  /**
   * ⚠️ 上游参考图要**并入**手填参考图，不能直接覆盖。
   *
   * 旧实现是 `shotInput.refs.images = images`，于是节点上「手填参考图」
   * （`data.params.referenceImages`，nodeToShot 已解析到 refs.images）在
   * 有上游连线时被**静默清空**：用户在节点里填的图一个字都不提，
   * 生成的只有上游那几张。合并顺序 = 手填在前（用户显式指定的优先），
   * 且按 ≤9 张截断（与 ref-images 的硬上限一致）。
   */
  const mergedImages = [...new Set([...(shotInput.refs?.images ?? []), ...images])].slice(0, 9);
  shotInput.refs.images = mergedImages;

  onProgress?.(15, '保存镜头卡');

  // 3) 存镜头卡
  const shot = await api.saveShot(projectId, shotInput as never);
  if (!shot?.id) throw new Error('SHOT_SAVE_FAILED: 镜头卡保存失败');

  onProgress?.(25, '提交生成任务');

  // 4) 提交生成
  const params = (node.data?.params ?? {}) as Record<string, unknown>;
  const job = await api.generate({
    projectId,
    shotId: shot.id,
    backend: shotInput.backend as never,
    seed: num(params['seed'], 1101),
    /**
     * ⚠️ steps / accelPlan 后端一直支持（`/generate` 会读
     * `body.steps` 与 `body.accelPlan`），但画布以前**从不传** ——
     * 于是画布上享受不到二采/加速方案的任何控制，而渲染页可以。
     * 同一个后端能力，两条入口行为不一致。
     */
    ...(num(params['steps'], 0) > 0 ? { steps: num(params['steps'], 0) } : {}),
    ...(typeof params['accelPlan'] === 'string' && params['accelPlan']
      ? { accelPlan: params['accelPlan'] as never }
      : {}),
  } as never);
  if (!job?.id) throw new Error('GENERATE_FAILED: 后端没有返回任务号');

  onProgress?.(35, '已提交，等待生成');

  // 5) 轮询任务
  const pollMs = opts.pollMs ?? 2500;
  const timeoutAt = Date.now() + (opts.timeoutMs ?? 30 * 60 * 1000);
  let lastStatus: string = job.status;

  while (Date.now() < timeoutAt) {
    await new Promise((r) => setTimeout(r, pollMs));
    let cur: { id: string; status: string; outputs?: unknown[]; error?: string } | null;
    try {
      // 同 waitJob：单任务查询，避免每 2.5s 拉一遍全量列表
      cur = await api.getJob(job.id) as { id: string; status: string; outputs?: unknown[]; error?: string };
    } catch {
      continue;   // 网络抖动不中断
    }
    if (!cur) continue;

    lastStatus = cur.status;
    if (cur.status === 'running') onProgress?.(60, '生成中');
    if (cur.status === 'queued') onProgress?.(40, '排队中');

    if (cur.status === 'completed') {
      onProgress?.(100, '完成');
      const outputs = ((cur.outputs ?? []) as JobOutput[])
        .map((o) => ({ ...o, url: assetUrlFromPath(o.path, o.rel) }));
      return { jobId: job.id, status: 'completed', outputs };
    }
    if (cur.status === 'failed') {
      return { jobId: job.id, status: 'failed', outputs: [], error: cur.error || '生成失败' };
    }
    if (cur.status === 'cancelled' || cur.status === 'interrupted') {
      return { jobId: job.id, status: 'cancelled', outputs: [], error: cur.error || '已取消' };
    }
  }

  throw new Error(`GENERATE_TIMEOUT: 超时（最后状态 ${lastStatus}）`);
}

/**
 * 把后端产物路径转成可访问的 URL。
 *
 * 优先用后端的 `rel`（相对 dataDir），只有老数据才回退到从绝对路径里截取。
 * `/jiuzhang/api/file` 只接受 dataDir 内的路径，传绝对路径会被 403。
 */
export function assetUrlFromPath(absPath?: string, rel?: string): string | undefined {
  if (rel) return fileUrl(rel);
  if (!absPath) return undefined;
  if (/^(https?:|data:|blob:)/.test(absPath)) return absPath;
  const norm = absPath.replace(/\\/g, '/');
  const m = norm.match(/(?:^|\/)(outputs\/.+)$/);
  if (m) return fileUrl(m[1]);
  const a = norm.match(/(?:^|\/)(assets\/.+)$/);
  if (a) return fileUrl(a[1]);
  return undefined;
}

export { describeError };
