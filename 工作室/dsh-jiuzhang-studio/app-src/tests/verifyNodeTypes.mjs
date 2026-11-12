/**
 * nodeTypes 映射验收脚本（任务验收第 3 条："nodeRegistry 能导出 26 项"）。
 *
 * 这里下载不了 React 组件，所以不能直接 import nodes/index.ts（它 import tsx）。
 * 做法：静态解析 nodes/index.ts 的 nodeTypes 字面量，逐项核对：
 *   1. 恰好 26 个 key
 *   2. key 集合 == NODE_TYPE_KEYS
 *   3. 每个 key 对应的组件名在 nodes/ 目录里真实存在且被导出
 *   4. 组件名与注册表 icon/category 无冲突（不重复映射到同一组件，避免复制粘贴漏改）
 *
 * 运行：node --import ./tests/register.mjs tests/verifyNodeTypes.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { NODE_TYPE_KEYS } from '../src/canvas/nodeKeys.ts';
import { NODE_REGISTRY } from '../src/canvas/nodeRegistry.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODES_DIR = path.resolve(HERE, '../src/canvas/nodes');
const INDEX_PATH = path.join(NODES_DIR, 'index.ts');

/** 解析 index.ts 里 `export const nodeTypes: NodeTypes = { ... }` 的字面量 */
function parseNodeTypes() {
  const src = readFileSync(INDEX_PATH, 'utf8');
  const start = src.indexOf('export const nodeTypes');
  assert.ok(start >= 0, 'nodes/index.ts 里找不到 nodeTypes 定义');
  const braceStart = src.indexOf('{', start);
  assert.ok(braceStart > start, 'nodeTypes 后应有对象字面量');
  // 手写括号配对（字符串内的大括号不会出现在这份文件里，风险可接受）
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.ok(end > braceStart, 'nodeTypes 对象字面量未闭合');
  const body = src.slice(braceStart + 1, end);

  // 形如 `key: Component,`（忽略注释行）
  const entries = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('//')) continue;
    const m = trimmed.match(/^([A-Za-z0-9_]+):\s*([A-Za-z0-9_]+),?$/);
    if (m) entries.push({ key: m[1], component: m[2] });
  }
  return entries;
}

/** 收集 nodes/*.tsx 里 export 的组件名 */
function collectExportedComponents() {
  const files = readdirSync(NODES_DIR).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  const exported = new Map(); // componentName -> file
  for (const file of files) {
    const src = readFileSync(path.join(NODES_DIR, file), 'utf8');
    for (const m of src.matchAll(/export function ([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
      exported.set(m[1], file);
    }
    for (const m of src.matchAll(/export const ([A-Z][A-Za-z0-9_]*)\s*[:=]/g)) {
      if (!exported.has(m[1])) exported.set(m[1], file);
    }
  }
  return exported;
}

/* ========================================================================== */

test('nodes/index.ts 的 nodeTypes 恰好 26 项', () => {
  const entries = parseNodeTypes();
  assert.equal(entries.length, 26, `实际 ${entries.length} 项：${entries.map((e) => e.key).join(',')}`);
});

test('nodeTypes 的 key 集合与 NODE_TYPE_KEYS 完全一致（顺序也一致）', () => {
  const entries = parseNodeTypes();
  assert.deepEqual(
    entries.map((e) => e.key),
    [...NODE_TYPE_KEYS],
    'nodeTypes 的 key 顺序应与 nodeKeys 一致',
  );
});

test('每个 nodeTypes 条目映射到的组件都真实存在于 nodes/ 目录', () => {
  const entries = parseNodeTypes();
  const exported = collectExportedComponents();
  for (const { key, component } of entries) {
    assert.ok(
      exported.has(component),
      `${key} 映射到 ${component}，但该组件未在任何 nodes/*.tsx 里导出`,
    );
  }
});

test('26 个 key 映射到 26 个不同组件（没有复制粘贴漏改）', () => {
  const entries = parseNodeTypes();
  const components = entries.map((e) => e.component);
  assert.equal(
    new Set(components).size,
    26,
    `组件有重复映射：${components.filter((c, i) => components.indexOf(c) !== i).join(',')}`,
  );
});

test('注册表 26 项都能在 nodeTypes 里找到映射（无遗漏）', () => {
  const entries = parseNodeTypes();
  const mapped = new Set(entries.map((e) => e.key));
  for (const key of Object.keys(NODE_REGISTRY)) {
    assert.ok(mapped.has(key), `注册表有 ${key}，但 nodeTypes 没有映射`);
  }
});

test('nodeTypes 里没有注册表之外的 key（无多余映射）', () => {
  const entries = parseNodeTypes();
  const registry = new Set(Object.keys(NODE_REGISTRY));
  for (const { key } of entries) {
    assert.ok(registry.has(key), `nodeTypes 有 ${key}，但注册表里没有`);
  }
});

test('index.ts 导出了 allNodeTypes（含 __unknown 兜底）与 REGISTERED_NODE_TYPES', () => {
  const src = readFileSync(INDEX_PATH, 'utf8');
  assert.ok(src.includes('export const allNodeTypes'), '缺 allNodeTypes 导出');
  assert.ok(src.includes('__unknown'), '缺 __unknown 兜底 key');
  assert.ok(src.includes('export const REGISTERED_NODE_TYPES'), '缺 REGISTERED_NODE_TYPES 导出');
  assert.ok(src.includes("from './UnknownNode'"), '缺 UnknownNode 引入');
});

test('nodes/ 目录下文件数符合预期（26 个组件分布在若干文件 + 入口 + 兜底）', () => {
  const files = readdirSync(NODES_DIR).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  assert.ok(files.includes('index.ts'), '缺 nodes/index.ts');
  assert.ok(files.includes('_shared.tsx'), '缺共享构件 _shared.tsx');
  assert.ok(files.includes('UnknownNode.tsx'), '缺兜底节点');
  assert.ok(files.length >= 8, `组件文件过少，可能漏实现：${files.join(',')}`);
});