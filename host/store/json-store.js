/**
 * 原子 JSON 存储 —— 全仓唯一的 JSON 落盘实现。
 *
 * 设计约束（每条都来自一次真实事故）：
 *
 * 1) 并发写不能 last-write-wins → 每个文件一条 Promise 队列，读-改-写整体串行。
 * 2) 解析失败不能静默清空 → 保留 .corrupt 副本并抛 CORRUPT_JSON；
 *    主文件损坏时自动回退 .bak（每写一次前都会留一份上一版）。
 * 3) 写盘失败不能连旧数据一起丢 → 重试只针对同一个 tmp 的 rename，
 *    全程绝不删除目标文件；rename 始终失败时退回非原子覆盖写（最坏只写一半，
 *    绝不会出现"两份都没了"）。
 * 4) 重试等待不能阻塞事件循环 → 同步 API 用 Atomics.wait，异步用 setTimeout。
 * 5) 读盘有 TOCTOU → 直接 readFileSync + catch，不先 existsSync。
 *
 * API：
 *
 *   readJson(file, fallback)                同步读
 *   writeJson(file, value)                  同步原子写（单写者场景）
 *   updateJson(file, fallback, mutator)     串行读-改-写（mutator 返回 undefined = 不写）
 *   replaceJson(file, value)                串行整体替换
 *   collectionStore(file, opts)             数组集合的 list/get/upsert/remove
 *   flushJsonStore()                        等待所有在途写完成（测试/退出用）
 */
import fs from 'node:fs';
import path from 'node:path';

/* ==========================================================================
 * 内部工具
 * ========================================================================== */

const queues = new Map();   // file -> Promise（队尾）

/** 可被其它线程唤醒的共享内存，用于同步睡眠 */
const SLEEPER = new Int32Array(new SharedArrayBuffer(4));

/**
 * 同步睡眠。
 *
 * `Atomics.wait` 在**主线程**上会被 Node 抛错（只能在 worker 里等），
 * 所以先尝试它，失败退回极短忙等 —— 总时长限制在 2ms 以内，不会阻塞事件循环。
 */
