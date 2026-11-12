/**
 * 模特工作台服务 —— 对齐洛书 `mw` 域（270 键 / 35 子域）。
 *
 * 洛书核心设计：
 *  - **双模式**：电商拍摄（ecom）/ 影视角色（film）
 *  - 电商套件：主品先出图 → 过检 → 并行其余
 *  - 影视套件：定妆照先行锁定 → 三视图 → 表情/姿态（13 张 / 10 张）
 *  - 作业状态机：draft → queued → preparing → generating → done/interrupted
 *  - 硬伤自动重出 1 次，上限 3 次
 *  - 方案库：画风/尺寸/镜头清单存成一套，一键套用
 *
 * 本实现策略：
 *  - **完整状态机 + 数据模型 + 规则引擎先落地**（不依赖图像模型）
 *  - 出图走已有的 H3/Seedance 通道；未配图像模型时给出明确的"待接"提示
 *  - 镜头清单由套件模板 + 风格展开，可逐镜改
 */
import fs from 'node:fs';
import path from 'node:path';

/** 双模式 */
export const MW_MODES = Object.freeze([
  { id: 'ecom', name: '电商拍摄', hint: '拍一件衣服的正面、背面、细节，选个风格，剩下交给它' },
  { id: 'film', name: '影视角色', hint: '一个角色的整套形象图：定妆 → 三视图 → 表情/姿态' },
]);

/** 作业状态机（洛书 mw.status） */
export const MW_STATUS = Object.freeze([
  { id: 'draft', name: '草稿' },
  { id: 'queued', name: '排队中' },
  { id: 'preparing', name: '备料中' },
  { id: 'generating', name: '生成中' },
  { id: 'done', name: '已完成' },
  { id: 'interrupted', name: '已中断' },
  { id: 'canceled', name: '已取消' },
  { id: 'failed', name: '失败' },
]);

/** 电商 · 6 风格预设（洛书 mw.styleLabel「风格 · 6 预设」） */
export const ECOM_STYLES = Object.freeze([
  { id: 'studio-clean', name: '棚拍白底', hint: '纯净白底，柔和顶光，商品主体清晰' },
  { id: 'lifestyle', name: '生活场景', hint: '居家/街景，自然光，人物自然互动' },
  { id: 'street', name: '街头潮流', hint: '城市街头，硬光，动感姿态' },
  { id: 'french', name: '法式慵懒', hint: '奶油色调，柔和逆光，松弛姿态' },
  { id: 'vintage', name: '复古胶片', hint: '暖黄颗粒感，低对比，怀旧氛围' },
  { id: 'minimal', name: '极简高级', hint: '低饱和，几何构图，克制留白' },
]);

/** 影视 · 10 风格预设（洛书 mw.styleLabelFilm「画风 · 10 预设」） */
export const FILM_STYLES = Object.freeze([
  { id: 'ink-wuxia', name: '水墨仙侠', hint: '水墨质感，冷冽雾气，留白' },
  { id: 'ancient', name: '古风写实', hint: '汉服质感，暖金光线，细腻皮肤' },
  { id: 'modern', name: '现代都市', hint: '冷白街灯，电影感浅景深' },
  { id: 'cyber', name: '赛博朋克', hint: '霓虹紫青，雨夜反光' },
  { id: 'wasteland', name: '废土末世', hint: '土黄沙尘，破损质感，硬光' },
  { id: 'fantasy', name: '西幻史诗', hint: '油画质感，戏剧光，宏大背影' },
  { id: 'noir', name: '黑色电影', hint: '高对比阴影，单一光源' },
  { id: 'pastel', name: '日系清新', hint: '柔光低饱和，通透空气感' },
  { id: 'steampunk', name: '蒸汽朋克', hint: '铜色机械，暖炉光，蒸汽' },
  { id: 'horror', name: '恐怖惊悚', hint: '低照度，冷绿调，压迫感' },
]);

