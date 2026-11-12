/**
 * 端口类型系统单测（本任务最重要的一组）。
 *
 * 运行：node --import ./tests/register.mjs tests/portTypes.test.mjs
 *
 * 覆盖要求（任务书）：isConnectable 至少 8 组正/反用例。这里给了 20+ 组，
 * 外加矩阵对称性、'none' 哨兵、端口表完整性、handle 解析。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCEPTS,
  PORT_KINDS,
  isConnectable,
  explainConnect,
  compatibleTargetKinds,
  compatibleSourceKinds,
  NODE_PORTS,
  portsOf,
  portKindOf,
  findPort,
  isConnectableHandles,
  canConnectNodeTypes,
  targetOptionsForHandle,
  targetNodeTypesForHandle,
  targetNodeTypesFor,
  sourceNodeTypesFor,
} from '../src/canvas/portTypes.ts';
import { NODE_TYPE_KEYS } from '../src/canvas/nodeKeys.ts';

/* ========================================================================== */
/* 一、isConnectable 的正/反用例（至少 8 组）                                   */
/* ========================================================================== */

test('isConnectable 正向：图片 → 图片端口（参考图）', () => {
  assert.equal(isConnectable('image', 'image'), true);
});

test('isConnectable 正向：文本 → 文本端口（提示词）', () => {
  assert.equal(isConnectable('text', 'text'), true);
});

test('isConnectable 正向：视频 → 视频端口', () => {
  assert.equal(isConnectable('video', 'video'), true);
});

test('isConnectable 正向：音频 → 音频端口', () => {
  assert.equal(isConnectable('audio', 'audio'), true);
});

test('isConnectable 正向：全景图 → 图片端口（equirect 当素材用）', () => {
  assert.equal(isConnectable('panorama', 'image'), true);
});

test('isConnectable 正向：资产 → 图片端口（资产自带代表图）', () => {
  assert.equal(isConnectable('asset', 'image'), true);
});

test('isConnectable 正向：姿势 → 图片端口（姿势渲染图）', () => {
  assert.equal(isConnectable('pose', 'image'), true);
});

test('isConnectable 正向：图片 → 姿态台的图片口（角色图）', () => {
  // 姿势台的"载入角色图"走 in:image，不是 in:pose（见下一条反向用例）
  assert.equal(isConnectable('image', 'image'), true);
  assert.equal(
    isConnectableHandles('uploadNode', 'out:image', 'poseStudioNode', 'in:image'),
    true,
  );
});

test('isConnectable 反向：图片 ✗ 姿势端口（位图不是骨架数据）', () => {
  assert.equal(isConnectable('image', 'pose'), false);
});

test('isConnectable 正向：图片 → 全景端口（自拼 equirect 进查看器）', () => {
  assert.equal(isConnectable('image', 'panorama'), true);
});

test('isConnectable 正向：全景 → 全景端口', () => {
  assert.equal(isConnectable('panorama', 'panorama'), true);
});

test('isConnectable 正向：资产 → 资产端口（导演台选角）', () => {
  assert.equal(isConnectable('asset', 'asset'), true);
});

/* --- 反向：类型不匹配必须拒绝 --- */

test('isConnectable 反向：文本 ✗ 图片端口', () => {
  assert.equal(isConnectable('text', 'image'), false);
});

test('isConnectable 反向：图片 ✗ 文本端口', () => {
  assert.equal(isConnectable('image', 'text'), false);
});

test('isConnectable 反向：图片 ✗ 视频端口（图→视频要走首帧，不做隐式转换）', () => {
  assert.equal(isConnectable('image', 'video'), false);
});

test('isConnectable 反向：视频 ✗ 图片端口', () => {
  assert.equal(isConnectable('video', 'image'), false);
});

test('isConnectable 反向：音频 ✗ 文本端口', () => {
  assert.equal(isConnectable('audio', 'text'), false);
});

test('isConnectable 反向：文本 ✗ 音频端口', () => {
  assert.equal(isConnectable('text', 'audio'), false);
});

test('isConnectable 反向：视频 ✗ 音频端口', () => {
  assert.equal(isConnectable('video', 'audio'), false);
});

test('isConnectable 反向：资产 ✗ 文本端口', () => {
  assert.equal(isConnectable('asset', 'text'), false);
});

test('isConnectable 反向：姿势 ✗ 视频端口', () => {
  assert.equal(isConnectable('pose', 'video'), false);
});

