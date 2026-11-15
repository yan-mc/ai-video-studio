/**
 * videoGeneratorNode 纯逻辑单测 —— 本任务"最复杂节点"的参数规则。
 *
 * 覆盖：
 *   · 19 档 H3 / 4 档 Seedance 的档位解析与后端映射
 *   · 五段流 1~5 段的增删边界
 *   · 时长 1~15 / 参考图 ≤9 / 模式必需输入
 *   · 档位与模式的一致性提示
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_VIDEO_PARAMS_FOR_TEST,
  SEGMENT_MIN,
  SEGMENT_MAX,
  MAX_REFERENCE_IMAGES,
  DURATION_MIN,
  DURATION_MAX,
  MODE_REQUIREMENTS,
  modelOptionsForBackend,
  parseModelValue,
  clampSegmentCount,
  normalizeSegments,
  addSegment,
  removeSegmentAt,
  withSegmentPrompt,
  validateVideoParams,
  summarizeVideoParams,
  DEFAULT_VIDEO_SEGMENTS,
} from '../src/canvas/videoParams.ts';
import { H3_MODEL_SLOT_OPTIONS, SEEDANCE_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS } from '../src/canvas/nodeRegistry.ts';

/* ========================================================================== */
/* 一、常量边界                                                                */
/* ========================================================================== */

test('五段流上下限：1 段 ~ 5 段', () => {
  assert.equal(SEGMENT_MIN, 1);
  assert.equal(SEGMENT_MAX, 5);
});

test('参考图上限 9 张（后端 validateShot 约束）', () => {
  assert.equal(MAX_REFERENCE_IMAGES, 9);
});

test('时长范围 1—15 秒', () => {
  assert.equal(DURATION_MIN, 1);
  assert.equal(DURATION_MAX, 15);
});

test('默认分段是 2 段，每段 5 秒', () => {
  assert.equal(DEFAULT_VIDEO_SEGMENTS.length, 2);
  for (const s of DEFAULT_VIDEO_SEGMENTS) assert.equal(s.durationSec, 5);
});

/* ========================================================================== */
/* 二、模型档位解析                                                            */
/* ========================================================================== */

test('parseModelValue：h3 前缀 → h3-local，档位保留', () => {
  const r = parseModelValue('h3:5SEG');
  assert.equal(r.backend, 'h3-local');
  assert.equal(r.slot, '5SEG');
});

test('parseModelValue：seedance 前缀 → seedance-cloud', () => {
  const r = parseModelValue('seedance:volc/doubao-seedance-2-5');
  assert.equal(r.backend, 'seedance-cloud');
  assert.equal(r.slot, 'volc/doubao-seedance-2-5');
});

test('parseModelValue：无前缀默认当 h3-local（容错老数据）', () => {
  const r = parseModelValue('T2V');
  assert.equal(r.backend, 'h3-local');
  assert.equal(r.slot, 'T2V');
});

test('modelOptionsForBackend：H3 返回 19 档，Seedance 返回 4 档', () => {
  const h3 = modelOptionsForBackend('h3-local');
  const sd = modelOptionsForBackend('seedance-cloud');
  assert.equal(h3.length, 19, `H3 应 19 档，实际 ${h3.length}`);
  assert.equal(sd.length, 4, `Seedance 应 4 档，实际 ${sd.length}`);
  // 全部带正确前缀
  for (const o of h3) assert.ok(o.value.startsWith('h3:'), `${o.value} 前缀不对`);
  for (const o of sd) assert.ok(o.value.startsWith('seedance:'), `${o.value} 前缀不对`);
  // value 唯一
  assert.equal(new Set([...h3, ...sd].map((o) => o.value)).size, 23);
});

test('H3 档位与后端 H3_MODEL_SLOTS 数量一致（19）', () => {
  assert.equal(H3_MODEL_SLOT_OPTIONS.length, 19);
  assert.equal(SEEDANCE_MODEL_OPTIONS.length, 4);
  // VIDEO_MODEL_OPTIONS = 19 H3 + 4 Seedance
  assert.equal(VIDEO_MODEL_OPTIONS.length, 23);
});

test('H3 档位包含官方全部 19 项（T2V/I2V/FLF/5SEG + 15 个专项）', () => {
  const values = H3_MODEL_SLOT_OPTIONS.map((o) => o.value);
  for (const must of ['T2V', 'I2V', 'FLF', '5SEG', 'U04', 'U05', 'U07', 'U09V3', 'U09V4', 'U14', 'U16', 'U17', 'U20FIGHT', 'U20FL2VA', 'U22', 'U24V2', 'U24V927', 'U28', 'U32']) {
    assert.ok(values.includes(must), `缺档位 ${must}`);
  }
});

