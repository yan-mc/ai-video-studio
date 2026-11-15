/**
 * 工具箱面板 —— 承载剩余的中小功能域（已并入设置页）：
 *  提示词模板 / 服化道 / 分镜导入 / 资源清理 / 动态条 / 运行日志 / 批量进度
 */
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import {
  Alert, Badge, Button, EmptyState, Field, Icon, Input, Loading, Panel, Select, Tabs, Textarea, useToast,
} from '../ui';

interface Template { id: string; name: string; category: string; content: string; custom?: boolean }
interface WardrobeItem { id: string; kind: string; name: string; desc: string; tags: string[] }
interface ScanFile { name: string; path: string; bytes: number; kind: string; matched: { id: string; name: string }[] }
interface ScanResult { dir: string; total: number; known: number; unknown: number; files: ScanFile[]; skipped: string[] }
interface Orphans {
  total: number; referenced: number; orphanCount: number; orphanBytes: number;
  orphans: { name: string; path: string; bytes: number; mtime: number }[];
}
interface LogEntry { at: number; level?: string; msg?: string; [k: string]: unknown }
interface BatchProg { total: number; done: number; failed: number; running: number; queued: number; percent: number }

type Domain = 'templates' | 'wardrobe' | 'import' | 'resources' | 'logs';

