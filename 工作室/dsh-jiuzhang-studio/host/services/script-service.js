/**
 * 剧本创作服务 —— 对齐洛书 `script` 域（160 键 / 35 子域）。
 *
 * 洛书核心能力：
 *  - 5 阶段流水线：大纲 → 人物小传 → 章节目录 → 章节正文 → 视觉分镜
 *  - 60 集长篇支持
 *  - 14 种题材模板
 *  - 一致性检查（上限可调 1~10）
 *  - 三幕锁
 *  - 产出直接落进素材库
 *
 * 本实现策略：
 *  - **本地规则引擎优先**：无 LLM 也能产出可编辑的骨架（结构/字段/校验）
 *  - **LLM 可选增强**：配了 LLM 通道则走模型精修
 *  - 分阶段可单步执行，也可一键跑完
 */
import fs from 'node:fs';
import path from 'node:path';
import { safeId } from '../security.js';

/** 14 种题材模板（洛书 script.templates 对齐） */
export const GENRES = Object.freeze([
  { id: 'xuanhuan', name: '玄幻', hints: '修炼体系、宗门、境界突破' },
  { id: 'xianxia', name: '仙侠', hints: '仙魔对立、飞升、道心' },
  { id: 'wuxia', name: '武侠', hints: '江湖恩怨、门派、武功秘籍' },
  { id: 'urban-cultivation', name: '都市修仙', hints: '现代都市 + 隐藏修行者' },
  { id: 'urban-rebirth', name: '都市重生', hints: '回到过去、先知优势、逆袭' },
  { id: 'apocalypse', name: '末世', hints: '丧尸/灾变、资源争夺、生存' },
  { id: 'scifi', name: '科幻', hints: '未来科技、星际、AI 觉醒' },
  { id: 'supernatural', name: '灵异', hints: '鬼怪、民俗、悬疑氛围' },
  { id: 'palace', name: '宫斗', hints: '后宫权谋、心机、翻盘' },
  { id: 'esports', name: '电竞', hints: '战队、赛场、团队成长' },
  { id: 'entertainment', name: '娱乐圈', hints: '选秀、黑红、翻红' },
  { id: 'period-rebirth', name: '年代重生', hints: '八九十年代、家庭、改命' },
  { id: 'mecha', name: '机甲', hints: '机甲战斗、驾驶员、星际战争' },
  { id: 'farming', name: '种田', hints: '经营、建设、慢节奏成长' },
]);

/** 5 阶段（洛书 script.stage.*） */
export const STAGES = Object.freeze([
  { id: 'outline', name: '大纲', desc: '一句话故事 → 三幕结构' },
  { id: 'bios', name: '人物小传', desc: '主要角色的动机、弧光、关系' },
  { id: 'chapters', name: '章节目录', desc: '拆成 N 集，每集一句话概要' },
  { id: 'body', name: '章节正文', desc: '逐集展开为可拍摄的剧本' },
  { id: 'storyboard', name: '视觉分镜', desc: '把正文拆成镜头表' },
]);

const THREE_ACT = ['第一幕 · 建置', '第二幕 · 对抗', '第三幕 · 解决'];

/**
 * 生成大纲骨架。
 * 无 LLM 时用模板 + 用户输入拼出可编辑结构。
 */
export function buildOutline({ title = '', premise = '', genre = 'urban-rebirth', episodes = 12 }) {
  const g = GENRES.find((x) => x.id === genre) || GENRES[4];
  const n = Math.max(1, Math.min(200, Number(episodes) || 12));
  const perAct = Math.max(1, Math.ceil(n / 3));

  const acts = THREE_ACT.map((name, i) => {
    const from = i * perAct + 1;
    const to = Math.min(n, (i + 1) * perAct);
    const epRange = from <= to ? `${from}-${to} 集` : '—';
    const beat = i === 0
      ? `主角登场，暴露处境的困境（${g.hints}）`
      : i === 1
        ? '冲突升级，主角反复受挫并找到关键突破口'
        : '高潮对决与收束，兑现开篇埋下的伏笔';
    return { act: name, episodes: epRange, beat };
  });

  return {
    title: title || '未命名剧本',
    premise: premise || '（尚未填写一句话故事）',
    genre: g.name,
    genreHints: g.hints,
    episodes: n,
    logline: premise
      ? `${premise}——一个关于${g.name}的故事，共 ${n} 集。`
      : `一个${g.name}题材的故事，共 ${n} 集。`,
    acts,
    createdAt: Date.now(),
  };
}

