/**
 * REST 分发器。
 *
 * 全部挂在 /jiuzhang/api 前缀下（handler 路由，绕过 DSH 准入 → 必须自查 security）。
 * 本文件只做四件事：URL 解析 → guard → 依次询问各域 router → 统一错误映射。
 * 业务在 routes/ 下，按域分文件。
 */
import path from 'node:path';
import { loadConfig } from '../config.js';
import { guard, safeId, resolveUserPath } from '../security.js';
import { getRuntime } from '../runtime.js';
import { CancelledError } from '../services/job-runner.js';
import { sendJson } from './http.js';
import { statusForError } from './errors.js';
import { handleMeta } from './routes/meta.js';
import { handleNanfeng } from './routes/nanfeng.js';
import { handleGenerate } from './routes/generate.js';
import { handleProjects } from './routes/projects.js';
import { handlePrompt } from './routes/prompt.js';
import { handleImage } from './routes/image.js';
import { handleVault } from './routes/vault.js';
import { handleMedia } from './routes/media.js';
import { handleBlender } from './routes/blender.js';
import { handleReplace } from './routes/replace.js';
import { handleToolbox } from './routes/toolbox.js';

/**
 * 路由域表 —— 顺序即匹配顺序。
 *
 * 后一个域只能看到前一个域没处理的路由，所以顺序必须保持稳定：
 * 精确路径先于前缀路径（`/jobs/batch-progress` 必须在 `/jobs/:id` 之前）。
 */
const ROUTERS = [
  handleMeta,
  handleNanfeng,
  handleGenerate,
  handleToolbox,
  handleProjects,
  handlePrompt,
  handleImage,
  handleVault,
  handleMedia,
  handleBlender,
  handleReplace,
];

/**
 * 处理一次 API 请求。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleApi(req, res) {
  const ctx = getRuntime();
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = url.pathname.replace(/^\/jiuzhang\/api/, '') || '/';

  try {
    const denied = guard(req, route);
    if (denied) return sendJson(res, denied.status, denied.body);

    const R = {
      ctx,
      cfg: loadConfig(),
      url,
      route,
      path,
      json: (code, value) => sendJson(res, code, value),
      safeId,
      resolveUserPath,
    };

    for (const handler of ROUTERS) {
      // eslint-disable-next-line no-await-in-loop -- 顺序即语义
      const handled = await handler(req, res, R);
      if (handled !== false) return handled;
    }

    // 错误码与消息分字段：前端需要 `e.code === 'UNKNOWN_ROUTE'` 能分支
    return sendJson(res, 404, { error: 'UNKNOWN_ROUTE', detail: `${req.method} ${route}` });
  } catch (err) {
    if (err instanceof CancelledError) {
      return sendJson(res, 409, { error: String(err?.message || err) });
    }
    const status = statusForError(err);
    const code = String(err?.code || '');
    const msg = String(err?.message || err);
    return sendJson(res, status, { error: msg, ...(code ? { code } : {}) });
  }
}

export { VALID_BACKENDS, executeBackend, loadImageWorkflow } from './backend.js';