function sleepSync(ms) {
  if (ms <= 0) return;
  try {
    Atomics.wait(SLEEPER, 0, 0, ms);
    return;
  } catch { /* 主线程不允许 Atomics.wait，走下面的短忙等 */ }
  const until = Date.now() + Math.min(ms, 2);
  while (Date.now() < until) { /* 最多 2ms */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

let tmpSeq = 0;

/** 生成唯一 tmp 名：进程内自增序号，同进程内绝不重名（零碰撞）。 */
function tmpNameFor(file) {
  tmpSeq += 1;
  return `${file}.${process.pid}.${tmpSeq}.tmp`;
}

/** 把原文件复制成 .bak（只尽力而为，失败不影响主流程） */
function backupSync(file) {
  try {
    if (!fs.existsSync(file)) return;
    const st = fs.statSync(file);
    if (!st.isFile() || st.size === 0) return;
    fs.copyFileSync(file, `${file}.bak`);
  } catch { /* ignore */ }
}

/* ==========================================================================
 * 读
 * ========================================================================== */

/**
 * 同步读。不存在 / 空文件 → fallback；解析失败 → 备份 .corrupt 并自动回退 .bak。
 *
 * 不用 `existsSync` 先判断（TOCTOU：检查与读取之间文件可能被删），直接读、按错误码分支。
 * 主文件损坏时回退上一版 `.bak` 并把恢复结果写回，让"人工恢复"变成"自动降级"。
 *
 * @returns {any}
 */
function readSync(file, fallback) {
  let txt;
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    // 其它错误（EACCES 等）不当作"文件不存在" —— 让调用方看到真实原因
    throw err;
  }
  if (!txt.trim()) return fallback;
  try {
    return JSON.parse(txt);
  } catch (err) {
    // 保留损坏副本，避免下一次写入把它彻底覆盖掉
    try { fs.copyFileSync(file, `${file}.corrupt`); } catch { /* ignore */ }

    // 自动回退上一版备份（存在且能解析才算数）
    try {
      const bakTxt = fs.readFileSync(`${file}.bak`, 'utf8');
      const recovered = JSON.parse(bakTxt);
      console.warn(`[jiuzhang] ${file} 损坏，已回退到 ${file}.bak（上一版备份）`);
      // 把恢复结果写回主文件，避免每次读都走这条路径。
      // ⚠️ 这里**不能**调 writeSyncAtomic：它在写之前会 backupSync(file)，
      //    会把刚用来恢复的那份好 .bak 覆盖成损坏内容。
      try {
        const tmp = tmpNameFor(file);
        fs.writeFileSync(tmp, JSON.stringify(recovered, null, 2), 'utf8');
        fs.renameSync(tmp, file);
      } catch { /* 写不回也不影响本次读取 */ }
      return recovered;
    } catch { /* 没有可用备份 */ }

    throw new Error(`CORRUPT_JSON: ${file}: ${err.message}`);
  }
}

/* ==========================================================================
 * 写
 * ========================================================================== */

/**
 * rename 失败时的兜底：直接覆盖写。
 *
 * 不是原子的（写到一半崩溃会留下截断文件），但它保证"旧数据要么被完整替换、
 * 要么原样保留 + 留下 .bak"，绝不会出现"目标被删、tmp 也被删、两份都没了"。
 */
function overwriteFallback(file, data) {
  const tmp = tmpNameFor(file);
  try {
    fs.writeFileSync(tmp, data, 'utf8');
    fs.copyFileSync(tmp, file);          // 覆盖内容，不删原文件
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
  }
}

/** 同步原子写（rename 语义）。失败时退回覆盖写，再失败才抛。 */
function writeSyncAtomic(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const data = JSON.stringify(value, null, 2);

  backupSync(file);

  const tmp = tmpNameFor(file);
  fs.writeFileSync(tmp, data, 'utf8');

  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      lastError = err;
      if (!RETRYABLE.has(err.code)) break;
      // ⚠️ 关键：这里**不删目标文件**。删了会让"重试失败"变成"数据丢失"。
      sleepSync(5 + attempt * 8);
    }
  }
  try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }

  // 还有一次机会：直接覆盖写（非原子但不丢数据）
  try {
    overwriteFallback(file, data);
    return;
  } catch (err) {
    throw lastError || err || new Error(`ATOMIC_WRITE_FAILED: ${file}`);
  }
}

/** 异步原子写：重试用 setTimeout，不阻塞事件循环 */
async function writeAsyncAtomic(file, value) {
  const dir = path.dirname(file);
  await fs.promises.mkdir(dir, { recursive: true });
  const data = JSON.stringify(value, null, 2);

  backupSync(file);

  const tmp = tmpNameFor(file);
  await fs.promises.writeFile(tmp, data, 'utf8');

  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.promises.rename(tmp, file);
      return;
    } catch (err) {
      lastError = err;
      if (!RETRYABLE.has(err.code)) break;
      await sleep(5 + attempt * 8);
    }
  }
  try { await fs.promises.rm(tmp, { force: true }); } catch { /* ignore */ }

  try {
    const fb = tmpNameFor(file);
    await fs.promises.writeFile(fb, data, 'utf8');
    await fs.promises.copyFile(fb, file);
    await fs.promises.rm(fb, { force: true });
    return;
  } catch (err) {
    throw lastError || err || new Error(`ATOMIC_WRITE_FAILED: ${file}`);
  }
}

/* ==========================================================================
 * 队列
 * ========================================================================== */

function queueFor(file) {
  let q = queues.get(file);
  if (!q) { q = Promise.resolve(); queues.set(file, q); }
  return q;
}

