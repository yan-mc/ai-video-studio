/**
 * 产物归档 + 字体 + /file 白名单 + 免令牌守卫。
 *
 * 从 api/index.js 逐字迁出（原 2488-2613 行）。
 *
 * 一组"产物落地"相关的杂项：生成完成后把产物归档进素材库、列出可用的
 * 中文字体（ffmpeg drawtext 需要真实路径）、限制 /file 能读的 dataDir
 * 子目录、以及 /token 端点的免令牌判定。
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSameOrigin as _isSameOrigin, isLoopbackHost as _isLoopbackHost } from '../security.js';
import { runJob } from '../services/job-runner.js';


/**
 * 跑一个任务，成功后把产物**自动归档进素材库**。
 *
 * 为什么需要：生成产物落在 `data/outputs/`（临时区），画布产物写回节点后
 * 就没人管了；渲染页、素材库都看不到。"画布 ↔ 渲染页"打不通的根因就是这个。
 *
 * 统一在这里归档，所有生成入口（/generate、/image/generate、
 * /breakdown/generate、/mw/job/generate、comic/render-panels）自动受益，
 * 不用每个入口各写一遍。
 *
 * 归档失败**不影响任务结果**——产物已经生成，只是没进素材库，属于可接受的降级。
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
            // ASSET_TYPES 白名单里没有 'video'，视频产物用 video_segment
            // （写 'video' 会被 asset-service 静默降级成 general）
            type: job.kind === 'image' ? 'general' : 'video_segment',
            name: `${job.kind === 'image' ? '图' : '片'}_${running.id}`,
            projectId: job.projectId ?? null,
            tag: 'auto-archived',
            note: String(running.prompt ?? '').slice(0, 200),
          });
          // ⚠️ 记下**源产物路径**，回填时按它对账。
          //    旧实现回填时拿 o.path（outputs/job_x.mp4）去 endsWith 归档后的
          //    新文件名（asset_y.mp4）—— 永远不匹配，于是前端 outputs[] 里
          //    永远没有 assetId / archivedRel，"产物自动归档"等于只在磁盘上发生，
          //    用户界面上看不出来。
          archived.push({ id: item.id, rel: item.rel, assetId: item.id, sourcePath: o.path });
        } catch { /* 单条失败不阻断 */ }
      }
      if (archived.length) {
        // 把素材 id 附在产物上，前端可直接引用（按源路径精确对账）
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
 * 把项目绑定的角色卡解析进 shot。
 *
 * 实现已下沉到 services/shot-context.js（与 Agent 工具共用同一份），
 * 这里只做转发，避免再次出现"两份实现各自漂移"。
 */

/**
 * 列出可用的中文字体文件（ffmpeg drawtext 需要真实字体路径）。
 *
 * 不再硬编码盘符：用系统字体目录 + 环境变量覆盖，
 * 这样换机器 / 换平台都不会失效。也可以用 DSH_POST_FONT 显式指定。
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
  /**
   * 剪辑产物与工程。
   *
   * 必须在这里：剪辑页要用 <video src="/file?path=edit/outputs/xxx.mp4"> 内联
   * 预览成片，白名单里没有 'edit' 会拿到 403 FORBIDDEN_PATH，
   * 表现为"出片成功但播放器一片空白"——是最容易被误判成前端 bug 的形态。
   *
   * 代价：data/edit/*.json 工程文件也变成可读的了。可以接受 ——
   * 工程里只有片段相对路径与音轨设置，没有任何凭据。
   */
  'edit',
]);

/**
 * abs 是否落在 dataDir 的可读子目录内。
 * @param {string} dataDir
 * @param {string} abs 已由 safeJoin 解析过的绝对路径
 */
export function isServableDataPath(dataDir, abs) {
  const rel = path.relative(path.resolve(dataDir), path.resolve(abs));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const top = rel.split(path.sep)[0];
  return SERVABLE_DATA_DIRS.includes(top);
}

export function guardNoToken(req) {
  // /token 只做 Origin 校验，不需要 token
  return _isLoopbackHost(req) && _isSameOrigin(req);
}
