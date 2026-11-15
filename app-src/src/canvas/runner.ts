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
//   - video     → 走 /generate（H3 / Seedance / mock）
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
    let jobs: unknown;
    try {
      jobs = await api.listJobs();
    } catch {
      continue;
    }
    const cur = (jobs as { id: string; status: string; outputs?: JobOutput[]; error?: string }[])
      .find((j) => j.id === jobId);
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
    const sizeId = str(p['sizeId'], 'sq-2048');

    onProgress?.(25, '提交图像生成');
    const job = await api.imageGenerate({
      prompt,
      sizeId,
      ...(p['seed'] ? { seed: Number(p['seed']) } : {}),
      ...(images.length ? { refImages: images } : {}),
      projectId,
    }) as { id?: string; status?: string };
    if (!job?.id) throw new Error('IMAGE_JOB_FAILED: 后端没有返回任务号');

    onProgress?.(40, '出图中');
    const final = await waitJob(job.id, onProgress, opts);
    if (final.status !== 'completed') {
      return { jobId: job.id, status: final.status as never, outputs: [], error: final.error };
    }
    const outs = (final.outputs ?? []).map((o) => ({ ...o, url: assetUrlFromPath(o.path, o.rel) }));
    onProgress?.(100, '完成');
    return { jobId: job.id, status: 'completed', outputs: outs };
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
  shotInput.refs.images = images;

  onProgress?.(15, '保存镜头卡');

  // 3) 存镜头卡
  const shot = await api.saveShot(projectId, shotInput as never);
  if (!shot?.id) throw new Error('SHOT_SAVE_FAILED: 镜头卡保存失败');

  onProgress?.(25, '提交生成任务');

  // 4) 提交生成
  const job = await api.generate({
    projectId,
    shotId: shot.id,
    backend: shotInput.backend as never,
    seed: num((node.data?.params as Record<string, unknown>)?.['seed'], 1101),
  } as never);
  if (!job?.id) throw new Error('GENERATE_FAILED: 后端没有返回任务号');

  onProgress?.(35, '已提交，等待生成');

  // 5) 轮询任务
  const pollMs = opts.pollMs ?? 2500;
  const timeoutAt = Date.now() + (opts.timeoutMs ?? 30 * 60 * 1000);
  let lastStatus: string = job.status;

  while (Date.now() < timeoutAt) {
    await new Promise((r) => setTimeout(r, pollMs));
    let jobs;
    try {
      jobs = await api.listJobs();
    } catch {
      continue;   // 网络抖动不中断
    }
    const cur = (jobs as { id: string; status: string; outputs?: unknown[]; error?: string }[])
      .find((j) => j.id === job.id);
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
