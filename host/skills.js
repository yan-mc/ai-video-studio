/**
 * Skill 提供者 —— 把本插件自带的 skills/ 注册进 DSH 的 skill 目录。
 *
 * ============================================================================
 * 为什么需要这一层
 * ============================================================================
 *
 * DSH 的 `dsh-skill-filesystem` 只扫描 skill 根目录的**一层**：
 *
 *   skills/*Ä°/SKILL.md        ← 会被发现
 *   skills/*.md                ← 会被发现（扁平的 skill）
 *   skills/prompt/xxx/SKILL.md ← **永远不会被发现**（嵌套太深）
 *
 * 本插件为了可读性把提示词类 skill 放在 `skills/prompt/<name>/SKILL.md`，
 * 于是它们对 Agent 完全不可见 —— 模型永远不知道有这些提示词规范，
 * 用户在对话里说"用 H3 官方格式写"也触发不到。
 *
 * 另一个更隐蔽的问题：`dsh-skill` 校验 name 必须是 **kebab-case**
 * （/^[a-z0-9]+(?:-[a-z0-9]+)*$/）。`name: H3官方提示词` 这种写法会被
 * 静默丢弃 —— 只留一条 logger.warn，界面上什么也看不到。本插件曾有 4 个
 * SKILL.md 因此全部失效（h3-official / h3-nonfirst-i2v / h3-continuation /
 * h3-continuation-cuts 都叫「H3官方提示词」或「H3一镜到底续写提示词」）。
 *
 * 这里注册一个**自己的 provider**，绕开目录深度限制，并对 frontmatter 做
 * 与 dsh-skill 一致的校验（不合规就跳过并 warn，绝不静默注册一个坏条目）。
 *
 * ============================================================================
 * 与 storyboard.js 的关系
 * ============================================================================
 *
 * `nanfeng/storyboard.js` 读的是同一批文件，但它把内容拼成 LLM 的 system
 * prompt（智能分镜内部用），**不经过** DSH 的 skill 目录。
 * 两个消费方共用 `skills/prompt/` 单一真源，改一处两边都生效。
 *
 * @module skills
 */
import fs from 'node:fs';
import path from 'node:path';

/** 与 dsh-skill 的 SKILL_NAME 完全一致；不一致会导致注册被拒 */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 层内排序权重。
 *
 * DSH 在**同一层**内用 rank 解决重名；跨层时项目级(100/200)永远赢过我们。
 * 取 300（与 custom 同档）：用户在项目里放一个同名 skill 就能覆盖我们的，
 * 这正是期望行为 —— 项目约定优先于插件内置。
 */
const SKILL_RANK = 300;

/** 扫描深度上限：skills/ → prompt/ → <name>/SKILL.md 正好 3 层 */
const MAX_DEPTH = 3;

/** 不当作 skill 的文件/目录名 */
const IGNORED = new Set(['README.md', 'node_modules', '.git']);

/**
 * 解析 YAML frontmatter —— 只取本插件实际用到的标量字段。
 *
 * 不引入 yaml 依赖：插件里所有 SKILL.md 的 frontmatter 都是
 * `key: value` 的单行标量，多行块（如 group-master 的「适配说明」）
 * 不是 name/description，不需要正确解析。
 *
 * @param {string} text
 * @returns {{ data: Record<string, string>, body: string } | null}
 */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || /^\s/.test(line)) continue;   // 跳过缩进/注释行
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) data[key] = val;
  }
  return { data, body: text.slice(m[0].length) };
}

/**
 * 递归收集候选 SKILL.md。
 *
 * 只认两种位置（与 dsh-skill-filesystem 的语义保持一致，只是放宽了深度）：
 *   1. `<root>/.../<name>/SKILL.md`
 *   2. `<root>/.../<name>.md`（扁平 skill）
 *
 * @param {string} root
 * @returns {Array<{ file: string, dir: string }>}
 */
function collectSkillFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (IGNORED.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        const skillMd = path.join(abs, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          out.push({ file: skillMd, dir: abs });
          // 同一目录下不再往下找（一个目录就是一个 skill）
          continue;
        }
        walk(abs, depth + 1);
      } else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'SKILL.md') {
        out.push({ file: abs, dir });
      }
    }
  };
  walk(root, 0);
  return out;
}

