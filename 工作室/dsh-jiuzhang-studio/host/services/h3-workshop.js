/**
 * H3 工坊 —— 1.0.59 的核心增量（"参考实现针对 H3 专门优化"的实质）。
 *
 * 依据 1.0.59 实测 i18n（h3PromptWorkshop.* 54 键）与 22 条 h3_* IPC：
 *   输入：本地目录扫描 或 粘贴文本（互不依赖，切换不清空）
 *   参数：集数 / 画幅 / 目标时长(最短-最长) / 台词语言 / 风格 / 平台 / LLM 模型 / 标题
 *   流程：analyze → 中性分段 + 资产提示词；镜头提示词由客户端编译
 *   产物：文本产物（分段表/角色/场景/道具/配音/镜头提示词）→ 导入资产库
 *
 * 设计原则：本地优先。没有 LLM 也能用规则引擎产出可编辑的初稿；
 * 配了 LLM 则走模型精修。
 */
import fs from 'node:fs';
import path from 'node:path';
import { runProcess, resolveFfmpeg, resolveFfprobe } from './seedance-client.js';
import { readWorkflow, resolveWorkflowFile } from './workflow-paths.js';
import { h3Length, resolutionFor, assets as assetStore } from '../store/models.js';

/* ------------------------------------------------------- 分段规则引擎 */

const DURATION_MIN = 4;
const DURATION_MAX = 15;

/** 从剧本文本里抽取场景/动作/台词，切成 H3 可用的中性分段 */
export function segmentScript(text, opts = {}) {
  const src = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!src) return { segments: [], stats: { chars: 0 } };

  const targetMin = clamp(opts.durationMin ?? 4, DURATION_MIN, DURATION_MAX);
  const targetMax = clamp(opts.durationMax ?? 10, DURATION_MIN, DURATION_MAX);
  const language = opts.language || 'zh';
  const style = opts.style || '';

  // 以空行 / 场景标记 / 动作标记切段
  const blocks = src
    .split(/\n{2,}|(?=^#{1,6}\s)|(?=^\s*(?:场景|SCENE|INT\.|EXT\.)\b)/gim)
    .map((b) => b.trim())
    .filter(Boolean);

  const segments = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const dialogue = lines.filter((l) => /^[\u4e00-\u9fa5A-Za-z0-9_\-（）()]{1,20}[：:]/.test(l) || /^["“].*["”]$/.test(l));
    const action = lines.filter((l) => !dialogue.includes(l));
    const sceneHint = guessScene(action.join(' ') + ' ' + block);

    // 时长：按台词字数与动作量估算，夹在用户给的区间
    const spoken = dialogue.join('').replace(/[：:"“”]/g, '').length;
    const est = spoken > 0 ? spoken / 4.2 : Math.max(1, action.join('').length / 12);
    const duration = clamp(round1(est), targetMin, targetMax);

    segments.push({
      index: segments.length + 1,
      scene: sceneHint,
      action: action.join(' ').slice(0, 400),
      // 保留 speaker 前缀：extractAssets 依赖它识别角色
      dialogue: dialogue.map((d) => {
        const m = d.match(/^([^：:]{1,20})[：:]\s*(.+)$/);
        if (m) return { speaker: m[1].trim(), text: m[2].trim() };
        return { speaker: null, text: d.replace(/^["“]|["”]$/g, '').trim() };
      }).filter((d) => d.text),
      durationSec: duration,
      h3Length: h3Length(duration),
      style,
      language,
    });
  }

  return {
    segments,
    stats: {
      chars: src.length,
      blocks: blocks.length,
      totalDuration: round1(segments.reduce((s, x) => s + x.durationSec, 0)),
    },
  };
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, Number(n) || lo)); }
function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

const SCENE_DICT = [
  ['室内', ['房间', '屋内', '客厅', '办公室', '卧室', '门店', '店', '大厅', '电梯']],
  ['街道', ['街', '路', '马路', '巷', '广场', '夜市']],
  ['自然', ['森林', '山', '河', '海', '湖', '草原', '雪', '雨']],
  ['夜景', ['夜', '晚上', '深夜', '路灯']],
  ['特写', ['眼', '手', '脸', '嘴角', '指尖']],
];

function guessScene(text) {
  for (const [name, keys] of SCENE_DICT) {
    if (keys.some((k) => text.includes(k))) return name;
  }
  return '通用';
}

/* --------------------------------------------------- 资产提示词抽取 */

