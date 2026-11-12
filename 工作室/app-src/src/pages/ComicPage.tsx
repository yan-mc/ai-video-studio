/**
 * 漫画工作台 —— 对齐洛书 `comic` 域（1120 键，最大域）。
 *
 * 核心设计（洛书实测）：本地渲染零费用 + 只有 LLM 抽取与出图花钱。
 * 15 个站里 7 个零费用，所以不接任何模型也能产出可交付页面。
 *
 * 本页落地零费用链路：
 *   分镜抽取（规则版）→ 换版式 → 体检 → 导出 SVG
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import { useProjectStore } from '../store';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Textarea, useToast,
} from '../ui';

interface Template { id: string; name: string; rows: number; cols: number }
interface Station { id: string; name: string; cost: string; desc: string }
interface Panel { index: number; text: string; bubble: string; speaker: string; geometry: { x: number; y: number; w: number; h: number }; imageRel: string | null }
interface PageDoc { index: number; template: string; panels: Panel[] }
interface Check { id: string; name: string; ok: boolean; detail: string }

interface ComicDoc {
  projectId?: string;
  sourceText?: string;
  pages?: PageDoc[];
  template?: string;
  panelCount?: number;
  preflight?: { ok: boolean; total: number; passed: number; checks: Check[]; blocking: Check[] };
}

const COST_LABEL: Record<string, string> = {
  free: '零费用', llm: '花 LLM', image: '出图花钱', server: '服务端',
};
const COST_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'default'> = {
  free: 'ok', llm: 'warn', image: 'warn', server: 'default',
};

export function ComicPage() {
  const toast = useToast();
  const projectId = useProjectStore((s) => s.currentProjectId);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [doc, setDoc] = useState<ComicDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [exportMsg, setExportMsg] = useState('');

  const [text, setText] = useState('');
  const [pages, setPages] = useState('1');
  const [template, setTemplate] = useState('grid_2x2');
  const [previewUrl, setPreviewUrl] = useState('');

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await api.getComic(projectId) as ComicDoc | null;
      setDoc(d);
      if (d?.sourceText) setText(d.sourceText);
      setErr('');
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.comicMeta() as { templates: Template[]; stations: Station[] };
        setTemplates(m.templates ?? []);
        setStations(m.stations ?? []);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleExtract() {
    if (!projectId) { toast.error('请先选择一个项目'); return; }
    if (!text.trim()) { toast.error('请先输入分镜文本'); return; }
    setBusy(true);
    try {
      const d = await api.comicExtract({
        projectId, text, pages: Number(pages) || 1, template,
      }) as ComicDoc;
      setDoc(d);
      setPreviewUrl('');
      toast.ok(`已抽取 ${d.pages?.length ?? 0} 页 / ${d.panelCount ?? 0} 格`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRelayout(pageIndex: number, tpl: string) {
    if (!projectId) return;
    setBusy(true);
    try {
      const d = await api.comicRelayout({ projectId, pageIndex, template: tpl }) as ComicDoc;
      setDoc(d);
      toast.ok(`第 ${pageIndex} 页换成「${templates.find((t) => t.id === tpl)?.name ?? tpl}」`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(pageIndex: number) {
    if (!projectId) return;
    setBusy(true);
    try {
      const r = await api.comicExportPage({ projectId, pageIndex }) as { ok: boolean; rel: string; bytes: number };
      const url = `/luoshu/api/file?path=${encodeURIComponent(r.rel)}`;
      setPreviewUrl(url);
      setExportMsg(`已导出第 ${pageIndex} 页（${(r.bytes / 1024).toFixed(1)} KB）`);
      toast.ok('导出完成');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const freeCount = useMemo(() => stations.filter((s) => s.cost === 'free').length, [stations]);
  const pf = doc?.preflight;

  if (loading) return <Page title="漫画工作台"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="漫画工作台"
      subtitle={`${templates.length} 套版式 · ${stations.length} 站（${freeCount} 个零费用）`}
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button variant="primary" icon={<Icon name="image" size={15} />} onClick={() => void handleExtract()} disabled={busy || !projectId}>
            {busy ? '处理中…' : '分镜抽取'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {err ? <Alert tone="danger">{err}</Alert> : null}
        {!projectId ? <Alert tone="warn">请先在「项目」页选择一个项目</Alert> : null}

        <Panel title="分镜文本">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={'每段一格，例如：\n第一格：雨夜街头，林晚独自站在路灯下。\n\n第二格：陈默从巷子里走出来。'}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--jz-sp-3)', marginTop: 10 }}>
            <Field label="页数">
              <Input value={pages} onChange={(e) => setPages(e.target.value)} mono />
            </Field>
            <Field label="版式">
              <Select<string>
                value={template}
                onChange={setTemplate}
                options={templates.map((t) => ({ value: t.id, label: `${t.name}（${t.rows}×${t.cols}）` }))}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="流水线（15 站）">
          <div className="jz-sm jz-muted" style={{ marginBottom: 8 }}>
            洛书设计：本地渲染零费用，只有 LLM 抽取与出图花钱。绿色为已实现的零费用站。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {stations.map((s) => {
              const done = s.cost === 'free';
              return (
                <div key={s.id} className="jz-card" style={{ padding: '7px 9px', opacity: done ? 1 : 0.6 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <b className="jz-sm">{s.name}</b>
                    <Badge tone={COST_TONE[s.cost] ?? 'default'}>{COST_LABEL[s.cost] ?? s.cost}</Badge>
                  </div>
                  <div className="jz-xs jz-muted" style={{ marginTop: 3 }}>{s.desc}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        {pf ? (
          <Panel title="发布前体检">
            <div className="jz-row" style={{ gap: 8, marginBottom: 8 }}>
              <Badge tone={pf.ok ? 'ok' : 'danger'}>{pf.ok ? '通过' : '有阻断'}</Badge>
              <span className="jz-sm jz-muted">{pf.passed}/{pf.total} 项通过</span>
            </div>
            <div className="jz-col" style={{ gap: 3 }}>
              {pf.checks.map((c) => (
                <div key={c.id} className="jz-sm" style={{ opacity: c.ok ? 0.75 : 1 }}>
                  <Badge tone={c.ok ? 'ok' : 'danger'}>{c.ok ? '✓' : '✗'}</Badge> {c.name}
                  <span className="jz-muted"> · {c.detail}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {doc?.pages?.length ? (
          <Panel title={`页面（${doc.pages.length} 页）`}>
            <div className="jz-col" style={{ gap: 12 }}>
              {doc.pages.map((page) => (
                <div key={page.index} className="jz-card" style={{ padding: 10 }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div className="jz-row" style={{ gap: 8 }}>
                      <b>第 {page.index} 页</b>
                      <Badge>{page.panels.length} 格</Badge>
                      <span className="jz-sm jz-muted">{templates.find((t) => t.id === page.template)?.name ?? page.template}</span>
                    </div>
                    <div className="jz-row" style={{ gap: 6 }}>
                      <Select<string>
                        value={page.template}
                        onChange={(v) => void handleRelayout(page.index, v)}
                        options={templates.map((t) => ({ value: t.id, label: t.name }))}
                      />
                      <Button onClick={() => void handleExport(page.index)} disabled={busy}>导出</Button>
                    </div>
                  </div>
                  {/* 分格预览（按几何比例画） */}
                  <div style={{ position: 'relative', width: '100%', maxWidth: 420, aspectRatio: '1240 / 1754', background: '#fff', borderRadius: 4, border: '1px solid var(--jz-border)' }}>
                    {page.panels.map((pn) => (
                      <div
                        key={pn.index}
                        style={{
                          position: 'absolute',
                          left: `${pn.geometry.x * 100}%`,
                          top: `${pn.geometry.y * 100}%`,
                          width: `${pn.geometry.w * 100}%`,
                          height: `${pn.geometry.h * 100}%`,
                          boxSizing: 'border-box',
                          border: '1.5px solid #222',
                          background: '#f4f4f4',
                          padding: 3,
                          overflow: 'hidden',
                          fontSize: 9,
                          lineHeight: 1.25,
                          color: '#555',
                        }}
                      >
                        {pn.text.slice(0, 40)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {exportMsg ? <Alert tone="ok">{exportMsg}</Alert> : null}
        {previewUrl ? (
          <Panel title="导出预览">
            <img src={previewUrl} alt="漫画页导出" style={{ maxWidth: '100%', maxHeight: 600, background: '#fff', borderRadius: 6 }} />
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

export default ComicPage;