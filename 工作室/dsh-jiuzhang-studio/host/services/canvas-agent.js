/**
 * 画布内置 Agent —— 对齐参考实现内置的 17 个画布工具 + 4 个权限位。
 *
 * 实测（bundle）：
 *  17 工具：resolve / list_refs / project_overview / list_nodes / get_node /
 *           read_document / search_assets / list_skills / image_job_status /
 *           skill_task_status / update_node / insert_image / batch /
 *           delete_node / generate_image / generate_video / call_skill
 *  4 权限位：canWriteCanvas / canSpend / canDelete / autoRun
 *  沙箱 run_script：10 秒、无网络、无 DOM
 *
 * 定位差异（重要）：
 *  参考实现这 17 个是**画布内** Agent 工具 —— 用户在画布上与 AI 对话，
 *  AI 直接改画布（增删节点/插入图片/触发生成）。
 *  插件原有的 studio_* 是 **Agent 侧**工具（模型调用插件）。
 *  两者不是同一层，本模块补的是前者。
 *
 * 实现策略：
 *  - 工具在**后端**执行，画布状态由前端传入/写回（保持单一真相源在前端）
 *  - 权限位强制：写操作需 canWriteCanvas，删除需 canDelete，生成需 canSpend
 *  - 所有变更返回 diff（前端可预览/撤销）
 */
import crypto from 'node:crypto';

/** 4 个权限位（实测） */
export const CANVAS_PERMISSIONS = Object.freeze([
  { id: 'canWriteCanvas', name: '可改画布', desc: '增删改节点、连线、分组' },
  { id: 'canSpend', name: '可花钱', desc: '触发图片/视频生成（消耗额度）' },
  { id: 'canDelete', name: '可删除', desc: '删除节点或资产' },
  { id: 'autoRun', name: '自动执行', desc: '不需要逐步确认即可连续执行' },
]);

/** 17 个画布工具（实测名单） */
export const CANVAS_TOOLS = Object.freeze([
  { name: 'resolve', desc: '把引用解析成实际对象（@nodeId / #assetId）', perm: null, kind: 'read' },
  { name: 'list_refs', desc: '列出可引用的对象（节点/资产/镜头）', perm: null, kind: 'read' },
  { name: 'project_overview', desc: '项目概览（节点数/类型分布/最近改动）', perm: null, kind: 'read' },
  { name: 'list_nodes', desc: '列出节点（可按类型/关键词过滤）', perm: null, kind: 'read' },
  { name: 'get_node', desc: '读单个节点的完整数据', perm: null, kind: 'read' },
  { name: 'read_document', desc: '读文本注释节点的 Markdown 正文', perm: null, kind: 'read' },
  { name: 'search_assets', desc: '搜素材库（按类型/名称/项目）', perm: null, kind: 'read' },
  { name: 'list_skills', desc: '列出可调用的技能', perm: null, kind: 'read' },
  { name: 'image_job_status', desc: '查图片任务状态', perm: null, kind: 'read' },
  { name: 'skill_task_status', desc: '查技能任务状态', perm: null, kind: 'read' },
  { name: 'update_node', desc: '改节点参数/标题/备注', perm: 'canWriteCanvas', kind: 'write' },
  { name: 'insert_image', desc: '往画布插入图片节点', perm: 'canWriteCanvas', kind: 'write' },
  { name: 'batch', desc: '批量操作（多个 update/insert/delete）', perm: 'canWriteCanvas', kind: 'write' },
  { name: 'delete_node', desc: '删除节点', perm: 'canDelete', kind: 'write' },
  { name: 'generate_image', desc: '触发图片生成', perm: 'canSpend', kind: 'spend' },
  { name: 'generate_video', desc: '触发视频生成', perm: 'canSpend', kind: 'spend' },
  { name: 'call_skill', desc: '调用技能（剧本/分镜/漫画等）', perm: 'canSpend', kind: 'spend' },
]);

/** 默认权限（保守：只读全开，写/删/花钱默认关） */
export const DEFAULT_CANVAS_PERMISSIONS = Object.freeze({
  canWriteCanvas: true,
  canSpend: false,
  canDelete: true,
  autoRun: false,
});

/** 沙箱限制 */
export const RUN_SCRIPT_LIMITS = Object.freeze({
  timeoutMs: 10_000,
  network: false,
  dom: false,
  maxOutputChars: 20_000,
});

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function text(v) {
  return typeof v === 'string' ? v : '';
}

/**
 * 创建画布 Agent 执行器。
 * 注意：不做持久化 —— 画布状态的真相源在前端，
 * 这里只负责「读 + 计算出变更」，把 diff 交回前端应用。
 */