/**
 * 串行化的读-改-写。mutator 返回 `undefined` 表示「本次不需要写盘」——
 * 跳过整份重写并返回当前值（jobs.json 这类 500KB+ 文件靠这个避免无意义重写）。
 *
 * @param {string} file
 * @param {any} fallback 文件不存在时的初值
 * @param {(current:any)=>any|Promise<any>} mutator 返回新值；返回 undefined = 不写
 * @returns {Promise<any>} 写入后的新值（= mutator 的返回值；未写时为当前值）
 */
export function updateJson(file, fallback, mutator) {
  const run = async () => {
    const current = readSync(file, fallback);
    const next = await mutator(current);
    if (next === undefined) return current;
    await writeAsyncAtomic(file, next);
    return next;
  };
  const prev = queueFor(file);
  const next = prev.then(run, run);        // 前一个失败也继续执行
  queues.set(file, next.then(() => {}, () => {}));  // 队列本身不因失败中断
  return next;
}

/** 等待所有在途写完成（测试 / 进程退出前用） */
export async function flushJsonStore() {
  const pending = [...queues.values()];
  await Promise.allSettled(pending);
}

/* ==========================================================================
 * 对外 API
 * ========================================================================== */

/** 同步读（不做串行，仅用于只读场景） */
export function readJson(file, fallback) {
  return readSync(file, fallback);
}

/** 同步原子写（单写者场景用；多写者请用 updateJson） */
export function writeJson(file, value) {
  writeSyncAtomic(file, value);
}

/** 串行化的整体替换 */
export function replaceJson(file, value) {
  return updateJson(file, value, () => value);
}

/**
 * 通用集合存储：一个 JSON 数组文件，提供 list/get/upsert/remove。
 * 所有写操作走同一队列，天然串行；`upsert` 返回**落盘后的合并结果**（不是入参回显）。
 *
 * `get(id)` 不触发全量读盘：内部维护 `{mtimeMs,size}` 指纹 + id→记录 索引，
 * 文件没变就命中缓存。jobs.json 500KB+、批次段每 2 秒 get 一次，全量 JSON.parse
 * 是数量级的浪费。
 */
export function collectionStore(file, { idField = 'id', prefix = 'item' } = {}) {
  const empty = () => [];

  /** { stamp, byId: Map } —— 指纹变化即失效 */
  let indexCache = null;
  const stampOf = () => {
    try {
      const st = fs.statSync(file);
      return `${st.mtimeMs}:${st.size}`;
    } catch { return ''; }
  };
  const indexOf = (arr) => {
    const byId = new Map();
    for (const x of arr) {
      if (x && x[idField] != null) byId.set(x[idField], x);
    }
    return byId;
  };
  const dropIndexCache = () => { indexCache = null; };

  function newId() {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    file,

    async list() {
      const arr = readSync(file, empty());
      return Array.isArray(arr) ? arr : [];
    },

    async get(id) {
      if (id == null) return null;
      const stamp = stampOf();
      if (indexCache && stamp && indexCache.stamp === stamp) {
        return indexCache.byId.get(id) ?? null;
      }
      const arr = await this.list();
      indexCache = { stamp: stampOf(), byId: indexOf(arr) };
      return indexCache.byId.get(id) ?? null;
    },

    async upsert(item) {
      const withId = { ...item };
      if (!withId[idField]) withId[idField] = newId();
      let merged = withId;
      await updateJson(file, empty(), (arr) => {
        const list = Array.isArray(arr) ? arr.slice() : [];
        const idx = list.findIndex((x) => x && x[idField] === withId[idField]);
        if (idx >= 0) {
          merged = { ...list[idx], ...withId };
          list[idx] = merged;
        } else {
          list.push(withId);
        }
        return list;
      });
      dropIndexCache();
      return merged;
    },

    async remove(id) {
      const out = await updateJson(file, empty(), (arr) => {
        const list = Array.isArray(arr) ? arr : [];
        return list.filter((x) => !x || x[idField] !== id);
      });
      dropIndexCache();
      return out;
    },

    newId,
  };
}