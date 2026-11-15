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

/** 判断一个 Origin 是否与本机请求同源。缺省（无 Origin）视为同源导航，放行。 */
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;              // 同源导航 / 非浏览器客户端
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  const host = req.headers.host;         // 例如 "127.0.0.1:7983"
  if (!host) return false;
  return parsed.host === host;
}

/** 只允许 loopback Host，防止 DNS rebinding（DSH 本身也这么做）。 */
export function isLoopbackHost(req) {
  const host = String(req.headers.host || '');
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    || /^127\./.test(hostname);
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
  if (!allowPattern.test(s)) throw new Error(`INVALID_ID: ${JSON.stringify(s)}`);
  return s;
}

export function safeJoin(base, rel) {
  const resolvedBase = path.resolve(base);
  const target = path.resolve(resolvedBase, String(rel ?? ''));
  const prefix = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  if (target !== resolvedBase && !target.startsWith(prefix)) {
    throw new Error('FORBIDDEN_PATH');
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
 *   · data URL      → 返回 ''（调用方应自己落盘，这里不处理）
 *
 * @param {object} opts
 * @param {string} opts.root      允许的根目录（通常是 cfg.dataDir）
 * @param {string} opts.input     用户给的路径
 * @param {string[]} [opts.allowSubdirs] 只允许这些一级子目录（可选，进一步收紧）
 * @param {boolean} [opts.mustExist] 是否要求文件已存在（默认 false）
 * @returns {string} 解析后的绝对路径；不合法时抛 FORBIDDEN_PATH / PATH_REQUIRED
 */
export function resolveUserPath({ root, input, allowSubdirs = null, mustExist = false }) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('PATH_REQUIRED');

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
    throw new Error('FORBIDDEN_PATH');
  }

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
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('FORBIDDEN_PATH');
    target = real;
  } else {
    target = safeJoin(base, raw);
  }

  // 再核一次（symlink / 大小写 / 短路径都可能绕过字符串比较）
  const relFinal = path.relative(base, target);
  if (relFinal.startsWith('..') || path.isAbsolute(relFinal)) throw new Error('FORBIDDEN_PATH');

  if (allowSubdirs && allowSubdirs.length) {
    const top = relFinal.split(path.sep)[0];
    if (!allowSubdirs.includes(top)) throw new Error('FORBIDDEN_PATH');
  }

  if (mustExist && !fs.existsSync(target)) throw new Error('NOT_FOUND');
  return target;
}