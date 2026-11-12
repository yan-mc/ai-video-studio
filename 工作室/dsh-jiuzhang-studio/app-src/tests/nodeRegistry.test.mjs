/**
 * 注册表 + 端口表 + nodeTypes 映射的一致性单测。
 *
 * 这是"26 项"验收的自动化证据：
 *   · NODE_TYPE_KEYS 恰好 26 个，与后端 NODE_TYPES 逐字一致；
 *   · NODE_REGISTRY / NODE_PORTS / nodeTypes 三处 key 集合完全相等；
 *   · 每个节点有默认尺寸、参数、图标、分组；
 *   · 默认参数能取出来且可 JSON 序列化（存进 projects.json 的前提）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { NODE_TYPE_KEYS, NODE_LABELS, isNodeTypeKey, defaultNodeLabel } from '../src/canvas/nodeKeys.ts';
import {
  NODE_DEFINITIONS,
  NODE_REGISTRY,
  getDefinition,
  definitionsByCategory,
  defaultParams,
  defaultNodeData,
  validateRegistry,
  nodeDefaultLabel,
  paramGroupsFor,
  selectLabelOf,
  VIDEO_MODEL_OPTIONS,
  H3_MODEL_SLOT_OPTIONS,
} from '../src/canvas/nodeRegistry.ts';
import { NODE_PORTS } from '../src/canvas/portTypes.ts';
import { NODE_CATEGORIES, NODE_CATEGORY_LABELS } from '../src/canvas/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ========================================================================== */
/* 一、26 项验收                                                               */
/* ========================================================================== */

test('NODE_TYPE_KEYS 恰好 26 个且无重复', () => {
  assert.equal(NODE_TYPE_KEYS.length, 26, `实际 ${NODE_TYPE_KEYS.length} 个`);
  assert.equal(new Set(NODE_TYPE_KEYS).size, 26, '存在重复 key');
});

test('26 个 type key 与任务书清单逐字一致', () => {
  const expected = [
    'uploadNode', 'audioUploadNode', 'uploadVideoNode',
    'agentGenNode', 'imageNode', 'aiTextNode',
    'aiVoiceGenerationNode', 'extractVoiceNode',
    'extractCharacterNode', 'extractSceneNode', 'extractItemNode',
    'exportImageNode', 'exportVideoNode', 'textAnnotationNode',
    'groupNode', 'storyboardNode', 'storyboardGenNode',
    'videoGeneratorNode', 'vr360PanoramaNode', 'panoramaViewerBNode', 'panoramaNode',
    'episodeSubCanvasNode', 'backgroundMusicNode',
    'blueprintNode', 'previzNode', 'poseStudioNode',
  ];
  assert.equal(expected.length, 26, '清单自身应为 26 项');
  assert.deepEqual([...NODE_TYPE_KEYS].sort(), [...expected].sort());
  // 顺序也要一致（便于与后端 NODE_TYPES 对照）
  assert.deepEqual([...NODE_TYPE_KEYS], expected);
});

test('注册表恰好 26 项，且 key 集合与 NODE_TYPE_KEYS 完全相等', () => {
  assert.equal(NODE_DEFINITIONS.length, 26);
  assert.equal(Object.keys(NODE_REGISTRY).length, 26);
  assert.deepEqual(Object.keys(NODE_REGISTRY).sort(), [...NODE_TYPE_KEYS].sort());
});

test('端口表恰好 26 项，key 集合与注册表相等', () => {
  assert.equal(Object.keys(NODE_PORTS).length, 26);
  assert.deepEqual(Object.keys(NODE_PORTS).sort(), Object.keys(NODE_REGISTRY).sort());
});

test('validateRegistry() 无问题（自检通过）', () => {
  const problems = validateRegistry();
  assert.deepEqual(problems, [], `注册表自检报错：\n${problems.join('\n')}`);
});

/* ========================================================================== */
/* 二、后端口径一致（type key 必须与 NODE_TYPES 完全一致）                        */
/* ========================================================================== */

