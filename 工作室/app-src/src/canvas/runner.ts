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
import type { CanvasNodeData } from './types';
import type { CanvasFlowNode } from './types';

/** 能真正触发后端生成的节点类型 → 后端能力映射 */
// 注意：值只表示"这类节点走哪条生成路线"，不表示具体后端。
// 具体后端在 runNodeGeneration 里按节点类型分发：
//   - realtime  → 走 /image/generate（H3-Image 文生图）
//   - imageEdit → 走 /breakdown/generate（参考图编辑）
//   - video     → 走 /generate（H3 / Seedance / mock）
export const GENERATIVE_NODE_MAP = Object.freeze({
  videoGeneratorNode: 'video',
  imageNode: 'image',            // AI 图片生成
  storyboardGenNode: 'image',    // 分镜生成（逐格出图）
  panoramaNode: 'image',         // 全景生成
  vr360PanoramaNode: 'image',    // 全景 A
  panoramaViewerBNode: 'image',  // 全景 B
  backgroundMusicNode: 'audio',  // 背景音乐（暂无后端，会明确提示）
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
 * 把 upstream 节点里已产出的图片 URL 收集起来（用于参考图）。
 * 只收 http/data URL，忽略空值。
 */
export function collectUpstreamImages(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
  edges: { source: string; target: string }[],
): string[] {
  const sourceIds = edges.filter((e) => e.target === node.id).map((e) => e.source);
  const out: string[] = [];
  for (const id of sourceIds) {
    const up = allNodes.find((n) => n.id === id);
    const r = up?.data?.result as { url?: string; urls?: string[] } | undefined;
    if (r?.url) out.push(r.url);
    if (Array.isArray(r?.urls)) out.push(...r.urls);
    // 上传节点的文件也当作参考图
    const p = up?.data?.params as { fileUrl?: string } | undefined;
    if (p?.fileUrl) out.push(p.fileUrl);
  }
  return out.filter(Boolean).slice(0, 9);   // H3 ref_images 上限 9
}

/**
 * 节点参数 → 后端 shot 结构。
 * 这是"画布节点"与"镜头卡"的桥。
 */
export function nodeToShot(node: CanvasFlowNode, projectId: string) {
  const p = (node.data?.params ?? {}) as Record<string, unknown>;
  const d = node.data ?? ({} as CanvasNodeData);

  const backend = str(p['backend'], 'h3-local');
  const durationSec = Math.min(15, Math.max(1, num(p['durationSec'] ?? p['duration'], 5)));
  const ratio = str(p['ratio'], '16:9');
  const profile = str(p['profile'], 'P12-draft');

  return {
    title: str(d.title, `画布镜头 ${new Date().toLocaleTimeString('zh-CN')}`),
    mode: str(p['mode'], 'ref2v'),
    durationSec,
    ratio,
    profile,
    backend,
    style: str(p['style'], ''),
    description: str(p['prompt'] ?? p['description'], ''),
    camera: str(p['camera'], ''),
    dialogue: str(p['dialogue'], ''),
    sound: str(p['sound'], ''),
    music: str(p['music'], ''),
    prompt: str(p['prompt'], ''),
    refs: { images: [] as string[], videos: [], audios: [] },
    projectId,
  };
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
  outputs: { role?: string; path?: string; bytes?: number; url?: string }[];
  error?: string;
}

/** 轮询任务直到终态（图像/视频共用） */
async function waitJob(
  jobId: string,
  onProgress?: (pct: number, note?: string) => void,
  opts?: { pollMs?: number; timeoutMs?: number },
): Promise<{ status: string; outputs?: { role?: string; path?: string; bytes?: number }[]; error?: string }> {
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
    const cur = (jobs as { id: string; status: string; outputs?: { role?: string; path?: string; bytes?: number }[]; error?: string }[])
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
    const outs = (final.outputs ?? []).map((o) => ({ ...o, url: assetUrlFromPath(o.path) }));
    onProgress?.(100, '完成');
    return { jobId: job.id, status: 'completed', outputs: outs };
  }

  /* ---------------- 音频路线：暂无后端 ---------------- */
  if (route === 'audio') {
    throw new Error('AUDIO_BACKEND_MISSING: 音频生成后端尚未接入');
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
      const outputs = ((cur.outputs ?? []) as { role?: string; path?: string; bytes?: number }[])
        .map((o) => ({ ...o, url: assetUrlFromPath(o.path) }));
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
 * 产物落在 dataDir/outputs 下，通过 /luoshu/api/file 提供。
 */
export function assetUrlFromPath(absPath?: string): string | undefined {
  if (!absPath) return undefined;
  if (/^(https?:|data:|blob:)/.test(absPath)) return absPath;
  const m = absPath.replace(/\\/g, '/').match(/(?:^|\/)outputs\/(.+)$/);
  if (m) return `/luoshu/api/file?path=${encodeURIComponent(`outputs/${m[1]}`)}`;
  const a = absPath.replace(/\\/g, '/').match(/(?:^|\/)assets\/(.+)$/);
  if (a) return `/luoshu/api/file?path=${encodeURIComponent(`assets/${a[1]}`)}`;
  return undefined;
}

export { describeError };