/** 从分段里抽出角色/场景/道具/配音提示词（规则版，可被 LLM 精修覆盖） */
export function extractAssets(segments) {
  const speakers = new Map();
  const scenes = new Map();
  const props = new Map();

  for (const seg of segments) {
    for (const d of seg.dialogue) {
      const who = typeof d === 'string' ? (d.match(/^([^：:]{1,16})[：:]/) || [])[1] : d.speaker;
      if (who) speakers.set(String(who).trim(), (speakers.get(String(who).trim()) || 0) + 1);
    }
    if (seg.scene) scenes.set(seg.scene, (scenes.get(seg.scene) || 0) + 1);
    const propWords = seg.action.match(/[一-龥]{2,4}(?:刀|剑|枪|杯|书|包|手机|门|桌|椅|车|伞|灯|花|箱|扇|镜)/g);
    if (propWords) for (const w of propWords) props.set(w, (props.get(w) || 0) + 1);
  }

  return {
    characters: [...speakers.entries()].map(([name, count]) => ({
      name, count, prompt: `${name}，人物外观与神态一致性参考，${name}的面部特征保持稳定`,
    })),
    scenes: [...scenes.entries()].map(([name, count]) => ({
      name, count, prompt: `${name}场景，环境与光照保持一致`,
    })),
    props: [...props.entries()].map(([name, count]) => ({
      name, count, prompt: `${name}，道具外观细节清晰可辨`,
    })),
    voices: [...speakers.keys()].map((name) => ({
      name, prompt: `${name}的说话音色与语气`,
    })),
  };
}

/* ----------------------------------------------------------- 工坊服务 */

/**
 * 创建 H3 工坊服务。
 *
 * 注意：`root` 参数**已不再需要**（历史上用来拼 workflows 路径，现在统一走
 * services/workflow-paths.js）。保留参数是为了不破坏既有调用点，但不再读取它。
 */