/**
 * 把 skills/ 根目录下的所有 skill 读成候选。
 *
 * @param {string} root 插件根目录
 * @param {(msg: string) => void} [warn]
 * @returns {Array<object>} dsh-skill 的 SkillCandidate 形状
 */
export function discoverSkills(root, warn = () => {}) {
  const skillsRoot = path.join(root, 'skills');
  if (!fs.existsSync(skillsRoot)) return [];

  const candidates = [];
  const seen = new Map();

  for (const { file, dir } of collectSkillFiles(skillsRoot)) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (e) {
      warn(`skill 文件读取失败 ${file}: ${e?.message ?? e}`);
      continue;
    }
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      // README.md / 说明文档没有 frontmatter —— 正常跳过，不当错误
      continue;
    }
    const { name, description } = parsed.data;
    if (!name || !description) {
      warn(`skill ${file} 缺少 name 或 description，已跳过`);
      continue;
    }
    if (!SKILL_NAME.test(name)) {
      warn(`skill ${file} 的 name "${name}" 不是 kebab-case（只允许 a-z 0-9 和 -），已跳过`);
      continue;
    }
    if (seen.has(name)) {
      warn(`skill 重名 "${name}"：${file} 与 ${seen.get(name)}，保留先出现的那个`);
      continue;
    }
    seen.set(name, file);

    const rel = path.relative(skillsRoot, file).replace(/\\/g, '/');
    candidates.push({
      name,
      description,
      ...(parsed.data.whenToUse ? { whenToUse: parsed.data.whenToUse } : {}),
      invocation: {
        // 默认都允许模型主动调用与用户点名调用
        modelInvocable: parsed.data['disable-model-invocation'] !== 'true',
        userInvocable: parsed.data['user-invocable'] !== 'false',
      },
      provider: 'jiuzhang',
      source: 'custom',
      rank: SKILL_RANK,
      locator: { file, dir, rel },
      resourceBase: { kind: 'directory', path: dir },
      path: file,
      metadata: { rel },
    });
  }
  return candidates;
}

/**
 * 在插件 apply() 期间注册 skill provider。
 *
 * 必须**同步**调用（Cordis 的 registerProvider 要求），因此这里不做任何
 * 异步 IO：候选只在 list() 时扫描，load 时才读正文。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string} root 插件根目录
 * @returns {() => void} 注销函数
 */
export function registerSkillProvider(ctx, root) {
  /**
   * ⚠️ 必须用 `ctx.get('skills')`，不能写 `ctx.skills`。
   *
   * Cordis 只把 **inject 里声明过**的服务直接挂到 ctx 上。`skills` 刻意没写进
   * inject（缺技能服务的 profile 里插件也该正常工作），所以 `ctx.skills`
   * 恒为 undefined —— 直接读它会让整个 provider 静默不注册，
   * 现象就是"skill 文件都对、名字都合法，但模型永远看不到它们"。
   * 这正是这个插件历史上反复出现的"看起来配好了、实际没生效"。
   */
  let skills;
  try {
    skills = ctx?.get?.('skills');
  } catch {
    skills = undefined;
  }
  if (!skills?.registerProvider) {
    ctx?.logger?.warn?.('[jiuzhang] 未挂载 skills 服务，插件自带的 skill 不会被 DSH 发现');
    return () => {};
  }

  const warn = (msg) => ctx?.logger?.warn?.(`[jiuzhang] ${msg}`);

  const provider = {
    name: 'jiuzhang',
    /**
     * 列出候选。文件在调用时现扫 —— 用户改完 SKILL.md 重启即生效，
     * 不需要重新安装插件。
     */
    async list() {
      const candidates = discoverSkills(root, warn);
      return { candidates, complete: true };
    },
    /**
     * 读取正文。
     *
     * 只返回 SKILL.md 的 body（不含 frontmatter）——
     * frontmatter 是元数据，塞进正文只会浪费 token。
     */
    async get(candidate) {
      const { file } = candidate.locator ?? {};
      if (!file) return undefined;
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = parseFrontmatter(raw);
      if (!parsed) return undefined;
      return {
        name: candidate.name,
        description: candidate.description,
        ...(candidate.whenToUse ? { whenToUse: candidate.whenToUse } : {}),
        invocation: candidate.invocation,
        provider: 'jiuzhang',
        source: 'custom',
        resourceBase: candidate.resourceBase,
        path: file,
        content: parsed.body.trim(),
      };
    },
  };

  return skills.registerProvider(() => provider);
}
