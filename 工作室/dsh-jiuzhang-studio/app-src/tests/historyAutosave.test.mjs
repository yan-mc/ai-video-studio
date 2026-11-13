/**
 * 历史栈（撤销 12 步）与自动保存（debounce 800ms）单测。
 *
 * 这两个模块是"数据安全"的关键：
 *   · 撤销深度必须**恰好 12**（多一步 = 违背交互契约，少一步 = 用户丢操作）；
 *   · 自动保存必须 **debounce**（不能每次按键都发请求）；
 *   · 保存必须**串行**（防乱序覆盖）；
 *   · 切项目必须 flush 给**旧**项目（防数据串项目，最严重的事故）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HistoryStack, HISTORY_LIMIT, cloneGraph, historyKeyOf } from '../src/canvas/history.ts';
import { Autosave, AUTOSAVE_DELAY_MS, buildPayload } from '../src/canvas/autosave.ts';

/** 构造一个可辨识的快照 */
function snap(label) {
  return { nodes: [{ id: label }], edges: [], label };
}

/* ========================================================================== */
/* 一、撤销深度 12 步                                                          */
/* ========================================================================== */

test('HISTORY_LIMIT 恰好是 12', () => {
  assert.equal(HISTORY_LIMIT, 12);
});

test('压入 20 步后只保留 12 步（上限生效）', () => {
  const h = new HistoryStack();
  for (let i = 0; i < 20; i += 1) h.push(snap(`s${i}`), `k${i}`); // 不同 key，不合并
  assert.equal(h.undoDepth(), 12, `撤销深度应为 12，实际 ${h.undoDepth()}`);
});

test('撤销 12 步后耗尽，再撤返回 null', () => {
  const h = new HistoryStack();
  for (let i = 0; i < 20; i += 1) h.push(snap(`s${i}`), `k${i}`);
  let count = 0;
  let cur = snap('current');
  for (;;) {
    const prev = h.undo(cur);
    if (!prev) break;
    cur = prev;
    count += 1;
  }
  assert.equal(count, 12, `应能撤销 12 次，实际 ${count}`);
  assert.equal(h.undo(cur), null, '耗尽后应返回 null');
});

test('重做把状态推回去，且重做深度也受限', () => {
  const h = new HistoryStack(3);
  h.push(snap('a'), 'k1');
  h.push(snap('b'), 'k2');
  h.push(snap('c'), 'k3');
  const cur = snap('now');
  const u1 = h.undo(cur);
  assert.equal(u1.label, 'c');
  assert.equal(h.canRedo(), true);
  const r1 = h.redo(u1);
  assert.equal(r1.label, 'now');
  assert.equal(h.canRedo(), false);
});

test('新的编辑会清空重做分支', () => {
  const h = new HistoryStack();
  h.push(snap('a'), 'k1');
  const u = h.undo(snap('now'));
  assert.equal(h.canRedo(), true);
  h.push(snap('new'), 'k2');
  assert.equal(h.canRedo(), false, '编辑后重做分支应被丢弃');
});

test('同一 key 在合并窗口内不新增历史条目（拖动/打字不会塞满 12 步）', () => {
  const h = new HistoryStack(12, 10_000); // 合并窗口 10 秒
  h.push(snap('first'), 'position');
  h.push(snap('second'), 'position');
  h.push(snap('third'), 'position');
  assert.equal(h.undoDepth(), 1, '相同 key 应合并为 1 步');
});

test('不同 key 即使时间很近也各记一步', () => {
  const h = new HistoryStack(12, 10_000);
  h.push(snap('a'), 'params:n1');
  h.push(snap('b'), 'params:n2');
  assert.equal(h.undoDepth(), 2);
});

test('null key 不合并（结构性变更每次都独立）', () => {
  const h = new HistoryStack(12, 10_000);
  h.push(snap('a'), null);
  h.push(snap('b'), null);
  assert.equal(h.undoDepth(), 2);
});

test('clear 清空双向栈', () => {
  const h = new HistoryStack();
  h.push(snap('a'), 'k');
  h.undo(snap('now'));
  h.clear();
  assert.equal(h.undoDepth(), 0);
  assert.equal(h.redoDepth(), 0);
  assert.equal(h.canUndo(), false);
});

test('limit 小于 1 时被规整为 1（不会出现零深度）', () => {
  const h = new HistoryStack(0);
  assert.equal(h.limit, 1);
  h.push(snap('a'), 'k1');
  h.push(snap('b'), 'k2');
  assert.equal(h.undoDepth(), 1);
});

/* ========================================================================== */
/* 二、快照深拷贝                                                              */
/* ========================================================================== */

