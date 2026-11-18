/**
 * 服务端事件推送（SSE）—— 让「DSH 改了参数」在网页上立即可见。
 *
 * ============================================================================
 * 为什么需要
 * ============================================================================
 *
 * 这是本项目的核心交互设计：**DSH Agent 和浏览器前端操作的是同一份状态**。
 *
 *   DSH Agent 调 studio_shot{action:'save', shot:{...}}
 *       ↓ 后端写 shots.json
 *       ↓ broadcast({ type:'shot-updated', projectId, shotId })
 *       ↓ SSE 推给所有连着的浏览器
 *   → 网页表单立即刷新，用户看到 Agent 改了什么
 *
 * 反过来也一样：用户在网页改参数 → 写 shots.json → Agent 下次读到新值。
 *
 * 这比轮询好在：批量续写进行中，进度需要实时反映。
 *
 * ============================================================================
 * 协议
 * ============================================================================
 *
 *   GET /jiuzhang/api/events        → text/event-stream
 *
 *   事件（JSON）：
 *     { type:'hello', clients:N }
 *     { type:'shot-updated', projectId, shotId, patch? }
 *     { type:'job-progress', jobId, status, percent?, output? }
 *     { type:'batch-progress', batchId, current, total, status }
 *     { type:'config-updated', keys:string[] }
 *     { type:'ping' }                     ← 每 25 秒，防代理超时
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
 * @param {object} event
 * @returns {number} 实际推送的客户端数
 */
export function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  let n = 0;
  for (const c of clients) {
    try {
      c.res.write(payload);
      n++;
    } catch {
      // 写失败说明连接已断，清掉
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