export function createH3Workshop({ cfg } = {}) {
  /** 目录扫描：列出可分析的文本文件 */
  function scanDir(dir) {
    const abs = path.resolve(dir);
    if (!fs.existsSync(abs)) throw new Error('DIR_NOT_FOUND');
    const out = [];
    const walk = (d, depth = 0) => {
      if (depth > 4) return;
      for (const name of fs.readdirSync(d)) {
        const p = path.join(d, name);
        let st;
        try { st = fs.statSync(p); } catch { continue; }
        if (st.isDirectory()) walk(p, depth + 1);
        else if (/\.(md|markdown|txt)$/i.test(name)) {
          out.push({ path: p, name, bytes: st.size, rel: path.relative(abs, p) });
        }
      }
    };
    walk(abs);
    return out.sort((a, b) => a.rel.localeCompare(b.rel, 'zh'));
  }

  /** 读文件预览（只读，限制大小） */
  function readPreview(file, limit = 200000) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) throw new Error('FILE_NOT_FOUND');
    const st = fs.statSync(abs);
    if (st.size > limit) throw new Error('FILE_TOO_LARGE');
    if (!/\.(md|markdown|txt)$/i.test(abs)) throw new Error('NON_TEXT_FILE');
    return fs.readFileSync(abs, 'utf8');
  }

  /**
   * 分析一集剧本 → 中性分段 + 资产提示词。
   * 不落盘，纯计算；便于前端反复调参预览。
   */
  async function analyze(body = {}) {
    const source = body.source === 'dir' ? 'dir' : 'paste';
    let text = '';
    if (source === 'dir') {
      if (!body.file) throw new Error('needFile');
      text = readPreview(body.file);
    } else {
      text = String(body.text || '');
      if (!text.trim()) throw new Error('needScript');
    }

    const episode = Number(body.episode);
    if (!Number.isInteger(episode) || episode < 1) throw new Error('badEpisode');

    const dmin = Number(body.durationMin ?? 4);
    const dmax = Number(body.durationMax ?? 10);
    if (!(dmin >= 1 && dmin <= 600 && dmax >= 1 && dmax <= 600 && dmin <= dmax)) throw new Error('badDuration');

    const seg = segmentScript(text, {
      durationMin: dmin, durationMax: dmax,
      language: body.language || 'zh',
      style: body.style || '',
    });
    const assets = extractAssets(seg.segments);

    // 镜头提示词（客户端侧编译，这里给组装好的初稿便于导入）
    const shotPrompts = seg.segments.map((s) => ({
      index: s.index,
      scene: s.scene,
      prompt: [
        body.title ? `作品：${body.title}` : '',
        body.style ? `风格：${body.style}` : '',
        s.scene !== '通用' ? `场景：${s.scene}` : '',
        s.action ? `画面：${s.action}` : '',
        s.dialogue.length ? `台词：${s.dialogue.join(' / ')}` : '',
        `时长：${s.durationSec}s（${s.h3Length} 帧）`,
        body.platform ? `平台：${body.platform}` : '',
      ].filter(Boolean).join('\n'),
      durationSec: s.durationSec,
      h3Length: s.h3Length,
    }));

    return {
      ok: true,
      episode,
      source,
      aspect: body.aspect || '16:9',
      resolution: resolutionFor(body.profile || 'P24-quality', body.aspect || '16:9'),
      segments: seg.segments,
      assets,
      shotPrompts,
      stats: seg.stats,
      warnings: buildWarnings(seg, body),
    };
  }

  function buildWarnings(seg, body) {
    const w = [];
    if (!body.style) w.push('未填写画面风格，画风块不会被注入');
    if (seg.segments.length === 0) w.push('未解析出任何分段，请检查剧本格式或改用粘贴文本');
    const tooLong = seg.segments.filter((s) => s.durationSec > DURATION_MAX);
    if (tooLong.length) w.push(`${tooLong.length} 个分段超过 ${DURATION_MAX}s，将被 H3 强制拆分`);
    return w;
  }

  /**
   * 导入资产库（把 analyze 的结果**真正落盘**到 assets-index）。
   *
   * ⚠️ 这里写入的是**纯文本资产**（kind='text'、rel=null），没有图片文件。
   *    它们只是「待办事项」：告诉你这一集出现了哪些角色/场景/道具，
   *    以及推荐的提示词骨架。**本服务不生成任何图片。**
   *    要得到可用的角色形象，请走「立绘拆解」或「角色卡仓库」。
   */
  async function importAssets(body = {}) {
    const projectId = body.projectId;
    if (!projectId) throw new Error('noProject');
    const analysis = body.analysis || (await analyze(body));
    const created = [];

    // 修复 G6：原先只 push 内存数组不落盘，summary.created 是幻觉数字
    const persist = async (type, name, data) => {
      const item = await assetStore.upsert({
        projectId,
        type,
        name,
        kind: 'text',
        rel: null,
        bytes: 0,
        tag: `h3-ep${analysis.episode}`,
        note: data.prompt ? String(data.prompt).slice(0, 200) : '',
        dataJson: JSON.stringify(data),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      created.push({ id: item.id, type, name });
      return item;
    };

    for (const c of analysis.assets?.characters || []) await persist('character', c.name, { prompt: c.prompt, figures: [] });
    for (const s of analysis.assets?.scenes || []) await persist('scene', s.name, { prompt: s.prompt });
    for (const p of analysis.assets?.props || []) await persist('item', p.name, { prompt: p.prompt });
    for (const v of analysis.assets?.voices || []) await persist('voice_tone', v.name, { prompt: v.prompt, generatedVoices: [] });
    for (const s of analysis.shotPrompts || []) await persist('shot', `第${analysis.episode}集-镜${s.index}`, s);

    return {
      ok: true,
      projectId,
      episode: analysis.episode,
      persisted: true,
      // 明确告诉调用方：这些资产没有图片
      assetsAreTextOnly: true,
      hint: '导入的是文本资产（无图片）。要得到角色形象请用「立绘拆解」生成，或在「角色卡仓库」里组装角色卡。',
      summary: {
        created: created.length,
        characters: analysis.assets?.characters?.length || 0,
        scenes: analysis.assets?.scenes?.length || 0,
        props: analysis.assets?.props?.length || 0,
        voices: analysis.assets?.voices?.length || 0,
        shots: analysis.shotPrompts?.length || 0,
      },
      items: created,
    };
  }

  /* --------------------------- H3 成片工作台 --------------------------- */

  let filmTask = { status: 'idle', progress: 0, message: '' };

  function filmStatus() {
    return { ...filmTask, ffmpeg: fs.existsSync(resolveFfmpeg(cfg)) ? 'ready' : 'missing' };
  }

  /**
   * 把分段视频合成成片：concat + 可选字幕。
   * 对齐 1.0.59 的 h3_ffmpeg_run / h3_write_concat_list 语义。
   */
  async function filmRender(body = {}) {
    const inputs = Array.isArray(body.inputs) ? body.inputs : [];
    if (!inputs.length) throw new Error('NO_INPUTS');
    const outRel = body.output || `film_${Date.now()}.mp4`;
    const outputsDir = path.join(cfg.dataDir, 'outputs');
    fs.mkdirSync(outputsDir, { recursive: true });
    const outAbs = path.join(outputsDir, path.basename(outRel));

    filmTask = { status: 'running', progress: 0, message: '准备合成' };

    try {
      const ffmpeg = resolveFfmpeg(cfg);
      if (!fs.existsSync(ffmpeg)) throw new Error('FFMPEG_MISSING');

      // 写 concat 清单
      const listFile = path.join(outputsDir, `concat_${Date.now()}.txt`);
      // ⚠️ 相对路径必须按 dataDir 解析，不能按进程 cwd。
      //    path.resolve(p) 会用进程工作目录（DSH 的 profile 目录），
      //    导致找到 C:\Users\…\.dsh\profiles\desktop\outputs\xxx.mp4 这种不存在的路径。
      //    ffmpeg 对 concat 清单里的相对路径也是相对**清单文件所在目录**解析，
      //    所以这里统一转成绝对路径。
      const lines = inputs.map((p) => {
        const abs = path.isAbsolute(p) ? p : path.join(cfg.dataDir, p);
        return `file '${abs.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;
      });
      fs.writeFileSync(listFile, lines.join('\n'), 'utf8');
      filmTask = { status: 'running', progress: 30, message: '拼接中' };

      const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile];

      // 可选字幕烧录
      // 同样按 dataDir 解析相对路径（理由同上）
      const subAbs = body.subtitleFile
        ? (path.isAbsolute(body.subtitleFile) ? body.subtitleFile : path.join(cfg.dataDir, body.subtitleFile))
        : '';
      if (subAbs && fs.existsSync(subAbs)) {
        args.push('-vf', `subtitles='${subAbs.replace(/\\/g, '/').replace(/:/g, '\\:')}'`);
      }
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', outAbs);

      await runProcess(ffmpeg, args, Number(body.timeoutSec || 1800) * 1000);
      try { fs.unlinkSync(listFile); } catch { /* ignore */ }

      const bytes = fs.statSync(outAbs).size;
      const meta = await probe(outAbs, cfg);
      filmTask = { status: 'done', progress: 100, message: '合成完成', output: outAbs, bytes, meta };
      return filmTask;
    } catch (e) {
      filmTask = { status: 'failed', progress: 0, message: String(e.message || e) };
      throw e;
    }
  }

  /**
   * 读取成片文件的元信息（时长 / 分辨率 / 帧数）。
   *
   * ⚠️ 这是**修好的桩函数**。原来写成：
   *      const { stderr } = await runProcess(...).catch(e => ({ stderr: '', err: e }));
   *      return stderr ? null : null;          // ← 两个分支都返回 null
   *    于是成片工作台的 "meta" 永远是 null，前端拿不到时长/分辨率。
   *    而且 runProcess 成功时解析的是 stdout（ffprobe 的 JSON 在 stdout），
   *    解构 stderr 本身就是错的。
   */
  async function probe(file, c) {
    try {
      const ffprobe = resolveFfprobe(c);
      const { stdout } = await runProcess(ffprobe, [
        '-v', 'error',
        '-show_entries', 'format=duration,size,format_name',
        '-show_entries', 'stream=codec_type,codec_name,width,height,nb_frames',
        '-of', 'json', file,
      ], 30000);
      const j = JSON.parse(stdout || '{}');
      const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
      const a = (j.streams ?? []).find((s) => s.codec_type === 'audio');
      return {
        ok: true,
        durationSec: Number(j?.format?.duration) || null,
        bytes: Number(j?.format?.size) || null,
        format: j?.format?.format_name ?? null,
        width: v?.width ?? null,
        height: v?.height ?? null,
        frames: Number(v?.nb_frames) || null,
        videoCodec: v?.codec_name ?? null,
        hasAudio: Boolean(a),
        audioCodec: a?.codec_name ?? null,
      };
    } catch (e) {
      // 探测是增强信息，失败不影响成片本身
      return { ok: false, error: String(e?.message ?? e) };
    }
  }

  /** 跨段连戏检查（对齐 h3_continuity 语义） */
  function continuity(segments = []) {
    const issues = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const cur = segments[i];
      if (prev.scene !== cur.scene && cur.scene === '通用') {
        issues.push({ index: cur.index, kind: 'scene-drift', detail: `镜 ${cur.index} 场景未知，可能与上一镜不连` });
      }
      if (cur.durationSec > DURATION_MAX) {
        issues.push({ index: cur.index, kind: 'too-long', detail: `镜 ${cur.index} 超过 ${DURATION_MAX}s` });
      }
    }
    return { ok: issues.length === 0, issues };
  }

  /* ----------------------------- 工作流 ----------------------------- */

  /**
   * 工作流模板路径。
   *
   * ⚠️ 曾经写成 `path.join(cfg.dataDir, 'workflows', 'h3.json')`：
   *    dataDir 是用户可改的**运行时数据**目录，而 workflows 是随插件分发的
   *    **模板**。用户一改数据目录，这里就找不到文件，生成报
   *    `WORKFLOW_MISSING: 缺少 data/workflows/h3.json` —— 指向一个插件里
   *    明明存在的文件。现在统一走 resolveWorkflowFile（见 services/workflow-paths.js）。
   */
  function workflowFile() {
    return resolveWorkflowFile('h3', cfg);
  }

  function loadWorkflow() {
    return readWorkflow('h3', cfg);
  }

  function dispose() { filmTask = { status: 'idle', progress: 0, message: '' }; }

  return {
    analyze, importAssets, scanDir, readPreview, segmentScript, extractAssets,
    filmStatus, filmRender, continuity, loadWorkflow, workflowFile, dispose,
  };
}