test('若后端 models.js 可达，则 type key 集合与 NODE_TYPES 完全一致', (t) => {
  const backendPath = path.resolve(HERE, '../../dsh-jiuzhang-studio/host/store/models.js');
  let source;
  try {
    source = readFileSync(backendPath, 'utf8');
  } catch {
    t.skip(`后端 models.js 不在预期位置（${backendPath}），跳过后端口径校验`);
    return;
  }
  const m = source.match(/export const NODE_TYPES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(m, '后端 models.js 里找不到 NODE_TYPES 定义（期望 Object.freeze([...])）');
  const backendKeys = [...m[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]);
  assert.equal(backendKeys.length, 26, `后端 NODE_TYPES 应为 26 项，实际 ${backendKeys.length}`);
  assert.deepEqual([...NODE_TYPE_KEYS].sort(), [...backendKeys].sort(), 'type key 必须与后端完全一致');

  // 同时校验中文名（NODE_LABELS）—— 后端是 Object.freeze({ ... }) 单行多键写法
  const labelMatch = source.match(/export const NODE_LABELS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
  assert.ok(labelMatch, '后端 models.js 里找不到 NODE_LABELS 定义');
  for (const key of backendKeys) {
    const re = new RegExp(`${key}\\s*:\\s*'([^']*)'`);
    const lm = labelMatch[1].match(re);
    if (!lm) continue; // 后端可能用变量/别名写法，跳过单项
    assert.equal(
      NODE_LABELS[key],
      lm[1],
      `${key} 的中文名与后端不一致：前端「${NODE_LABELS[key]}」后端「${lm[1]}」`,
    );
  }
});

test('若反编译 node-types.json 可达，则 26 个 type key 全部出现在其中', (t) => {
  const artifactsPath = path.resolve(
    HERE,
    '../../../功能拆解/预演软件/03_反编译与代码/主UI_节点画布/artifacts/node-types.json',
  );
  let raw;
  try {
    raw = readFileSync(artifactsPath, 'utf8');
  } catch {
    t.skip('反编译产物不在预期位置，跳过');
    return;
  }
  for (const key of NODE_TYPE_KEYS) {
    assert.ok(raw.includes(`"${key}"`), `node-types.json 里缺少 ${key}`);
  }
});

/* ========================================================================== */
/* 三、每个节点的定义完整性                                                    */
/* ========================================================================== */

test('每个定义都有：默认标题、短标签、图标、分组、描述、尺寸、tone', () => {
  for (const def of NODE_DEFINITIONS) {
    assert.ok(def.label && def.label.length > 0, `${def.type} 缺默认标题`);
    assert.ok(def.shortLabel && def.shortLabel.length > 0, `${def.type} 缺短标签`);
    assert.ok(def.icon && def.icon.length > 0, `${def.type} 缺图标`);
    assert.ok(NODE_CATEGORIES.includes(def.category), `${def.type} 分组 ${def.category} 非法`);
    assert.ok(def.description && def.description.length > 0, `${def.type} 缺描述`);
    assert.ok(def.size.width > 0 && def.size.height > 0, `${def.type} 尺寸非法`);
    assert.ok(def.tone && def.tone.length > 0, `${def.type} 缺 tone`);
  }
});

test('每个节点（除画布辅助）都有参数字段，且字段 key 唯一', () => {
  for (const def of NODE_DEFINITIONS) {
    if (def.category === 'structure') continue;
    assert.ok(def.fields.length > 0, `${def.type} 没有任何参数`);
    const keys = def.fields.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, `${def.type} 参数 key 重复：${keys.join(',')}`);
  }
});

test('参数默认值可取出，且能 JSON 序列化（存 projects.json 的前提）', () => {
  for (const def of NODE_DEFINITIONS) {
    const params = defaultParams(def);
    const json = JSON.stringify(params);
    assert.ok(json.length > 0);
    assert.deepEqual(JSON.parse(json), params, `${def.type} 默认参数序列化后不一致`);
  }
});

test('defaultNodeData 产出可序列化的 data（含 status/params）', () => {
  for (const key of NODE_TYPE_KEYS) {
    const data = defaultNodeData(key);
    const round = JSON.parse(JSON.stringify(data));
    assert.deepEqual(round, data, `${key} 默认 data 序列化后不一致`);
    assert.equal(data.status, 'idle');
    assert.ok(typeof data.params === 'object' && data.params !== null);
  }
});

test('图标名都是设计系统 Icon 的合法子集（不会渲染成空白）', async () => {
  // 动态 import 会牵进 React 组件；这里改为读文件正则校验，避免 node 加载 tsx
  const iconSrc = readFileSync(path.resolve(HERE, '../src/ui/Icon.tsx'), 'utf8');
  const names = new Set([...iconSrc.matchAll(/\|\s*'([a-zA-Z]+)'/g)].map((x) => x[1]));
  for (const def of NODE_DEFINITIONS) {
    assert.ok(names.has(def.icon), `${def.type} 的图标 ${def.icon} 不在 Icon 集合里`);
  }
});

test('分组归类：8 个分类都有节点，且分类标签齐全', () => {
  const groups = definitionsByCategory();
  assert.equal(groups.length, NODE_CATEGORIES.length, '每个分类都应有节点');
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  assert.equal(total, 26);
  for (const c of NODE_CATEGORIES) {
    assert.ok(NODE_CATEGORY_LABELS[c], `分类 ${c} 缺标签`);
  }
});

test('getDefinition / nodeDefaultLabel 对未知类型安全降级', () => {
  assert.equal(getDefinition('noSuchNode'), undefined);
  assert.equal(nodeDefaultLabel('noSuchNode'), 'noSuchNode');
  assert.equal(defaultNodeLabel('noSuchNode'), 'noSuchNode');
  assert.equal(isNodeTypeKey('noSuchNode'), false);
  assert.equal(isNodeTypeKey('imageNode'), true);
});

/* ========================================================================== */
/* 四、videoGeneratorNode —— 重点验收                                           */
/* ========================================================================== */

test('videoGeneratorNode 覆盖任务书要求的全部参数面', () => {
  const def = getDefinition('videoGeneratorNode');
  assert.ok(def, '缺 videoGeneratorNode 定义');
  const keys = def.fields.map((f) => f.key);
  // 模型选择 / 后端
  assert.ok(keys.includes('backend'), '缺后端选择');
  assert.ok(keys.includes('model'), '缺模型选择');
  // 首尾帧
  assert.ok(keys.includes('firstFrameUrl'), '缺首帧');
  assert.ok(keys.includes('lastFrameUrl'), '缺尾帧');
  // 参考图
  assert.ok(keys.includes('referenceImages'), '缺参考图');
  assert.ok(keys.includes('referenceVideos'), '缺参考视频');
  // 五段流
  const seg = def.fields.find((f) => f.key === 'segments');
  assert.ok(seg, '缺五段流参数');
  assert.equal(seg.kind, 'segments');
  assert.equal(seg.min, 1, '段数下限应为 1');
  assert.equal(seg.max, 5, '段数上限应为 5');
  // 步数
  assert.ok(keys.includes('steps'), '缺总步数');
  assert.ok(keys.includes('firstPassSteps'), '缺一采步数');
  // 动作 LoRA
  const lora = def.fields.find((f) => f.key === 'motionLoraStrength');
  assert.ok(lora, '缺动作 LoRA 强度');
  assert.equal(lora.kind, 'range');
  assert.equal(lora.min, 0);
  assert.equal(lora.max, 2);
});

test('H3 模型档位恰好 19 个（后端 H3_MODEL_SLOTS）', () => {
  assert.equal(H3_MODEL_SLOT_OPTIONS.length, 19, `实际 ${H3_MODEL_SLOT_OPTIONS.length} 档`);
  assert.equal(new Set(H3_MODEL_SLOT_OPTIONS.map((o) => o.value)).size, 19, '档位 value 重复');
});

test('视频模型下拉包含 19 档 H3 + 4 档 Seedance，且 value 唯一', () => {
  const values = VIDEO_MODEL_OPTIONS.map((o) => o.value);
  assert.equal(new Set(values).size, values.length, '模型 value 重复');
  const h3 = values.filter((v) => v.startsWith('h3:'));
  const sd = values.filter((v) => v.startsWith('seedance:'));
  assert.equal(h3.length, 19, `H3 应有 19 档，实际 ${h3.length}`);
  assert.equal(sd.length, 4, `Seedance 应有 4 档，实际 ${sd.length}`);
  // 五段流档位必须在
  assert.ok(h3.includes('h3:5SEG'), '缺 5SEG 档');
});

test('视频节点参数分组覆盖全部字段（不丢参数）', () => {
  const def = getDefinition('videoGeneratorNode');
  const groups = paramGroupsFor('videoGeneratorNode');
  const covered = new Set(groups.flatMap((g) => g.fields.map((f) => f.key)));
  for (const f of def.fields) {
    assert.ok(covered.has(f.key), `参数 ${f.key} 未出现在任何分组里（会渲染不出来）`);
  }
  assert.ok(groups.length >= 5, `视频参数应分至少 5 组，实际 ${groups.length}`);
});

test('非视频节点的参数分组是单组（不做多余分组）', () => {
  const groups = paramGroupsFor('imageNode');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, '参数');
});

test('selectLabelOf 能取到显示名，未命中回退原值', () => {
  assert.equal(selectLabelOf('agentGenNode', 'target', 'video'), '视频（≤15 秒）');
  assert.equal(selectLabelOf('agentGenNode', 'target', 'nope'), 'nope');
  assert.equal(selectLabelOf('imageNode', 'size', '1024'), '1024');
});