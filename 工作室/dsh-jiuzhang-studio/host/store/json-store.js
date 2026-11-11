/**
 * 原子 JSON 存储 —— 修复审查发现的两个真实缺陷：
 *  1) jobs.json 全量读-改-写无串行化 → 并发 runJob 会 last-write-wins 丢字段；
 *  2) readJson 静默吞掉解析错误 → 损坏文件被当作空继续，下次写入即覆盖。
 *
 * 本实现：
 *  - 每个文件一条写队列（Promise 链），读-改-写整体串行；
 *  - tmp + rename 原子替换；
 *  - 解析失败时保留 .corrupt 副本并抛出，不再静默清空。
 */
import fs from 'node:fs';
import path from 'node:path';

const queues = new Map();   // file -> Promise

function queueFor(file) {
  let q = queues.get(file);
  if (!q) { q = Promise.resolve(); queues.set(file, q); }
  return q;
}

function readSync(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const txt = fs.readFileSync(file, 'utf8');
  if (!txt.trim()) return fallback;
  try {
    return JSON.parse(txt);
  } catch (err) {
    // 保留损坏副本，避免下一次写入把它彻底覆盖掉
    try { fs.copyFileSync(file, file + '.corrupt'); } catch { /* ignore */ }
    throw new Error(`CORRUPT_JSON: ${file}: ${err.message}`);
  }
}

function writeSyncAtomic(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');

  // Windows 上 rename 覆盖已存在文件可能因杀软扫描/句柄占用抛 EPERM/EBUSY。
  // 短暂重试即可（这是 Windows 上原子写的标准处理）。
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      lastError = err;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) break;
      // 目标被占用时，先尝试移除（Windows 上 rename 覆盖偶发失败）
      try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
      // 同步自旋等待（此处无并发可让出）
      const until = Date.now() + 5 + attempt * 10;
      while (Date.now() < until) { /* busy wait, max ~85ms total */ }
    }
  }
  try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
  throw lastError || new Error('ATOMIC_WRITE_FAILED');
}

/** 同步读（不做串行，仅用于只读场景） */
export function readJson(file, fallback) {
  return readSync(file, fallback);
}

/** 同步写（原子，但不串行——仅供单写者配置用） */
export function writeJson(file, value) {
  writeSyncAtomic(file, value);
}

/**
 * 串行化的读-改-写。mutator 收到当前值，返回新值（或原地改后返回同引用）。
 * @returns {Promise<any>} 写入后的新值
 */
export function updateJson(file, fallback, mutator) {
  const run = async () => {
    const current = readSync(file, fallback);
    const next = await mutator(current);
    writeSyncAtomic(file, next);
    return next;
  };
  const prev = queueFor(file);
  const next = prev.then(run, run);       // 前一个失败也继续执行
  queues.set(file, next.catch(() => {})); // 队列本身不因失败中断
  return next;
}

/** 串行化的整体替换 */
export function replaceJson(file, value) {
  return updateJson(file, value, () => value);
}

/**
 * 通用集合存储：一个 JSON 数组文件，提供 list/get/upsert/remove。
 * 所有写操作走同一队列，天然串行。
 */
export function collectionStore(file, { idField = 'id', prefix = 'item' } = {}) {
  const empty = () => [];

  function newId() {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    file,
    async list() {
      const arr = readSync(file, empty());
      return Array.isArray(arr) ? arr : [];
    },
    listSync() {
      const arr = readSync(file, empty());
      return Array.isArray(arr) ? arr : [];
    },
    async get(id) {
      const arr = await this.list();
      return arr.find((x) => x && x[idField] === id) ?? null;
    },
    async upsert(item) {
      const withId = { ...item };
      if (!withId[idField]) withId[idField] = newId();
      return updateJson(file, empty(), (arr) => {
        const list = Array.isArray(arr) ? arr.slice() : [];
        const idx = list.findIndex((x) => x && x[idField] === withId[idField]);
        if (idx >= 0) list[idx] = { ...list[idx], ...withId };
        else list.push(withId);
        return list;
      }).then(() => withId);
    },
    async remove(id) {
      return updateJson(file, empty(), (arr) => {
        const list = Array.isArray(arr) ? arr : [];
        return list.filter((x) => !x || x[idField] !== id);
      });
    },
    newId,
  };
}

/** 测试用：等待所有队列落定 */
export async function drainQueues() {
  await Promise.all([...queues.values()]);
  queues.clear();
}