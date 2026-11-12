/**
 * 画布 AI 助手面板 —— 对接后端 17 个画布工具。
 *
 * 定位（与插件的 studio_* 工具不同）：
 *  - studio_* 是「模型调用插件」的 Agent 侧工具
 *  - 这里是「用户在画布上与 AI 对话，AI 直接改画布」的画布侧工具
 *
 * 交互：输入指令 → 后端解析成工具调用 → 返回 diff → 应用到画布
 */
import { useCallback, useState } from 'react';

import { api } from '../api/client';
import { Alert, Badge, Button, Input, useToast } from '../ui';

interface CanvasTool { name: string; desc: string; perm: string | null; kind: string }
interface Perm { id: string; name: string; desc: string }
interface Meta { tools: CanvasTool[]; permissions: Perm[]; defaults: Record<string, boolean> }

/** 自然语言 → 工具调用的极简规则解析（无需 LLM 也能跑通常见指令） */
function parseIntent(text: string): { tool: string; args: Record<string, unknown> } | null {
  const t = text.trim();
  if (!t) return null;

  // 「列出/查看节点」
  if (/^(列出|查看|显示|有哪些).*(节点|node)/.test(t)) {
    const m = t.match(/类型[：:]\s*(\w+)/);
    return { tool: 'list_nodes', args: m ? { type: m[1] } : {} };
  }
  // 「概览」
  if (/(概览|overview|统计)/.test(t)) return { tool: 'project_overview', args: {} };
  // 「列出素材」
  if (/(素材|资产).*(列表|列出|查看|有哪些)/.test(t)) {
    const m = t.match(/类型[：:]\s*([\w_]+)/);
    return { tool: 'search_assets', args: m ? { type: m[1] } : {} };
  }
  // 「改标题」
  const mt = t.match(/(?:把|将)?\s*@?(\S+?)\s*(?:的)?\s*标题\s*(?:改成|改为|设为)\s*[「"']?([^」"']+)[」"']?/);
  if (mt) return { tool: 'update_node', args: { nodeId: mt[1], title: mt[2].trim() } };
  // 「删除节点」
  const md = t.match(/(?:删除|移除)\s*@?(\S+)/);
  if (md && /(删除|移除)/.test(t)) return { tool: 'delete_node', args: { nodeId: md[1] } };
  // 「插入图片」
  if (/(插入|添加).*(图片|image)/.test(t)) {
    const mu = t.match(/(https?:\/\/\S+|assets\/\S+)/);
    return { tool: 'insert_image', args: { url: mu?.[1] ?? '', title: '插入的图片' } };
  }
  // 「技能」
  if (/(技能|skills?)/.test(t)) return { tool: 'list_skills', args: {} };
  return null;
}

interface Props {
  /** 当前画布快照（供后端工具读） */
  getContext: () => { nodes: unknown[]; edges: unknown[]; jobs?: unknown[] };
  /** 应用后端返回的 diff */
  applyDiff: (diff: unknown) => void;
  projectId: string | null;
}

