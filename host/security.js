/**
 * 安全层 —— 插件的 handler 路由绕过 DSH 的连接准入，
 * 所以必须自己补 Origin 同源校验 + 写操作 token。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// 进程级随机 token，启动时生成
const WRITE_TOKEN = randomBytes(24).toString('base64url');

export function getWriteToken() {
  return WRITE_TOKEN;
}

/**
 * 判断一个 Origin 是否与本机请求同源。无 Origin（导航 / 非浏览器客户端）放行。
 *
 * 顺带校验 protocol，并用 `Sec-Fetch-Site: cross-site` 兜住
 * "Origin 被凑成和 Host 一样"的绕过（浏览器不会伪造这个头）。
 */
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  const host = req.headers.host;
  if (!host) return false;

  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false;

  if (parsed.host !== host) return false;
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * 只允许 loopback Host，防 DNS rebinding。
 *
 * 必须是严格 IP 判定：`/^127\./` 会让 `127.0.0.1.evil.com` 通过，
 * 而它与 isSameOrigin 的"自比对"配合可以完整绕过 guard。
 */
const IPV4_LOOPBACK = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * 判断主机名是否指向本机（不含端口）。全仓唯一实现 —— config.js 的
 * validateComfyUrl 也用它，否则两处会各自演化出 SSRF 口子。
 * 不接受 `0.0.0.0`（语义是"任意地址"）。
 */
export function isLoopbackHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  if (h === '127.0.0.1') return true;
  const m = IPV4_LOOPBACK.exec(h);
  if (!m) return false;
  return m.slice(1).every((seg) => Number(seg) <= 255);
}