test('isConnectable 反向：全景 ✗ 视频端口', () => {
  assert.equal(isConnectable('panorama', 'video'), false);
});

/* --- none 哨兵 --- */

test("'none' 永远不可连（含 none→none）", () => {
  for (const k of PORT_KINDS) {
    assert.equal(isConnectable('none', k), false, `none → ${k} 应为 false`);
    assert.equal(isConnectable(k, 'none'), false, `${k} → none 应为 false`);
  }
});

/* ========================================================================== */
/* 二、矩阵一致性                                                               */
/* ========================================================================== */

test('ACCEPTS 覆盖全部 8 种 PortKind，且不含未知类型', () => {
  assert.deepEqual(Object.keys(ACCEPTS).sort(), [...PORT_KINDS].sort());
  for (const [target, sources] of Object.entries(ACCEPTS)) {
    for (const s of sources) {
      assert.ok(
        PORT_KINDS.includes(s),
        `ACCEPTS[${target}] 含未知来源类型 ${s}`,
      );
    }
  }
});

test('ACCEPTS[target] 不含 none，且自身不含 none 键以外的自反误配', () => {
  for (const [target, sources] of Object.entries(ACCEPTS)) {
    assert.ok(!sources.includes('none'), `ACCEPTS[${target}] 不该包含 none`);
  }
});

test('compatibleTargetKinds 与 isConnectable 完全一致', () => {
  for (const src of PORT_KINDS) {
    const listed = compatibleTargetKinds(src);
    for (const dst of PORT_KINDS) {
      assert.equal(
        listed.includes(dst),
        isConnectable(src, dst),
        `compatibleTargetKinds(${src}) 与 isConnectable 在 ${dst} 上不一致`,
      );
    }
  }
});

test('compatibleSourceKinds 与 isConnectable 完全一致', () => {
  for (const dst of PORT_KINDS) {
    const listed = compatibleSourceKinds(dst);
    for (const src of PORT_KINDS) {
      assert.equal(
        listed.includes(src),
        isConnectable(src, dst),
        `compatibleSourceKinds(${dst}) 与 isConnectable 在 ${src} 上不一致`,
      );
    }
  }
});

test('explainConnect 的 ok 与 isConnectable 一致，且失败必给原因', () => {
  for (const src of PORT_KINDS) {
    for (const dst of PORT_KINDS) {
      const v = explainConnect(src, dst);
      assert.equal(v.ok, isConnectable(src, dst), `${src}→${dst}`);
      assert.equal(typeof v.reason, 'string');
      assert.ok(v.reason.length > 0, `${src}→${dst} 原因不该为空`);
    }
  }
});

/* ========================================================================== */
/* 三、26 节点端口表完整性                                                      */
/* ========================================================================== */

test('NODE_PORTS 恰好声明 26 个节点，与 NODE_TYPE_KEYS 一一对应', () => {
  const declared = Object.keys(NODE_PORTS).sort();
  const expected = [...NODE_TYPE_KEYS].sort();
  assert.equal(declared.length, 26, '端口表应有 26 项');
  assert.deepEqual(declared, expected, '端口表 key 必须与 nodeKeys 完全一致');
});

