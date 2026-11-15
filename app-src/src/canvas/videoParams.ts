/**
 * videoGeneratorNode 的**纯逻辑**部分 —— 参数校验、模型档位解析、分段规范。
 *
 * 为什么从组件里拆出来：
 *   组件文件 import 了 React/设计系统，node 跑不了；但"参数怎么算"是业务规则，
 *   必须能单测（五段流 1~5 段、参考图 ≤9、时长 1~15、模式与档位一致性）。
 *   拆成零依赖模块后，`node --test` 可以直接打这些函数。
 */
import {
  H3_MODEL_SLOT_OPTIONS,
  SEEDANCE_MODEL_OPTIONS,
  DEFAULT_VIDEO_SEGMENTS,
} from './nodeRegistry';
import { paramList, paramNum, paramSegments, paramStr } from './types';
import type { VideoSegmentParam } from './types';

export { DEFAULT_VIDEO_SEGMENTS };

/**
 * 测试专用的"齐备参数"基线 —— 除被测项外全部满足，便于单独断言某一条警告。
 * 放在生产模块里是因为它同时可作"一键填满默认值"的能力被 UI 复用。
 */
export const DEFAULT_VIDEO_PARAMS_FOR_TEST: Record<string, unknown> = {
  backend: 'h3-local',
  model: 'h3:T2V',
  mode: 't2v',
  durationSec: 5,
  aspectRatio: '16:9',
  profile: 'P24-quality',
  steps: 4,
  firstPassSteps: 4,
  motionLoraStrength: 1,
  segments: DEFAULT_VIDEO_SEGMENTS,
  referenceImages: [],
  referenceVideos: [],
  firstFrameUrl: '',
  lastFrameUrl: '',
};

/** 五段流的段数上下限（= 镜头数 1~5，报告 §8.3） */
export const SEGMENT_MIN = 1;
export const SEGMENT_MAX = 5;

/** 参考图上限（后端 validateShot 的硬约束） */
export const MAX_REFERENCE_IMAGES = 9;

/** 时长范围（后端 validateShot：1—15 秒） */
export const DURATION_MIN = 1;
export const DURATION_MAX = 15;

/** 生成模式 → 需要哪些输入 */
export const MODE_REQUIREMENTS: Readonly<
  Record<string, { first?: boolean; last?: boolean; refs?: boolean; segments?: boolean }>
> = Object.freeze({
  t2v: {},
  i2v: { first: true },
  fl2v: { first: true, last: true },
  ref: { refs: true },
  '5seg': { segments: true },
});

/** 后端 → 该后端可用的模型档位 */
export function modelOptionsForBackend(
  backend: string,
): ReadonlyArray<{ value: string; label: string }> {
  if (backend === 'seedance-cloud') {
    return SEEDANCE_MODEL_OPTIONS.map((o) => ({ value: `seedance:${o.value}`, label: o.label }));
  }
  return H3_MODEL_SLOT_OPTIONS.map((o) => ({ value: `h3:${o.value}`, label: o.label }));
}

/** 解析 `h3:U20FIGHT` → { backend: 'h3-local', slot: 'U20FIGHT' } */
export function parseModelValue(value: string): { backend: string; slot: string } {
  const idx = value.indexOf(':');
  if (idx < 0) return { backend: 'h3-local', slot: value };
  const prefix = value.slice(0, idx);
  return {
    backend: prefix === 'seedance' ? 'seedance-cloud' : 'h3-local',
    slot: value.slice(idx + 1),
  };
}

/** 段数裁剪到 1..5（NaN 兜底 1，±Infinity 夹到边界） */
export function clampSegmentCount(n: number): number {
  if (Number.isNaN(n)) return SEGMENT_MIN;
  if (n === Infinity) return SEGMENT_MAX;
  if (n === -Infinity) return SEGMENT_MIN;
  if (!Number.isFinite(n)) return SEGMENT_MIN;
  return Math.max(SEGMENT_MIN, Math.min(SEGMENT_MAX, Math.round(n)));
}

/** 把 segment 数组规范化成 1..5 段（index 重排、空数组兜底 1 段） */
export function normalizeSegments(list: ReadonlyArray<VideoSegmentParam>): VideoSegmentParam[] {
  const sliced = list.slice(0, SEGMENT_MAX).map((s, i) => ({ ...s, index: i + 1 }));
  if (sliced.length === 0) return [{ index: 1, prompt: '', durationSec: 5 }];
  return sliced;
}