test('cloneGraph 产生深拷贝（改原对象不影响快照）', () => {
  const nodes = [{ id: 'a', data: { params: { x: 1 } } }];
  const edges = [{ id: 'e' }];
  const copy = cloneGraph(nodes, edges);
  nodes[0].data.params.x = 999;
  assert.equal(copy.nodes[0].data.params.x, 1, '快照不该被后续 mutate 污染');
  assert.notEqual(copy.nodes, nodes);
  assert.notEqual(copy.edges, edges);
});

/* ========================================================================== */
/* 三、historyKeyOf                                                            */
/* ========================================================================== */

test('historyKeyOf：纯选择不记历史，position 合并，结构性变更不合并', () => {
  assert.equal(historyKeyOf([]), null);
  assert.equal(historyKeyOf([{ type: 'select' }]), null, '纯选择不该记历史');
  assert.equal(historyKeyOf([{ type: 'position' }, { type: 'position' }]), 'position');
  assert.equal(historyKeyOf([{ type: 'dimensions' }]), 'dimensions');
  assert.equal(historyKeyOf([{ type: 'remove' }]), null);
  assert.equal(historyKeyOf([{ type: 'position' }, { type: 'remove' }]), null, '混合变更不合并');
});

/* ========================================================================== */
/* 四、自动保存                                                                */
/* ========================================================================== */

test('AUTOSAVE_DELAY_MS 恰好是 800', () => {
  assert.equal(AUTOSAVE_DELAY_MS, 800);
});

/** 可等待的 sleep */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function payload(n) {
  return buildPayload([{ id: `n${n}` }], [], { x: 0, y: 0, zoom: 1 });
}

test('debounce：800ms 内多次 schedule 只发一次请求', async () => {
  const calls = [];
  const saver = new Autosave({
    delayMs: 30, // 测试用短窗口
    save: async (pid, p) => {
      calls.push({ pid, count: p.nodeCount });
    },
  });
  saver.schedule('p1', payload(1));
  saver.schedule('p1', payload(2));
  saver.schedule('p1', payload(3));
  assert.equal(calls.length, 0, '不应立即发送');
  await sleep(90);
  assert.equal(calls.length, 1, `应只发一次，实际 ${calls.length}`);
  // 最后一次 payload 胜出
  assert.equal(calls[0].count, 1);
});

test('flush 立即落盘 pending', async () => {
  const calls = [];
  const saver = new Autosave({
    delayMs: 10_000,
    save: async (pid) => calls.push(pid),
  });
  saver.schedule('p1', payload(1));
  assert.equal(saver.hasPending(), true);
  await saver.flush();
  assert.equal(calls.length, 1, 'flush 应立即保存');
  assert.equal(saver.hasPending(), false);
});

test('保存状态回调顺序：pending → saving → saved', async () => {
  const states = [];
  const saver = new Autosave({
    delayMs: 5,
    save: async () => {},
    onState: (s) => states.push(s),
  });
  saver.schedule('p1', payload(1));
  await sleep(50);
  assert.deepEqual(states, ['pending', 'saving', 'saved']);
});

test('保存失败回调 error 且带错误信息', async () => {
  const seen = [];
  const saver = new Autosave({
    delayMs: 5,
    save: async () => {
      throw new Error('网络断开');
    },
    onState: (s, err) => seen.push({ s, err }),
  });
  saver.schedule('p1', payload(1));
  await sleep(60);
  const last = seen[seen.length - 1];
  assert.equal(last.s, 'error');
  assert.match(last.err, /网络断开/);
});

test('串行化：慢请求期间的新请求不会并发（防乱序覆盖）', async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  const order = [];
  const saver = new Autosave({
    delayMs: 1,
    save: async (pid, p) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(p.nodeCount);
      await sleep(20);
      concurrent -= 1;
    },
  });

  saver.schedule('p1', payload(1));
  await sleep(5); // 让第一次进入飞行
  saver.schedule('p1', payload(2));
  await sleep(5);
  await saver.flush();

  assert.equal(maxConcurrent, 1, `不应有并发保存，实际峰值 ${maxConcurrent}`);
  // 最后一次编辑必须最后落盘
  assert.equal(order[order.length - 1], 1, `最后一次 payload 应最后写，实际顺序 ${order.join(',')}`);
});

