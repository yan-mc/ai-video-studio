/**
 * 安全层 —— 插件注册的 handler 路由绕过 DSH 的连接准入，
 * 所以必须自己补上 Origin 同源校验 + 写操作 token。
 *
 * 审查已证实：DSH 的 webServer handler 路由不做任何 Host/Origin/Cookie 检查，
 * 任意网页都能对本机插件 API 发起无预检的简单请求。
 */
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
import path from 'node:path';
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