/**
 * 预演引擎控制器 —— 管理内置 previz server.mjs 子进程。
 *
 * 沿用已验证可用的方式：spawn services/previz/server.mjs（HTTP :4318）。
 * 引擎本体属于拆解产物，已在 .gitignore 中排除，仅本地存在。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function createPrevizController({ root, cfg }) {
  let child = null;
  let childPort = null;

  const serviceDir = path.join(root, '..', 'services', 'previz');
  const serverEntry = path.join(serviceDir, 'server.mjs');

  function port() {
    return Number(cfg.previzPort) || 4318;
  }

  function url() {
    return `http://127.0.0.1:${port()}/`;
  }

  async function health() {
    try {
      const res = await fetch(`${url()}api/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return { ok: false, running: false, detail: `HTTP ${res.status}`, url: url() };
      const body = await res.json().catch(() => ({}));
      return {
        ok: true, running: true, url: url(),
        detail: body?.service || 'previs-engine',
        home: body?.home || null,
      };
    } catch (e) {
      return { ok: false, running: false, detail: `不可达（${e.message}）`, url: url() };
    }
  }

  async function start() {
    const h = await health();
    if (h.ok) return { ok: true, already: true, url: url() };

    if (!fs.existsSync(serverEntry)) {
      throw new Error(`PREVIZ_ENTRY_MISSING: ${serverEntry}（引擎属于本地拆解产物，需先部署）`);
    }
    if (child && !child.killed) return { ok: true, starting: true, url: url() };

    childPort = port();
    const home = path.join(cfg.dataDir, 'previz');
    fs.mkdirSync(home, { recursive: true });

    child = spawn(process.execPath, [serverEntry], {
      cwd: serviceDir,
      env: {
        ...process.env,
        PREVIZ_ENGINE_HOME: home,
        PREVIZ_ENGINE_HOST: '127.0.0.1',
        PREVIZ_ENGINE_PORT: String(childPort),
        PORT: String(childPort),
      },
      windowsHide: true,
      stdio: 'ignore',
    });
    child.on('exit', () => { child = null; childPort = null; });

    // 等就绪（最多 15s）
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
      const cur = await health();
      if (cur.ok) return { ok: true, started: true, url: url() };
    }
    return { ok: false, started: false, detail: '启动超时（15s 内未就绪）', url: url() };
  }

  function stop() {
    if (child && !child.killed) {
      try { child.kill(); } catch { /* ignore */ }
      child = null;
      childPort = null;
    }
    return { ok: true, stopped: true };
  }

  async function state() {
    const r = await fetch(`${url()}api/project`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`PREVIZ_HTTP_${r.status}`);
    return await r.json();
  }

  async function command(name, args) {
    const r = await fetch(`${url()}api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args || {} }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body?.ok === false) throw new Error(body?.error || `PREVIZ_CMD_${r.status}`);
    return body?.result ?? body;
  }

  return { start, stop, health, state, command, url, port, get child() { return child; } };
}