/** 拍摄尺寸（整组统一） */
export const MW_SIZES = Object.freeze([
  { id: 'ecom-sq', name: '电商方图 1:1', ratio: '1:1', profile: 'P12-draft' },
  { id: 'ecom-45', name: '电商竖图 4:5', ratio: '4:5', profile: 'P12-draft' },
  { id: 'ecom-34', name: '人像 3:4', ratio: '3:4', profile: 'P12-draft' },
  { id: 'film-169', name: '影视 16:9', ratio: '16:9', profile: 'P12-draft' },
  { id: 'film-916', name: '影视竖屏 9:16', ratio: '9:16', profile: 'P12-draft' },
  { id: 'film-21', name: '宽银幕 21:9', ratio: '21:9', profile: 'P12-draft' },
]);

/* ------------------------------------------------- 套件清单（镜头模板） */

/**
 * 电商套件：默认 6 张（正面/背面/侧面/细节/搭配/特写）。
 * 洛书 countHint：「改张数，镜头清单自动换成对应套数」。
 */
export function ecomShots(count = 6) {
  const base = [
    { key: 'front', name: '正面全图', camera: '正面平视 · 中景', desc: '主品完整呈现，正对镜头' },
    { key: 'back', name: '背面全图', camera: '背面平视 · 中景', desc: '展示背面版型与工艺' },
    { key: 'side', name: '侧面', camera: '侧面 45° · 中景', desc: '展示侧面轮廓与垂感' },
    { key: 'detail', name: '细节特写', camera: '微距 · 近景', desc: '面料纹理、缝线、五金' },
    { key: 'styling', name: '搭配造型', camera: '全身 · 中远景', desc: '全套搭配整体效果' },
    { key: 'closeup', name: '半身特写', camera: '半身 · 近景', desc: '上身穿着效果与表情' },
    { key: 'walk', name: '走动', camera: '侧面跟拍 · 全身', desc: '动态下的垂感与版型' },
    { key: 'sit', name: '坐姿', camera: '正面 · 中景', desc: '坐姿下褶皱与舒适度' },
  ];
  const n = Math.max(1, Math.min(base.length, Number(count) || 6));
  return Array.from({ length: n }, (_, i) => ({ index: i + 1, ...base[i], custom: '' }));
}

/**
 * 影视套件：人物 13 张（定妆 1 + 三视图 4 + 表情 8）；
 *           神兽 10 张（定妆 1 + 三视图 3 + 姿态 6）。
 * 洛书 suitePerson / suiteBeast 原文即此。
 */
export function filmShots(kind = 'person') {
  const isPerson = kind !== 'beast';
  const shots = [];
  let i = 1;
  shots.push({ index: i++, key: 'base', name: '定妆照', camera: '正面半身 · 中景', desc: '锁定身份用，最干净的一张', stage: 'base', custom: '' });

  if (isPerson) {
    for (const [k, nm, cam] of [
      ['tv-front', '三视图 · 正', '正面全身 · 平视'],
      ['tv-side', '三视图 · 侧', '侧面全身 · 平视'],
      ['tv-back', '三视图 · 背', '背面全身 · 平视'],
      ['tv-3q', '三视图 · 45°', '四分之三侧 · 平视'],
    ]) shots.push({ index: i++, key: k, name: nm, camera: cam, desc: '统一光位与白底，便于建模参考', stage: 'view', custom: '' });

    const exps = ['中性', '微笑', '大笑', '愤怒', '悲伤', '惊讶', '思考', '闭眼'];
    exps.forEach((nm, k) => shots.push({
      index: i++, key: `exp-${k}`, name: `表情 · ${nm}`, camera: '面部特写 · 平视',
      desc: `表情「${nm}」的稳定呈现`, stage: 'exp', custom: '',
    }));
  } else {
    for (const [k, nm, cam] of [
      ['tv-front', '三视图 · 正', '正面全身 · 平视'],
      ['tv-side', '三视图 · 侧', '侧面全身 · 平视'],
      ['tv-back', '三视图 · 背', '背面全身 · 平视'],
    ]) shots.push({ index: i++, key: k, name: nm, camera: cam, desc: '统一光位与白底', stage: 'view', custom: '' });

    const poses = ['站立', '伏卧', '扑击', '嘶鸣', '回头', '腾跃'];
    poses.forEach((nm, k) => shots.push({
      index: i++, key: `pose-${k}`, name: `姿态 · ${nm}`, camera: '全身 · 中景',
      desc: `姿态「${nm}」`, stage: 'pose', custom: '',
    }));
  }
  return shots;
}