export function ToolboxPanel() {
  const toast = useToast();
  const [domain, setDomain] = useState<Domain>('templates');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [orphans, setOrphans] = useState<Orphans | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [batch, setBatch] = useState<BatchProg | null>(null);

  // 编辑态
  const [tplName, setTplName] = useState('');
  const [tplCat, setTplCat] = useState('文字');
  const [tplContent, setTplContent] = useState('');
  const [wdKind, setWdKind] = useState('costume');
  const [wdName, setWdName] = useState('');
  const [wdDesc, setWdDesc] = useState('');
  const [scanDir, setScanDir] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, w, o, l, b] = await Promise.all([
        api.toolboxTemplates(), api.toolboxWardrobe(),
        api.toolboxOrphans(), api.toolboxLogs(), api.toolboxBatchProgress(),
      ]);
      setTemplates(t as Template[]);
      setWardrobe(w as WardrobeItem[]);
      setOrphans(o as Orphans);
      setLogs(l as LogEntry[]);
      setBatch(b as BatchProg);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function saveTemplate() {
    if (!tplName.trim() || !tplContent.trim()) { toast.error('名称与内容必填'); return; }
    setBusy(true);
    try {
      await api.toolboxTemplateUpsert({ name: tplName, category: tplCat, content: tplContent });
      setTplName(''); setTplContent('');
      await load();
      toast.ok('模板已保存');
    } catch (e) { toast.error(String((e as Error)?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function delTemplate(id: string) {
    if (!window.confirm('删除这个模板？')) return;
    try { await api.toolboxTemplateDelete(id); await load(); toast.ok('已删除'); }
    catch (e) { toast.error(String((e as Error)?.message ?? e)); }
  }

  async function saveWardrobe() {
    if (!wdName.trim()) { toast.error('名称必填'); return; }
    setBusy(true);
    try {
      await api.toolboxWardrobeUpsert({ kind: wdKind, name: wdName, desc: wdDesc });
      setWdName(''); setWdDesc('');
      await load();
      toast.ok('已入库');
    } catch (e) { toast.error(String((e as Error)?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function delWardrobe(id: string) {
    if (!window.confirm('删除这条服化道？')) return;
    try { await api.toolboxWardrobeDelete(id); await load(); toast.ok('已删除'); }
    catch (e) { toast.error(String((e as Error)?.message ?? e)); }
  }

  async function doScan() {
    if (!scanDir.trim()) { toast.error('请输入目录路径'); return; }
    setBusy(true);
    try {
      const r = await api.toolboxImportScan({ dir: scanDir }) as ScanResult;
      setScan(r);
      toast.ok(`识别到 ${r.known} 个可导入文件`);
    } catch (e) { toast.error(String((e as Error)?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function doPreview(p: string) {
    try {
      const r = await api.toolboxImportPreview({ path: p, limit: 3000 }) as { preview: string; name: string };
      setPreview(`── ${r.name} ──\n${r.preview}`);
    } catch (e) { toast.error(String((e as Error)?.message ?? e)); }
  }

  async function doClean() {
    if (!window.confirm('删除所有孤儿文件？此操作不可恢复。')) return;
    setBusy(true);
    try {
      const r = await api.toolboxOrphansClean({ confirm: true }) as { removed: number; bytes: number };
      toast.ok(`已删除 ${r.removed} 个文件，释放 ${(r.bytes / 1024).toFixed(1)} KB`);
      await load();
    } catch (e) { toast.error(String((e as Error)?.message ?? e)); }
    finally { setBusy(false); }
  }

  if (loading) return <Loading text="载入中" />;

  return (
    <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
      <div className="jz-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        {batch ? (
          <Badge tone={batch.failed ? 'danger' : batch.running ? 'warn' : 'ok'}>
            任务 {batch.done}/{batch.total} · {batch.percent}%
          </Badge>
        ) : null}
        <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
      </div>
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        <Tabs<Domain>
          items={[
            { value: 'templates', label: `提示词模板（${templates.length}）` },
            { value: 'wardrobe', label: `服化道（${wardrobe.length}）` },
            { value: 'import', label: '分镜导入' },
            { value: 'resources', label: `资源清理${orphans?.orphanCount ? ` (${orphans.orphanCount})` : ''}` },
            { value: 'logs', label: `运行日志（${logs.length}）` },
          ]}
          value={domain}
          onChange={setDomain}
          ariaLabel="工具箱分区"
        />

        {domain === 'templates' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="新增模板">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--jz-sp-3)' }}>
                <Field label="名称"><Input value={tplName} onChange={(e) => setTplName(e.target.value)} /></Field>
                <Field label="分类"><Input value={tplCat} onChange={(e) => setTplCat(e.target.value)} /></Field>
              </div>
              <Field label="内容"><Textarea value={tplContent} onChange={(e) => setTplContent(e.target.value)} rows={3} /></Field>
              <Button variant="primary" style={{ marginTop: 8 }} onClick={() => void saveTemplate()} disabled={busy}>保存</Button>
            </Panel>
            <Panel title={`模板库（${templates.length}）`}>
              <div className="jz-col" style={{ gap: 6 }}>
                {templates.map((t) => (
                  <div key={t.id} className="jz-card" style={{ padding: '8px 10px' }}>
                    <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                      <div className="jz-row" style={{ gap: 8 }}>
                        <b className="jz-sm">{t.name}</b>
                        <Badge>{t.category}</Badge>
                        {t.custom ? <Badge tone="warn">自定义</Badge> : null}
                      </div>
                      {t.custom ? <Button onClick={() => void delTemplate(t.id)}>删除</Button> : null}
                    </div>
                    <div className="jz-xs jz-muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{t.content}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {domain === 'wardrobe' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="新增服化道">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--jz-sp-3)' }}>
                <Field label="类别">
                  <Select<string> value={wdKind} onChange={setWdKind} options={[
                    { value: 'costume', label: '服装' }, { value: 'accessory', label: '饰品' },
                    { value: 'weapon', label: '武器' }, { value: 'prop', label: '道具' },
                  ]} />
                </Field>
                <Field label="名称"><Input value={wdName} onChange={(e) => setWdName(e.target.value)} /></Field>
              </div>
              <Field label="描述"><Input value={wdDesc} onChange={(e) => setWdDesc(e.target.value)} /></Field>
              <Button variant="primary" style={{ marginTop: 8 }} onClick={() => void saveWardrobe()} disabled={busy}>入库</Button>
            </Panel>
            <Panel title={`服化道库（${wardrobe.length}）`}>
              {wardrobe.length === 0 ? <EmptyState icon="assets" title="还没有条目" hint="加一条服装/饰品/武器/道具" /> : (
                <div className="jz-col" style={{ gap: 6 }}>
                  {wardrobe.map((w) => (
                    <div key={w.id} className="jz-card" style={{ padding: '8px 10px' }}>
                      <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                        <div className="jz-row" style={{ gap: 8 }}>
                          <b className="jz-sm">{w.name}</b>
                          <Badge>{{ costume: '服装', accessory: '饰品', weapon: '武器', prop: '道具' }[w.kind] ?? w.kind}</Badge>
                        </div>
                        <Button onClick={() => void delWardrobe(w.id)}>删除</Button>
                      </div>
                      {w.desc ? <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>{w.desc}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        ) : null}

        {domain === 'import' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="扫描目录">
              <Field label="目录绝对路径" hint="识别 seedance / H3 产物">
                <Input value={scanDir} onChange={(e) => setScanDir(e.target.value)} mono placeholder="项目\第01集\产物 或 绝对路径" />
              </Field>
              <Button variant="primary" style={{ marginTop: 8 }} onClick={() => void doScan()} disabled={busy}>扫描</Button>
            </Panel>
            {scan ? (
              <Panel title={`扫描结果（可导入 ${scan.known} / 共 ${scan.total}）`}>
                <div className="jz-col" style={{ gap: 4 }}>
                  {scan.files.map((f) => (
                    <div key={f.path} className="jz-row" style={{ gap: 8, padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,.06)' }}>
                      <Badge tone={f.kind === 'h3' ? 'ok' : 'default'}>{f.kind}</Badge>
                      <span className="jz-sm" style={{ flex: 1 }}>{f.name}</span>
                      <span className="jz-xs jz-muted">{(f.bytes / 1024).toFixed(1)} KB</span>
                      <Button onClick={() => void doPreview(f.path)}>预览</Button>
                    </div>
                  ))}
                  {scan.skipped.length ? (
                    <div className="jz-xs jz-muted" style={{ marginTop: 8 }}>跳过：{scan.skipped.join('、')}</div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
            {preview ? (
              <Panel title="文件预览">
                <pre className="jz-mono jz-xs" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto', background: 'var(--jz-bg-sunken)', padding: 10, borderRadius: 6 }}>{preview}</pre>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {domain === 'resources' ? (
          <Panel title="孤儿文件清理">
            {orphans ? (
              <div className="jz-col" style={{ gap: 10 }}>
                <div className="jz-row jz-wrap" style={{ gap: 8 }}>
                  <Badge>{orphans.total} 个文件</Badge>
                  <Badge tone="ok">{orphans.referenced} 个被引用</Badge>
                  <Badge tone={orphans.orphanCount ? 'warn' : 'default'}>{orphans.orphanCount} 个孤儿</Badge>
                  <Badge>{(orphans.orphanBytes / 1024).toFixed(1)} KB 可释放</Badge>
                </div>
                {orphans.orphanCount ? (
                  <>
                    <Alert tone="warn">孤儿文件没有被任何资产记录引用，删除后不可恢复。</Alert>
                    <div className="jz-col" style={{ gap: 3 }}>
                      {orphans.orphans.slice(0, 20).map((o) => (
                        <div key={o.name} className="jz-row" style={{ gap: 8 }}>
                          <span className="jz-sm jz-mono" style={{ flex: 1 }}>{o.name}</span>
                          <span className="jz-xs jz-muted">{(o.bytes / 1024).toFixed(1)} KB</span>
                        </div>
                      ))}
                      {orphans.orphanCount > 20 ? <div className="jz-xs jz-muted">…还有 {orphans.orphanCount - 20} 个</div> : null}
                    </div>
                    <Button variant="primary" onClick={() => void doClean()} disabled={busy}>清理孤儿文件</Button>
                  </>
                ) : <div className="jz-sm jz-muted">没有孤儿文件，很干净。</div>}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {domain === 'logs' ? (
          <Panel title={`运行日志（${logs.length}）`}>
            {logs.length === 0 ? <EmptyState icon="file" title="暂无日志" hint="执行任务后会在这里记录" /> : (
              <div className="jz-col" style={{ gap: 3 }}>
                {logs.map((l, i) => (
                  <div key={i} className="jz-row" style={{ gap: 8, borderBottom: '1px dashed rgba(255,255,255,.06)', padding: '3px 0' }}>
                    <span className="jz-xs jz-muted jz-mono">{new Date(l.at).toLocaleTimeString('zh-CN')}</span>
                    {l.level ? <Badge tone={l.level === 'error' ? 'danger' : l.level === 'warn' ? 'warn' : 'default'}>{String(l.level)}</Badge> : null}
                    <span className="jz-sm" style={{ flex: 1 }}>{String(l.msg ?? '')}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

export default ToolboxPanel;