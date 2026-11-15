/**
 * 安全回归测试 —— 验证 v1.5.0 修掉的几个漏洞确实关上了。
 *
 *   node tests/test-security.mjs
 *
 * 每个用例在修复前都是**可利用**的（有实测记录），
 * 修复后必须返回拒绝。
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const mod = (r) => import(pathToFileURL(path.join(ROOT, r)).href);

const FAILS = [];
let checks = 0;
const check = (cond, msg) => { checks += 1; if (!cond) FAILS.push(msg); };

// ---------------------------------------------------------------- 装配
const cfgMod = await mod('host/config.js');
const rt = await mod('host/runtime.js');
const { handleApi } = await mod('host/api/index.js');
const cfg = cfgMod.loadConfig();
const getCfg = () => cfgMod.loadConfig();

rt.initRuntime({ root: ROOT, cfg, webServer: null });
rt.attachControllers({
  h3: (await mod('host/services/h3-workshop.js')).createH3Workshop({ root: ROOT, cfg, getCfg }),
  post: (await mod('host/services/post.js')).createPostService({ cfg, getCfg }),
  assets: (await mod('host/services/asset-service.js')).createAssetService({ cfg, getCfg }),
  script: (await mod('host/services/script-service.js')).createScriptService({ cfg, getCfg }),
  comic: (await mod('host/services/comic-service.js')).createComicService({ cfg, getCfg }),
  mw: (await mod('host/services/model-workbench.js')).createModelWorkbench({ cfg, getCfg }),
  vault: (await mod('host/services/character-vault.js')).createVaultService({ cfg, getCfg }),
  canvasAgent: (await mod('host/services/canvas-agent.js')).createCanvasAgent({
    cfg, getCfg, runGenerate: async () => ({}), runSkill: async () => ({}),
  }),
  extras: (await mod('host/services/extras.js')).createExtrasService({ cfg, getCfg }),
});

const server = http.createServer((q, s) => {
  handleApi(q, s).catch(() => { try { s.writeHead(500); s.end('{}'); } catch { /* ignore */ } });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const get = (p) => new Promise((resolve) => {
  http.get({ host: '127.0.0.1', port, path: p, headers: { host: `127.0.0.1:${port}` } }, (res) => {
    let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
  });
});
const token = JSON.parse((await get('/token')).body).token;