/** 按模式 + 张数取套件清单 */
export function suiteShots({ mode = 'ecom', count, kind = 'person' } = {}) {
  if (mode === 'film') return filmShots(kind);
  return ecomShots(count);
}

/* ------------------------------------------------------- 提示词拼装（零费用） */

/**
 * 把「模式 + 风格 + 尺寸 + 镜头」拼成逐张提示词。
 * 洛书在 gen.stepPlan「拍摄规划 · 每张的提示词已拼好」这一步做同样的事。
 */
export function planPrompts(job) {
  const mode = job.mode ?? 'ecom';
  const styles = mode === 'film' ? FILM_STYLES : ECOM_STYLES;
  const style = typeof job.style === 'string' && job.style.trim()
    ? { id: 'custom', name: job.style, hint: job.style }
    : styles.find((s) => s.id === job.styleId) ?? styles[0];

  const size = MW_SIZES.find((s) => s.id === job.sizeId) ?? MW_SIZES[0];
  const shots = job.shots ?? suiteShots({ mode, count: job.count, kind: job.kind });

  return shots.map((shot) => {
    const parts = [];
    // 主体
    if (mode === 'ecom') {
      if (job.model?.desc) parts.push(job.model.desc);
      if (job.garments?.length) parts.push(`穿着：${job.garments.map((g) => g.name).join('、')}`);
    } else {
      if (job.role?.desc) parts.push(job.role.desc);
      if (job.look?.name && job.look.name !== '基础白底') parts.push(`造型：${job.look.name}`);
      if (job.props?.length) parts.push(`配件：${job.props.map((p) => p.name).join('、')}`);
      if (job.scene?.name) parts.push(`场景：${job.scene.name}`);
    }
    // 镜头
    parts.push(`${shot.name} —— ${shot.desc}`);
    parts.push(`构图：${shot.camera}`);
    // 风格 + 质量
    parts.push(`画风：${style.hint}`);
    parts.push('高质量，细节清晰，色彩准确');
    // 自定义
    if (shot.custom) parts.push(shot.custom);

    return {
      index: shot.index,
      key: shot.key,
      name: shot.name,
      stage: shot.stage ?? 'shot',
      ratio: size.ratio,
      profile: size.profile,
      prompt: parts.join('。'),
    };
  });
}

/* --------------------------------------------------------------- 硬伤检查 */

/**
 * 硬伤检查（洛书「有硬伤自动重出一次」）。
 * 无图像模型时用规则检查：文件存在、尺寸对、非空白。
 */
export function checkFlaws(shotResult, expect) {
  const issues = [];
  if (!shotResult?.path) {
    issues.push({ code: 'no-image', level: 'error', detail: '没有产出图' });
  } else {
    try {
      if (!fs.existsSync(shotResult.path)) issues.push({ code: 'missing', level: 'error', detail: '产物文件不存在' });
      else if (fs.statSync(shotResult.path).size < 1024) issues.push({ code: 'tiny', level: 'error', detail: '文件过小，可能是空图' });
    } catch {
      issues.push({ code: 'stat-failed', level: 'error', detail: '无法读取产物' });
    }
  }
  if (expect?.ratio && shotResult?.ratio && expect.ratio !== shotResult.ratio) {
    issues.push({ code: 'ratio', level: 'warn', detail: `比例不符：期望 ${expect.ratio}，实际 ${shotResult.ratio}` });
  }
  return { ok: issues.filter((i) => i.level === 'error').length === 0, issues };
}

