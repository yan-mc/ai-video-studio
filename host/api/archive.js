/**
 * 产物归档 + 字体 + /file 白名单 + 免令牌守卫。
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSameOrigin as _isSameOrigin, isLoopbackHost as _isLoopbackHost, isUnderAllowedSubdir } from '../security.js';
import { runJob } from '../services/job-runner.js';

/**
 * 跑一个任务，成功后把产物**自动归档进素材库**。
 *
 * 所有生成入口共用这一份，归档失败不影响任务结果（产物已生成，只是没进素材库）。
 */
export function runAndArchive(job, run, ctx) {
  return runJob(job, async (running, hooks) => {
    const result = await run(running, hooks);
    try {
      const outs = Array.isArray(result?.outputs) ? result.outputs : [];
      const archived = [];
      for (const o of outs) {
        if (!o?.path) continue;
        try {
          const item = await ctx.assets.archiveFile(o.path, {
            // ASSET_TYPES 白名单没有 'video'，写它会被静默降级成 general
            type: job.kind === 'image' ? 'general' : 'video_segment',
            name: `${job.kind === 'image' ? '图' : '片'}_${running.id}`,
            projectId: job.projectId ?? null,
            tag: 'auto-archived',
            note: String(running.prompt ?? '').slice(0, 200),
          });
          // 必须记下**源产物路径**，回填时按它对账（归档后文件名已变）
          archived.push({ id: item.id, rel: item.rel, assetId: item.id, sourcePath: o.path });
        } catch { /* 单条失败不阻断 */ }
      }
      if (archived.length) {
        const norm = (p) => String(p ?? '').replace(/\\/g, '/');
        result.outputs = outs.map((o) => {
          const hit = archived.find((a) => a.sourcePath && norm(a.sourcePath) === norm(o.path));
          return hit ? { ...o, assetId: hit.assetId, archivedRel: hit.rel } : o;
        });
      }
    } catch { /* 归档整体失败不影响产物 */ }
    return result;
  });
}

/**
 * 列出可用的中文字体文件（ffmpeg drawtext 需要真实字体路径）。
 * 走系统字体目录 + DSH_POST_FONT 覆盖，不硬编码盘符。
 */
export function listChineseFonts() {
  const out = [];
  const push = (p) => {
    try { if (p && fs.existsSync(p) && !out.includes(p)) out.push(p); } catch { /* ignore */ }
  };

  if (process.env.DSH_POST_FONT) push(process.env.DSH_POST_FONT);

  const names = [
    'msyh.ttc', 'msyhbd.ttc', 'simhei.ttf', 'simsun.ttc',   // Windows
    'PingFang.ttc', 'Hiragino Sans GB.ttc',                 // macOS
    'NotoSansCJK-Regular.ttc', 'wqy-zenhei.ttc', 'DejaVuSans.ttf', // Linux
  ];
  const dirs = [];
  if (process.env.SystemRoot) dirs.push(path.join(process.env.SystemRoot, 'Fonts'));
  if (process.env.WINDIR) dirs.push(path.join(process.env.WINDIR, 'Fonts'));
  dirs.push(
    '/System/Library/Fonts',
    '/Library/Fonts',
    '/usr/share/fonts',
    '/usr/share/fonts/truetype',
    '/usr/local/share/fonts',
  );
  for (const d of dirs) {
    for (const n of names) push(path.join(d, n));
  }
  return out;
}

// 允许通过 /file 读取的 dataDir 子目录（产物与素材）。
// 白名单而非黑名单：新增运行时文件时默认不会被读到。
const SERVABLE_DATA_DIRS = Object.freeze([
  'outputs', 'assets', 'previz', 'previz-shots', 'post', 'comic', 'tmp-inline', 'inputs',
  // 剪辑页要内联预览 edit/outputs/*.mp4；代价是 data/edit/*.json 也可读（无凭据）
  'edit',
  // 换人页的「成片」链接指向 replace/joined_*.mp4
  'replace',
]);

/**
 * abs 是否落在 dataDir 的可读子目录内。
 *
 * 与 resolveUserPath 的 allowSubdirs 共用 security.js 的 isUnderAllowedSubdir，
 * 避免 /file 与 /assets/archive 两处口径漂移。
 */
export function isServableDataPath(dataDir, abs) {
  const rel = path.relative(path.resolve(dataDir), path.resolve(abs));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return isUnderAllowedSubdir(rel, SERVABLE_DATA_DIRS);
}

/** /file 的 403 文案与 /assets/archive 的白名单必须同源 */
export function servableDirsHint() {
  return SERVABLE_DATA_DIRS.join('/');
}

export function guardNoToken(req) {
  // /token 只做 Origin 校验，不需要 token
  return _isLoopbackHost(req) && _isSameOrigin(req);
}