export function isLoopbackHost(req) {
  const host = String(req.headers.host || '');
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return isLoopbackHostname(hostname);
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 统一入口：null 表示放行，否则返回 { status, body }。 */
export function guard(req, route) {
  if (!isLoopbackHost(req)) {
    return { status: 403, body: { error: 'FORBIDDEN_HOST', detail: '仅允许本机访问' } };
  }
  if (!isSameOrigin(req)) {
    return { status: 403, body: { error: 'FORBIDDEN_ORIGIN', detail: '跨源请求被拒绝' } };
  }
  if (WRITE_METHODS.has(req.method)) {
    const sent = String(req.headers['x-jz-token'] || '');
    if (!tokenEquals(sent, WRITE_TOKEN)) {
      return { status: 403, body: { error: 'WRITE_TOKEN_REQUIRED', detail: '写操作需要有效 token' } };
    }
  }
  return null;
}

function tokenEquals(a, b) {
  // 先各自 sha256 再比较，长度恒为 32 字节 —— timingSafeEqual 才不会因长度差异提前返回
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

/** 解析 id：只允许白名单字符，防止 `../../..` 造成目录逃逸 */
export function safeId(id, allowPattern = /^[A-Za-z0-9_-]{1,64}$/) {
  const s = String(id ?? '');
  if (!allowPattern.test(s)) {
    const err = new Error(`INVALID_ID: ${JSON.stringify(s)}`);
    err.code = 'INVALID_ID';
    throw err;
  }
  return s;
}

/**
 * 拼一个必须落在 base 内的路径。
 * 用 path.relative 判定而不是字符串 startsWith：Windows 大小写不敏感。
 */
export function safeJoin(base, rel) {
  const resolvedBase = path.resolve(base);
  const target = path.resolve(resolvedBase, String(rel ?? ''));
  const delta = path.relative(resolvedBase, target);
  if (delta && (delta.startsWith('..') || path.isAbsolute(delta))) {
    const err = new Error('FORBIDDEN_PATH');
    err.code = 'FORBIDDEN_PATH';
    throw err;
  }
  return target;
}

/**
 * 解析"用户给的路径"，并强制它落在允许的根目录里。
 *
 * **所有接受路径的入口都必须走这里**，不要各写一遍 safeJoin + isAbsolute。
 *
 * 接受：相对路径 / root 内的绝对路径（realpath 比较，防 symlink 逃逸）/
 * 同源 URL 的 `?path=` / data URL（抛 INLINE_DATA_URL）。
 * 错误都带 `code`，上层据此映射 4xx 而不是一律 500。
 *
 * @param {object} opts
 * @param {string} opts.root      允许的根目录（通常是 cfg.dataDir）
 * @param {string} opts.input     用户给的路径
 * @param {string[]} [opts.allowSubdirs] 只允许这些子目录（可含 `/` 分层）
 * @param {boolean} [opts.mustExist] 是否要求文件已存在（默认 false）
 * @returns {string} 解析后的绝对路径
 */

/**
 * 尽量解析出真实路径（穿透 symlink / Windows junction）。
 *
 * realpathSync 对不存在的路径会抛错，而 mustExist=false 的上传目标路径还不存在，
 * 所以这里解析"最长的已存在祖先"，再把剩余段拼回去。少了这一步，
 * 相对路径分支看不出 dataDir 内 junction 指向 root 之外。
 */
function realpathLoose(p) {
  let cur = path.resolve(p);
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...tail.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);   // 到盘根仍解析不了
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

/**
 * 把相对路径规范化成可比较的形态：
 *   · path.normalize 收敛 `.` / `..` / 多余分隔符
 *   · 统一成 `/` 分隔并转小写（Windows 大小写不敏感）
 *   · 剥掉每段尾随的点与空格（Win32 的 CreateFile 会静默丢弃它们）
 */
function normalizeRel(rel) {
  const normalized = path.normalize(rel).replace(/\\/g, '/');
  const parts = normalized.split('/').filter((s) => s && s !== '.');
  const stripped = parts.map((s) => s.replace(/[. ]+$/, ''));
  return { normalized, stripped };
}

/**
 * 子目录白名单判定。
 *
 * 逐段比较而不是只比第一段：`allowSubdirs: ['edit/outputs']` 这种嵌套
 * 白名单在"只比首段"的实现下会整目录放行，而 Windows 侧的
 * 尾随点/空格、`::$DATA`（ADS）又都能穿透朴素字符串比较。
 *
 * @param {string} relFinal 相对根的路径
 * @param {string[]} allowSubdirs 允许的子目录（可含 `/` 分层）
 * @returns {boolean}
 */
export function isUnderAllowedSubdir(relFinal, allowSubdirs) {
  const { stripped } = normalizeRel(relFinal);
  if (!stripped.length) return false;
  const target = stripped.map((s) => s.toLowerCase());

  for (const dir of allowSubdirs) {
    const { stripped: dirParts } = normalizeRel(String(dir));
    if (!dirParts.length || dirParts.length > target.length) continue;
    const want = dirParts.map((s) => s.toLowerCase());
    if (want.every((seg, i) => seg === target[i])) return true;
  }
  return false;
}

export function resolveUserPath({ root, input, allowSubdirs = null, mustExist = false }) {
  const fail = (code) => {
    const err = new Error(code);
    err.code = code;
    return err;
  };

  const raw = String(input ?? '').trim();
  if (!raw) throw fail('PATH_REQUIRED');

  // 远程 URL 后端取不到（不是本地文件）
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (/^https?:\/\//i.test(raw)) {
      // 同源 API URL 里可能带 path 参数
      try {
        const u = new URL(raw);
        const p = u.searchParams.get('path');
        if (p) return resolveUserPath({ root, input: p, allowSubdirs, mustExist });
      } catch { /* ignore */ }
    }
    throw fail('FORBIDDEN_PATH');
  }
  // data URL（内联 base64 图）不是文件路径 —— 明确拒绝，而不是静默返回空串
  if (/^data:/i.test(raw)) throw fail('INLINE_DATA_URL');

  const base = (() => {
    try { return fs.realpathSync(path.resolve(root)); } catch { return path.resolve(root); }
  })();

  let target;
  if (raw.startsWith('/') && !/^[A-Za-z]:/.test(raw)) {
    // POSIX 风格但出现在 Win32 上；或同源 API 路径
    try {
      const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
      const p = new URLSearchParams(q).get('path');
      if (p) return resolveUserPath({ root, input: p, allowSubdirs, mustExist });
    } catch { /* ignore */ }
    target = safeJoin(base, raw);
  } else if (path.isAbsolute(raw)) {
    const real = (() => {
      try { return fs.realpathSync(raw); } catch { return path.resolve(raw); }
    })();
    const rel = path.relative(base, real);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw fail('FORBIDDEN_PATH');
    target = real;
  } else {
    target = safeJoin(base, raw);
  }

  // 把结果再"物理化"一次：字符串层面的越界检查看不出 symlink / junction 指向哪
  target = realpathLoose(target);

  // 再核一次（symlink / 大小写 / 短路径都可能绕过字符串比较）
  const relFinal = path.relative(base, target);
  if (relFinal.startsWith('..') || path.isAbsolute(relFinal)) throw fail('FORBIDDEN_PATH');

  /*
   * Windows 特定拒绝：ADS 与尾随点/空格。
   *
   * `data/jobs.json::$DATA` 在 NTFS 上可读，而字符串比较只看到 `jobs.json`；
   * `outputs/a.png.` 的尾随点会被 CreateFile 静默丢掉。两种形态都会让
   * 白名单判定与实际打开的文件不是同一个。
   */
  const segs = relFinal.split(path.sep).filter(Boolean);
  for (const seg of segs) {
    if (seg.includes(':')) throw fail('FORBIDDEN_PATH');
    if (/[. ]$/.test(seg)) throw fail('FORBIDDEN_PATH');
  }

  if (allowSubdirs && allowSubdirs.length && !isUnderAllowedSubdir(relFinal, allowSubdirs)) {
    throw fail('FORBIDDEN_PATH');
  }

  if (mustExist && !fs.existsSync(target)) throw fail('NOT_FOUND');
  return target;
}