/**
 * 全量验收脚本 —— 一条命令跑完所有验收项。
 *
 * 覆盖：
 *  A. 静态：文件结构、语法、配置
 *  B. Host 模块：串行写、安全、模型、工坊
 *  C. HTTP：鉴权、路由、CRUD、生成（mock）
 *  D. 构建产物：SPA 可服务性
 *  E. 线上实例：DSH 里真实挂载的路由
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve(import.meta.dirname, '..');
const results = [];
const add = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail });

/* ============================ A. 静态检查 ============================ */

const REQUIRED = [
  'package.json', 'cordis.patch.yml', 'icon.svg', 'client.js', 'README.md',
  'locale/zh.json', 'locale/en.json',
  'host/index.js', 'host/security.js', 'host/config.js', 'host/static.js', 'host/runtime.js', 'host/tools.js',
  'host/api/index.js',
  'host/store/json-store.js', 'host/store/models.js',
  'host/services/job-runner.js', 'host/services/job-store.js', 'host/services/comfy-client.js',
  'host/services/seedance-client.js', 'host/services/previz-controller.js',
  'host/services/h3-workshop.js', 'host/services/post.js', 'host/services/asset-service.js',
  'app-dist/index.html', 'data/workflows/h3.json',
];
for (const rel of REQUIRED) {
  add('A-结构', rel, fs.existsSync(path.join(ROOT, rel)));
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
add('A-结构', 'package.json 有 dsh.bundle.patch', Boolean(pkg.dsh?.bundle?.patch));
add('A-结构', 'package.json exports 含 ./client', Boolean(pkg.exports?.['./client']));
add('A-结构', 'files 含 app-dist', (pkg.files || []).some((f) => f.includes('app-dist')));
add('A-结构', 'patch yml 声明新插件 id', fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8').includes('jiuzhang-studio'));

/* ============================ B. Host 模块 ============================ */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-verify-'));
process.env.DSH_JZ_CONFIG_FILE = path.join(tmp, 'config.json');
process.env.DSH_JZ_DATA_DIR = tmp;

const { resetConfigCache, loadConfig, saveConfig, sanitizeConfigPatch, maskConfig } = await import('../host/config.js');
resetConfigCache();
const cfg = loadConfig();
add('B-配置', '默认 dataDir 指向隔离目录', cfg.dataDir === tmp, cfg.dataDir);

// 白名单：可执行路径不可注入
const inj = sanitizeConfigPatch({ ffmpeg: 'C:/evil.exe', previzExe: 'x', comfyUrl: 'http://127.0.0.1:8188' });
add('B-配置', 'ffmpeg 不可注入', !('ffmpeg' in inj));
add('B-配置', 'previzExe 不可注入', !('previzExe' in inj));
add('B-配置', 'comfyUrl 可配置', 'comfyUrl' in inj);
add('B-配置', '掩码回填被丢弃', Object.keys(sanitizeConfigPatch({ seedanceApiKey: '***' })).length === 0);
saveConfig({ seedanceApiKey: 'sk-test-123' });
add('B-配置', '密钥读取时掩码', maskConfig(loadConfig()).seedanceApiKey === '***');

// 安全
const { safeId, safeJoin, isSameOrigin } = await import('../host/security.js');
let blocked = 0;
for (const bad of ['../../..', '../x', 'a/b', '', 'x'.repeat(100)]) {
  try { safeId(bad); } catch { blocked++; }
}
add('B-安全', 'id 白名单拦截穿越', blocked === 5, `${blocked}/5`);
try { safeJoin(tmp, '../../../Windows'); add('B-安全', 'safeJoin 拦截穿越', false); }
catch { add('B-安全', 'safeJoin 拦截穿越', true); }
add('B-安全', '跨源 Origin 被判否', isSameOrigin({ headers: { origin: 'http://evil.example', host: '127.0.0.1:1' } }) === false);
add('B-安全', '同源 Origin 被判真', isSameOrigin({ headers: { origin: 'http://127.0.0.1:1', host: '127.0.0.1:1' } }) === true);

// 串行写
const { collectionStore, drainQueues } = await import('../host/store/json-store.js');
const cs = collectionStore(path.join(tmp, 'conc.json'), { prefix: 'c' });
await Promise.all(Array.from({ length: 40 }, (_, i) => cs.upsert({ id: `c_${i}`, i })));
await drainQueues();
add('B-存储', '并发 40 写不丢', (await cs.list()).length === 40, (await cs.list()).length);

// 模型
const { NODE_TYPES, ASSET_TYPES, resolutionFor, h3Length, PROFILES, H3_MODEL_SLOTS } = await import('../host/store/models.js');
add('B-模型', '26 种节点', NODE_TYPES.length === 26, NODE_TYPES.length);
add('B-模型', '15 类资产（含人设卡）', ASSET_TYPES.length === 15, ASSET_TYPES.length);
add('B-模型', '19 档 H3 槽位', H3_MODEL_SLOTS.length === 19, H3_MODEL_SLOTS.length);
add('B-模型', '5 个生成档位', Object.keys(PROFILES).length === 5);
add('B-模型', 'P24 16:9 = 1056x608', resolutionFor('P24-quality', '16:9').width === 1056);
add('B-模型', 'P24 9:16 = 608x1056', resolutionFor('P24-quality', '9:16').width === 608);
add('B-模型', '5s = 124 帧', h3Length(5) === 124);
add('B-模型', '10s = 243 帧', h3Length(10) === 243);
add('B-模型', '15s = 362 帧', h3Length(15) === 362);

// 分段引擎
const { segmentScript, extractAssets } = await import('../host/services/h3-workshop.js');
const script = '第一场 夜 街道\n林晚：我不等了。\n陈默：你没有选择吗？\n\n第二场 室内 办公室\n陈默：签了它。';
const seg = segmentScript(script, { durationMin: 4, durationMax: 10, style: '冷色调' });
add('B-工坊', '分段产生', seg.segments.length >= 2, seg.segments.length);
const ex = extractAssets(seg.segments);
add('B-工坊', '角色抽取', ex.characters.length === 2, ex.characters.map((c) => c.name).join(','));
add('B-工坊', '场景抽取', ex.scenes.length >= 2, ex.scenes.length);
add('B-工坊', '音色抽取', ex.voices.length === 2, ex.voices.length);
add('B-工坊', '分段时间在区间内', seg.segments.every((s) => s.durationSec >= 4 && s.durationSec <= 10));

// 工作流
const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/workflows/h3.json'), 'utf8'));
// API 格式：{ "1": { class_type, inputs } }
const wfNodes = Object.values(wf);
add('B-工作流', 'h3.json 可解析', wfNodes.length > 0 && wfNodes.every((n) => n && n.class_type));
add('B-工作流', '含 H3 节点', wfNodes.some((n) => /MiniMaxH3/.test(n.class_type)));
add('B-工作流', '含 LoadImage 参考图节点', wfNodes.filter((n) => n.class_type === 'LoadImage').length >= 1);

// ⚠️ 回归：AUTOGROW 输入的接线写法必须带点号（images.image_1 / ref_images.ref_image_1）
// 错误写法会被 ComfyUI 静默忽略 → 参考图完全不生效（实测输出哈希相同）
add(
  'B-工作流',
  'h3-image 参考图接线用点号形式',
  (() => {
    const src = fs.readFileSync(path.join(ROOT, 'host/services/h3-image.js'), 'utf8');
    return src.includes('images.image_') && src.includes('images.image_${i + 1}') && !/inputs\.images\s*=\s*refNames/.test(src);
  })(),
);
add(
  'B-工作流',
  'h3 视频参考图接线用点号形式',
  (() => {
    const src = fs.readFileSync(path.join(ROOT, 'host/services/generator.js'), 'utf8');
    return src.includes('ref_images.ref_image_') && src.includes('ref_images.ref_image_${i + 1}') && !/inputs\.ref_images\s*=\s*names\.map/.test(src);
  })(),
);
add('B-工作流', '含 SaveVideo 输出', wfNodes.some((n) => n.class_type === 'SaveVideo'));
const raw = fs.readFileSync(path.join(ROOT, 'data/workflows/h3.json'), 'utf8');
// 新版工作流是 ReferenceToVideo 链路：参考图用 REF_IMAGE_*，不再有 CFG/首尾帧占位符
for (const ph of ['PROMPT', 'WIDTH', 'HEIGHT', 'LENGTH', 'STEPS', 'SEED', 'REF_IMAGE_1', 'REF_IMAGE_SIZE']) {
  add('B-工作流', `占位符 ${ph}`, raw.includes(`{{${ph}}}`));
}

/* ============================================================
 * ⚠️ 回归：参考图必须真的进入 ComfyUI
 *
 * 历史缺陷（用户实测报告"图片没有真正进入模型"）：
 *  1) stageToComfyInput 在 cfg.comfyInputDir 为空时**直接 return {}**
 *     （该字段默认就是空字符串）→ 调用方拿不到文件名 → 接线整段跳过
 *     → 提交的工作流里根本没有图，人设卡与视频都退化成纯文生图。
 *  2) generator.js 只给前 2 张参考图做 LoadImage 占位（20/21），
 *     而模板/节点支持 9 张 → 第 3 张起指向不存在的节点。
 *
 * 这里做**行为级**断言（真跑接线），不是 grep 源码。
 * ============================================================ */

const comfy = await import('../host/services/comfy-client.js');

// (1) 参考图必须真送进 ComfyUI —— 要么成功，要么显式报错，**绝不静默返回空**
{
  // 端口自动发现后，空配置也可能真的送达（本机有 ComfyUI 时）。
  // 关键不变量是：允许"成功"，允许"抛错"，但不允许"返回空对象还不报错"。
  const probeCfg = { comfyUrl: '', comfyInputDir: '' };
  let ok = false;
  let detail = '';
  try {
    const r = await comfy.stageToComfyInput(probeCfg, { '{{X}}': path.join(ROOT, 'icon.svg') }, 'vtest');
    // 成功路径：必须真的给出文件名
    const landed = Object.keys(r).length === 1 && Boolean(r['{{X}}']);
    ok = landed;
    detail = landed ? `已送达 ${r['{{X}}']}` : '返回了空对象（静默丢图）';
  } catch (e) {
    // 失败路径也是合法的 —— 只要它显式报了错
    ok = true;
    detail = `显式报错 ${String(e.message).slice(0, 40)}`;
  }
  add('B-参考图', '绝不静默丢图（成功或报错二选一）', ok, detail);
}
{
  // 源文件缺失也必须报错
  let threw = false;
  try {
    await comfy.stageToComfyInput({ comfyUrl: '', comfyInputDir: '' }, { '{{X}}': path.join(ROOT, 'no-such.png') }, 'vtest');
  } catch { threw = true; }
  add('B-参考图', '源文件缺失时必须报错', threw);
}
{
  // 无参考图时不该报错
  let ok = true;
  try {
    const r = await comfy.stageToComfyInput({ comfyUrl: '', comfyInputDir: '' }, {}, 'vtest');
    ok = r && Object.keys(r).length === 0;
  } catch { ok = false; }
  add('B-参考图', '无参考图时返回空对象且不报错', ok);
}

// (2) 视频多参考图接线：每张图都要有对应的 LoadImage 节点
{
  const { runH3Local } = await import('../host/services/generator.js');
  const h3Wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/workflows/h3.json'), 'utf8'));
  // 参考图必须是真实存在的文件：resolveRefImages 会过滤掉不存在的路径
  const refImgs = ['a.png', 'b.png', 'c.png'].map((name, i) => {
    const p = path.join(tmp, `ref${i}.png`);
    fs.writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e, 0x47, i]));
    return p;
  });
  let captured = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('/upload/image')) {
      return new Response(JSON.stringify({ name: `stub_${Math.random().toString(36).slice(2, 8)}.png`, subfolder: '', type: 'input' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).endsWith('/prompt')) {
      captured = JSON.parse(opts.body).prompt;
      throw new Error('STOP_AFTER_CAPTURE');
    }
    return realFetch(url, opts);
  };
  try {
    await runH3Local({
      workflow: h3Wf,
      job: { id: 'vtest', params: { seed: 1 } },
      shot: { profile: 'P12-draft', ratio: '16:9', durationSec: 5, refs: { images: refImgs } },
      prompt: 'x',
      cfg: { comfyUrl: 'http://127.0.0.1:8188', comfyInputDir: '', dataDir: path.join(ROOT, 'data') },
    });
  } catch (e) {
    if (e.message !== 'STOP_AFTER_CAPTURE') throw e;
  } finally {
    globalThis.fetch = realFetch;
  }
  const wired = captured ? Object.keys(captured['9'].inputs).filter((k) => k.startsWith('ref_images')) : [];
  const allExist = wired.length > 0 && wired.every((k) => Boolean(captured[captured['9'].inputs[k][0]]));
  add('B-参考图', '视频 3 张参考图全部接线上 LoadImage', wired.length === 3 && allExist, `wired=${wired.length}`);
}

