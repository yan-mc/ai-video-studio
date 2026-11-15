/**
 * 画布图逻辑单测：连线校验 / 分组 / 序列化 / 结果回流。
 *
 * 这里补上 portTypes 单测覆盖不到的一层：**结构约束**
 *   · 自连、重复边、成环必须被拒
 *   · 类型不兼容要给明确 code
 *   · 分组/解组的坐标换算必须可逆
 *   · 序列化→反序列化后图结构等价
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkConnection,
  isValidConnection,
  reaches,
  hasDuplicateEdge,
  createCanvasNode,
  createCanvasEdge,
  newNodeId,
  newEdgeId,
  groupSelection,
  ungroup,
  childrenOf,
  removeNodes,
  serializeNode,
  serializeEdge,
  deserializeNodes,
  deserializeEdges,
  upstreamOf,
  downstreamOf,
  collectUpstreamResult,
  displayTitle,
  isBusy,
  groupDisplayName,
} from '../src/canvas/graph.ts';

/* ========================================================================== */
/* 辅助                                                                       */
/* ========================================================================== */

function node(type, overrides = {}) {
  const n = createCanvasNode({ type, position: overrides.position ?? { x: 0, y: 0 } });
  return { ...n, ...overrides, id: overrides.id ?? n.id, data: overrides.data ?? n.data };
}

const UPLOAD = node('uploadNode', { id: 'n_upload' });
const IMAGE = node('imageNode', { id: 'n_image' });
const VIDEO = node('videoGeneratorNode', { id: 'n_video' });
const EXPORT_VIDEO = node('exportVideoNode', { id: 'n_evideo' });
const AUDIO_UP = node('audioUploadNode', { id: 'n_audio' });
const TEXT = node('aiTextNode', { id: 'n_text' });
const ANNOTATION = node('textAnnotationNode', { id: 'n_note' });

const NODES = [UPLOAD, IMAGE, VIDEO, EXPORT_VIDEO, AUDIO_UP, TEXT, ANNOTATION];

/* ========================================================================== */
/* 一、ID 生成                                                                 */
/* ========================================================================== */

test('newNodeId 唯一且带类型前缀（可读、可排查）', () => {
  const ids = new Set();
  for (let i = 0; i < 200; i += 1) ids.add(newNodeId('imageNode'));
  assert.equal(ids.size, 200, 'ID 出现碰撞');
  for (const id of ids) assert.ok(id.startsWith('nd_image_'), `ID 前缀不对：${id}`);
});

test('newEdgeId 唯一', () => {
  const ids = new Set();
  for (let i = 0; i < 200; i += 1) ids.add(newEdgeId('a', 'b'));
  assert.equal(ids.size, 200);
});

/* ========================================================================== */
/* 二、连线校验（类型层 + 结构层）                                              */
/* ========================================================================== */

test('合法连线：上传图片 out:image → AI 视频 in:firstFrame', () => {
  const result = checkConnection(NODES, [], {
    source: 'n_upload',
    target: 'n_video',
    sourceHandle: 'out:image',
    targetHandle: 'in:firstFrame',
  });
  assert.equal(result.ok, true);
});