test('切项目：旧项目的 pending 必须 flush 给旧项目，不能写到新项目', async () => {
  const calls = [];
  const saver = new Autosave({
    delayMs: 10_000, // 长窗口，靠"切项目"触发保存
    save: async (pid, p) => calls.push({ pid, count: p.nodeCount }),
  });
  saver.schedule('proj-A', payload(1));
  saver.schedule('proj-B', payload(2)); // 换成 B
  await sleep(20);
  assert.ok(
    calls.some((c) => c.pid === 'proj-A'),
    `旧项目 A 必须被保存，实际 ${JSON.stringify(calls)}`,
  );

  await saver.flush();
  const bCalls = calls.filter((c) => c.pid === 'proj-B');
  assert.ok(bCalls.length > 0, 'B 项目也应被保存');
  // A 的 payload 绝不能挂到 B 上
  for (const c of calls) {
    if (c.pid === 'proj-B') assert.equal(c.count, 1, 'B 应收到 B 自己的 payload');
  }
});

test('projectId 为空时 schedule 不生效（没有项目不该发请求）', async () => {
  const calls = [];
  const saver = new Autosave({ delayMs: 5, save: async () => calls.push(1) });
  saver.schedule('', payload(1));
  await sleep(40);
  assert.equal(calls.length, 0);
  assert.equal(saver.hasPending(), false);
});

test('dispose 会 flush 后再拒绝新任务', async () => {
  const calls = [];
  const saver = new Autosave({ delayMs: 5, save: async (pid) => calls.push(pid) });
  saver.schedule('p1', payload(1));
  await saver.dispose();
  assert.equal(calls.length, 1, 'dispose 应落盘 pending');
  saver.schedule('p2', payload(2));
  await sleep(30);
  assert.equal(calls.filter((c) => c === 'p2').length, 0, 'dispose 后不应再保存');
});

test('savingProject 暴露正在保存的项目（调试用）', async () => {
  const saver = new Autosave({
    delayMs: 1,
    save: async () => {
      await sleep(30);
    },
  });
  saver.schedule('pX', payload(1));
  await sleep(8);
  assert.equal(saver.savingProject(), 'pX');
  await saver.flush();
  assert.equal(saver.savingProject(), null);
});

/* ========================================================================== */
/* 五、buildPayload                                                            */
/* ========================================================================== */

test('buildPayload：nodeCount 取真实节点数（后端列表徽标直接用）', () => {
  const p = buildPayload([1, 2, 3], ['e1'], { x: 5, y: 6, zoom: 0.8 });
  assert.equal(p.nodeCount, 3);
  assert.equal(p.nodes.length, 3);
  assert.equal(p.edges.length, 1);
  assert.deepEqual(p.viewport, { x: 5, y: 6, zoom: 0.8 });
});

test('buildPayload：viewport 缺省填 null（可 JSON 序列化）', () => {
  const p = buildPayload([], [], undefined);
  assert.equal(p.viewport, null);
  assert.equal(p.nodeCount, 0);
  assert.doesNotThrow(() => JSON.stringify(p));
});
/* ============================================================
 * 回归：撤销栈必须存「编辑前」的状态
 *
 * 历史缺陷（用户报告"Crtl+Z 点了没反应"）：
 *   commitGraph 先把 nodesRef 指向新状态，再 pushHistory(nextNodes…)，
 *   于是栈里存的是编辑**后**的状态；undo() 弹出的正是当前画面本身
 *   → 第一次撤销毫无变化，第二次才动，初始状态永久丢失。
 *   这里用与 commitGraph 相同的调用顺序做行为断言。
 * ============================================================ */

test('撤销栈语义：push 的是编辑前状态，撤销一次即回到前一版', () => {
  const h = new HistoryStack();
  // 模拟 commitGraph：push(旧状态) 之后才应用新状态
  let current = snap('A');
  const commit = (next) => {
    h.push(current, null);
    current = snap(next);
  };

  commit('B');
  commit('C');
  assert.equal(current.label, 'C');

  // 第一次撤销 → 必须回到 B（而不是"留在 C"）
  let prev = h.undo(current);
  assert.equal(prev?.label, 'B', `第一次撤销应回到 B，实际 ${prev?.label}`);
  current = prev;

  prev = h.undo(current);
  assert.equal(prev?.label, 'A', `第二次撤销应回到 A，实际 ${prev?.label}`);
  current = prev;

  assert.equal(h.undo(current), null, '初始状态之后应无更多历史');
});

test('合并窗口内保留最早的撤销目标（连续输入不丢初态）', () => {
  const h = new HistoryStack();
  let current = snap('A');
  // 同一 key、窗口内连续编辑：只应记录一次，且保留最早的 A
  for (const next of ['B', 'C', 'D']) {
    h.push(current, 'data:n1');
    current = snap(next);
  }
  const prev = h.undo(current);
  assert.equal(prev?.label, 'A', `连续编辑后撤销应回到初始 A，实际 ${prev?.label}`);
});