/* ========================================================================== */
/* 三、分段操作边界                                                            */
/* ========================================================================== */

test('clampSegmentCount：越界/非法值被夹到 1..5', () => {
  assert.equal(clampSegmentCount(-3), 1);
  assert.equal(clampSegmentCount(0), 1);
  assert.equal(clampSegmentCount(3), 3);
  assert.equal(clampSegmentCount(9), 5);
  assert.equal(clampSegmentCount(NaN), 1);
  assert.equal(clampSegmentCount(Infinity), 5);
  assert.equal(clampSegmentCount(2.6), 3, '应四舍五入');
});

test('normalizeSegments：空数组兜底为 1 段', () => {
  const n = normalizeSegments([]);
  assert.equal(n.length, 1);
  assert.equal(n[0].index, 1);
});

test('normalizeSegments：超过 5 段被截断并重排 index', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ index: i + 1, prompt: `p${i}` }));
  const n = normalizeSegments(many);
  assert.equal(n.length, 5);
  assert.deepEqual(n.map((s) => s.index), [1, 2, 3, 4, 5]);
});

test('addSegment：到 5 段后不再增加', () => {
  let list = [{ index: 1, prompt: 'a' }];
  for (let i = 0; i < 10; i += 1) list = addSegment(list);
  assert.equal(list.length, SEGMENT_MAX, `最多 5 段，实际 ${list.length}`);
  // 不修改原数组（纯函数）
  const origin = [{ index: 1, prompt: 'x' }];
  addSegment(origin);
  assert.equal(origin.length, 1);
});

test('removeSegmentAt：降到 1 段后不再删除', () => {
  let list = normalizeSegments([{ index: 1, prompt: 'a' }, { index: 2, prompt: 'b' }]);
  list = removeSegmentAt(list, 0);
  assert.equal(list.length, 1);
  list = removeSegmentAt(list, 0);
  assert.equal(list.length, 1, '最少保留 1 段');
});

test('removeSegmentAt：删除中间段后 index 重排连续', () => {
  const list = normalizeSegments([
    { index: 1, prompt: 'a' },
    { index: 2, prompt: 'b' },
    { index: 3, prompt: 'c' },
  ]);
  const next = removeSegmentAt(list, 1);
  assert.equal(next.length, 2);
  assert.deepEqual(next.map((s) => s.index), [1, 2]);
  assert.deepEqual(next.map((s) => s.prompt), ['a', 'c']);
});

test('removeSegmentAt：越界索引安全返回副本', () => {
  const list = normalizeSegments([{ index: 1, prompt: 'a' }, { index: 2, prompt: 'b' }]);
  assert.equal(removeSegmentAt(list, 99).length, 2);
  assert.equal(removeSegmentAt(list, -1).length, 2);
});

test('withSegmentPrompt 只改指定段', () => {
  const list = normalizeSegments([
    { index: 1, prompt: 'a' },
    { index: 2, prompt: 'b' },
  ]);
  const next = withSegmentPrompt(list, 1, '新提示词');
  assert.deepEqual(next.map((s) => s.prompt), ['a', '新提示词']);
  assert.deepEqual(list.map((s) => s.prompt), ['a', 'b'], '不改原数组');
});

/* ========================================================================== */
/* 四、参数校验                                                                */
/* ========================================================================== */

test('t2v 模式、时长合法、无多余要求 → 无警告', () => {
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    mode: 't2v',
    model: 'h3:T2V',
    durationSec: 5,
  });
  assert.deepEqual(warnings, []);
});

test('时长越界被提示（0 / 16）', () => {
  const base = { ...DEFAULT_VIDEO_PARAMS_FOR_TEST, model: 'h3:T2V' };
  assert.ok(validateVideoParams({ ...base, durationSec: 0 }).some((w) => w.includes('时长')));
  assert.ok(validateVideoParams({ ...base, durationSec: 16 }).some((w) => w.includes('时长')));
  assert.ok(!validateVideoParams({ ...base, durationSec: 15 }).some((w) => w.includes('时长')));
});

test('参考图超过 9 张被提示', () => {
  const refs = Array.from({ length: 10 }, (_, i) => `r${i}.png`);
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    model: 'h3:T2V',
    referenceImages: refs,
  });
  assert.ok(warnings.some((w) => w.includes('参考图') && w.includes('9')), `实际 ${warnings.join(' / ')}`);
});