/* ------------------------------------------------------------------- 服务 */

export function createModelWorkbench({ cfg }) {
  function dir() {
    const d = path.join(cfg.dataDir, 'mw');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }
  const jobsFile = () => path.join(dir(), 'jobs.json');
  const plansFile = () => path.join(dir(), 'plans.json');
  const figuresFile = () => path.join(dir(), 'figures.json');

  function readArr(f) {
    if (!fs.existsSync(f)) return [];
    try { const a = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; }
  }
  function writeArr(f, arr) {
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(arr, null, 2), 'utf8');
    fs.renameSync(tmp, f);
    return arr;
  }

  const listJobs = () => readArr(jobsFile());
  const listPlans = () => readArr(plansFile());
  const listFigures = () => readArr(figuresFile());

  function newJobId() {
    return `mw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  /** 新建作业（生成镜头清单 + 提示词计划，status=draft） */
  function createJob(body = {}) {
    const mode = body.mode === 'film' ? 'film' : 'ecom';
    const shots = suiteShots({ mode, count: body.count, kind: body.kind });
    const job = {
      id: newJobId(),
      name: body.name || `${mode === 'film' ? '影视角色' : '电商拍摄'} ${new Date().toLocaleString('zh-CN')}`,
      mode,
      status: 'draft',
      styleId: body.styleId ?? (mode === 'film' ? 'ancient' : 'studio-clean'),
      customStyle: body.customStyle ?? '',
      sizeId: body.sizeId ?? (mode === 'film' ? 'film-169' : 'ecom-sq'),
      count: shots.length,
      kind: body.kind ?? 'person',
      // 素材
      garments: body.garments ?? [],
      model: body.model ?? null,
      role: body.role ?? null,
      look: body.look ?? null,
      props: body.props ?? [],
      scene: body.scene ?? { name: '默认白底' },
      shots: shots.map((s) => ({ ...s, status: 'queued', result: null, attempts: 0, check: null })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    job.plan = planPrompts(job);
    const arr = listJobs();
    arr.unshift(job);
    writeArr(jobsFile(), arr);
    return job;
  }

  function updateJob(id, patch) {
    const arr = listJobs();
    const at = arr.findIndex((j) => j.id === id);
    if (at < 0) throw new Error('MW_JOB_NOT_FOUND');
    arr[at] = { ...arr[at], ...patch, updatedAt: Date.now() };
    writeArr(jobsFile(), arr);
    return arr[at];
  }

  function deleteJobs(ids) {
    const set = new Set(ids);
    const before = listJobs();
    const after = before.filter((j) => !set.has(j.id));
    writeArr(jobsFile(), after);
    return { removed: before.length - after.length, remaining: after.length };
  }

  /** 生成/重算提示词计划（改风格/尺寸/张数后调） */
  function replanJob(id) {
    const arr = listJobs();
    const at = arr.findIndex((j) => j.id === id);
    if (at < 0) throw new Error('MW_JOB_NOT_FOUND');
    const job = { ...arr[at] };
    job.shots = suiteShots({ mode: job.mode, count: job.count, kind: job.kind })
      .map((s, i) => ({ ...s, status: 'queued', result: null, attempts: 0, check: null, custom: arr[at].shots?.[i]?.custom ?? '' }));
    job.plan = planPrompts(job);
    arr[at] = { ...job, updatedAt: Date.now() };
    writeArr(jobsFile(), arr);
    return arr[at];
  }

  /** 存为方案 */
  function savePlan(jobId, name) {
    const job = listJobs().find((j) => j.id === jobId);
    if (!job) throw new Error('MW_JOB_NOT_FOUND');
    const plans = listPlans();
    const plan = {
      id: `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name: name || `${job.mode === 'film' ? FILM_STYLES.find((s) => s.id === job.styleId)?.name ?? job.styleId : ECOM_STYLES.find((s) => s.id === job.styleId)?.name ?? job.styleId} · ${job.count} 张`,
      mode: job.mode,
      styleId: job.styleId,
      customStyle: job.customStyle,
      sizeId: job.sizeId,
      count: job.count,
      kind: job.kind,
      shots: job.shots.map((s) => ({ key: s.key, name: s.name, camera: s.camera, desc: s.desc, stage: s.stage, custom: s.custom })),
      withFigure: Boolean(job.role || job.model),
      figure: job.role ?? job.model ?? null,
      usedCount: 0,
      createdAt: Date.now(),
    };
    plans.unshift(plan);
    writeArr(plansFile(), plans);
    return plan;
  }

  /** 一键套用方案 */
  function applyPlan(jobId, planId) {
    const plan = listPlans().find((p) => p.id === planId);
    if (!plan) throw new Error('MW_PLAN_NOT_FOUND');
    const arr = listJobs();
    const at = arr.findIndex((j) => j.id === jobId);
    if (at < 0) throw new Error('MW_JOB_NOT_FOUND');
    const job = {
      ...arr[at],
      mode: plan.mode, styleId: plan.styleId, customStyle: plan.customStyle,
      sizeId: plan.sizeId, count: plan.count, kind: plan.kind,
      shots: plan.shots.map((s, i) => ({
        index: i + 1, ...s, status: 'queued', result: null, attempts: 0, check: null,
      })),
      ...(plan.withFigure && plan.figure ? { role: plan.mode === 'film' ? plan.figure : null, model: plan.mode === 'ecom' ? plan.figure : null } : {}),
    };
    job.plan = planPrompts(job);
    arr[at] = { ...job, updatedAt: Date.now() };
    writeArr(jobsFile(), arr);

    // 使用次数 +1
    const plans = listPlans().map((p) => (p.id === planId ? { ...p, usedCount: (p.usedCount ?? 0) + 1 } : p));
    writeArr(plansFile(), plans);
    return arr[at];
  }

  function deletePlan(id) {
    const before = listPlans();
    const after = before.filter((p) => p.id !== id);
    writeArr(plansFile(), after);
    return { removed: before.length - after.length };
  }

  /** 形象库 */
  function listFigureItems() { return listFigures(); }
  function upsertFigure(fig) {
    const arr = listFigures();
    const at = arr.findIndex((f) => f.id === fig.id);
    const next = { ...fig, updatedAt: Date.now(), createdAt: fig.createdAt ?? Date.now() };
    if (at >= 0) arr[at] = next; else arr.unshift(next);
    writeArr(figuresFile(), arr);
    return next;
  }
  function deleteFigure(id) {
    const before = listFigures();
    const after = before.filter((f) => f.id !== id);
    writeArr(figuresFile(), after);
    return { removed: before.length - after.length };
  }

  /** 元信息 */
  function meta() {
    return {
      modes: MW_MODES,
      status: MW_STATUS,
      ecomStyles: ECOM_STYLES,
      filmStyles: FILM_STYLES,
      sizes: MW_SIZES,
      suite: {
        ecom: ecomShots(6).map((s) => s.name),
        person: filmShots('person').map((s) => s.name),
        beast: filmShots('beast').map((s) => s.name),
      },
    };
  }

  return {
    meta, createJob, updateJob, deleteJobs, listJobs, replanJob,
    savePlan, applyPlan, deletePlan, listPlans,
    listFigureItems, upsertFigure, deleteFigure,
    planPrompts, dir,
  };
}

export { MW_MODES as MODEL_WORKBENCH_MODES };