export function CanvasAgentPanel({ getContext, applyDiff, projectId }: Props) {
  const toast = useToast();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<{ role: 'user' | 'ai'; text: string; tool?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const ensureMeta = useCallback(async () => {
    if (meta) return meta;
    const m = await api.canvasAgentMeta() as Meta;
    setMeta(m);
    setPerms(m.defaults ?? {});
    return m;
  }, [meta]);

  async function run() {
    const q = input.trim();
    if (!q) return;
    setInput('');
    setLogs((l) => [...l, { role: 'user', text: q }]);

    const intent = parseIntent(q);
    if (!intent) {
      setLogs((l) => [...l, {
        role: 'ai',
        text: '没听懂这条指令。可以试：\n· 列出节点\n· 概览\n· 把 n1 的标题改为 新标题\n· 删除 n1\n· 列出素材 类型:character\n· 技能列表',
      }]);
      return;
    }

    setBusy(true);
    try {
      const m = await ensureMeta();
      const ctx = getContext();
      const r = await api.canvasAgentExec({
        name: intent.tool,
        arguments: intent.args,
        projectId: projectId ?? undefined,
        context: { ...ctx, permissions: perms },
      }) as { ok: boolean; result: unknown; diff?: unknown };

      const summary = summarize(intent.tool, r.result);
      setLogs((l) => [...l, { role: 'ai', text: summary, tool: intent.tool }]);

      if (r.diff) {
        applyDiff(r.diff);
        setLogs((l) => [...l, { role: 'ai', text: '已把改动应用到画布。' }]);
      }
      void m;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setLogs((l) => [...l, { role: 'ai', text: `执行失败：${msg}` }]);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function summarize(tool: string, result: unknown): string {
    if (Array.isArray(result)) {
      if (!result.length) return '没有结果。';
      return result.slice(0, 8).map((x) => {
        const o = x as Record<string, unknown>;
        return `· ${o.title ?? o.name ?? o.id ?? JSON.stringify(o).slice(0, 60)}`;
      }).join('\n') + (result.length > 8 ? `\n…共 ${result.length} 项` : '');
    }
    if (result && typeof result === 'object') {
      const o = result as Record<string, unknown>;
      if (tool === 'project_overview') {
        return `${o.nodeCount} 节点 · ${o.edgeCount} 连线 · ${o.assetCount} 素材 · ${o.shotCount} 镜头`;
      }
      return JSON.stringify(o, null, 1).slice(0, 800);
    }
    return String(result);
  }

  return (
    <div className="jz-col" style={{ gap: 8, height: '100%' }}>
      <div className="jz-row" style={{ justifyContent: 'space-between' }}>
        <b className="jz-sm">画布 AI 助手</b>
        {meta ? <Badge>{meta.tools.length} 工具</Badge> : null}
      </div>

      {meta ? (
        <div className="jz-row jz-wrap" style={{ gap: 4 }}>
          {meta.permissions.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.desc}
              onClick={() => setPerms((x) => ({ ...x, [p.id]: !x[p.id] }))}
              className="jz-btn jz-btn--sm"
              style={{
                opacity: perms[p.id] ? 1 : 0.45,
                borderColor: perms[p.id] ? 'var(--jz-accent)' : undefined,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <Button onClick={() => void ensureMeta()}>载入能力</Button>
      )}

      <div style={{
        flex: 1, minHeight: 180, overflow: 'auto', background: 'var(--jz-bg-sunken)',
        borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {logs.length === 0 ? (
          <div className="jz-xs jz-muted">
            可以试：<br />
            · 列出节点<br />
            · 概览<br />
            · 列出素材 类型:character<br />
            · 技能列表<br />
            · 把 n1 的标题改为 新标题
          </div>
        ) : logs.map((l, i) => (
          <div key={i} style={{ alignSelf: l.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div className="jz-xs" style={{
              background: l.role === 'user' ? 'var(--jz-accent)' : 'var(--jz-bg-raised)',
              color: l.role === 'user' ? 'var(--jz-on-accent)' : undefined,
              padding: '5px 8px', borderRadius: 6, whiteSpace: 'pre-wrap',
            }}>
              {l.text}
            </div>
            {l.tool ? <div className="jz-xs jz-muted" style={{ marginTop: 2 }}>{l.tool}</div> : null}
          </div>
        ))}
      </div>

      <div className="jz-row" style={{ gap: 6 }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
          placeholder="告诉 AI 要做什么…"
        />
        <Button variant="primary" onClick={() => void run()} disabled={busy}>
          {busy ? '…' : '执行'}
        </Button>
      </div>

      {!projectId ? <Alert tone="warn">未选项目，部分能力不可用</Alert> : null}
    </div>
  );
}

export default CanvasAgentPanel;