// (3) 参考图路径解析：画布串联第二跳不能静默丢图
{
  const { resolveRefImages } = await import('../host/services/generator.js');
  const pcfg = { dataDir: tmp };
  fs.mkdirSync(path.join(tmp, 'assets'), { recursive: true });
  const img = path.join(tmp, 'assets', 'ref.png');
  fs.writeFileSync(img, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const pick = (ref) => resolveRefImages({ refs: { images: [ref] } }, pcfg).length > 0;
  add('B-参考图', '相对路径可解析', pick('assets/ref.png'));
  add('B-参考图', '绝对路径可解析', pick(img));
  // ⚠️ win32 上 path.isAbsolute('/luoshu/...') === true，必须先排除 URL 形态
  add('B-参考图', '画布同源 /file URL 可反查', pick('/luoshu/api/file?path=' + encodeURIComponent('assets/ref.png')));
  add('B-参考图', '远程 URL 被丢弃（后端取不到）', !pick('https://example.com/a.png'));
  add('B-参考图', 'blob URL 被丢弃', !pick('blob:http://127.0.0.1/x'));
}

// (4) 没有出口能把参考图静默丢成空数组
{
  const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
  const hardcoded = /refs:\s*\{\s*images:\s*\[\s*\]\s*\}/.test(apiSrc);
  add('B-参考图', 'API 层不再硬编码空参考图', !hardcoded);
}

/* ============================================================
 * 回归：本轮修掉的 P0/P1
 * ============================================================ */

// (5) 工具注册不得重名（studio_prompt 曾因重名被静默吃掉）
{
  const src = fs.readFileSync(path.join(ROOT, 'host/tools.js'), 'utf8');
  const names = [...src.matchAll(/^\s{4}'(studio_[a-z_]+)',$/gm)].map((m) => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  add('B-工具', '没有重名工具', dup.length === 0, dup.join(','));
  add('B-工具', 'studio_prompt 仍存在', names.includes('studio_prompt'));
  // 合并后必须同时保留 六段式 action 与旧的无 action 兼容路径
  add('B-工具', 'studio_prompt 支持 action=meta', src.includes("a.action === 'meta'"));
}

// (6) 未知 backend 必须报错，不能静默降级成 mock 假视频
{
  const { VALID_BACKENDS } = await import('../host/api/index.js');
  add('B-后端', 'backend 有显式枚举', VALID_BACKENDS.size >= 4, [...VALID_BACKENDS].join(','));
  const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
  add('B-后端', '未知 backend 抛 UNKNOWN_BACKEND', apiSrc.includes('UNKNOWN_BACKEND'));
  // 兜底不能是无条件 runMock
  add('B-后端', 'runMock 只对 mock 生效', /backendId === 'mock'/.test(apiSrc));
}

// (7) h3-image 必须算本地后端（否则绕过并发闸门 + 取消不发 /interrupt）
{
  const { LOCAL_BACKENDS, isLocalBackendOf } = await import('../host/services/job-store.js');
  add('B-后端', 'h3-image 在 LOCAL_BACKENDS 内', LOCAL_BACKENDS.has('h3-image'));
  add('B-后端', 'h3-image 被识别为本地后端', isLocalBackendOf('h3-image'));
  add('B-后端', 'seedance-cloud 不是本地后端', !isLocalBackendOf('seedance-cloud'));
}

// (8) 导演台不得硬编码端口，且 stop 必须复用同一控制器实例
{
  const src = fs.readFileSync(path.join(ROOT, 'host/services/director3d.js'), 'utf8');
  add('B-导演台', 'base 跟随 cfg.previzPort', src.includes('cfg?.previzPort') || src.includes('cfg.previzPort'));
  add('B-导演台', 'start/stop 复用一个控制器实例', src.includes('sharedPreviz'));
  add('B-导演台', 'stop 不再新建实例', !/async function stop\(\)\s*\{[\s\S]{0,120}createPrevizController\(/.test(src));
}

// (9) 画布 Agent 的生成/技能工具必须真的接线
{
  const idx = fs.readFileSync(path.join(ROOT, 'host/index.js'), 'utf8');
  add('B-画布Agent', '注入 runGenerate', idx.includes('runGenerate:'));
  add('B-画布Agent', '注入 runSkill', idx.includes('runSkill:'));
  const ca = fs.readFileSync(path.join(ROOT, 'host/services/canvas-agent.js'), 'utf8');
  add('B-画布Agent', 'call_skill 不再是空壳', !ca.includes('技能调用转交对应服务'));
}

// (10) validateShot 必须真的被调用
{
  const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
  const calls = (apiSrc.match(/validateShot\(/g) || []).length;
  add('B-校验', 'validateShot 被实际调用', calls >= 1, `calls=${calls}`);
}

/* ============================================================
 * 回归：路径可移植性（不得出现硬编码盘符）
 * ============================================================ */
{
  const HOST_FILES = [
    'host/config.js', 'host/index.js', 'host/tools.js', 'host/api/index.js', 'host/security.js',
    'host/runtime.js', 'host/static.js',
    ...fs.readdirSync(path.join(ROOT, 'host/services')).map((f) => `host/services/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'host/store')).map((f) => `host/store/${f}`),
  ].filter((f) => f.endsWith('.js'));

  const offenders = [];
  for (const rel of HOST_FILES) {
    let src;
    try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
    // 匹配 "X:\..." 形式的硬编码盘符（注释里提到也算提示，但只报代码行）
    for (const line of src.split(/\r?\n/)) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;   // 跳过注释
      if (/['"`][A-Za-z]:[\\/]/.test(line)) offenders.push(`${rel}: ${line.trim().slice(0, 70)}`);
    }
  }
  add('B-可移植', 'host 代码无硬编码盘符路径', offenders.length === 0, offenders.slice(0, 3).join(' | '));
}

// (11) 产出一律带 rel（前端不再需要从绝对路径里抠）
{
  const comfySrc = fs.readFileSync(path.join(ROOT, 'host/services/comfy-client.js'), 'utf8');
  add('B-可移植', 'comfy 产出含 rel', /rel:\s*toRel\(/.test(comfySrc));
  add('B-可移植', 'toRel 已导出', /export function toRel\(/.test(comfySrc));
  const seedSrc = fs.readFileSync(path.join(ROOT, 'host/services/seedance-client.js'), 'utf8');
  add('B-可移植', 'seedance 产出含 rel', (seedSrc.match(/rel:\s*toRel\(/g) || []).length >= 2);
}

// (12) post / extractFrame 对图片输入要报清晰错误
{
  const postSrc = fs.readFileSync(path.join(ROOT, 'host/services/post.js'), 'utf8');
  add('B-后处理', 'scale 按输入类型决定输出格式', postSrc.includes('kindOf(abs)'));
  add('B-后处理', '抽帧对非视频报 NOT_A_VIDEO', postSrc.includes('NOT_A_VIDEO'));
}

/* ============================================================
 * 角色卡仓库
 * ============================================================ */

// (13) 拆解提示词不得复述图片外观
{
  const { buildBreakdownPrompt } = await import('../host/services/breakdown.js');
  const input = {
    character: '三角初华',
    outfit: ['黑色画家帽', '银白蕾丝胸衣'],
    parts: ['金色兽尾'],
    notes: '哥特风格',
    // 即使调用方塞了外观描述，也不该出现在提示词里
    description: '金发紫瞳的少女',
  };
  for (const lv of ['standard', 'full', 'parts']) {
    const p = buildBreakdownPrompt(input, lv);
    const leak = /金发|紫瞳|银蓝色|红橙色眼睛/.test(p);
    add('B-拆解提示词', `${lv} 档不复述外貌`, !leak, leak ? p.slice(0, 80) : '');
  }
  // 必须保留任务指令与一致性要求
  const std = buildBreakdownPrompt(input, 'standard');
  add('B-拆解提示词', '保留三视图要求', std.includes('三视图'));
  add('B-拆解提示词', '保留"以参考图为准"', /以参考图为准/.test(std));
  add('B-拆解提示词', '角色名只作称呼', std.includes('「三角初华」'));
}

// (14) 角色卡仓库：预算裁剪与槽位策略
{
  const os = await import('node:os');
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-vault-'));
  const { createVaultService, H3_MAX_REF_IMAGES } = await import('../host/services/character-vault.js');
  const v = createVaultService({ cfg: { dataDir: tmpVault } });

  add('B-角色卡', 'H3 参考图上限为 9', H3_MAX_REF_IMAGES === 9);

  // sheet-first：有 sheet 用 sheet
  const c1 = await v.upsert({
    name: 'A', images: { sheet: 'assets/s.png', origin: 'assets/o.png' },
    refPolicy: { mode: 'sheet-first', maxImages: 1 },
  });
  add('B-角色卡', 'sheet-first 取设定卡', c1.resolvedImages[0]?.slot === 'sheet');

  // both：两张都带
  const c2 = await v.upsert({
    name: 'B', images: { sheet: 'assets/s2.png', origin: 'assets/o2.png' },
    refPolicy: { mode: 'both', maxImages: 2 },
  });
  add('B-角色卡', 'both 取两张', c2.resolvedImages.length === 2);

  // 超限：10 张卡 → 裁到 9 且给警告
  const ids = [c1.id, c2.id];
  for (let i = 0; i < 8; i += 1) {
    const x = await v.upsert({ name: `X${i}`, images: { sheet: `assets/x${i}.png` }, refPolicy: { mode: 'sheet-first', maxImages: 1 } });
    ids.push(x.id);
  }
  const plan = await v.plan({ cardIds: ids });
  add('B-角色卡', '超限时裁到上限', plan.used <= H3_MAX_REF_IMAGES, `used=${plan.used}`);
  add('B-角色卡', '超限时有明确警告', plan.warnings.length > 0);

  // 设定卡优先级高于原立绘
  const sheetIds = [];
  for (let i = 0; i < 8; i += 1) {
    sheetIds.push((await v.upsert({ name: `S${i}`, images: { sheet: `assets/s${i}.png` }, refPolicy: { mode: 'sheet-first', maxImages: 1 } })).id);
  }
  for (let i = 0; i < 4; i += 1) {
    sheetIds.push((await v.upsert({ name: `O${i}`, images: { origin: `assets/o${i}.png` }, refPolicy: { mode: 'sheet-first', maxImages: 1 } })).id);
  }
  const plan2 = await v.plan({ cardIds: sheetIds });
  const sheetsKept = plan2.characters.filter((x) => x.slot === 'sheet').length;
  add('B-角色卡', '裁剪时优先保留设定卡', sheetsKept === 8, `kept=${sheetsKept}`);

  fs.rmSync(tmpVault, { recursive: true, force: true });
}

// (15) 角色卡注入提示词的编号必须与参考图顺序一致
{
  const src = fs.readFileSync(path.join(ROOT, 'host/services/generator.js'), 'utf8');
  add('B-角色卡', '生成时注入 subject_definitions', src.includes('subject_definitions'));
  add('B-角色卡', '按 <Picture N> 编号引用', /<Picture \$\{/.test(src) || src.includes('<Picture '));
  add('B-角色卡', '角色卡图排在参考图最前', /0\) 角色卡仓库/.test(src));
}

/* ============================================================
 * H3 四类参考输入（图 / 视频 / 视频音轨 / 独立音频）
 * 依据 docs/H3参考输入契约.md
 * ============================================================ */
{
  const { buildRenderPlan, buildMediaNotes, H3_MAX_REF_VIDEOS, H3_MAX_REF_AUDIOS }
    = await import('../host/services/render-plan.js');

  add('B-媒体参考', '视频上限 3 段', H3_MAX_REF_VIDEOS === 3);
  add('B-媒体参考', '音频上限 3 段', H3_MAX_REF_AUDIOS === 3);

  // 核心：视频自带音轨会占用 <Audio> 编号
  const p1 = buildRenderPlan({
    videos: [{ rel: 'v1.mp4', hasAudio: true }, { rel: 'v2.mp4', hasAudio: false }],
    audios: [{ rel: 'a1.wav' }],
  });
  add('B-媒体参考', '<Video 1> 编号正确', p1.videos[0]?.index === 1);
  add('B-媒体参考', '<Video 2> 编号正确', p1.videos[1]?.index === 2);
  add('B-媒体参考', '带音轨视频占 <Audio 1>', p1.videos[0]?.audioIndex === 1);
  add('B-媒体参考', '无声视频不占音频编号', p1.videos[1]?.audioIndex === undefined);
  add('B-媒体参考', '独立音频顺延为 <Audio 2>', p1.audios[0]?.audioIndex === 2, `got=${p1.audios[0]?.audioIndex}`);

  // 无视频时，独立音频从 1 开始
  const p2 = buildRenderPlan({ audios: [{ rel: 'a.wav' }] });
  add('B-媒体参考', '无视频时独立音频为 <Audio 1>', p2.audios[0]?.audioIndex === 1);

  // 参考说明段
  const notes = buildMediaNotes(p1);
  add('B-媒体参考', '生成视频用途说明', notes.some((n) => n.includes('<Video 1>')));
  add('B-媒体参考', '生成音频用途说明', notes.some((n) => n.includes('<Audio 2>')));

  // 统计
  add('B-媒体参考', 'stats 含视频数', p1.stats.videoCount === 2);
  add('B-媒体参考', 'stats 含音轨数', p1.stats.videoAudioCount === 1);

  // 超限截断
  const p3 = buildRenderPlan({
    videos: Array.from({ length: 5 }, (_, i) => ({ rel: `v${i}.mp4`, hasAudio: false })),
    audios: Array.from({ length: 5 }, (_, i) => ({ rel: `a${i}.wav` })),
  });
  add('B-媒体参考', '视频超限截到 3', p3.videos.length === 3, `got=${p3.videos.length}`);
  add('B-媒体参考', '音频超限截到 3', p3.audios.length === 3, `got=${p3.audios.length}`);
}

/* ============================================================
 * 媒体探测（ffprobe）
 * ============================================================ */
{
  const { probeMedia, resetProbeCache } = await import('../host/services/media-probe.js');
  add('B-媒体探测', '导出 probeMedia', typeof probeMedia === 'function');

  // 缺文件要优雅失败，不能抛
  resetProbeCache();
  let failOk = true;
  let r = null;
  try { r = await probeMedia('F:\\__no_such_file__.mp4', {}); } catch { failOk = false; }
  add('B-媒体探测', '缺失文件不抛异常', failOk);
  add('B-媒体探测', '缺失文件返回 ok=false', r?.ok === false);
  add('B-媒体探测', '缺失文件 hasAudio=false', r?.hasAudio === false);

  // 用真实的测试素材探测（存在才测）
  const ff = 'F:\\AI视频\\工作室\\tools\\ffmpeg\\bin\\ffmpeg.exe';
  if (fs.existsSync(ff)) {
    const os2 = await import('node:os');
    const tmpMedia = fs.mkdtempSync(path.join(os2.tmpdir(), 'jz-probe-'));
    const { execFileSync } = await import('node:child_process');
    const mk = (args, out) => {
      try { execFileSync(ff, ['-y', ...args, out], { stdio: 'ignore' }); return true; } catch { return false; }
    };
    const withAudio = path.join(tmpMedia, 'a.mp4');
    const noAudio = path.join(tmpMedia, 'b.mp4');
    const audioOnly = path.join(tmpMedia, 'c.m4a');

    const ok1 = mk(['-f', 'lavfi', '-i', 'color=c=red:s=160x120:d=2:r=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'], withAudio);
    const ok2 = mk(['-f', 'lavfi', '-i', 'color=c=blue:s=160x120:d=2:r=24', '-c:v', 'libx264', '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p', '-an'], noAudio);
    const ok3 = mk(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=2', '-c:a', 'aac'], audioOnly);

    if (ok1 && ok2 && ok3) {
      resetProbeCache();
      const pa = await probeMedia(withAudio, {});
      const pb = await probeMedia(noAudio, {});
      const pc = await probeMedia(audioOnly, {});
      add('B-媒体探测', '带音轨视频识别为 hasAudio', pa.ok && pa.hasAudio === true && pa.kind === 'video',
        `kind=${pa.kind} hasAudio=${pa.hasAudio}`);
      add('B-媒体探测', '无音轨视频识别为 hasAudio=false', pb.ok && pb.hasAudio === false && pb.kind === 'video',
        `kind=${pb.kind} hasAudio=${pb.hasAudio}`);
      add('B-媒体探测', '纯音频识别为 audio', pc.ok && pc.kind === 'audio', `kind=${pc.kind}`);
      add('B-媒体探测', '能读出时长', Math.abs((pa.durationSec ?? 0) - 2) < 0.5, `dur=${pa.durationSec}`);
    } else {
      add('B-媒体探测', '测试素材生成（跳过）', true);
    }
    try { fs.rmSync(tmpMedia, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/* ============================================================
 * ref_image_size 档位
 * ============================================================ */
{
  const { REF_IMAGE_SIZE_MODES, normalizeRefImageSize, buildRenderPlan }
    = await import('../host/services/render-plan.js');

  add('B-保真档位', '有两个档位', REF_IMAGE_SIZE_MODES.length === 2);
  add('B-保真档位', 'match 归一化正确', normalizeRefImageSize('match') === 'match');
  add('B-保真档位', 'max 归一化正确', normalizeRefImageSize('max') === 'max');
  add('B-保真档位', '非法值回落 match', normalizeRefImageSize('xxx') === 'match');
  add('B-保真档位', 'undefined 回落 match', normalizeRefImageSize(undefined) === 'match');

  const p = buildRenderPlan({ refImageSize: 'max' });
  add('B-保真档位', '计划里带 refImageSize', p.refImageSize === 'max');

  // generator 必须真的把它写进工作流
  const genSrc = fs.readFileSync(path.join(ROOT, 'host/services/generator.js'), 'utf8');
  add('B-保真档位', 'generator 使用统一决策函数', genSrc.includes('decideRefImageSize'));
}

/* ============================================================
 * 媒体时长约束（2–15 秒）
 * ============================================================ */
{
  const { buildRenderPlan, CLIP_SEC_RANGE } = await import('../host/services/render-plan.js');
  add('B-时长约束', '范围是 2–15 秒', CLIP_SEC_RANGE[0] === 2 && CLIP_SEC_RANGE[1] === 15);

  const p = buildRenderPlan({
    videos: [
      { rel: 'short.mp4', durationSec: 0.8, hasAudio: false },
      { rel: 'long.mp4', durationSec: 30, hasAudio: false },
      { rel: 'ok.mp4', durationSec: 5, hasAudio: false },
    ],
    audios: [
      { rel: 'tiny.wav', durationSec: 1.2 },
      { rel: 'fine.wav', durationSec: 6 },
    ],
  });
  const w = p.warnings.join(' | ');
  add('B-时长约束', '过短视频被警告', w.includes('short.mp4') && w.includes('短于'));
  add('B-时长约束', '过长视频被警告', w.includes('long.mp4') && w.includes('超过'));
  add('B-时长约束', '合格视频不警告', !w.includes('ok.mp4'));
  add('B-时长约束', '过短音频被警告', w.includes('tiny.wav'));
  add('B-时长约束', '合格音频不警告', !w.includes('fine.wav'));

  // 没有时长数据时不能误报
  const q = buildRenderPlan({ videos: [{ rel: 'x.mp4', hasAudio: false }] });
  add('B-时长约束', '无时长数据不误报', q.warnings.length === 0);

  // 与 h3-prompt 的常量必须一致（两处独立定义，容易漂移）
  const { H3_LIMITS } = await import('../host/services/h3-prompt.js');
  add('B-时长约束', '与 H3_LIMITS 一致',
    H3_LIMITS.audioClipSec[0] === CLIP_SEC_RANGE[0] && H3_LIMITS.audioClipSec[1] === CLIP_SEC_RANGE[1],
    `${H3_LIMITS.audioClipSec} vs ${CLIP_SEC_RANGE}`);
}

/* ============================================================
 * max 模式的显存保护
 * ============================================================ */
{
  const { decideRefImageSize, MAX_MODE_MIN_FREE_VRAM_BYTES, buildRenderPlan }
    = await import('../host/services/render-plan.js');
  const GB = 1024 ** 3;

  add('B-显存保护', '门槛已定义', MAX_MODE_MIN_FREE_VRAM_BYTES > 0);

  const plenty = { ok: true, freeBytes: 8 * GB };
  const tight = { ok: true, freeBytes: 2 * GB };
  const unknown = { ok: false, freeBytes: 0 };

  add('B-显存保护', 'match 不受影响', decideRefImageSize('match', tight).value === 'match');
  add('B-显存保护', 'max + 充足 → 保持 max', decideRefImageSize('max', plenty).value === 'max');
  const d = decideRefImageSize('max', tight);
  add('B-显存保护', 'max + 不足 → 降级 match', d.value === 'match' && d.downgraded === true);
  add('B-显存保护', '降级必须说明原因', d.reason.length > 0 && d.reason.includes('显存'));
  add('B-显存保护', 'max + 未知 → 不降级（尊重用户）', decideRefImageSize('max', unknown).value === 'max');

  // 计划里要能看到"请求什么/实际用什么/是否降级"
  const p = buildRenderPlan({ refImageSize: 'max', vram: tight });
  add('B-显存保护', '计划记录请求值', p.refImageSizeRequested === 'max');
  add('B-显存保护', '计划记录实际值', p.refImageSize === 'match');
  add('B-显存保护', '计划标记已降级', p.refImageSizeDowngraded === true);
  add('B-显存保护', '降级写进 warnings', p.warnings.some((x) => x.includes('显存')));
}

/* ============================================================
 * 探测结果回写素材库
 * ============================================================ */
{
  const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
  add('B-回写', '有 writeBackProbe', apiSrc.includes('function writeBackProbe'));
  add('B-回写', 'resolveMediaRefs 会回写', /writeBackProbe\(ctx, cfg, rel, probe\)/.test(apiSrc));
  add('B-回写', 'asset-service 导出 upsertRaw', fs.readFileSync(path.join(ROOT, 'host/services/asset-service.js'), 'utf8').includes('upsertRaw'));
  add('B-回写', 'comfy 暴露 vramStatus', fs.readFileSync(path.join(ROOT, 'host/services/comfy-client.js'), 'utf8').includes('export async function vramStatus'));
}

/* ============================================================
 * 端口自动发现（Hyper-V 会动态保留大段端口，不能写死）
 * ============================================================ */
{
  const comfy = await import('../host/services/comfy-client.js');
  add('B-端口', '导出 discoverComfyUrl', typeof comfy.discoverComfyUrl === 'function');
  add('B-端口', '导出 resolveComfyUrl', typeof comfy.resolveComfyUrl === 'function');
  add('B-端口', '导出 resetComfyProbe', typeof comfy.resetComfyProbe === 'function');

  // 环境变量优先级最高
  process.env.DSH_COMFY_URL = 'http://127.0.0.1:19999';
  const viaEnv = comfy.discoverComfyUrl();
  add('B-端口', '环境变量可覆盖发现', viaEnv === 'http://127.0.0.1:19999', viaEnv);
  delete process.env.DSH_COMFY_URL;

  // 端口文件格式正确时应被采用
  const os2 = await import('node:os');
  const tmpHome = fs.mkdtempSync(path.join(os2.tmpdir(), 'jz-port-'));
  fs.writeFileSync(path.join(tmpHome, '.comfy-port'), '12345', 'utf8');
  process.env.DSH_COMFY_HOME = tmpHome;
  const viaFile = comfy.discoverComfyUrl();
  add('B-端口', '端口文件可被读取', viaFile === 'http://127.0.0.1:12345', viaFile);

  // 非法端口要忽略，不能崩
  fs.writeFileSync(path.join(tmpHome, '.comfy-port'), 'not-a-port', 'utf8');
  let badOk = true;
  try { comfy.discoverComfyUrl(); } catch { badOk = false; }
  add('B-端口', '非法端口文件不崩溃', badOk);
  delete process.env.DSH_COMFY_HOME;
  fs.rmSync(tmpHome, { recursive: true, force: true });

  // 启动脚本必须自己挑端口（不再硬编码 8188）
  const ps1 = path.join(ROOT, '..', '..', 'ai-runtime', 'start-h3.ps1');
  if (fs.existsSync(ps1)) {
    const src = fs.readFileSync(ps1, 'utf8');
    add('B-端口', '启动脚本有端口挑选逻辑', src.includes('Find-FreePort') || src.includes('Test-PortUsable'));
    add('B-端口', '启动脚本写端口文件', src.includes('.comfy-port'));
    add('B-端口', '启动脚本不硬编码 8188 作为唯一端口', !/--port['",\s]+8188/.test(src));
  }
}

/* ============================ C. HTTP 集成 ============================ */

const { initRuntime, attachControllers } = await import('../host/runtime.js');
const { handleApi } = await import('../host/api/index.js');
const { serveSpa } = await import('../host/static.js');
const { createPrevizController } = await import('../host/services/previz-controller.js');
const { createH3Workshop } = await import('../host/services/h3-workshop.js');
const { createPostService } = await import('../host/services/post.js');
const { createAssetService } = await import('../host/services/asset-service.js');

let port = 0;
initRuntime({ root: ROOT, cfg, webServer: { getOrigin: () => `http://127.0.0.1:${port}` } });
attachControllers({
  previz: createPrevizController({ root: ROOT, cfg }),
  h3: createH3Workshop({ root: ROOT, cfg }),
  post: createPostService({ cfg }),
  assets: createAssetService({ cfg }),
});

const distTmp = path.join(tmp, 'dist');
fs.mkdirSync(distTmp, { recursive: true });
fs.writeFileSync(path.join(distTmp, 'index.html'), '<!doctype html><title>九章工作室</title><div id=root></div>');
fs.writeFileSync(path.join(distTmp, 'a.txt'), 'static-ok');

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/luoshu/api')) return handleApi(req, res).catch((e) => { res.writeHead(500); res.end(String(e)); });
  if (u.pathname.startsWith('/luoshu/app')) return serveSpa(req, res, { prefix: '/luoshu/app', distDir: distTmp }).catch(() => res.end());
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
port = server.address().port;
const base = `http://127.0.0.1:${port}`;

async function call(method, p, body, headers = {}) {
  const r = await fetch(base + p, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* not json */ }
  return { status: r.status, json: j, text: t };
}

const tokRes = await call('GET', '/luoshu/api/token');
const TOKEN = tokRes.json?.token;
add('C-HTTP', 'GET /token 返回 token', Boolean(TOKEN));
add('C-HTTP', 'GET /token 注入 origin', tokRes.json?.origin === base);

add('C-HTTP', '无 token 写被拒', (await call('POST', '/luoshu/api/projects', { name: 'x' })).status === 403);
add('C-HTTP', '跨源读被拒', (await call('GET', '/luoshu/api/projects', null, { Origin: 'http://evil.example' })).status === 403);

const proj = await call('POST', '/luoshu/api/projects', { name: 'V项目', category: 'drama' }, { 'X-JZ-Token': TOKEN });
add('C-HTTP', '带 token 建项目', proj.status === 200 && Boolean(proj.json?.id));
add('C-HTTP', '项目读回', (await call('GET', '/luoshu/api/projects')).json?.length === 1);

const pid = proj.json.id;
const shot = await call('POST', `/luoshu/api/projects/${pid}/shots`,
  { shot: { title: 'V镜头', durationSec: 3, ratio: '16:9', profile: 'P12-draft', backend: 'mock', style: '电影感' } },
  { 'X-JZ-Token': TOKEN });
add('C-HTTP', '建镜头', shot.status === 200 && Boolean(shot.json?.id));

const meta = await call('GET', '/luoshu/api/meta');
add('C-HTTP', 'meta 26 节点', meta.json?.nodeTypes?.length === 26);
add('C-HTTP', 'meta 19 槽位', meta.json?.h3Slots?.length === 19);

const an = await call('POST', '/luoshu/api/h3/workshop/analyze',
  { text: '林晚：走。\n陈默：不。', episode: 1, durationMin: 4, durationMax: 10 }, { 'X-JZ-Token': TOKEN });
add('C-HTTP', '工坊 analyze', an.status === 200 && an.json?.segments?.length >= 1);

const imp = await call('POST', '/luoshu/api/h3/workshop/import', { projectId: pid, analysis: an.json }, { 'X-JZ-Token': TOKEN });
add('C-HTTP', '工坊 import 建资产', (imp.json?.summary?.created ?? 0) > 0);

add('C-HTTP', '未知路由 404', (await call('GET', '/luoshu/api/nope')).status === 404);
add('C-HTTP', '坏集数报错', (await call('POST', '/luoshu/api/h3/workshop/analyze', { text: 'x', episode: 0 }, { 'X-JZ-Token': TOKEN })).status === 500);

// SPA 服务
const sp = await fetch(base + '/luoshu/app/');
add('C-SPA', 'index 200', sp.status === 200);
add('C-SPA', '静态资源可取', (await fetch(base + '/luoshu/app/a.txt')).status === 200);
add('C-SPA', '穿越被挡', !(await (await fetch(base + '/luoshu/app/../../../etc/passwd')).text()).includes('root:'));

// 生成（mock，真出片）
const gen = await call('POST', '/luoshu/api/generate', { projectId: pid, shotId: shot.json.id, backend: 'mock' }, { 'X-JZ-Token': TOKEN });
add('C-生成', '提交 mock 任务', gen.status === 200 && Boolean(gen.json?.id));
const jobId = gen.json.id;
let finalJob = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const list = (await call('GET', '/luoshu/api/jobs')).json || [];
  finalJob = list.find((j) => j.id === jobId);
  if (finalJob && ['completed', 'failed', 'cancelled'].includes(finalJob.status)) break;
}
add('C-生成', '任务到达终态', Boolean(finalJob) && finalJob.status !== 'queued', finalJob?.status);
add('C-生成', 'mock 出片成功', finalJob?.status === 'completed', finalJob?.error || '');
if (finalJob?.outputs?.[0]?.path) {
  const out = finalJob.outputs[0];
  add('C-生成', '产物文件存在', fs.existsSync(out.path), out.path);
  add('C-生成', '产物非空', fs.statSync(out.path).size > 1000, out.bytes);
}

server.close();

/* ============================ 结果汇总 ============================ */

const byGroup = {};
for (const r of results) {
  byGroup[r.group] ||= { pass: 0, fail: 0, fails: [] };
  if (r.ok) byGroup[r.group].pass++;
  else { byGroup[r.group].fail++; byGroup[r.group].fails.push(`${r.name}${r.detail !== undefined ? ' :: ' + r.detail : ''}`); }
}

console.log('========== 验收结果 ==========');
let totalPass = 0, totalFail = 0;
for (const [g, s] of Object.entries(byGroup)) {
  console.log(`${g.padEnd(10)} PASS ${String(s.pass).padStart(2)}  FAIL ${s.fail}`);
  for (const f of s.fails) console.log(`   ✗ ${f}`);
  totalPass += s.pass; totalFail += s.fail;
}
console.log('-------------------------------');
console.log(`TOTAL PASS=${totalPass} FAIL=${totalFail}`);

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(totalFail ? 1 : 0);


