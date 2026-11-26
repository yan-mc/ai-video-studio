/**
 * 媒体域：静态二进制服务（/assets/item /file）、资产 CRUD、后处理 /post/*、剪辑 /edit/*。
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJsonBody, readRawBody, parseMultipart, parseRangeHeader, pipeStream, MIME_BY_EXT } from '../http.js';
import { resolveUserPath, safeJoin } from '../../security.js';
import { isServableDataPath, listChineseFonts, servableDirsHint } from '../archive.js';
import { probeMedia } from '../../services/media-probe.js';

const EDIT_PROJECT = /^\/edit\/projects\/([^/]+)$/;

/** /assets/archive 允许的来源子目录（只允许本来就是产物/素材的目录） */
const ARCHIVE_SUBDIRS = Object.freeze(['outputs', 'assets', 'previz', 'post', 'tmp-inline', 'inputs']);

/**
 * 二进制响应的**唯一实现**（/file 与 /assets/item 共用）。
 *
 * 两处各写一份的代价是缓存语义漂移（一处 no-store、一处 no-cache），
 * 而且新增安全头时必然漏掉一处。
 *
 * SVG 是可执行文档，以 `image/svg+xml` 内联返回 = 同源存储型 XSS
 * （该源上挂着写接口，令牌可从 /token 取到）→ 一律强制 attachment + nosniff。
 *
 * @param {object} opts
 * @param {string} opts.cacheControl
 * @param {boolean} [opts.attachmentForSvg]
 * @param {string} [opts.downloadName] SVG 下载时的固定文件名
 */
export function serveBinary(req, res, abs, stat, opts = {}) {
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const headers = { 'X-Content-Type-Options': 'nosniff' };
  if (ext === '.svg' && opts.attachmentForSvg !== false) {
    headers['Content-Disposition'] = `attachment; filename="${opts.downloadName || 'download.svg'}"`;
  }

  const range = parseRangeHeader(req.headers.range, stat.size);
  if (range && range.invalid) {
    res.writeHead(416, { 'Content-Range': `bytes */${stat.size}`, ...headers });
    return res.end();
  }
  if (range) {
    res.writeHead(206, {
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
      'Content-Length': range.end - range.start + 1,
      'Cache-Control': opts.cacheControl ?? 'no-store',
      ...headers,
    });
    return pipeStream(res, abs, range);
  }
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': opts.cacheControl ?? 'no-store',
    ...headers,
  });
  if (req.method === 'HEAD') return res.end();
  return pipeStream(res, abs);
}

