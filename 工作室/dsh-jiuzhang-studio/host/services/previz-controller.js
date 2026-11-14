/**
 * 预演引擎控制器 —— 管理外部 previz server.mjs 子进程。
 *
 * ⚠️ 引擎本体**不在本插件仓库里**（属于第三方拆解产物，许可证不允许分发）。
 *    之前写死成 `<插件>/../services/previz/server.mjs`：因为插件在
 *    `工作室/dsh-jiuzhang-studio/`，所以实际指向 `工作室/services/previz/`。
 *    结果是——**从 GitHub clone 插件的用户永远没有 3D 预演**，
 *    而 README 把它列为核心特性，且失败信息只说"需先部署"，不说去哪配。
 *
 *    现在改成显式定位 + 可配置：
 *      1) 配置项 `previzDir`
 *      2) 环境变量 `PREVIZ_HOME` / `DSH_PREVIZ_DIR`
 *      3) `<插件>/../services/previz`（老布局，保持兼容）
 *      4) `<dataDir>/previz-engine`（用户自己放引擎的位置）
 *    全部找不到时，health() 返回 `available:false` 并给出可操作的提示，
 *    页面据此显示"未安装"而不是一个莫名其妙的"离线"。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function createPrevizController({ root, cfg }) {
  let child = null;
  let childPort = null;

  /** 候选引擎目录（按优先级） */
  function engineDirs() {
    const out = [];
    const push = (p) => { if (p && !out.includes(p)) out.push(p); };
    if (cfg?.previzDir) push(path.resolve(String(cfg.previzDir)));
    if (process.env.PREVIZ_HOME) push(path.resolve(process.env.PREVIZ_HOME));
    if (process.env.DSH_PREVIZ_DIR) push(path.resolve(process.env.DSH_PREVIZ_DIR));
    // 老布局：插件在 <workspace>/工作室/dsh-jiuzhang-studio，引擎在 <workspace>/工作室/services/previz
    push(path.join(root, '..', 'services', 'previz'));
    // 用户自备：放进数据目录
    if (cfg?.dataDir) push(path.join(cfg.dataDir, 'previz-engine'));
    return out;
  }

  /** 找到真正含 server.mjs 的目录；没有返回 '' */
  function resolveEngineDir() {
    for (const d of engineDirs()) {
      try {
        if (fs.existsSync(path.join(d, 'server.mjs'))) return d;
      } catch { /* ignore */ }
    }
    return '';
  }

  function serverEntry() {
    const d = resolveEngineDir();
    return d ? path.join(d, 'server.mjs') : '';
  }

  function port() {
    return Number(cfg.previzPort) || 4318;
  }

  function url() {
    return `http://127.0.0.1:${port()}/`;
  }

  /** 引擎未安装时的统一提示（前端直接展示） */
  function missingHint() {
    return '未安装 3D 预演引擎。引擎本体不随插件分发（许可证限制），'
      + `请把 previz 引擎目录放到 ${path.join(cfg?.dataDir ?? '<dataDir>', 'previz-engine')}，`
      + '或通过配置项 previzDir / 环境变量 PREVIZ_HOME 指定其位置。';
  }

  async function health() {
    if (!resolveEngineDir()) {
      // 没装引擎就不要去打网络 —— 直接给出可操作的原因
      const remote = await probeRemote().catch(() => null);
      if (remote) return remote;                 // 但用户可能在别处跑着，尊重它
      return {
        ok: false, running: false, available: false,
        detail: 'ENGINE_NOT_INSTALLED', hint: missingHint(), url: url(),
      };
    }
    try {
      const res = await fetch(`${url()}api/health`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return { ok: false, running: false, available: true, detail: `HTTP ${res.status}`, url: url() };
      const body = await res.json().catch(() => ({}));
      return {
        ok: true, running: true, available: true, url: url(),
        detail: body?.service || 'previs-engine',
        home: body?.home || null,
      };
    } catch (e) {
      return { ok: false, running: false, available: true, detail: `不可达（${e.message}）`, url: url() };
    }
  }

  /** 探一下 configured url 上是否已经有一个引擎在跑（用户手动启动的情况） */
  async function probeRemote() {
    try {
      const res = await fetch(`${url()}api/health`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      const body = await res.json().catch(() => ({}));
      return {
        ok: true, running: true, available: true, url: url(), external: true,
        detail: body?.service || 'previs-engine', home: body?.home || null,
      };
    } catch { return null; }
  }

  async function start() {
    const h = await health();
    if (h.ok) return { ok: true, already: true, url: url() };

    const entry = serverEntry();
    if (!entry) {
      return { ok: false, started: false, available: false, detail: 'ENGINE_NOT_INSTALLED', hint: missingHint(), url: url() };
    }
    if (child && !child.killed) return { ok: true, starting: true, url: url() };

    childPort = port();
    const home = path.join(cfg.dataDir, 'previz');
    fs.mkdirSync(home, { recursive: true });

    child = spawn(process.execPath, [entry], {
      cwd: path.dirname(entry),
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
    return { ok: false, started: false, available: true, detail: '启动超时（15s 内未就绪）', url: url() };
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

  return {
    start, stop, health, state, command, url, port,
    resolveEngineDir, serverEntry, missingHint,
    get child() { return child; },
  };
}