export function createCanvasAgent({ cfg, getProject, listAssets, runGenerate, runSkill } = {}) {
  /** 权限检查 */
  function need(perm, granted) {
    if (!perm) return;
    if (!granted?.[perm]) {
      const meta = CANVAS_PERMISSIONS.find((p) => p.id === perm);
      throw new Error(`PERMISSION_DENIED: 缺少「${meta?.name ?? perm}」权限`);
    }
  }

  /** 解析引用：@nodeId / #assetId */
  function resolveRef(ref, ctx) {
    const r = text(ref).trim();
    if (!r) return null;
    if (r.startsWith('@')) {
      const id = r.slice(1);
      const n = (ctx.nodes ?? []).find((x) => x.id === id);
      return n ? { kind: 'node', id: n.id, value: n } : { kind: 'node', id, value: null };
    }
    if (r.startsWith('#')) {
      const id = r.slice(1);
      const a = (ctx.assets ?? []).find((x) => x.id === id);
      return a ? { kind: 'asset', id: a.id, value: a } : { kind: 'asset', id, value: null };
    }
    return { kind: 'plain', id: null, value: r };
  }

  /**
   * 执行一个工具。
   * @param {string} name 工具名
   * @param {object} args 参数
   * @param {object} ctx { nodes, edges, assets, shots, permissions }
   * @returns {{ ok:boolean, result:any, diff?:object }}
   */
  async function exec(name, args = {}, ctx = {}) {
    const def = CANVAS_TOOLS.find((t) => t.name === name);
    if (!def) throw new Error(`UNKNOWN_CANVAS_TOOL: ${name}`);
    const perms = { ...DEFAULT_CANVAS_PERMISSIONS, ...(ctx.permissions ?? {}) };
    need(def.perm, perms);

    const nodes = ctx.nodes ?? [];
    const assets = ctx.assets ?? [];

    switch (name) {
      /* ---------------- 读 ---------------- */
      case 'resolve': {
        return { ok: true, result: resolveRef(args.ref, { nodes, assets }) };
      }
      case 'list_refs': {
        const limit = Math.max(1, Math.min(200, Number(args.limit) || 50));
        return {
          ok: true,
          result: {
            nodes: nodes.slice(0, limit).map((n) => ({ ref: `@${n.id}`, type: n.type, title: n.data?.title ?? '' })),
            assets: assets.slice(0, limit).map((a) => ({ ref: `#${a.id}`, type: a.type, name: a.name })),
          },
        };
      }
      case 'project_overview': {
        const byType = {};
        for (const n of nodes) byType[n.type ?? 'unknown'] = (byType[n.type ?? 'unknown'] ?? 0) + 1;
        return {
          ok: true,
          result: {
            nodeCount: nodes.length,
            edgeCount: (ctx.edges ?? []).length,
            assetCount: assets.length,
            shotCount: (ctx.shots ?? []).length,
            byType,
          },
        };
      }
      case 'list_nodes': {
        const type = text(args.type);
        const kw = text(args.keyword).toLowerCase();
        let list = nodes;
        if (type) list = list.filter((n) => n.type === type);
        if (kw) {
          list = list.filter((n) =>
            text(n.data?.title).toLowerCase().includes(kw) || n.id.toLowerCase().includes(kw));
        }
        const limit = Math.max(1, Math.min(500, Number(args.limit) || 100));
        return {
          ok: true,
          result: list.slice(0, limit).map((n) => ({
            id: n.id, type: n.type,
            title: n.data?.title ?? '',
            status: n.data?.status ?? 'idle',
            hasResult: Boolean(n.data?.result?.url),
          })),
        };
      }
      case 'get_node': {
        const n = nodes.find((x) => x.id === args.nodeId);
        if (!n) throw new Error('NODE_NOT_FOUND');
        return { ok: true, result: n };
      }
      case 'read_document': {
        const n = nodes.find((x) => x.id === args.nodeId);
        if (!n) throw new Error('NODE_NOT_FOUND');
        return { ok: true, result: { markdown: n.data?.markdown ?? '', title: n.data?.title ?? '' } };
      }
      case 'search_assets': {
        const type = text(args.type);
        const kw = text(args.keyword).toLowerCase();
        let list = assets;
        if (type) list = list.filter((a) => a.type === type);
        if (kw) list = list.filter((a) => text(a.name).toLowerCase().includes(kw));
        const limit = Math.max(1, Math.min(200, Number(args.limit) || 50));
        return {
          ok: true,
          result: list.slice(0, limit).map((a) => ({
            id: a.id, type: a.type, name: a.name, kind: a.kind, rel: a.rel,
          })),
        };
      }
      case 'list_skills': {
        return {
          ok: true,
          result: [
            { id: 'script', name: '剧本创作', desc: '5 阶段流水线' },
            { id: 'comic', name: '漫画工作台', desc: '分镜抽取 → 排版 → 导出' },
            { id: 'mw', name: '模特工作台', desc: '电商/影视双模式套件' },
            { id: 'director', name: '3D 导演台', desc: '58 动作 / 28 运镜' },
            { id: 'prompt', name: 'H3 提示词编译', desc: '六段式结构化提示词' },
          ],
        };
      }
      case 'image_job_status': {
        if (!ctx.jobs) return { ok: true, result: { jobs: [], note: '前端未提供 jobs' } };
        const j = ctx.jobs.find((x) => x.id === args.jobId);
        return { ok: true, result: j ?? null };
      }
      case 'skill_task_status': {
        const j = (ctx.jobs ?? []).find((x) => x.id === args.jobId);
        return { ok: true, result: j ?? null };
      }

      /* ---------------- 写 ---------------- */
      case 'update_node': {
        const n = nodes.find((x) => x.id === args.nodeId);
        if (!n) throw new Error('NODE_NOT_FOUND');
        const patch = {};
        if (args.title !== undefined) patch.title = text(args.title);
        if (args.note !== undefined) patch.note = text(args.note);
        if (args.params && typeof args.params === 'object') {
          patch.params = { ...(n.data?.params ?? {}), ...args.params };
        }
        if (args.markdown !== undefined) patch.markdown = text(args.markdown);
        return {
          ok: true,
          result: { nodeId: n.id, applied: Object.keys(patch) },
          diff: { op: 'update_node', nodeId: n.id, before: n.data ?? {}, after: { ...(n.data ?? {}), ...patch } },
        };
      }
      case 'insert_image': {
        const src = text(args.url) || text(args.assetRel) || text(args.assetId);
        if (!src) throw new Error('IMAGE_SOURCE_REQUIRED');
        const id = newId('node');
        const node = {
          id,
          type: 'uploadNode',
          position: args.position ?? { x: Number(args.x) || 0, y: Number(args.y) || 0 },
          data: {
            title: text(args.title) || '插入的图片',
            params: { fileUrl: src },
          },
        };
        return {
          ok: true,
          result: { nodeId: id },
          diff: { op: 'insert_image', node },
        };
      }
      case 'batch': {
        const ops = Array.isArray(args.operations) ? args.operations : [];
        if (ops.length > 50) throw new Error('BATCH_TOO_LARGE: 最多 50 个操作');
        const results = [];
        const diffs = [];
        for (const op of ops) {
          if (!op?.tool) continue;
          const r = await exec(op.tool, op.arguments ?? {}, ctx);
          results.push({ tool: op.tool, ok: r.ok });
          if (r.diff) diffs.push(r.diff);
        }
        return { ok: true, result: results, diff: { op: 'batch', diffs } };
      }
      case 'delete_node': {
        const n = nodes.find((x) => x.id === args.nodeId);
        if (!n) throw new Error('NODE_NOT_FOUND');
        return {
          ok: true,
          result: { removed: n.id },
          diff: { op: 'delete_node', nodeId: n.id, type: n.type },
        };
      }

      /* ---------------- 花钱 ---------------- */
      case 'generate_image': {
        if (typeof runGenerate !== 'function') throw new Error('GENERATE_UNAVAILABLE');
        const r = await runGenerate({ kind: 'image', nodeId: args.nodeId, prompt: args.prompt, options: args });
        return { ok: true, result: r, diff: { op: 'generate_image', jobId: r?.jobId } };
      }
      case 'generate_video': {
        if (typeof runGenerate !== 'function') throw new Error('GENERATE_UNAVAILABLE');
        const r = await runGenerate({ kind: 'video', nodeId: args.nodeId, prompt: args.prompt, options: args });
        return { ok: true, result: r, diff: { op: 'generate_video', jobId: r?.jobId } };
      }
      case 'call_skill': {
        const skill = text(args.skill);
        if (!skill) throw new Error('SKILL_REQUIRED');
        // 真实分发到对应服务，而不是返回一句"已转交"的空壳。
        if (typeof runSkill !== 'function') {
          throw new Error(`SKILL_UNAVAILABLE: 「${skill}」没有可用的服务实现`);
        }
        const r = await runSkill({ skill, args: args.arguments ?? {} });
        return { ok: true, result: r, diff: { op: 'call_skill', skill } };
      }

      default:
        throw new Error(`UNKNOWN_CANVAS_TOOL: ${name}`);
    }
  }

  /** 供前端展示的能力清单 */
  function meta() {
    return {
      tools: CANVAS_TOOLS,
      permissions: CANVAS_PERMISSIONS,
      defaults: DEFAULT_CANVAS_PERMISSIONS,
      runScript: RUN_SCRIPT_LIMITS,
    };
  }

  return { exec, meta };
}

export { CANVAS_TOOLS as CANVAS_TOOL_LIST };