/** 人物小传骨架：从大纲里抽主要角色位 */
export function buildBios({ outline, characters = [] }) {
  const seeds = characters.length
    ? characters
    : [
        { name: '主角', role: 'protagonist' },
        { name: '对手', role: 'antagonist' },
        { name: '盟友', role: 'ally' },
      ];
  const roleHints = {
    protagonist: '目标明确、有缺陷、在第二幕最低谷后完成转变',
    antagonist: '与主角目标直接冲突，动机自洽而非纯粹作恶',
    ally: '推动主角成长，自身也有独立欲望',
  };
  return {
    characters: seeds.map((c) => ({
      name: c.name,
      role: c.role,
      want: '（角色表层欲望）',
      need: '（角色深层需求）',
      wound: '（角色创伤事件）',
      arc: roleHints[c.role] || '（角色弧光）',
      relation: '（与其他角色的关系）',
    })),
    note: `基于《${outline?.title ?? '未命名'}》的 ${outline?.genre ?? ''} 题材`,
  };
}

/** 章节目录：把大纲拆成逐集一句话 */
export function buildChapters({ outline, bios }) {
  const n = outline?.episodes ?? 12;
  const acts = outline?.acts ?? [];
  const chapters = [];
  for (let i = 1; i <= n; i++) {
    const actIdx = Math.min(2, Math.floor(((i - 1) / n) * 3));
    chapters.push({
      index: i,
      act: acts[actIdx]?.act ?? '',
      title: `第 ${i} 集`,
      summary: i === 1
        ? '开场：交代世界与主角处境'
        : i === n
          ? '收束：解决核心冲突，交代后日谈'
          : acts[actIdx]?.beat ?? '推进：制造新的阻碍与信息',
      characters: (bios?.characters ?? []).slice(0, 3).map((c) => c.name),
    });
  }
  return { chapters };
}

/** 章节正文：把一集的概要展开成可拍摄剧本 */
export function buildBody({ outline, bios, chapters, episodeIndex = 1 }) {
  const ch = (chapters?.chapters ?? []).find((c) => c.index === episodeIndex);
  const chars = bios?.characters ?? [];
  const lead = chars[0]?.name ?? '主角';
  const foil = chars[1]?.name ?? '对手';

  return {
    episode: episodeIndex,
    title: ch?.title ?? `第 ${episodeIndex} 集`,
    act: ch?.act ?? '',
    scenes: [
      {
        no: 1,
        slug: '内/外景 · 时间',
        location: '（场景）',
        action: `${lead}登场，暴露当前困境。${ch?.summary ?? ''}`,
        beats: ['建立处境', '抛出问题'],
        dialogue: [{ speaker: lead, line: '（台词）' }],
      },
      {
        no: 2,
        slug: '内景 · 时间',
        location: '（场景）',
        action: `${foil}施压，冲突升级。${lead}获得关键信息但付出代价。`,
        beats: ['对抗', '转折'],
        dialogue: [
          { speaker: foil, line: '（台词）' },
          { speaker: lead, line: '（台词）' },
        ],
      },
      {
        no: 3,
        slug: '内景 · 夜',
        location: '（场景）',
        action: `本集收尾，留下钩子引向下一集。`,
        beats: ['收束', '悬念'],
        dialogue: [],
      },
    ],
    wordCountEstimate: 1200,
  };
}

/** 视觉分镜：把正文拆成镜头表（可导入画布） */
export function buildStoryboard({ outline, body }) {
  const shots = [];
  let idx = 1;
  for (const sc of body?.scenes ?? []) {
    const base = sc.beats ?? ['动作'];
    for (let i = 0; i < Math.max(1, base.length); i++) {
      shots.push({
        index: idx++,
        sceneNo: sc.no,
        location: sc.location,
        shot: base[i],
        durationSec: 4,
        description: `${sc.action}（${base[i]}）`,
        camera: i === 0 ? '中景 · 固定' : '近景 · 缓慢推进',
        dialogue: sc.dialogue?.[i]?.line ?? '',
      });
    }
  }
  return {
    title: `${outline?.title ?? '未命名'} · 第 ${body?.episode ?? 1} 集`,
    shots,
  };
}

/**
 * 一致性检查（洛书 script.consistency，上限可调）。
 * 纯本地规则：检查命名冲突、集数缺口、角色未登场等。
 */