/** 增加一段（到上限则原样返回） */
export function addSegment(list: ReadonlyArray<VideoSegmentParam>): VideoSegmentParam[] {
  if (list.length >= SEGMENT_MAX) return list.slice();
  return [...list, { index: list.length + 1, prompt: '', durationSec: 5 }];
}

/** 删除第 idx 段（到下限则原样返回），并重排 index */
export function removeSegmentAt(
  list: ReadonlyArray<VideoSegmentParam>,
  idx: number,
): VideoSegmentParam[] {
  if (list.length <= SEGMENT_MIN) return list.slice();
  if (idx < 0 || idx >= list.length) return list.slice();
  return list
    .filter((_, i) => i !== idx)
    .map((s, i) => ({ ...s, index: i + 1 }));
}

/** 改某段提示词 */
export function withSegmentPrompt(
  list: ReadonlyArray<VideoSegmentParam>,
  idx: number,
  prompt: string,
): VideoSegmentParam[] {
  return list.map((s, i) => (i === idx ? { ...s, prompt } : s));
}

/**
 * 参数校验：返回人话警告列表（空数组 = 可以生成）。
 * 规则全部来自后端 validateShot + 报告 §8.3，前端提前提示，避免提交后才报错。
 */
export function validateVideoParams(params: Record<string, unknown> | undefined): string[] {
  const warnings: string[] = [];
  const mode = paramStr(params, 'mode', 't2v');
  const req = MODE_REQUIREMENTS[mode] ?? {};
  const first = paramStr(params, 'firstFrameUrl');
  const last = paramStr(params, 'lastFrameUrl');
  const refs = paramList(params, 'referenceImages');
  const segs = paramSegments(params, 'segments', DEFAULT_VIDEO_SEGMENTS);

  const duration = paramNum(params, 'durationSec', 5);
  if (!Number.isFinite(duration) || duration < DURATION_MIN || duration > DURATION_MAX) {
    warnings.push(`时长需为 ${DURATION_MIN}—${DURATION_MAX} 秒`);
  }

  if (refs.length > MAX_REFERENCE_IMAGES) {
    warnings.push(`参考图 ${refs.length} 张，超过 ${MAX_REFERENCE_IMAGES} 张上限`);
  }

  if (req.first && !first) warnings.push('当前模式需要首帧图片');
  if (req.last && !last) warnings.push('当前模式需要尾帧图片');
  if (req.refs && refs.length === 0) warnings.push('全能参考模式至少需要 1 张参考图');
  if (req.segments) {
    if (segs.length < SEGMENT_MIN || segs.length > SEGMENT_MAX) {
      warnings.push(`五段流段数需为 ${SEGMENT_MIN}—${SEGMENT_MAX}`);
    }
    const empty = segs.filter((s) => !s.prompt.trim()).length;
    if (empty > 0) warnings.push(`五段流有 ${empty} 段未填提示词`);
  }

  const model = paramStr(params, 'model', 'h3:T2V');
  const { slot } = parseModelValue(model);
  // 档位与模式不一致是最高频误配，提前提示
  if (slot === '5SEG' && mode !== '5seg') warnings.push('模型选了 5SEG，建议把模式切到「五段流」');
  if (mode === '5seg' && slot !== '5SEG') warnings.push('五段流模式建议选 5SEG 档位');
  if (slot === 'FLF' && mode !== 'fl2v' && mode !== 'ref') warnings.push('FLF 档位需要首尾帧模式');

  return warnings;
}

/** 汇总节点头部徽标要显示的信息（纯函数，便于测试） */
export interface VideoSummary {
  backendLabel: string;
  backend: string;
  model: string;
  mode: string;
  segmentCount: number;
  filledSegments: number;
  refCount: number;
  duration: number;
  ratio: string;
}

export function summarizeVideoParams(params: Record<string, unknown> | undefined): VideoSummary {
  const backend = paramStr(params, 'backend', 'h3-local');
  const model = paramStr(params, 'model', 'h3:T2V');
  const mode = paramStr(params, 'mode', 't2v');
  const segs = paramSegments(params, 'segments', DEFAULT_VIDEO_SEGMENTS);
  return {
    backend,
    backendLabel: backend === 'seedance-cloud' ? 'Seedance' : 'H3',
    model,
    mode,
    segmentCount: segs.length,
    filledSegments: segs.filter((s) => s.prompt.trim()).length,
    refCount: paramList(params, 'referenceImages').length,
    duration: paramNum(params, 'durationSec', 5),
    ratio: paramStr(params, 'aspectRatio', '16:9'),
  };
}