test('每个节点的端口 id 唯一、kind 合法、label 非空', () => {
  for (const [type, spec] of Object.entries(NODE_PORTS)) {
    const all = [...spec.inputs, ...spec.outputs];
    const ids = all.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${type} 端口 id 重复`);
    for (const p of all) {
      assert.ok(PORT_KINDS.includes(p.kind), `${type}.${p.id} kind=${p.kind} 非法`);
      assert.ok(p.label && p.label.length > 0, `${type}.${p.id} label 为空`);
      // 端口 id 前缀必须与方向一致（约定，便于调试）
      const expectedPrefix = spec.inputs.includes(p) ? 'in:' : 'out:';
      assert.ok(p.id.startsWith(expectedPrefix), `${type}.${p.id} 前缀应为 ${expectedPrefix}`);
    }
  }
});

test('has-port 节点：生成类节点至少一个输出口', () => {
  const generative = [
    'agentGenNode',
    'imageNode',
    'aiTextNode',
    'aiVoiceGenerationNode',
    'extractVoiceNode',
    'extractCharacterNode',
    'extractSceneNode',
    'extractItemNode',
    'storyboardGenNode',
    'videoGeneratorNode',
    'panoramaNode',
    'episodeSubCanvasNode',
    'backgroundMusicNode',
  ];
  for (const type of generative) {
    const spec = portsOf(type);
    assert.ok(spec.outputs.length > 0, `${type} 应有输出口`);
  }
});

test('无端口节点只有 textAnnotationNode / groupNode', () => {
  const empty = Object.entries(NODE_PORTS)
    .filter(([, s]) => s.inputs.length === 0 && s.outputs.length === 0)
    .map(([k]) => k)
    .sort();
  assert.deepEqual(empty, ['groupNode', 'textAnnotationNode']);
});

test('上传类节点零输入、单输出', () => {
  for (const [type, kind] of [
    ['uploadNode', 'image'],
    ['audioUploadNode', 'audio'],
    ['uploadVideoNode', 'video'],
  ]) {
    const spec = portsOf(type);
    assert.equal(spec.inputs.length, 0, `${type} 不该有输入口`);
    assert.equal(spec.outputs.length, 1, `${type} 应有 1 个输出口`);
    assert.equal(spec.outputs[0].kind, kind);
  }
});

test('videoGeneratorNode 有首尾帧 / 参考图 / 参考视频 / 音频 / 文本五类输入', () => {
  const spec = portsOf('videoGeneratorNode');
  const kinds = spec.inputs.map((p) => p.kind);
  assert.ok(kinds.includes('text'), '缺提示词输入');
  assert.ok(spec.inputs.some((p) => p.id === 'in:firstFrame'), '缺首帧');
  assert.ok(spec.inputs.some((p) => p.id === 'in:lastFrame'), '缺尾帧');
  assert.ok(spec.inputs.some((p) => p.id === 'in:refImage'), '缺参考图');
  assert.ok(spec.inputs.some((p) => p.id === 'in:refVideo'), '缺参考视频');
  assert.ok(spec.inputs.some((p) => p.id === 'in:audio'), '缺配音');
  assert.deepEqual(
    spec.outputs.map((p) => p.kind).sort(),
    ['image', 'video'],
    '视频节点应输出视频 + 尾帧',
  );
});

/* ========================================================================== */
/* 四、handle 解析 / 节点级连通判定                                             */
/* ========================================================================== */

test('findPort：显式 handleId 精确匹配', () => {
  assert.equal(findPort('videoGeneratorNode', 'in:lastFrame', 'in')?.kind, 'image');
  assert.equal(findPort('videoGeneratorNode', 'out:video', 'out')?.kind, 'video');
});

test('findPort：handleId 为空退回该方向第一个端口', () => {
  assert.equal(findPort('uploadNode', null, 'out')?.id, 'out:image');
  assert.equal(findPort('exportImageNode', undefined, 'in')?.id, 'in:image');
});

test('findPort：方向反了返回 null', () => {
  assert.equal(findPort('uploadNode', 'out:image', 'in'), null);
  assert.equal(findPort('textAnnotationNode', null, 'in'), null);
  assert.equal(findPort('textAnnotationNode', null, 'out'), null);
});

test('findPort：未知节点类型安全返回 null', () => {
  assert.equal(findPort('noSuchNode', null, 'out'), null);
  assert.equal(portKindOf('noSuchNode', null, 'in'), 'none');
});

test('isConnectableHandles：uploadNode.out:image → videoGeneratorNode.in:firstFrame', () => {
  assert.equal(isConnectableHandles('uploadNode', 'out:image', 'videoGeneratorNode', 'in:firstFrame'), true);
});

test('isConnectableHandles：uploadNode.out:image ✗ videoGeneratorNode.in:text', () => {
  assert.equal(isConnectableHandles('uploadNode', 'out:image', 'videoGeneratorNode', 'in:text'), false);
});

test('isConnectableHandles：aiTextNode.out:text → videoGeneratorNode.in:text', () => {
  assert.equal(isConnectableHandles('aiTextNode', 'out:text', 'videoGeneratorNode', 'in:text'), true);
});

test('isConnectableHandles：audioUploadNode.out:audio ✗ imageNode.in:image', () => {
  assert.equal(isConnectableHandles('audioUploadNode', 'out:audio', 'imageNode', 'in:image'), false);
});

test('canConnectNodeTypes：节点级只要存在一对可连就算可连', () => {
  // 上传图片 → AI 视频：图片能进首帧/尾帧/参考图
  assert.equal(canConnectNodeTypes('uploadNode', 'videoGeneratorNode'), true);
  // AI 文本 → AI 图片：文本能进提示词
  assert.equal(canConnectNodeTypes('aiTextNode', 'imageNode'), true);
  // 上传音频 → AI 图片：无任何可连端口
  assert.equal(canConnectNodeTypes('audioUploadNode', 'imageNode'), false);
  // 标注 → 任何节点都不可连
  assert.equal(canConnectNodeTypes('textAnnotationNode', 'imageNode'), false);
  // 任何节点 → 标注也不可连
  assert.equal(canConnectNodeTypes('imageNode', 'textAnnotationNode'), false);
  // 上传图片 → 上传图片（都没有输入口）
  assert.equal(canConnectNodeTypes('uploadNode', 'uploadNode'), false);
});

/* ========================================================================== */
/* 五、"拖线到空白处只列出能连上的节点" —— 核心产品行为                            */
/* ========================================================================== */

test('上传图片的输出只能接图片类输入（不该出现音频/文本节点）', () => {
  const types = targetNodeTypesForHandle('uploadNode', 'out:image');
  // 行动点：回归时把这条当成产品契约
  assert.ok(types.includes('imageNode'), '应能接 AI 图片');
  assert.ok(types.includes('videoGeneratorNode'), '应能接 AI 视频（首帧）');
  assert.ok(types.includes('exportImageNode'), '应能接结果图片');
  assert.ok(types.includes('panoramaViewerBNode'), '应能接全景查看器');
  assert.ok(!types.includes('aiVoiceGenerationNode'), '不该接 AI 音色');
  assert.ok(!types.includes('backgroundMusicNode'), '不该接背景音乐');
  assert.ok(!types.includes('uploadNode'), '上传节点没有输入口，不该出现');
  assert.ok(!types.includes('textAnnotationNode'), '标注节点没有端口，不该出现');
  assert.ok(!types.includes('groupNode'), '分组节点没有端口，不该出现');
});

test('文本输出只能接文本输入', () => {
  const types = targetNodeTypesForHandle('aiTextNode', 'out:text');
  assert.ok(types.includes('imageNode'), 'AI 图片有提示词输入');
  assert.ok(types.includes('videoGeneratorNode'), 'AI 视频有提示词输入');
  assert.ok(types.includes('storyboardGenNode'), '分镜生成有提示词输入');
  assert.ok(types.includes('backgroundMusicNode'), '背景音乐有剧本输入');
  assert.ok(!types.includes('uploadNode'), '上传节点无输入');
  assert.ok(!types.includes('exportVideoNode'), '结果视频只接视频');
  assert.ok(!types.includes('vr360PanoramaNode'), '全景 A 只接全景');
});

test('音频输出只接音频输入（AI 音色是文本→音频，不收音频）', () => {
  const types = targetNodeTypesForHandle('audioUploadNode', 'out:audio');
  assert.deepEqual(
    types.sort(),
    ['extractVoiceNode', 'videoGeneratorNode'].sort(),
    '音频应只进 提取音色（绑定已有音频）/ AI 视频配音',
  );
  // 反向确认：AI 音色的输入口是文本，接不住音频
  assert.equal(
    isConnectableHandles('audioUploadNode', 'out:audio', 'aiVoiceGenerationNode', 'in:text'),
    false,
  );
});

test('视频输出只进视频输入', () => {
  const types = targetNodeTypesForHandle('videoGeneratorNode', 'out:video');
  assert.deepEqual(types.sort(), ['agentGenNode', 'episodeSubCanvasNode', 'exportVideoNode', 'videoGeneratorNode'].sort());
});

test('资产输出：必达资产端口（导演台/预演），且可降级当图片参考', () => {
  const types = targetNodeTypesForHandle('extractCharacterNode', 'out:asset');
  // 资产端口只有两个节点收（导演台选角、白模预演）
  assert.ok(types.includes('blueprintNode'), '应能进导演台');
  assert.ok(types.includes('previzNode'), '应能进白模预演');
  // 资产自带代表图 → 也能进图片端口（这是显式设计，见 ACCEPTS.image）
  assert.ok(types.includes('imageNode'), '资产代表图应可当 AI 图片参考');
  assert.ok(isConnectable('asset', 'image'), 'ACCEPTS.image 应包含 asset');
  // 但资产的"图"进不了纯资产端口以外的非图片口
  assert.equal(isConnectable('asset', 'video'), false);
  assert.equal(isConnectable('asset', 'text'), false);
  // 资产不会出现在"只收标题/文本"的节点菜单里
  assert.ok(!types.includes('backgroundMusicNode'));
  assert.ok(!types.includes('aiTextNode'));
});

test('全景输出进全景端口 + 图片端口', () => {
  const types = targetNodeTypesForHandle('panoramaNode', 'out:panorama');
  assert.ok(types.includes('vr360PanoramaNode'), '应能进全景 A');
  assert.ok(types.includes('panoramaViewerBNode'), '应能进全景 B');
  assert.ok(types.includes('imageNode'), '全景当参考图进 AI 图片');
});

test('targetOptionsForHandle 返回具体 handleId，可直接落线', () => {
  const options = targetOptionsForHandle('uploadNode', 'out:image');
  const video = options.find((o) => o.nodeType === 'videoGeneratorNode');
  assert.ok(video, '应给出 videoGeneratorNode 的落线选项');
  assert.ok(
    ['in:firstFrame', 'in:lastFrame', 'in:refImage'].includes(video.handleId),
    `落线 handle 应为首帧/尾帧/参考图，实际 ${video.handleId}`,
  );
  assert.equal(video.handleKind, 'image');
});

test('无端口的源返回空候选（不会列出任何节点）', () => {
  assert.deepEqual(targetOptionsForHandle('textAnnotationNode', null), []);
  assert.deepEqual(targetNodeTypesForHandle('groupNode', null), []);
});

test('targetNodeTypesFor / sourceNodeTypesFor 互为反查', () => {
  for (const src of NODE_TYPE_KEYS) {
    const targets = targetNodeTypesFor(src);
    for (const t of targets) {
      assert.ok(
        sourceNodeTypesFor(t).includes(src),
        `${src} → ${t} 存在，但反查 ${t} 的来源里没有 ${src}`,
      );
    }
  }
});

/* ========================================================================== */
/* 六、端到端：几组真实的官方工作流路径                                          */
/* ========================================================================== */

test('官方工作流：上传图片 → AI 图片 → 结果图片（全链路可连）', () => {
  assert.equal(isConnectableHandles('uploadNode', 'out:image', 'imageNode', 'in:image'), true);
  assert.equal(isConnectableHandles('imageNode', 'out:image', 'exportImageNode', 'in:image'), true);
});

test('官方工作流：上传图片 → AI 视频(首帧) → 结果视频（全链路可连）', () => {
  assert.equal(
    isConnectableHandles('uploadNode', 'out:image', 'videoGeneratorNode', 'in:firstFrame'),
    true,
  );
  assert.equal(
    isConnectableHandles('videoGeneratorNode', 'out:video', 'exportVideoNode', 'in:video'),
    true,
  );
});

test('官方工作流：AI 文本 → AI 音色 → AI 视频配音（全链路可连）', () => {
  assert.equal(
    isConnectableHandles('aiTextNode', 'out:text', 'aiVoiceGenerationNode', 'in:text'),
    true,
  );
  assert.equal(
    isConnectableHandles('aiVoiceGenerationNode', 'out:audio', 'videoGeneratorNode', 'in:audio'),
    true,
  );
});

test('官方工作流：AI 图片 → 全景生成 → 全景查看器 B', () => {
  assert.equal(isConnectableHandles('imageNode', 'out:image', 'panoramaNode', 'in:image'), true);
  // 全景生成输出 panorama，进查看器 B 的 panorama 输入
  assert.equal(
    isConnectableHandles('panoramaNode', 'out:panorama', 'panoramaViewerBNode', 'in:panorama'),
    true,
  );
});

test('官方工作流：提取角色 → 资产 → 白模预演', () => {
  assert.equal(
    isConnectableHandles('extractCharacterNode', 'out:asset', 'previzNode', 'in:asset'),
    true,
  );
});

test('官方工作流：姿势台 → 白模预演姿势口', () => {
  assert.equal(isConnectableHandles('poseStudioNode', 'out:pose', 'previzNode', 'in:pose'), true);
  // 反向不行：预演不产出姿势
  assert.equal(isConnectableHandles('previzNode', 'out:image', 'poseStudioNode', 'in:pose'), false);
});

test('尾帧继承：AI 视频的 out:lastFrame 可进下一镜的 in:firstFrame', () => {
  assert.equal(
    isConnectableHandles('videoGeneratorNode', 'out:lastFrame', 'videoGeneratorNode', 'in:firstFrame'),
    true,
  );
});