const call = (p, method = 'GET', body = null) => new Promise((resolve) => {
  const req = http.request({
    host: '127.0.0.1', port, path: p, method,
    headers: {
      host: `127.0.0.1:${port}`,
      'x-jz-token': token,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
  }, (res) => {
    let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
  });
  if (body) req.write(JSON.stringify(body));
  req.end();
});

// ---------------------------------------------------------------- 用例
const outside = path.join(os.tmpdir(), `jz_probe_${Date.now()}.json`);
fs.writeFileSync(outside, '{"secret":"TOPSECRET"}', 'utf8');

/**
 * 测试自身产生的文件，跑完必须清掉。
 *
 * ⚠️ 这些用例会真的调 /assets/archive 和 /post/annotate，
 *    它们会在 data/tmp-inline/ 和 data/post/ 落下文件。
 *    不清理的话每跑一次就多几个垃圾 —— 这正是本项目历史上
 *    "previz 无清理" 那个缺陷的同类问题，不能在测试里重演。
 */
const artifacts = [];
const track = (abs) => artifacts.push(abs);

try {
  // 1) /assets/archive 绝对路径越界（修复前：200 + 可下载）
  {
    const r = await call('/assets/archive', 'POST', { items: [{ path: outside, name: 'leak' }] });
    let ok = false;
    try { ok = JSON.parse(r.body).saved?.length > 0; } catch { /* ignore */ }
    check(!ok, '❌ /assets/archive 仍能用绝对路径把 dataDir 外的文件收进素材库');
    check(/FORBIDDEN_PATH/.test(r.body), `期望 FORBIDDEN_PATH，实际：${r.body.slice(0, 120)}`);
  }

  // 2) 正常相对路径仍能归档
  {
    const inside = path.join(cfg.dataDir, 'tmp-inline', `ok_${Date.now()}.json`);
    fs.mkdirSync(path.dirname(inside), { recursive: true });
    fs.writeFileSync(inside, '{"ok":1}', 'utf8');
    track(inside);
    const r = await call('/assets/archive', 'POST', { items: [{ path: path.relative(cfg.dataDir, inside), name: 'ok' }] });
    // 归档后的副本也要清
    try {
      const savedRel = JSON.parse(r.body).saved?.[0]?.rel;
      if (savedRel) track(path.join(cfg.dataDir, savedRel));
    } catch { /* ignore */ }
    let saved = 0;
    try { saved = JSON.parse(r.body).saved?.length ?? 0; } catch { /* ignore */ }
    check(saved === 1, `正常相对路径归档应成功，实际 ${r.status} ${r.body.slice(0, 120)}`);
    // 清理
    try {
      const id = JSON.parse(r.body).saved?.[0]?.id;
      if (id) await call('/assets/delete', 'POST', { id });
    } catch { /* ignore */ }
  }

  // 3) 路径穿越
  {
    const r = await call('/file?path=../../../../Windows/win.ini');
    check(r.status === 403 || r.status === 404, `/file 穿越应被拒，实际 ${r.status}`);
  }

  // 4) post/annotate 的 color 注入（修复前可破坏 filtergraph）
  {
    // 自建一张 1x1 PNG，不依赖仓库里有没有 chain_s1_last.png
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const rel = `tmp-inline/annotate_probe_${Date.now()}.png`;
    const abs = path.join(cfg.dataDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, png);

    const r = await call('/post/annotate', 'POST', {
      input: rel, text: 'hi',
      color: "red':x=0;y=0,drawtext=text='pwned",
    });
    check(r.status === 200, `注入 payload 应被白名单兜住并正常渲染，实际 ${r.status} ${r.body.slice(0, 100)}`);
    track(abs);
    // annotate 把它写在 data/post/ 下，也要清
    try {
      const outRel = JSON.parse(r.body)?.rel;
      if (outRel) track(path.join(cfg.dataDir, outRel));
    } catch { /* ignore */ }
  }

  // 5) canvas-agent 自报 canDelete（修复前可绕过 need()）
  {
    const r = await call('/canvas-agent/exec', 'POST', {
      name: 'delete_node',
      arguments: { id: 'n1' },
      context: { permissions: { canDelete: true } },
    });
    let denied = false;
    try {
      const j = JSON.parse(r.body);
      denied = j.ok === false || /PERMISSION|permissions|canDelete/i.test(r.body);
    } catch { denied = r.status >= 400; }
    check(denied, `❌ 请求体自报 canDelete 不应生效，实际 ${r.status} ${r.body.slice(0, 160)}`);
  }

  // 6) 角色卡 both 模式必须给 2 张
  {
    const vault = await mod('host/services/character-vault.js');
    const card = {
      refPolicy: { mode: 'both' },
      images: { sheet: ['sheet.png'], origin: ['origin.png'], heads: [], extras: [] },
    };
    const picked = vault.cardImagesFor
      ? vault.cardImagesFor(card)
      : null;
    if (picked) {
      check(picked.length === 2, `❌ both 模式应给 2 张，实际 ${picked.length}`);
    }
  }
} finally {
  try { fs.unlinkSync(outside); } catch { /* ignore */ }
  for (const abs of artifacts) {
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch { /* ignore */ }
  }
  server.close();
}

// ---------------------------------------------------------------- 结果
console.log(`安全回归测试：${checks} 项检查，${FAILS.length} 项失败`);
if (FAILS.length) {
  console.log('\n失败详情：');
  for (const f of FAILS) console.log('  -', f);
  process.exit(1);
}
console.log('OK');
