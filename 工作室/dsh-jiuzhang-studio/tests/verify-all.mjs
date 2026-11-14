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
/** 明确记为"跳过"（不计入 PASS，也不假装通过） */
const skip = (group, name, detail) => results.push({ group, name, ok: true, skipped: true, detail });

/**
 * 找出可用于测试的 ffmpeg —— 复用插件自己的解析链，不写死盘符。
 * 解析顺序与运行时一致：DSH_FFMPEG_DIR / FFMPEG_DIR → 插件配置 → 向上找 tools/ffmpeg → PATH。
 */
function resolveFfmpegForTest() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const dirs = [];
  for (const key of ['DSH_FFMPEG_DIR', 'FFMPEG_DIR']) {
    const v = process.env[key];
    if (v) { dirs.push(path.join(v, 'bin')); dirs.push(v); }
  }
  try {
    const cfgPath = path.join(ROOT, 'data', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const c = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (c?.ffmpegDir) { dirs.push(path.join(c.ffmpegDir, 'bin')); dirs.push(c.ffmpegDir); }
    }
  } catch { /* ignore */ }
  // 从插件根向上逐层找 tools/ffmpeg
  let dir = ROOT;
  for (let i = 0; i < 6; i += 1) {
    dirs.push(path.join(dir, 'tools', 'ffmpeg', 'bin'));
    dirs.push(path.join(dir, 'tools', 'ffmpeg'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const d of dirs) {
    const p = path.join(d, exe);
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  // 最后退回 PATH
  for (const d of String(process.env.PATH || '').split(path.delimiter)) {
    if (!d) continue;
    const p = path.join(d, exe);
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

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

  // 用真实的 ffmpeg 生成测试素材（走插件自己的解析链，不写死盘符；
  // 找不到就**明确记为跳过**，而不是静默 add(..., true) 假装通过）
  const ff = resolveFfmpegForTest();
  if (ff) {
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
      skip('B-媒体探测', 'ffmpeg 无法生成测试素材', `ffmpeg=${ff}`);
    }
    try { fs.rmSync(tmpMedia, { recursive: true, force: true }); } catch { /* ignore */ }
  } else {
    // 明确跳过：不再用 add(..., true) 假装通过
    skip('B-媒体探测', '未找到 ffmpeg，真实素材探测跳过', '可用 DSH_FFMPEG_DIR 指定');
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
  // 注意：合格项可能因"时长未知不计入预算"以外的原因出现，
  // 这里只断言它**没有被判为时长违规**（不该出现在"短于/超过"警告里）
  add('B-时长约束', '合格视频不警告', !/ok\.mp4.*(短于|超过)/.test(w));
  add('B-时长约束', '过短音频被警告', w.includes('tiny.wav'));
  add('B-时长约束', '合格音频不警告', !/fine\.wav.*(短于|超过)/.test(w));

  // 没有时长数据时，不该被判为时长违规
  // （R23 起会额外提示"时长未知不计入预算"，那是有意为之的告知，不算误报）
  const q = buildRenderPlan({ videos: [{ rel: 'x.mp4', hasAudio: false }] });
  add('B-时长约束', '无时长数据不误报', !q.warnings.some((x) => /短于|超过/.test(x)),
    q.warnings.join(' | '));

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
  // writeBackProbe / resolveMediaRefs 已下沉到 services/shot-context.js，
  // 这里改查**真正的实现文件**，并确认 api 层仍然导出（兼容旧调用点）。
  const ctxSrc = fs.readFileSync(path.join(ROOT, 'host/services/shot-context.js'), 'utf8');
  const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
  add('B-回写', '有 writeBackProbe', /export async function writeBackProbe/.test(ctxSrc));
  add('B-回写', 'resolveMediaRefs 会回写', /writeBackProbe\(ctx, cfg, rel, probe\)/.test(ctxSrc));
  add('B-回写', 'api 层重新导出共享实现', /from '\.\.\/services\/shot-context\.js'/.test(apiSrc));
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
  //
  // ⚠️ 这里曾经写的是 `path.join(ROOT, '..', '..', 'ai-runtime', 'start-h3.ps1')`，
  //    ROOT = <workspace>/工作室/dsh-jiuzhang-studio，所以 '..','..' 指向
  //    <workspace>/工作室，而脚本实际在 <workspace>/ai-runtime/ —— **少了一层**。
  //    于是这三项检查从来没跑过，一直静默跳过。
  //    现在逐层向上找，不再依赖写死层级。
  const ps1 = (() => {
    let dir = ROOT;
    for (let i = 0; i < 6; i += 1) {
      const p = path.join(dir, 'ai-runtime', 'start-h3.ps1');
      if (fs.existsSync(p)) return p;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return '';
  })();
  if (ps1) {
    const src = fs.readFileSync(ps1, 'utf8');
    add('B-端口', '启动脚本有端口挑选逻辑', src.includes('Find-FreePort') || src.includes('Test-PortUsable'), ps1);
    add('B-端口', '启动脚本写端口文件', src.includes('.comfy-port'));
    add('B-端口', '启动脚本不硬编码 8188 作为唯一端口', !/--port['",\s]+8188/.test(src));
  } else {
    skip('B-端口', '未找到 ai-runtime/start-h3.ps1（可选运行时）', '插件本身不依赖它');
  }
}

/* ============================================================
 * 审查回归 —— 每条对应一个曾经真实存在、且会静默失败的问题
 * ============================================================ */
{
  // ---- R1 工作流模板不跟随 dataDir ----
  {
    const { resolveWorkflowFile, resolveWorkflowDir, readWorkflow } = await import('../host/services/workflow-paths.js');
    const altDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-altdata-'));
    const cfgAlt = { ...cfg, dataDir: altDir };
    const f = resolveWorkflowFile('h3', cfgAlt);
    add('B-回归', 'R1 工作流不跟随 dataDir', !f.startsWith(altDir), f);
    add('B-回归', 'R1 改 dataDir 后仍能读到 h3 工作流', Boolean(readWorkflow('h3', cfgAlt)));
    add('B-回归', 'R1 改 dataDir 后仍能读到 image 工作流', Boolean(readWorkflow('image', cfgAlt)));
    add('B-回归', 'R1 工作流目录指向插件内 data/workflows',
      resolveWorkflowDir(cfgAlt).replace(/\\/g, '/').endsWith('/data/workflows'), resolveWorkflowDir(cfgAlt));
    fs.rmSync(altDir, { recursive: true, force: true });

    // 四处调用点必须都用共享解析器（防止再次各自拼路径）
    // 只看**代码行**：注释里提到旧写法（`path.join(cfg.dataDir, 'workflows', ...)`）
    // 是刻意保留的考古说明，不该判失败。
    const stripComments = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')       // 块注释
      .replace(/(^|[^:])\/\/.*$/gm, '$1');    // 行注释（避开 http://）
    const srcs = {
      'host/index.js': stripComments(fs.readFileSync(path.join(ROOT, 'host/index.js'), 'utf8')),
      'host/api/index.js': stripComments(fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8')),
      'host/tools.js': stripComments(fs.readFileSync(path.join(ROOT, 'host/tools.js'), 'utf8')),
      'host/services/h3-workshop.js': stripComments(fs.readFileSync(path.join(ROOT, 'host/services/h3-workshop.js'), 'utf8')),
    };
    const bad = Object.entries(srcs).filter(([, s]) => /path\.join\([^)]*'workflows'/.test(s) || /`\$\{dirs\(\)\.root\}\/workflows/.test(s));
    add('B-回归', 'R1 没有残留的手工 workflow 路径拼接', bad.length === 0, bad.map(([f2]) => f2).join(','));
  }

  // ---- R2 取消必须能通知远端（isLocalBackendOf 已导入）----
  {
    const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
    const toolsSrc = fs.readFileSync(path.join(ROOT, 'host/tools.js'), 'utf8');
    add('B-回归', 'R2 api 导入了 isLocalBackendOf', /import\s*\{[^}]*isLocalBackendOf[^}]*\}\s*from\s*'\.\.\/services\/job-store\.js'/.test(apiSrc));
    add('B-回归', 'R2 tools 导入了 isLocalBackendOf', /import\s*\{[^}]*isLocalBackendOf[^}]*\}\s*from\s*'\.\/services\/job-store\.js'/.test(toolsSrc));

    // 行为验证：任务已提交远端时，取消必须把"远端取消成功"报出来
    const { cancelJob, markCancelled } = await import('../host/services/job-runner.js');
    const { jobs: js, newJob } = await import('../host/services/job-store.js');
    const j = newJob({ projectId: 'p', shotId: 's', backendId: 'h3-local', prompt: 'x', params: {} });
    j.remoteId = 'remote-1';
    await js().upsert(j);
    let called = 0;
    const r1 = await cancelJob(j.id, async () => { called += 1; });
    add('B-回归', 'R2 远端取消被调用', called === 1);
    add('B-回归', 'R2 取消结果标记 remoteCancel=ok', r1.remoteCancel === 'ok', r1.remoteCancel);

    const j2 = newJob({ projectId: 'p', shotId: 's', backendId: 'h3-local', prompt: 'x', params: {} });
    j2.remoteId = 'remote-2';
    await js().upsert(j2);
    const r2 = await cancelJob(j2.id, async () => { throw new Error('comfy down'); });
    add('B-回归', 'R2 远端失败时本地仍取消', r2.cancelResult === 'CANCELLED' && r2.status === 'cancelled');
    add('B-回归', 'R2 远端失败**不静默**（带原因）', r2.remoteCancel === 'failed' && /comfy down/.test(r2.remoteCancelError || ''), r2.remoteCancelError);
    void markCancelled;
  }

  // ---- R3 形象库参考图必须真的取得到（ctx 已传入）----
  {
    const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
    add('B-回归', 'R3 resolveMwFigureRefs 接收 ctx', /function resolveMwFigureRefs\(ctx,\s*job\)/.test(apiSrc));
    add('B-回归', 'R3 调用点传了 ctx', /resolveMwFigureRefs\(ctx,\s*job\)/.test(apiSrc));
    // 模块级函数里不允许再出现裸 ctx
    const body = apiSrc.slice(apiSrc.indexOf('function resolveMwFigureRefs'));
    const head = body.slice(0, body.indexOf('\n}\n') + 3);
    add('B-回归', 'R3 函数体内不再引用未声明 ctx', !/\bctx\.mw/.test(head), head.includes('ctx?.mw') ? '用了可选链+参数' : '');
  }

  // ---- R4/R5 studio_generate 与 REST 一致 ----
  {
    const toolsSrc = fs.readFileSync(path.join(ROOT, 'host/tools.js'), 'utf8');
    const seg = toolsSrc.slice(toolsSrc.indexOf("'studio_generate'"), toolsSrc.indexOf("'studio_jobs'"));
    add('B-回归', 'R4 studio_generate 校验后端名', /UNKNOWN_BACKEND/.test(seg));
    add('B-回归', 'R4 studio_generate 有 h3-image 分支', /runH3ImageLocal/.test(seg));
    add('B-回归', 'R4 不再有"未知后端掉进 mock"', !/return seedanceClient\.runMock[\s\S]{0,40}\}\s*\);\s*\n\s*\}\)\;\s*\n\s*return job/.test(seg) || /VALID\.has\(backendId\)/.test(seg));
    add('B-回归', 'R5 studio_generate 解析角色卡', /withVaultCards/.test(seg));
  }

  // ---- R6 pictureIndex 来自真实参考图顺序 ----
  {
    const { resolvePictureIndices } = await import('../host/services/shot-context.js');
    const cards = [
      { id: 'card_A', name: 'A', resolvedImages: [] },                                   // 无图
      { id: 'card_B', name: 'B', resolvedImages: [{ slot: 'sheet', rel: 'assets/b1.png' }] },
    ];
    // 让图"存在"，否则 resolveRefImages 会过滤掉
    fs.mkdirSync(path.join(cfg.dataDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(cfg.dataDir, 'assets', 'b1.png'), 'x');
    const subs = resolvePictureIndices({ characterCards: cards }, cfg);
    const A = subs.find((s) => s.name === 'A');
    const B = subs.find((s) => s.name === 'B');
    add('B-回归', 'R6 无图的卡 pictureIndex=null', A && A.pictureIndex === null && A.hasImage === false, JSON.stringify(A));
    add('B-回归', 'R6 有图的卡编号=1', B && B.pictureIndex === 1, JSON.stringify(B?.pictureIndex));

    // 编译器不能把 null 编号写进提示词
    const { compileH3Prompt } = await import('../host/services/h3-prompt.js');
    const out = compileH3Prompt({
      mode: 'ref2va',
      subjects: [
        { id: 'A', name: 'A', pictureIndex: null, hasImage: false, traits: '黑发' },
        { id: 'B', name: 'B', pictureIndex: 1, traits: '银发' },
      ],
      sceneLayout: '天台',
    });
    add('B-回归', 'R6 无图角色不写 <Picture null>', !out.prompt.includes('<Picture null>'));
    add('B-回归', 'R6 无图角色走文字描述', out.prompt.includes('没有参考图') || out.prompt.includes('text_only'));
  }

  // ---- R7 存储句柄跟随 dataDir ----
  {
    const { projects: pj, newProject: np, resetModelStores } = await import('../host/store/models.js');
    const before = pj.file;
    const alt = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-altstore-'));
    saveConfig({ dataDir: alt });
    resetConfigCache();
    resetModelStores();
    const after = pj.file;
    add('B-回归', 'R7 改 dataDir 后 projects.file 跟随', after !== before && after.startsWith(alt), after);
    await pj.upsert(np({ name: 'R7' }));
    add('B-回归', 'R7 项目真的写进新目录', fs.existsSync(path.join(alt, 'projects.json')));
    saveConfig({ dataDir: tmp });
    resetConfigCache();
    resetModelStores();
    fs.rmSync(alt, { recursive: true, force: true });
  }

  // ---- R8 /file 不能读出秘密 ----
  {
    const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
    add('B-回归', 'R8 /file 有目录白名单', /isServableDataPath/.test(apiSrc) && /SERVABLE_DATA_DIRS/.test(apiSrc));
    add('B-回归', 'R8 白名单不含 dataDir 根', !/SERVABLE_DATA_DIRS[\s\S]{0,200}''/.test(apiSrc));
  }

  // ---- R9 测试与代码里不再写死本项目盘符 ----
  {
    // 注意：断言自身也会出现盘符字面量，所以拼出来比对，避免自匹配
    const drive = 'F' + ':\\\\';
    const self = fs.readFileSync(path.join(ROOT, 'tests/verify-all.mjs'), 'utf8');
    // 允许的唯一一处在"缺失文件探测"用例里（它探测的就是一个不存在的路径）
    const offending = self.split('\n')
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => line.includes(drive) && !line.includes('__no_such_file__'));
    add('B-回归', 'R9 verify-all 无写死项目盘符', offending.length === 0,
      offending.map((o) => `L${o.no}`).join(','));

    const hostFiles = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
        else if (e.name.endsWith('.js')) hostFiles.push(p);
      }
    };
    walk(path.join(ROOT, 'host'));
    const hardcoded = hostFiles.filter((f) => {
      const s = fs.readFileSync(f, 'utf8');
      // 只看代码行，注释里提到旧实现路径是允许的
      return s.split('\n').some((line) => !/^\s*(\*|\/\/|\/\*)/.test(line) && /['"`][A-Za-z]:\\/.test(line));
    });
    add('B-回归', 'R9 host/ 无写死盘符（代码行）', hardcoded.length === 0, hardcoded.map((f) => path.basename(f)).join(','));
  }

  // ---- R10 尺寸表命名与几何一致 ----
  {
    const { IMAGE_SIZES, imageSize, IMAGE_SIZE_ALIASES } = await import('../host/services/h3-image.js');
    const film = IMAGE_SIZES.find((s) => s.id === 'p-2x3-film');
    add('B-回归', 'R10 人物卡 id 与几何一致（2:3）', Boolean(film) && Math.abs(film.w / film.h - 2 / 3) < 0.01, film ? `${film.w}x${film.h}` : 'missing');
    add('B-回归', 'R10 旧 id 仍可用（别名）', imageSize('p-3x4-film').id === 'p-2x3-film');
    add('B-回归', 'R10 别名表存在', Boolean(IMAGE_SIZE_ALIASES['p-3x4-film']));
    const v = IMAGE_SIZES.find((s) => s.id === 'v-16x9');
    add('B-回归', 'R10 竖屏尺寸是 9:16', v && Math.abs(v.w / v.h - 9 / 16) < 0.01, v ? `${v.w}x${v.h}` : 'missing');
  }

  // ---- R11 死配置清理 + imageSteps 生效 ----
  {
    add('B-回归', 'R11 assetRoot 已移除', !('assetRoot' in loadConfig()));
    add('B-回归', 'R11 workflowDir/previzDir 已加入', ('workflowDir' in loadConfig()) && ('previzDir' in loadConfig()));
    const imgSrc = fs.readFileSync(path.join(ROOT, 'host/services/h3-image.js'), 'utf8');
    add('B-回归', 'R11 imageSteps 真的被读取', /cfg\?\.imageSteps/.test(imgSrc));
  }

  // ---- R12 归档回填按源路径对账 ----
  {
    const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
    add('B-回归', 'R12 归档记录 sourcePath', /sourcePath:\s*o\.path/.test(apiSrc));
    add('B-回归', 'R12 回填按 sourcePath 匹配', /a\.sourcePath && norm\(a\.sourcePath\) === norm\(o\.path\)/.test(apiSrc));
  }

  // ---- R13 mode 词表统一 ----
  {
    const { normalizeMode, newShot, validateShot } = await import('../host/store/models.js');
    add('B-回归', 'R13 t2v 归一为 t2va', normalizeMode('t2v') === 't2va');
    add('B-回归', 'R13 i2v 归一为 i2va', normalizeMode('i2v') === 'i2va');
    add('B-回归', 'R13 fl2v 归一为 fl2va', normalizeMode('fl2v') === 'fl2va');
    add('B-回归', 'R13 newShot 默认就是规范名', newShot({}).mode === 't2va', newShot({}).mode);
    add('B-回归', 'R13 validateShot 能识别 i2v 缺图',
      validateShot({ durationSec: 5, mode: 'i2v', refs: { images: [] } }).warnings.some((w) => w.includes('首帧')));
    add('B-回归', 'R13 validateShot 能识别 fl2v 缺图',
      validateShot({ durationSec: 5, mode: 'fl2v', refs: { images: [] } }).warnings.some((w) => w.includes('首尾帧')));

    const { compileH3Prompt } = await import('../host/services/h3-prompt.js');
    const r = compileH3Prompt({ mode: 'i2v', durationSec: 5, subjects: [], sceneLayout: 'x' });
    add('B-回归', 'R13 i2v 走关键帧分支（含对齐指令）', r.prompt.includes('aligns with the'), r.mode);
  }

  // ---- R14 probe 桩函数已修好 ----
  {
    const src = fs.readFileSync(path.join(ROOT, 'host/services/h3-workshop.js'), 'utf8');
    // 只看代码行：注释里保留"旧实现长这样"的考古说明是允许的
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
    add('B-回归', 'R14 不再有 "return stderr ? null : null"', !/return stderr \? null : null/.test(code));
    add('B-回归', 'R14 成片 probe 解析 stdout', /JSON\.parse\(stdout/.test(code));
    add('B-回归', 'R14 probe 返回时长/分辨率', /durationSec:\s*Number\(j\?\.format/.test(code));
  }

  // ---- R15 项目删除会清理派生数据 ----
  {
    const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
    add('B-回归', 'R15 有 cleanupProjectArtifacts', /function cleanupProjectArtifacts/.test(apiSrc));
    add('B-回归', 'R15 DELETE 项目时调用', /cleanupProjectArtifacts\(cfg, id\)/.test(apiSrc));
  }

  // ---- R16 导入预览不能读任意文件 ----
  {
    const { createExtrasService } = await import('../host/services/extras.js');
    const ex = createExtrasService({ cfg });
    let blocked = false;
    try { ex.previewImportFile(path.join(ROOT, 'package.json'), 100); } catch { blocked = true; }
    add('B-回归', 'R16 非分镜类文件禁止预览', blocked);
    let blocked2 = false;
    try { ex.scanImportDir('relative/dir'); } catch { blocked2 = true; }
    add('B-回归', 'R16 相对路径被拒', blocked2);
  }

  // ---- R17 项目 id 穿越被拦 ----
  {
    const { listShots, upsertShot } = await import('../host/api/index.js');
    let blocked = false;
    try { upsertShot('../../etc', { id: 'shot_x' }); } catch { blocked = true; }
    add('B-回归', 'R17 upsertShot 拦截穿越 projectId', blocked);
    add('B-回归', 'R17 listShots 对非法 id 返回空', Array.isArray(listShots('../../etc')) && listShots('../../etc').length === 0);
  }

  // ---- R18 previz 引擎缺失时给出可操作信息 ----
  {
    const { createPrevizController } = await import('../host/services/previz-controller.js');
    // 构造一个"哪里都找不到引擎"的环境：目录指向不存在的路径，
    // 且临时清掉可能存在的环境变量覆盖。
    const savedEnv = { PREVIZ_HOME: process.env.PREVIZ_HOME, DSH_PREVIZ_DIR: process.env.DSH_PREVIZ_DIR };
    delete process.env.PREVIZ_HOME;
    delete process.env.DSH_PREVIZ_DIR;
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-nopreviz-'));
    const emptyData = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-noprevizdata-'));
    try {
      const pc = createPrevizController({
        root: emptyRoot,
        cfg: { ...cfg, previzDir: '', dataDir: emptyData, previzPort: 43998 },
      });
      add('B-回归', 'R18 找不到引擎时 resolveEngineDir 为空', pc.resolveEngineDir() === '');
      const h = await pc.health();
      // 若本机恰好在 43998 上跑着引擎，那属于外部引擎，不做断言
      if (!h.ok) {
        add('B-回归', 'R18 未装引擎时 available=false', h.available === false, JSON.stringify(h.detail));
        add('B-回归', 'R18 给出可操作提示', typeof h.hint === 'string' && h.hint.includes('previz'), h.hint);
      } else {
        skip('B-回归', 'R18 端口上已有外部引擎，跳过未安装断言', h.url);
      }
      const started = await pc.start();
      add('B-回归', 'R18 未装引擎时 start 不抛、返回可读原因',
        started.ok === true || (started.ok === false && Boolean(started.hint || started.detail)), JSON.stringify(started.detail));
    } finally {
      if (savedEnv.PREVIZ_HOME !== undefined) process.env.PREVIZ_HOME = savedEnv.PREVIZ_HOME;
      if (savedEnv.DSH_PREVIZ_DIR !== undefined) process.env.DSH_PREVIZ_DIR = savedEnv.DSH_PREVIZ_DIR;
      fs.rmSync(emptyRoot, { recursive: true, force: true });
      fs.rmSync(emptyData, { recursive: true, force: true });
    }
  }
  // ---- R19 提交后 remoteId 必须立即可见（否则窗口期取消打不到远端）----
  {
    const { runJob, cancelJob } = await import('../host/services/job-runner.js');
    const { jobs: js, newJob } = await import('../host/services/job-store.js');

    // 模拟：runner 提交成功后调用 onSubmitted 上报远端 ID，然后长时间轮询。
    // 在这段"已提交但未完成"的窗口里取消，必须能拿到 remoteId 去中断远端。
    const job = newJob({ projectId: 'p', shotId: 's', backendId: 'h3-local', prompt: 'x', params: {} });
    await js().upsert(job);

    let remoteIdSeenAtCancel = null;
    const run = runJob(job, async (running, hooks) => {
      // 模拟 ComfyUI 返回 prompt_id
      hooks.onSubmitted('remote-abc-123');
      await new Promise((r) => setTimeout(r, 400));
      // 窗口期内查询存储，应已能看到 remoteId
      const mid = await js().get(job.id);
      remoteIdSeenAtCancel = mid?.remoteId ?? null;
      // 等待被取消
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const cur = await js().get(job.id);
        if (cur?.status === 'cancelled') break;
      }
      return { outputs: [] };
    }).catch(() => null);

    // 等提交回调落盘
    await new Promise((r) => setTimeout(r, 200));
    const atCancel = await js().get(job.id);
    let interrupted = '';
    await cancelJob(job.id, async (j) => { interrupted = j.remoteId || ''; });
    await run;

    add('B-回归', 'R19 onSubmitted 后 storage 里有 remoteId', atCancel?.remoteId === 'remote-abc-123', atCancel?.remoteId ?? 'null');
    add('B-回归', 'R19 窗口期取消能取到 remoteId 去中断', interrupted === 'remote-abc-123', interrupted || '空');
    add('B-回归', 'R19 runner 内部也能看到 remoteId', remoteIdSeenAtCancel === 'remote-abc-123', remoteIdSeenAtCancel ?? 'null');

    // 取消后的 job 不应把 remoteId 丢回 null（便于排查远端残留）
    const after = await js().get(job.id);
    add('B-回归', 'R19 取消后仍保留 remoteId', after?.remoteId === 'remote-abc-123', after?.remoteId ?? 'null');

    // 代码层面确认透传链完整
    const comfySrc = fs.readFileSync(path.join(ROOT, 'host/services/comfy-client.js'), 'utf8');
    add('B-回归', 'R19 comfy-client 提交后回调 onSubmitted', /onSubmitted\(remoteId/.test(comfySrc));
    const genSrc = fs.readFileSync(path.join(ROOT, 'host/services/generator.js'), 'utf8');
    add('B-回归', 'R19 generator 透传 onSubmitted', /onSubmitted,/.test(genSrc) || /onSubmitted \}/.test(genSrc));
  }

  // ---- R20 取消走真实 HTTP 时错误码可见 ----
  {
    const apiSrc = fs.readFileSync(path.join(ROOT, 'host/api/index.js'), 'utf8');
    add('B-回归', 'R20 api 层传 isLocalBackendOf 判据', /isLocalBackendOf\(job\.backendId\)/.test(apiSrc));
    add('B-回归', 'R20 cancel 路由存在', /route\.match\(\/\^\\\/jobs/.test(apiSrc) || apiSrc.includes("(cancel|retry)"));
  }
  // ---- R21 拆解提示词：移除表情差分 + 强制细节还原 ----
  {
    const { buildBreakdownPrompt, BREAKDOWN_LEVELS } = await import('../host/services/breakdown.js');
    for (const lv of ['standard', 'full', 'parts']) {
      const p = buildBreakdownPrompt({ character: '测试角色' }, lv);
      add('B-回归', `R21 ${lv} 不含表情差分`, !/表情|头部特写/.test(p),
        (p.match(/表情|头部特写/g) || []).join(','));
      add('B-回归', `R21 ${lv} 含细节还原要求`, /细节还原要求/.test(p));
      add('B-回归', `R21 ${lv} 不含 Markdown 标记`, !/\*\*|^#{1,6}\s|`/m.test(p));
    }
    // standard 与 full 内容应当一致（表情差分移除后不再有区别）
    const s = buildBreakdownPrompt({ character: '测试角色' }, 'standard');
    const f = buildBreakdownPrompt({ character: '测试角色' }, 'full');
    add('B-回归', 'R21 standard 与 full 内容一致', s === f, `std=${s.length} full=${f.length}`);
    // 细节锁的五个要点都要在
    for (const k of ['逐件单列', '保持原比例与朝向', '逐项复刻材质与工艺', '不丢小件', '不做增删']) {
      add('B-回归', `R21 细节要点：${k}`, s.includes(k));
    }
    // 档位描述不再宣称表情集
    const full = BREAKDOWN_LEVELS.find((x) => x.id === 'full');
    add('B-回归', 'R21 full 档描述说明表情已移除', /表情差分.*已移除|已移除/.test(full.desc), full.desc);
  }
  // ---- R22 角色卡排序决定 <Picture N>，不能随编辑漂移 ----
  {
    const { createVaultService, resetVaultStore } = await import('../host/services/character-vault.js');
    const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-r22-'));
    const cfgV = { ...cfg, dataDir: tmpVault };
    resetVaultStore();
    const v = createVaultService({ cfg: cfgV });

    // 先建 A，再建 B（A 创建更早）
    const a = await v.upsert({ name: '甲角色', description: 'a' });
    await new Promise((r) => setTimeout(r, 15));
    const b = await v.upsert({ name: '乙角色', description: 'b' });

    let order = (await v.list()).map((c) => c.name);
    add('B-回归', 'R22 列表按创建顺序（早的在前）', order[0] === '甲角色' && order[1] === '乙角色', order.join(','));

    // 关键：编辑**较早创建**的那张卡，顺序不能变（旧实现用 updatedAt 会把它顶到最前）
    await new Promise((r) => setTimeout(r, 15));
    await v.upsert({ ...(await v.get(a.id)), description: '改过的文字' });
    order = (await v.list()).map((c) => c.name);
    add('B-回归', 'R22 编辑后顺序不变（编号不漂移）', order[0] === '甲角色' && order[1] === '乙角色', order.join(','));

    // 编号必须与该顺序一致
    const { resolvePictureIndices } = await import('../host/services/shot-context.js');
    fs.mkdirSync(path.join(tmpVault, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(tmpVault, 'vault'), { recursive: true });
    for (const rel of ['assets/a.png', 'assets/b.png']) {
      fs.writeFileSync(path.join(tmpVault, rel), 'x');
    }
    const cardA = { id: a.id, name: '甲角色', resolvedImages: [{ slot: 'sheet', rel: 'assets/a.png' }] };
    const cardB = { id: b.id, name: '乙角色', resolvedImages: [{ slot: 'sheet', rel: 'assets/b.png' }] };
    const idx = resolvePictureIndices({ characterCards: [cardA, cardB] }, cfgV);
    add('B-回归', 'R22 甲角色占 Picture 1', idx[0]?.name === '甲角色' && idx[0]?.pictureIndex === 1, JSON.stringify(idx.map((x) => x.pictureIndex)));
    add('B-回归', 'R22 乙角色占 Picture 2', idx[1]?.name === '乙角色' && idx[1]?.pictureIndex === 2);

    const { resolveRefImages } = await import('../host/services/generator.js');
    const refs = resolveRefImages({ characterCards: [cardA, cardB] }, cfgV);
    add('B-回归', 'R22 提交顺序与编号一致（REF_1=甲）',
      refs[0]?.cardId === a.id && refs[1]?.cardId === b.id,
      refs.map((r) => r.cardId).join(','));

    resetVaultStore();
    fs.rmSync(tmpVault, { recursive: true, force: true });
  }
  // ---- R23 参考视频+音频合计时长 ≤14.8s ----
  {
    const { buildRenderPlan, MAX_REFS_TOTAL_SEC } = await import('../host/services/render-plan.js');
    add('B-回归', 'R23 上限是 14.8s', MAX_REFS_TOTAL_SEC === 14.8, String(MAX_REFS_TOTAL_SEC));

    // 未超限：全部保留
    const ok = buildRenderPlan({
      videos: [{ rel: 'v1.mp4', durationSec: 8, hasAudio: true }],
      audios: [{ rel: 'a1.wav', durationSec: 5 }],
    });
    add('B-回归', 'R23 13s 不裁剪', ok.videos.length === 1 && ok.audios.length === 1);
    add('B-回归', 'R23 stats.mediaSec 正确', Math.abs(ok.stats.mediaSec - 13) < 0.001, String(ok.stats.mediaSec));
    add('B-回归', 'R23 未超限时 mediaSecOver=false', ok.stats.mediaSecOver === false);

    // 正好 14.8：放行
    const edge = buildRenderPlan({
      videos: [{ rel: 'v.mp4', durationSec: 7.4, hasAudio: false }],
      audios: [{ rel: 'a.wav', durationSec: 7.4 }],
    });
    add('B-回归', 'R23 正好 14.8s 放行', edge.stats.mediaSecOver === false
      && edge.videos.length === 1 && edge.audios.length === 1, String(edge.stats.mediaSec));

    // 超限：先砍音频
    const over = buildRenderPlan({
      videos: [{ rel: 'v1.mp4', durationSec: 8, hasAudio: true }],
      audios: [{ rel: 'a1.wav', durationSec: 8 }],
    });
    add('B-回归', 'R23 超限先砍音频', over.audios.length === 0 && over.videos.length === 1);
    add('B-回归', 'R23 裁剪后有明确警告', over.warnings.some((w) => w.includes('14.8') && w.includes('已移除')));

    // 音频砍完还不够：继续砍视频
    const over2 = buildRenderPlan({
      videos: [
        { rel: 'v1.mp4', durationSec: 9, hasAudio: false },
        { rel: 'v2.mp4', durationSec: 9, hasAudio: false },
      ],
    });
    add('B-回归', 'R23 砍完音频仍超则砍视频', over2.videos.length === 1, String(over2.videos.length));
    add('B-回归', 'R23 裁剪后合计回到限额内',
      over2.stats.mediaSec <= MAX_REFS_TOTAL_SEC, String(over2.stats.mediaSec));

    // 裁剪后编号必须连续（否则提示词里的 <Video k>/<Audio j> 全错）
    const mix = buildRenderPlan({
      videos: [
        { rel: 'v1.mp4', durationSec: 6, hasAudio: true },
        { rel: 'v2.mp4', durationSec: 6, hasAudio: true },
        { rel: 'v3.mp4', durationSec: 6, hasAudio: false },
      ],
      audios: [{ rel: 'a1.wav', durationSec: 6 }],
    });
    const vidx = mix.videos.map((v) => v.index);
    add('B-回归', 'R23 裁剪后视频编号连续', vidx.every((n, i) => n === i + 1), vidx.join(','));
    const allAudio = [
      ...mix.videos.filter((v) => v.hasAudio).map((v) => v.audioIndex),
      ...mix.audios.map((a) => a.audioIndex),
    ];
    add('B-回归', 'R23 裁剪后音频编号连续',
      allAudio.every((n, i) => n === i + 1), allAudio.join(','));
    add('B-回归', 'R23 合计不超限', mix.stats.mediaSec <= MAX_REFS_TOTAL_SEC, String(mix.stats.mediaSec));

    // 时长未知的项不参与预算，但要提示
    const unknown = buildRenderPlan({
      videos: [{ rel: 'u.mp4', hasAudio: false }],
    });
    add('B-回归', 'R23 时长未知会提示', unknown.warnings.some((w) => w.includes('时长未知')));
  }
  // ---- R24 手工提示词必须整段生效（不能被自动编译覆盖）----
  {
    const { compilePrompt } = await import('../host/api/index.js');
    // 构造一段明确超过 200 字的手写提示词
    const manual = [
      'CRITICAL STYLE RULE:',
      '90s OVA animation style. Cel animation look. 4K.',
      '禁止：写实质感。',
      'NO subtitles, NO on-screen text.',
      '',
      'subject_definitions:',
      '测试角色 = 外观来自 <Picture 1> — 金发紫瞳。此角色为说话人 (S1)。',
      '',
      'summary:',
      '这是一段用于验证手工提示词优先级的测试文本，长度必须超过两百个字符，'
      + '否则会被当成简短备注走自动编译分支。继续填充内容以确保长度达标：'
      + '黄昏海滩、并肩行走、长椅落座、相向亲吻，共三个镜头。',
      '',
      'overall_soundscape: 海浪声。',
      'non_diegetic_music: N/A',
      '',
      'MOTION DESCRIPTION:',
      '[0.0s-3.5s] 全景。两人并肩行走。运镜：横移跟拍。',
    ].join('\n');
    add('B-回归', 'R24 测试提示词足够长', manual.length > 200, String(manual.length));

    const out = compilePrompt({ prompt: manual, mode: 'ref2va', durationSec: 10 });
    add('B-回归', 'R24 手工提示词整段返回', out.trim() === manual.trim(), `len=${out.length}`);
    // 不能被自动编译的骨架污染
    add('B-回归', 'R24 不混入自动编译骨架',
      !out.includes('（未指定场景）') && !out.includes('环境底噪'));

    // 短备注仍走自动编译（不能把所有 prompt 都当成品）
    const short = compilePrompt({ prompt: '简短备注', mode: 'ref2va', durationSec: 5, description: '两人在海边' });
    add('B-回归', 'R24 短备注仍走自动编译', short.includes('CRITICAL STYLE RULE') && short.length > 300, `len=${short.length}`);

    // 无 prompt 正常编译
    const none = compilePrompt({ mode: 'ref2va', durationSec: 5, description: '测试' });
    add('B-回归', 'R24 无 prompt 正常编译', none.includes('CRITICAL STYLE RULE'));

    // 超长要截断到 7000
    const huge = compilePrompt({ prompt: 'X'.repeat(9000), mode: 'ref2va' });
    add('B-回归', 'R24 超长截断到 7000', huge.length <= 7000, String(huge.length));

    // 前端必须真的把手工提示词存进镜头卡（否则后端根本收不到）
    const pageSrc = fs.readFileSync(path.join(ROOT, 'app-src/src/pages/RenderPage.tsx'), 'utf8');
    add('B-回归', 'R24 前端 saveShot 传了 prompt',
      /useManualPrompt \? manualPrompt\.trim\(\)/.test(pageSrc) && /\.\.\.\(manual \? \{ prompt: manual \}/.test(pageSrc));
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
  byGroup[r.group] ||= { pass: 0, fail: 0, skip: 0, fails: [], skips: [] };
  if (r.skipped) { byGroup[r.group].skip++; byGroup[r.group].skips.push(r.name); continue; }
  if (r.ok) byGroup[r.group].pass++;
  else { byGroup[r.group].fail++; byGroup[r.group].fails.push(`${r.name}${r.detail !== undefined ? ' :: ' + r.detail : ''}`); }
}

console.log('========== 验收结果 ==========');
let totalPass = 0, totalFail = 0, totalSkip = 0;
for (const [g, s] of Object.entries(byGroup)) {
  console.log(`${g.padEnd(10)} PASS ${String(s.pass).padStart(2)}  FAIL ${s.fail}  SKIP ${s.skip}`);
  for (const f of s.fails) console.log(`   ✗ ${f}`);
  for (const k of s.skips) console.log(`   - ${k}`);
  totalPass += s.pass; totalFail += s.fail; totalSkip += s.skip;
}
console.log('-------------------------------');
console.log(`TOTAL PASS=${totalPass} FAIL=${totalFail} SKIP=${totalSkip}`);

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(totalFail ? 1 : 0);