export async function handleMedia(req, res, R) {
  const { route, url, cfg, ctx, json, safeId, resolveUserPath } = R;

  /** 后处理 op 的统一入口（8 条同构 handler 共用一个实现） */
  const postOp = async (op) => {
    const body = await readJsonBody(req);
    return json(200, await ctx.post[op](body));
  };

  /* ---------------- 资产 ---------------- */

  if (req.method === 'GET' && route === '/assets') {
    const type = url.searchParams.get('type') || undefined;
    const projectId = url.searchParams.get('projectId') || undefined;
    return json(200, await ctx.assets.list({ type, projectId }));
  }

  if (req.method === 'POST' && route === '/assets/upload') {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.includes('multipart/form-data')) {
      return json(400, { error: 'USE_MULTIPART', detail: '请用 multipart/form-data 上传' });
    }
    const raw = await readRawBody(req, 256 * 1024 * 1024);
    const parts = parseMultipart(raw, ct);

    const fields = {};
    const files = [];
    for (const p of parts) {
      if (p.filename) files.push(p);
      else fields[p.name] = p.data.toString('utf8');
    }
    if (!files.length) return json(400, { error: 'UPLOAD_EMPTY' });

    const saved = [];
    for (const f of files) {
      try {
        const item = await ctx.assets.saveUploaded(f.data, {
          filename: f.filename,
          type: fields.type,
          name: fields.name || f.filename,
          projectId: fields.projectId,
          tag: fields.tag,
          note: fields.note,
        });

        // 上传后立刻探测媒体信息：前端不用等到渲染时才发现"这段视频其实没有音轨"
        if (item.kind === 'video' || item.kind === 'audio') {
          try {
            const probe = await probeMedia(safeJoin(cfg.dataDir, item.rel), cfg);
            if (probe.ok) {
              const enriched = {
                ...item,
                durationSec: probe.durationSec,
                hasAudio: probe.hasAudio,
                mediaWidth: probe.width,
                mediaHeight: probe.height,
                fps: probe.fps,
                codecs: { video: probe.videoCodec, audio: probe.audioCodec },
                dataJson: JSON.stringify({
                  durationSec: probe.durationSec,
                  hasAudio: probe.hasAudio,
                  width: probe.width,
                  height: probe.height,
                  fps: probe.fps,
                }),
              };
              await ctx.assets.upsertRaw(enriched);
              saved.push(enriched);
              continue;
            }
          } catch { /* 探测失败不影响上传 */ }
        }
        saved.push(item);
      } catch (e) {
        return json(400, { error: String(e.message || e), file: f.filename });
      }
    }
    return json(200, { ok: true, saved, count: saved.length, fields });
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && route === '/assets/item') {
    const id = url.searchParams.get('id');
    try {
      const abs = await ctx.assets.resolveFile(id);
      return serveBinary(req, res, abs, fs.statSync(abs), {
        cacheControl: 'no-store',
        downloadName: 'download.svg',
      });
    } catch (e) {
      return json(404, { error: String(e.message || e) });
    }
  }

  if (req.method === 'POST' && route === '/assets/delete') {
    const body = await readJsonBody(req);
    return json(200, await ctx.assets.remove(body.id));
  }

  /*
   * 产物归档：生成产物落在 data/outputs/（临时区），归档后变成正式素材。
   *
   * 子目录白名单是**必须的**：archive 是服务端自己把文件搬进 assets/，
   * 天然绕过 /file 的 SERVABLE_DATA_DIRS 白名单 ——
   * 不收紧的话 `{"path":"config.json"}` 就能把明文配置搬进素材库再下载。
   */
  if (req.method === 'POST' && route === '/assets/archive') {
    const body = await readJsonBody(req);
    const items = Array.isArray(body.items) ? body.items : [body];
    const saved = [];
    const failed = [];
    for (const it of items) {
      try {
        const abs = resolveUserPath({
          root: cfg.dataDir,
          input: typeof it.path === 'string' && it.path ? it.path : it.rel,
          mustExist: true,
          allowSubdirs: ARCHIVE_SUBDIRS,
        });
        saved.push(await ctx.assets.archiveFile(abs, {
          type: it.type ?? 'general',
          name: it.name,
          projectId: it.projectId ?? null,
          tag: it.tag ?? 'archived',
          note: it.note ?? '',
        }));
      } catch (e) {
        failed.push({ input: it, error: String(e?.message || e) });
      }
    }
    return json(200, { ok: failed.length === 0, saved, count: saved.length, failed });
  }

  /* ---------------- 文件服务（产物/资产，带 Range） ---------------- */
  //
  // 只允许 dataDir 下的**指定子目录**：dataDir 根下还有 config.json（含密钥）、
  // jobs.json、projects.json 等，整体放行等于绕过 /config 的掩码。
  if ((req.method === 'GET' || req.method === 'HEAD') && route === '/file') {
    const rel = url.searchParams.get('path');
    if (!rel) return json(400, { error: 'PATH_REQUIRED' });

    let abs;
    try {
      // 必须走 resolveUserPath：safeJoin 只是字符串判断，看不出 symlink / junction
      abs = resolveUserPath({ root: cfg.dataDir, input: rel, mustExist: true });
    } catch (e) {
      const code = e?.code || 'FORBIDDEN_PATH';
      return json(code === 'NOT_FOUND' ? 404 : 403, { error: code, path: rel });
    }
    if (!isServableDataPath(cfg.dataDir, abs)) {
      return json(403, {
        error: 'FORBIDDEN_PATH',
        detail: `只允许读取产物与素材子目录（${servableDirsHint()}）`,
        path: rel,
      });
    }
    let stat;
    try { stat = fs.statSync(abs); } catch { return json(404, { error: 'NOT_FOUND', path: rel }); }
    if (!stat.isFile()) return json(404, { error: 'NOT_FOUND', path: rel });

    // fixed 文件名：用途是"下载而非渲染"，也避免把用户文件名拼进 header
    return serveBinary(req, res, abs, stat, { cacheControl: 'no-cache', downloadName: 'download.svg' });
  }

  /* ---------------- 后处理 / 图像工具 ---------------- */

  // 8 条 op 的 handler 逐字相同，只有服务方法名不同 → 共用 postOp()
  if (req.method === 'POST' && route === '/post/transcode') return postOp('transcode');
  if (req.method === 'POST' && route === '/post/scale') return postOp('scale');
  if (req.method === 'POST' && route === '/post/crop') return postOp('crop');
  if (req.method === 'POST' && route === '/post/split') return postOp('split');
  if (req.method === 'POST' && route === '/post/annotate') return postOp('annotate');
  if (req.method === 'POST' && route === '/post/extractFrame') return postOp('extractFrame');
  if (req.method === 'POST' && route === '/post/extractAudio') return postOp('extractAudio');
  // 去音轨是人物替换的必备前置：参考视频自带的音轨会被当作 <Audio j> 送进条件
  if (req.method === 'POST' && route === '/post/stripAudio') return postOp('stripAudio');

  // qc 收的是**一个字符串**（媒体路径），其余 op 收对象
  if (req.method === 'POST' && route === '/post/qc') {
    const body = await readJsonBody(req);
    const target = body.input ?? body.path;
    if (!target) return json(400, { error: 'INPUT_REQUIRED', detail: 'qc 需要 input（媒体文件路径）' });
    return json(200, await ctx.post.qc(target));
  }

  if (req.method === 'GET' && route === '/post/fonts') {
    return json(200, { fonts: listChineseFonts() });
  }

  /* ---------------- 视频剪辑（裁切 / 拼接 / 音轨） ---------------- */

  if (req.method === 'GET' && route === '/edit/clips') {
    return json(200, ctx.edit.listClips());
  }
  if (req.method === 'POST' && route === '/edit/probe') {
    const body = await readJsonBody(req);
    if (!body.input) return json(400, { error: 'INPUT_REQUIRED' });
    return json(200, await ctx.edit.probe(body.input));
  }
  if (req.method === 'POST' && route === '/edit/trim') {
    const body = await readJsonBody(req);
    if (!body.input) return json(400, { error: 'INPUT_REQUIRED' });
    return json(200, await ctx.edit.trim(body));
  }
  if (req.method === 'POST' && route === '/edit/concat') {
    const body = await readJsonBody(req);
    return json(200, await ctx.edit.concat(body));
  }
  if (req.method === 'POST' && route === '/edit/audio') {
    const body = await readJsonBody(req);
    if (!body.input) return json(400, { error: 'INPUT_REQUIRED' });
    return json(200, await ctx.edit.audio(body));
  }
  if (req.method === 'POST' && route === '/edit/render') {
    const body = await readJsonBody(req);
    return json(200, await ctx.edit.render(body));
  }
  if (req.method === 'GET' && route === '/edit/projects') {
    return json(200, await ctx.edit.listProjects());
  }
  if (req.method === 'POST' && route === '/edit/projects') {
    const body = await readJsonBody(req);
    const id = safeId(String(body.id || `edit_${Date.now().toString(36)}`));
    return json(200, { ok: true, project: ctx.edit.saveProject(id, body) });
  }

  const me = EDIT_PROJECT.exec(route);
  if (me) {
    const id = me[1];
    if (req.method === 'GET') return json(200, { ok: true, project: ctx.edit.getProject(id) });
    if (req.method === 'DELETE') return json(200, ctx.edit.deleteProject(id));
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      const body = await readJsonBody(req);
      return json(200, { ok: true, project: ctx.edit.saveProject(id, body) });
    }
  }

  return false;
}