test('自连被拒（code=self）', () => {
  const result = checkConnection(NODES, [], {
    source: 'n_image',
    target: 'n_image',
    sourceHandle: 'out:image',
    targetHandle: 'in:image',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'self');
});

test('类型不兼容被拒（code=type，且原因里带类型名）', () => {
  const result = checkConnection(NODES, [], {
    source: 'n_audio',
    target: 'n_image',
    sourceHandle: 'out:audio',
    targetHandle: 'in:image',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'type');
  assert.match(result.reason, /音频/);
  assert.match(result.reason, /图片/);
});

test('重复边被拒（同一对 handle 连两次）', () => {
  const edges = [{ source: 'n_upload', target: 'n_image', sourceHandle: 'out:image', targetHandle: 'in:image' }];
  const result = checkConnection(NODES, edges, {
    source: 'n_upload',
    target: 'n_image',
    sourceHandle: 'out:image',
    targetHandle: 'in:image',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'duplicate');
});

test('同一对节点但不同 handle 不算重复（首帧与尾帧可各连一条）', () => {
  const edges = [{ source: 'n_upload', target: 'n_video', sourceHandle: 'out:image', targetHandle: 'in:firstFrame' }];
  const result = checkConnection(NODES, edges, {
    source: 'n_upload',
    target: 'n_video',
    sourceHandle: 'out:image',
    targetHandle: 'in:lastFrame',
  });
  assert.equal(result.ok, true);
});

test('成环被拒（A→B 已存在，再加 B→A）', () => {
  const edges = [{ source: 'n_upload', target: 'n_image', sourceHandle: 'out:image', targetHandle: 'in:image' }];
  const result = checkConnection(NODES, edges, {
    source: 'n_image',
    target: 'n_upload',
    sourceHandle: 'out:image',
    targetHandle: 'in:image',
  });
  // uploadNode 没有输入口 → 类型层先拒；至少不能通过
  assert.equal(result.ok, false);
});

test('成环检测：三节点链 A→B→C 再加 C→A 被拒', () => {
  const nodes = [
    node('imageNode', { id: 'a' }),
    node('imageNode', { id: 'b' }),
    node('imageNode', { id: 'c' }),
  ];
  const edges = [
    { source: 'a', target: 'b', sourceHandle: 'out:image', targetHandle: 'in:image' },
    { source: 'b', target: 'c', sourceHandle: 'out:image', targetHandle: 'in:image' },
  ];
  const result = checkConnection(nodes, edges, {
    source: 'c',
    target: 'a',
    sourceHandle: 'out:image',
    targetHandle: 'in:image',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'cycle');
});

test('reaches：直接/间接/不可达', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];
  assert.equal(reaches(edges, 'a', 'b'), true);
  assert.equal(reaches(edges, 'a', 'c'), true, '应支持传递');
  assert.equal(reaches(edges, 'c', 'a'), false);
  assert.equal(reaches(edges, 'a', 'a'), true, '自身可达（用于闭环判定）');
  assert.equal(reaches([], 'a', 'b'), false);
});

test('hasDuplicateEdge 忽略 null/undefined handle 差异', () => {
  const edges = [{ source: 'a', target: 'b', sourceHandle: null, targetHandle: undefined }];
  assert.equal(hasDuplicateEdge(edges, { source: 'a', target: 'b', sourceHandle: null, targetHandle: null }), true);
});

test('缺端点的连接被拒（code=no-source / no-target）', () => {
  assert.equal(checkConnection(NODES, [], { source: null, target: 'n_image' }).code, 'no-source');
  assert.equal(checkConnection(NODES, [], { source: 'n_upload', target: null }).code, 'no-target');
});

test('isValidConnection 是 checkConnection 的布尔投影', () => {
  const conn = { source: 'n_upload', target: 'n_image', sourceHandle: 'out:image', targetHandle: 'in:image' };
  assert.equal(isValidConnection(NODES, [], conn), true);
  assert.equal(isValidConnection(NODES, [], { ...conn, target: 'n_audio' }), false);
});

/* ========================================================================== */
/* 三、连线创建                                                                */
/* ========================================================================== */

test('createCanvasEdge 带端口类型风格与 label（用于上色和可读性）', () => {
  const edge = createCanvasEdge(NODES, {
    source: 'n_upload',
    target: 'n_video',
    sourceHandle: 'out:image',
    targetHandle: 'in:firstFrame',
  });
  assert.equal(edge.source, 'n_upload');
  assert.equal(edge.target, 'n_video');
  assert.equal(edge.type, 'smoothstep');
  assert.equal(edge.data.sourceKind, 'image');
  assert.equal(edge.data.targetKind, 'image');
  assert.match(edge.label, /图片/);
  // 颜色必须是 CSS 变量，不能是 hex
  assert.match(edge.style.stroke, /^var\(--jz-/);
});

test('createCanvasEdge：视频连线用 warn 色，音频连线用 ok 色', () => {
  const v = createCanvasEdge(NODES, {
    source: 'n_video',
    target: 'n_evideo',
    sourceHandle: 'out:video',
    targetHandle: 'in:video',
  });
  assert.match(v.style.stroke, /warn/);
  const a = createCanvasEdge(NODES, {
    source: 'n_audio',
    target: 'n_video',
    sourceHandle: 'out:audio',
    targetHandle: 'in:audio',
  });
  assert.match(a.style.stroke, /ok/);
});

/* ========================================================================== */
/* 四、节点创建                                                                */
/* ========================================================================== */

test('createCanvasNode 使用注册表默认尺寸与默认参数', () => {
  const n = createCanvasNode({ type: 'videoGeneratorNode', position: { x: 10, y: 20 } });
  assert.equal(n.type, 'videoGeneratorNode');
  assert.equal(n.position.x, 10);
  assert.equal(n.width, 320, '应取注册表宽度');
  assert.equal(n.data.params.backend, 'h3-local', '应带默认参数');
  assert.ok(Array.isArray(n.data.params.segments), '五段流应有默认段');
  assert.equal(n.data.status, 'idle');
});

test('createCanvasNode 支持参数覆盖（合并不替换）', () => {
  const n = createCanvasNode({
    type: 'videoGeneratorNode',
    position: { x: 0, y: 0 },
    data: { params: { mode: '5seg' } },
  });
  assert.equal(n.data.params.mode, '5seg', '覆盖生效');
  assert.equal(n.data.params.backend, 'h3-local', '未覆盖的保持默认');
});

test('createCanvasNode 给子节点设置 parentId + extent=parent', () => {
  const g = createCanvasNode({ type: 'groupNode', position: { x: 0, y: 0 } });
  const child = createCanvasNode({ type: 'imageNode', position: { x: 5, y: 5 }, parentId: g.id });
  assert.equal(child.parentId, g.id);
  assert.equal(child.extent, 'parent');
});

test('groupNode 的 zIndex 为负（必须在成员下方）', () => {
  const g = createCanvasNode({ type: 'groupNode', position: { x: 0, y: 0 } });
  assert.ok((g.zIndex ?? 0) < 0);
});

/* ========================================================================== */
/* 五、分组 / 解组                                                             */
/* ========================================================================== */

test('groupSelection 需要至少 2 个节点', () => {
  assert.equal(groupSelection([UPLOAD, IMAGE], ['n_upload']), null);
  assert.equal(groupSelection([UPLOAD, IMAGE], ['n_upload', 'n_image']).nodes.length, 3);
});

test('groupSelection 把成员坐标转成相对坐标，并限定 extent=parent', () => {
  const a = node('imageNode', { id: 'ga', position: { x: 100, y: 100 } });
  const b = node('imageNode', { id: 'gb', position: { x: 400, y: 300 } });
  const result = groupSelection([a, b], ['ga', 'gb'], 20);
  assert.ok(result);
  const group = result.nodes.find((n) => n.id === result.groupId);
  assert.ok(group, '应创建分组节点');
  const a2 = result.nodes.find((n) => n.id === 'ga');
  assert.equal(a2.parentId, result.groupId);
  assert.equal(a2.extent, 'parent');
  assert.ok(a2.position.x < 100, '相对坐标应比绝对坐标小');
  // 分组包围盒应覆盖两个成员
  assert.ok(group.position.x <= 100 - 20);
  assert.ok((group.width ?? 0) >= 300);
});

test('groupSelection 跳过已有 parentId 的节点（不跨组嵌套）', () => {
  const a = node('imageNode', { id: 'pa', parentId: 'existing' });
  const b = node('imageNode', { id: 'pb' });
  const c = node('imageNode', { id: 'pc' });
  const result = groupSelection([a, b, c], ['pa', 'pb', 'pc']);
  assert.ok(result);
  const pa = result.nodes.find((n) => n.id === 'pa');
  assert.equal(pa.parentId, 'existing', '已有父节点的成员不该被改父');
});

test('groupSelection 跳过 groupNode 自身（不允许组套组）', () => {
  const g = node('groupNode', { id: 'gg' });
  const b = node('imageNode', { id: 'nb' });
  const c = node('imageNode', { id: 'nc' });
  const result = groupSelection([g, b, c], ['gg', 'nb', 'nc']);
  assert.ok(result);
  const gg = result.nodes.find((n) => n.id === 'gg');
  assert.equal(gg.parentId, undefined, '分组节点不该被塞进新组');
});

test('ungroup 是 groupSelection 的逆运算（坐标可还原）', () => {
  const a = node('imageNode', { id: 'ua', position: { x: 100, y: 100 } });
  const b = node('imageNode', { id: 'ub', position: { x: 400, y: 300 } });
  const grouped = groupSelection([a, b], ['ua', 'ub'], 20);
  const ungrouped = ungroup(grouped.nodes, grouped.groupId);
  const a2 = ungrouped.find((n) => n.id === 'ua');
  const b2 = ungrouped.find((n) => n.id === 'ub');
  assert.equal(a2.position.x, 100, 'X 坐标应还原');
  assert.equal(a2.position.y, 100, 'Y 坐标应还原');
  assert.equal(b2.position.x, 400);
  assert.equal(b2.position.y, 300);
  assert.equal(a2.parentId, undefined, '解组后应清除 parentId');
  assert.equal(a2.extent, undefined, '解组后应清 ext');
});

test('childrenOf 返回分组成员', () => {
  const a = node('imageNode', { id: 'ca', parentId: 'G' });
  const b = node('imageNode', { id: 'cb', parentId: 'G' });
  const c = node('imageNode', { id: 'cc' });
  assert.deepEqual(childrenOf([a, b, c], 'G').sort(), ['ca', 'cb']);
});

test('removeNodes 连带删除子节点与相关连线', () => {
  const nodes = [
    node('groupNode', { id: 'G' }),
    node('imageNode', { id: 'c1', parentId: 'G' }),
    node('uploadNode', { id: 'u' }),
  ];
  const edges = [
    { id: 'e1', source: 'u', target: 'c1' },
  ];
  const result = removeNodes(nodes, edges, ['G']);
  assert.deepEqual(result.nodes.map((n) => n.id), ['u'], '分组与子节点都应删除');
  assert.equal(result.edges.length, 0, '悬空连线应删除');
});

/* ========================================================================== */
/* 六、序列化往返                                                              */
/* ========================================================================== */

test('serializeNode 剔除运行时字段（measured/selected/dragging）', () => {
  const n = {
    ...UPLOAD,
    measured: { width: 236, height: 214 },
    selected: true,
    dragging: true,
    resizing: true,
  };
  const s = serializeNode(n);
  assert.equal(s.measured, undefined);
  assert.equal(s.selected, undefined);
  assert.equal(s.dragging, undefined);
  assert.equal(s.resizing, undefined);
  // 业务字段必须保留
  assert.equal(s.id, 'n_upload');
  assert.equal(s.type, 'uploadNode');
  assert.ok(s.position);
  assert.ok(s.data);
});

test('serializeEdge 只保留后端关心的字段', () => {
  const e = createCanvasEdge(NODES, {
    source: 'n_upload',
    target: 'n_image',
    sourceHandle: 'out:image',
    targetHandle: 'in:image',
  });
  const s = serializeEdge(e);
  assert.deepEqual(Object.keys(s).sort(), [
    'data', 'id', 'source', 'sourceHandle', 'target', 'targetHandle', 'type',
  ]);
});

test('反序列化 → 序列化 → 反序列化 后图结构等价', () => {
  const nodes = [
    createCanvasNode({ type: 'uploadNode', position: { x: 0, y: 0 } }),
    createCanvasNode({ type: 'imageNode', position: { x: 300, y: 0 } }),
  ];
  const rawNodes = nodes.map(serializeNode);
  const restored = deserializeNodes(rawNodes);
  assert.equal(restored.length, 2);
  assert.equal(restored[0].type, 'uploadNode');
  assert.deepEqual(restored[0].position, { x: 0, y: 0 });

  const edge = createCanvasEdge(nodes, {
    source: restored[0].id,
    target: restored[1].id,
    sourceHandle: 'out:image',
    targetHandle: 'in:image',
  });
  const rawEdges = [serializeEdge(edge)];
  const restoredEdges = deserializeEdges(rawEdges, restored);
  assert.equal(restoredEdges.length, 1);
  assert.equal(restoredEdges[0].source, restored[0].id);
  assert.equal(restoredEdges[0].target, restored[1].id);
  // 连线类型信息被重算（不依赖落盘）
  assert.equal(restoredEdges[0].data?.sourceKind, 'image');
});

test('deserializeNodes 对脏数据安全（不炸、跳过非法项、补默认尺寸）', () => {
  const dirty = [
    null,
    42,
    'hello',
    {},
    { id: '' },
    { id: 'ok', type: 'imageNode' }, // 缺 position/data
    { id: 'badType', type: 'notARealNode', position: { x: 1, y: 2 } },
    { id: 'weirdPos', type: 'imageNode', position: { x: 'NaN', y: null } },
    { id: 'grp', type: 'groupNode', parentId: 'p' },
  ];
  const nodes = deserializeNodes(dirty);
  const ids = nodes.map((n) => n.id);
  assert.ok(ids.includes('ok'), '合法项应保留');
  assert.ok(ids.includes('badType'), '未知类型也应保留（走 UnknownNode 兜底）');
  assert.ok(!ids.includes(''), '空 id 应被丢弃');
  // 9 条脏数据里只有 4 条带合法非空 id：ok / badType / weirdPos / grp
  assert.equal(nodes.length, 4, `应保留 4 项，实际 ${ids.length}：${ids.join(',')}`);

  const ok = nodes.find((n) => n.id === 'ok');
  assert.deepEqual(ok.position, { x: 0, y: 0 }, '缺 position 补 0');
  assert.equal(ok.width, 268, '缺 width 用注册表默认');

  const weird = nodes.find((n) => n.id === 'weirdPos');
  assert.deepEqual(weird.position, { x: 0, y: 0 }, '非数字坐标应归零');

  const grp = nodes.find((n) => n.id === 'grp');
  assert.equal(grp.parentId, 'p');
  assert.equal(grp.extent, 'parent');
});

test('deserializeEdges 丢弃悬空连线', () => {
  const nodes = [node('uploadNode', { id: 'u' })];
  const edges = deserializeEdges(
    [
      { source: 'u', target: 'missing' },
      { source: 'u', target: 'u' },
      { source: 'ghost', target: 'u' },
    ],
    nodes,
  );
  assert.equal(edges.length, 1, '只有两端都在的连线才保留');
  assert.equal(edges[0].target, 'u');
});

/* ========================================================================== */
/* 七、上下游 / 结果回流 / 展示                                                */
/* ========================================================================== */

test('upstreamOf / downstreamOf', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];
  assert.deepEqual(upstreamOf(edges, 'b'), ['a']);
  assert.deepEqual(downstreamOf(edges, 'b'), ['c']);
  assert.deepEqual(upstreamOf(edges, 'a'), []);
});

test('collectUpstreamResult 取上游产物（url 与 text 分别继承）', () => {
  const a = {
    ...node('imageNode', { id: 'up1' }),
    data: { result: { url: '/a.png' } },
  };
  const b = {
    ...node('aiTextNode', { id: 'up2' }),
    data: { result: { text: '你好' } },
  };
  const target = node('videoGeneratorNode', { id: 't' });
  const edges = [
    { source: 'up1', target: 't' },
    { source: 'up2', target: 't' },
  ];
  const patch = collectUpstreamResult([a, b, target], edges, 't');
  assert.equal(patch.result.url, '/a.png');
  assert.equal(patch.result.text, '你好');
});

test('displayTitle：用户标题优先，否则用注册表默认名', () => {
  assert.equal(displayTitle({ ...IMAGE, data: {} }), 'AI 图片');
  assert.equal(displayTitle({ ...IMAGE, data: { title: '主视觉' } }), '主视觉');
  assert.equal(displayTitle({ ...IMAGE, data: { title: '   ' } }), 'AI 图片');
});

test('isBusy：running/queued 为真', () => {
  assert.equal(isBusy({ ...IMAGE, data: { status: 'running' } }), true);
  assert.equal(isBusy({ ...IMAGE, data: { status: 'queued' } }), true);
  assert.equal(isBusy({ ...IMAGE, data: { status: 'idle' } }), false);
  assert.equal(isBusy({ ...IMAGE, data: {} }), false);
});

test('groupDisplayName：groupName 参数优先于 data.title', () => {
  const g = node('groupNode', { id: 'g', data: { title: '默认名', params: { groupName: '第一场' } } });
  assert.equal(groupDisplayName(g), '第一场');
  const g2 = node('groupNode', { id: 'g2', data: { title: '默认名' } });
  assert.equal(groupDisplayName(g2), '默认名');
});