test('i2v 模式缺首帧被提示', () => {
  const warnings = validateVideoParams({ ...DEFAULT_VIDEO_PARAMS_FOR_TEST, mode: 'i2v', model: 'h3:I2V' });
  assert.ok(warnings.some((w) => w.includes('首帧')));
});

test('fl2v 模式缺尾帧被提示（首帧给了也要提示尾帧）', () => {
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    mode: 'fl2v',
    model: 'h3:FLF',
    firstFrameUrl: '/a.png',
  });
  assert.ok(warnings.some((w) => w.includes('尾帧')));
  // 两帧都给了就不该再提示
  const ok = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    mode: 'fl2v',
    model: 'h3:FLF',
    firstFrameUrl: '/a.png',
    lastFrameUrl: '/b.png',
  });
  assert.ok(!ok.some((w) => w.includes('首帧') || w.includes('尾帧')), `实际 ${ok.join(' / ')}`);
});

test('ref 模式无参考图被提示', () => {
  const warnings = validateVideoParams({ ...DEFAULT_VIDEO_PARAMS_FOR_TEST, mode: 'ref', model: 'h3:U20FL2VA' });
  assert.ok(warnings.some((w) => w.includes('参考图')));
});

test('5seg 模式：段数为空提示 + 空白提示词提示', () => {
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    mode: '5seg',
    model: 'h3:5SEG',
    segments: [
      { index: 1, prompt: '' },
      { index: 2, prompt: '' },
    ],
  });
  assert.ok(warnings.some((w) => w.includes('未填提示词')), `实际 ${warnings.join(' / ')}`);

  const ok = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    mode: '5seg',
    model: 'h3:5SEG',
    segments: [
      { index: 1, prompt: 'a' },
      { index: 2, prompt: 'b' },
    ],
  });
  assert.ok(!ok.some((w) => w.includes('未填')), `实际 ${ok.join(' / ')}`);
});

test('档位与模式误配被提示：选 5SEG 但模式不是五段流', () => {
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    model: 'h3:5SEG',
    mode: 't2v',
  });
  assert.ok(warnings.some((w) => w.includes('5SEG')), `实际 ${warnings.join(' / ')}`);
});

test('档位与模式误配被提示：五段流模式却没选 5SEG 档', () => {
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    model: 'h3:T2V',
    mode: '5seg',
    segments: [{ index: 1, prompt: 'a' }],
  });
  assert.ok(warnings.some((w) => w.includes('5SEG')), `实际 ${warnings.join(' / ')}`);
});

test('FLF 档位配错模式被提示', () => {
  const warnings = validateVideoParams({
    ...DEFAULT_VIDEO_PARAMS_FOR_TEST,
    model: 'h3:FLF',
    mode: 't2v',
  });
  assert.ok(warnings.some((w) => w.includes('FLF')), `实际 ${warnings.join(' / ')}`);
});

test('validateVideoParams 对 undefined 参数安全（回退默认值）', () => {
  const warnings = validateVideoParams(undefined);
  // 默认 t2v + h3:T2V + 5 秒 + 2 段 → 无警告
  assert.deepEqual(warnings, []);
});

test('MODE_REQUIREMENTS 覆盖全部 5 种模式', () => {
  assert.deepEqual(Object.keys(MODE_REQUIREMENTS).sort(), ['5seg', 'fl2v', 'i2v', 'ref', 't2v'].sort());
});

/* ========================================================================== */
/* 五、摘要                                                                    */
/* ========================================================================== */

test('summarizeVideoParams：后端名 / 段数 / 已填段数 / 参考图数', () => {
  const s = summarizeVideoParams({
    backend: 'seedance-cloud',
    model: 'seedance:volc/doubao-seedance-2-5',
    mode: '5seg',
    segments: [
      { index: 1, prompt: 'a' },
      { index: 2, prompt: '' },
      { index: 3, prompt: 'c' },
    ],
    referenceImages: ['1.png', '2.png'],
    durationSec: 8,
    aspectRatio: '9:16',
  });
  assert.equal(s.backendLabel, 'Seedance');
  assert.equal(s.segmentCount, 3);
  assert.equal(s.filledSegments, 2);
  assert.equal(s.refCount, 2);
  assert.equal(s.duration, 8);
  assert.equal(s.ratio, '9:16');
});

test('summarizeVideoParams：默认值（undefined 安全）', () => {
  const s = summarizeVideoParams(undefined);
  assert.equal(s.backendLabel, 'H3');
  assert.equal(s.segmentCount, 2);
  assert.equal(s.duration, 5);
  assert.equal(s.ratio, '16:9');
});