export function checkConsistency({ outline, bios, chapters, bodies = [] }, { limit = 10 } = {}) {
  const issues = [];
  const max = Math.max(1, Math.min(10, Number(limit) || 10));

  // 1) 集数缺口
  const n = outline?.episodes ?? 0;
  const got = (chapters?.chapters ?? []).length;
  if (n && got !== n) {
    issues.push({ level: 'error', kind: 'episode-count', detail: `大纲 ${n} 集，目录 ${got} 集` });
  }

  // 2) 角色未在正文出现
  const names = (bios?.characters ?? []).map((c) => c.name);
  const used = new Set();
  for (const b of bodies) {
    for (const sc of b?.scenes ?? []) {
      for (const d of sc.dialogue ?? []) used.add(d.speaker);
    }
  }
  for (const nm of names) {
    if (!used.has(nm)) issues.push({ level: 'warn', kind: 'unused-character', detail: `角色「${nm}」尚未在任何正文中出现` });
  }

  // 3) 空台词
  for (const b of bodies) {
    for (const sc of b?.scenes ?? []) {
      for (const d of sc.dialogue ?? []) {
        if (!d.line || /^（台词）$/.test(d.line)) {
          issues.push({ level: 'warn', kind: 'empty-line', detail: `第 ${b.episode} 集 场 ${sc.no} 有未填写的台词` });
        }
      }
    }
  }

  return {
    ok: issues.filter((i) => i.level === 'error').length === 0,
    total: issues.length,
    shown: issues.slice(0, max),
    issues,
    limit: max,
  };
}

/** 把剧本工程落盘（一个项目一份） */
export function createScriptService({ cfg }) {
  function dir() {
    const d = path.join(cfg.dataDir, 'script');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  /**
   * 单个项目的剧本文件。
   *
   * ⚠️ projectId 必须校验：这里直接拼进文件名（`${projectId}.json`），
   *    而 `studio_script` 工具是把参数**原样**传进来的。不校验的话
   *    `projectId: '../../../x'` 可把文件写到数据目录之外。
   */
  function file(projectId) {
    const id = safeId(projectId);
    return path.join(dir(), `${id}.json`);
  }
  function load(projectId) {
    const f = file(projectId);
    if (!fs.existsSync(f)) return null;
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  }
  function save(projectId, doc) {
    const f = file(projectId);
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ ...doc, updatedAt: Date.now() }, null, 2), 'utf8');
    fs.renameSync(tmp, f);
    return doc;
  }

  /** 单阶段执行 */
  async function runStage(projectId, stage, input = {}) {
    const cur = load(projectId) ?? {};
    let next = { ...cur, projectId, genre: input.genre ?? cur.genre };

    if (stage === 'outline') {
      next.outline = buildOutline({
        title: input.title ?? cur.outline?.title,
        premise: input.premise ?? cur.outline?.premise,
        genre: input.genre ?? cur.genre,
        episodes: input.episodes ?? cur.outline?.episodes,
      });
    } else if (stage === 'bios') {
      next.bios = buildBios({ outline: next.outline, characters: input.characters });
    } else if (stage === 'chapters') {
      next.chapters = buildChapters({ outline: next.outline, bios: next.bios });
    } else if (stage === 'body') {
      const idx = Number(input.episodeIndex) || 1;
      const bodies = Array.isArray(next.bodies) ? next.bodies.slice() : [];
      const body = buildBody({ outline: next.outline, bios: next.bios, chapters: next.chapters, episodeIndex: idx });
      const at = bodies.findIndex((b) => b.episode === idx);
      if (at >= 0) bodies[at] = body; else bodies.push(body);
      next.bodies = bodies.sort((a, b) => a.episode - b.episode);
    } else if (stage === 'storyboard') {
      const idx = Number(input.episodeIndex) || 1;
      const body = (next.bodies ?? []).find((b) => b.episode === idx);
      if (!body) throw new Error('BODY_NOT_FOUND: 请先生成该集正文');
      next.storyboard = buildStoryboard({ outline: next.outline, body });
    } else {
      throw new Error(`UNKNOWN_STAGE: ${stage}`);
    }

    next.consistency = checkConsistency(next, { limit: input.consistencyLimit ?? 10 });
    save(projectId, next);
    return { stage, doc: next };
  }

  /** 一键跑完 5 阶段（body/storyboard 只跑第 1 集） */
  async function runAll(projectId, input = {}) {
    let doc = await runStage(projectId, 'outline', input);
    doc = await runStage(projectId, 'bios', input);
    doc = await runStage(projectId, 'chapters', input);
    doc = await runStage(projectId, 'body', { ...input, episodeIndex: 1 });
    doc = await runStage(projectId, 'storyboard', { ...input, episodeIndex: 1 });
    return { doc: doc.doc };
  }

  return { load, save, runStage, runAll, dir, file };
}

export { GENRES as SCRIPT_GENRES, STAGES as SCRIPT_STAGES };