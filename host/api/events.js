/**
 * 服务端事件推送（SSE）—— DSH Agent 与浏览器共享同一份状态，改动即时可见。
 *
 * GET /jiuzhang/api/events → text/event-stream，事件体为 JSON：
 *   { type:'hello', clients:N }
 *   { type:'shot-updated', projectId, shotId, patch? }
 *   { type:'batch-progress', batchId, current, total, status }
 *   { type:'replace-progress', replaceId, ... }
 *   { type:'ping' }                     ← 每 25 秒，防代理超时
 *
 * @module api/events
 */

/** 已连接的客户端 */
const clients = new Set();

/** ping 定时器 */
let pingTimer = null;

/**
 * 处理一个 SSE 连接。
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    // 禁用 nginx 缓冲（如果将来放在反代后面）
    'X-Accel-Buffering': 'no',
  });

  // 初始握手
  res.write(`data: ${JSON.stringify({ type: 'hello', clients: clients.size + 1 })}\n\n`);

  const client = { res };
  clients.add(client);
  ensurePing();

  const cleanup = () => {
    clients.delete(client);
    if (clients.size === 0) stopPing();
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
}

/**
 * 广播一条事件给所有在线客户端。
 *
 * `res.write()` 对已关闭的响应**不抛错**（只返回 false 或触发 error 事件），
 * 所以不能用 try/catch 判活 —— 死连接会一直留在 Set 里导致 clientCount 虚高。
 * 必须先看可写状态再写。
 *
 * @param {object} event
 * @returns {number} 实际推送的客户端数
 */
export function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  let n = 0;
  for (const c of clients) {
    if (!c?.res || c.res.writableEnded || c.res.destroyed) {
      clients.delete(c);
      continue;
    }
    try {
      c.res.write(payload);
      n += 1;
    } catch {
      clients.delete(c);
    }
  }
  return n;
}

/** 当前连接数（供 /health 展示） */
export function clientCount() {
  return clients.size;
}

function ensurePing() {
  if (pingTimer) return;
  pingTimer = setInterval(() => {
    broadcast({ type: 'ping' });
  }, 25000);
  // 不要阻止进程退出
  if (typeof pingTimer.unref === 'function') pingTimer.unref();
}

function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

/**
 * 安全地广播 —— 事件推送失败绝不影响主流程。
 *
 * 调用点一律用这个，不要直接 broadcast()，避免 SSE 故障拖垮生成。
 */
export function emit(event) {
  try {
    return broadcast(event);
  } catch {
    return 0;
  }
}
