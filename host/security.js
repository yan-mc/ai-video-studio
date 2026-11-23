/**
 * 安全层 —— 插件注册的 handler 路由绕过 DSH 的连接准入，
 * 所以必须自己补上 Origin 同源校验 + 写操作 token。
 *
 * 审查已证实：DSH 的 webServer handler 路由不做任何 Host/Origin/Cookie 检查，
 * 任意网页都能对本机插件 API 发起无预检的简单请求。
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

// 进程级随机 token，启动时生成，注入 SPA 的 index.html
const WRITE_TOKEN = randomBytes(24).toString('base64url');

export function getWriteToken() {
  return WRITE_TOKEN;
}

/**
 * 判断一个 Origin 是否与本机请求同源。缺省（无 Origin）视为同源导航，放行。
 *
 * 除了 host 比对，还校验：
 *   · protocol 必须一致（旧实现不比对 → http/https 同 host 被视为同源）；
 *   · 带 Origin 的请求若携带 `Sec-Fetch-Site: cross-site`，直接拒绝
 *     （浏览器不会伪造这个头，用来兜住"Origin 被凑成和 Host 一样"的绕过）。
 */
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;              // 同源导航 / 非浏览器客户端
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  const host = req.headers.host;         // 例如 "127.0.0.1:7983"
  if (!host) return false;

  // 反 DNS-rebinding 兜底：浏览器把跨站请求标成 cross-site，且无法被页面伪造。
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false;

  if (parsed.host !== host) return false;
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * 只允许 loopback Host，防止 DNS rebinding（DSH 本身也这么做）。
 *
 * ⚠️ 历史 P0（本次修复）
 *    旧实现最后一条是 `/^127\./.test(hostname)` —— 这个正则只要求**以 `127.` 开头**，
 *    于是 `Host: 127.0.0.1.evil.com` 也会被判为本机。
 *
 *    单独看它似乎无害（还有 Origin 同源校验兜底），但 `isSameOrigin()` 的做法是
 *    **把 Origin 的 host 与请求的 Host 头做「自比对」** —— 攻击者只要让
 *    `Origin: http://127.0.0.1.evil.com` 与 `Host: 127.0.0.1.evil.com` 一致，
 *    两道校验会**同时通过**，guard() 被完整绕过（配合 DNS rebinding 把该域名
 *    解析到 127.0.0.1，浏览器就会把请求真的发到本机 Host）。
 *
 *    所以这里必须是**严格 IP 判定**：整串只能是四个 0-255 的十进制段。
 */
const IPV4_LOOPBACK = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * 判断一个**主机名**是否指向本机（不含端口）。
 *
 * 这是全仓唯一实现：`config.js` 的 `validateComfyUrl` 也必须用它，
 * 否则两处会各自演化（历史上就是 `/^127\./` 与严格四段的差别，
 * 于是 `127.0.0.1.evil.com` 在配置值这条出口上仍然放行 → SSRF）。
 *
 * ⚠️ 不接受 `0.0.0.0`：它的语义是"任意地址"，不是本机。
 *
 * @param {string} hostname 已去掉方括号、已 toLowerCase 的主机名
 */
export function isLoopbackHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  if (h === '127.0.0.1') return true;
  const m = IPV4_LOOPBACK.exec(h);
  if (!m) return false;
  // 每一段都必须 <= 255（Host 头是裸字符串，不受 URL 解析器约束）
  return m.slice(1).every((seg) => Number(seg) <= 255);
}

export function isLoopbackHost(req) {
  const host = String(req.headers.host || '');
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return isLoopbackHostname(hostname);
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 统一入口：返回 null 表示放行，否则返回 { status, body }。
 * @param {import('node:http').IncomingMessage} req
 * @param {string} route  去掉前缀后的路由（用于日志）
 */
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
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 解析 id 并保证不越出 base 目录。
 * 审查证实原实现有 `id=../../..` 递归删除整个项目的严重缺陷。
 */
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
 *
 * ⚠️ 用 `path.relative` 判定而不是字符串 `startsWith`：
 *    Windows 文件系统大小写不敏感，`C:\Data` 与 `c:\data` 是同一个目录，
 *    字符串比较会**误拒**合法路径（功能问题），也可能因大小写差异误放行。
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
 * **所有接受路径的入口都必须走这里**，不要再各写一遍 safeJoin +
 * path.isAbsolute 判断 —— 历史审计发现 6 处各写各的，其中 5 处漏掉了
 * 绝对路径分支，等于给了任意文件读的口子（实测可以读 Windows hosts、
 * 用户 .docker/config.json 这类带凭据的文件）。
 *
 * 支持的输入形态：
 *   · 相对路径      → 相对 root 解析
 *   · 绝对路径      → 必须在 root 内（用 realpath 比较，防 symlink 逃逸）
 *   · 同源 URL      → /jiuzhang/api/file?path=xxx（画布产物常见形态）
 *   · data URL      → 抛 INLINE_DATA_URL（内联图由调用方自己落盘）
 *
 * 抛出的错误都带 `code`，方便上层映射成 4xx 而不是一律 500。
 *
 * @param {object} opts
 * @param {string} opts.root      允许的根目录（通常是 cfg.dataDir）
 * @param {string} opts.input     用户给的路径
 * @param {string[]} [opts.allowSubdirs] 只允许这些一级子目录（可选，进一步收紧）
 * @param {boolean} [opts.mustExist] 是否要求文件已存在（默认 false）
 * @returns {string} 解析后的绝对路径
 */
/**
 * 尽量解析出真实路径（穿透 symlink / Windows junction）。
 *
 * `fs.realpathSync` 对**不存在的路径**会抛错，而 `resolveUserPath` 允许
 * `mustExist=false`（上传落盘前的目标路径）。所以这里解析"最长的已存在祖先"，
 * 再把剩余段原样拼回去。
 *
 * ⚠️ 没有这一步，相对路径分支就是一条**可读 root 之外文件**的口子：
 *    `dataDir` 内放一个指向 `C:\` 的 junction，`resolveUserPath({root: dataDir,
 *    input: 'escape/secret.txt'})` 的字符串比较完全看不出越界
 *    （实测：junction 能读出 root 外的 SECRET，而绝对路径分支因为走了
 *    `realpathSync` 则被正确拒绝 —— 两条分支口径不一致）。
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
  // data URL（内联 base64 图）不是文件路径 —— 明确拒绝，而不是静默返回空串。
  // 静默返回空串会让调用方以为"解析成功但路径为空"，进而把素材静默丢掉。
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

  // 把结果再"物理化"一次：字符串层面的越界检查看不出 symlink / junction 指向哪。
  target = realpathLoose(target);

  // 再核一次（symlink / 大小写 / 短路径都可能绕过字符串比较）
  const relFinal = path.relative(base, target);
  if (relFinal.startsWith('..') || path.isAbsolute(relFinal)) throw fail('FORBIDDEN_PATH');

  if (allowSubdirs && allowSubdirs.length) {
    const top = relFinal.split(path.sep)[0];
    if (!allowSubdirs.includes(top)) throw fail('FORBIDDEN_PATH');
  }

  if (mustExist && !fs.existsSync(target)) throw fail('NOT_FOUND');
  return target;
}