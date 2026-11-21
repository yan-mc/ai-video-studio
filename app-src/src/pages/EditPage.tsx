/**
 * 视频剪辑页 —— 裁切 / 拼接 / 音轨。
 *
 * ============================================================================
 * 为什么是「片段列表」而不是多轨时间轴
 * ============================================================================
 *
 * 本插件的主流产出是 H3 生成的**顺序片段**（镜头 1 → 2 → 3），不是需要自由
 * 编排的素材堆。因此这里的编辑模型是：
 *
 *   素材池（左）  →  片段序列（中，可上下移动/删除/设裁剪区间）  →  音轨设置 + 出片（右）
 *
 * 不做自由轨道 / 拖拽吸附 / 逐帧预览，理由见 host/services/edit.js 文件头。
 * 这个页面的职责是：让用户能**把几个镜头按想要的顺序接起来，掐掉不用的头尾，
 * 换一条 BGM**，然后拿到 mp4。就这些。
 *
 * ============================================================================
 * 与后端的分工
 * ============================================================================
 * 前端只做「组织片段 + 调后端」，**不在浏览器里解码视频**。
 * 所有 ffmpeg 工作都在 Host 侧的原生 ffmpeg 上跑（本机 9.0.2），
 * 所以 GB 级素材不会把浏览器撑爆。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteEditProject,
  editFileUrl,
  getEditProject,
  listEditClips,
  listEditProjects,
  probeEditMedia,
  renderEditProject,
  saveEditProject,
  describeError,
} from '../api/edit';
import type {
  EditAudioMode,
  EditClip,
  EditMediaItem,
  EditProbeResult,
  EditProjectSummary,
  EditRenderResult,
} from '../api/edit';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  Input,
  Loading,
  Panel,
  Select,
  Tabs,
  Page,
  formatBytes,
  formatRelativeTime,
  useT,
} from '../ui';
import { useToast } from '../ui/Toast';

/* ------------------------------------------------------------- 小工具 */

function fmtSec(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = Math.max(0, n);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m > 0 ? `${m}:${rest.toFixed(2).padStart(5, '0')}` : `${rest.toFixed(2)}s`;
}

let seq = 0;
function newClipId(): string {
  seq += 1;
  return `c${Date.now().toString(36)}${seq}`;
}

/** 后端返回的 rel 去掉目录前缀，只留文件名给用户看 */
function baseName(rel: string): string {
  const i = Math.max(rel.lastIndexOf('/'), rel.lastIndexOf('\\'));
  return i >= 0 ? rel.slice(i + 1) : rel;
}

/**
 * 一个片段的本地状态。
 *
 * meta 是探测结果，可能还没回来（null）。UI 必须能忍受 meta 为 null ——
 * 探测是逐个异步发的，首帧一定会遇到 null。
 */
interface DraftClip extends EditClip {
  meta: EditProbeResult | null;
  probing: boolean;
}

/* --------------------------------------------------------------- 页面 */

type TabId = 'edit' | 'projects';

export function EditPage() {
  const t = useT();
  const toast = useToast();

  const [tab, setTab] = useState<TabId>('edit');

  /* ---- 素材池 ---- */
  const [media, setMedia] = useState<EditMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string>('');

  /* ---- 当前工程 ---- */
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('未命名剪辑');
  const [clips, setClips] = useState<DraftClip[]>([]);
  const [selectedId, setSelectedId] = useState('');

  /* ---- 音轨 ---- */
  const [audioMode, setAudioMode] = useState<EditAudioMode>('original');
  const [bgmRel, setBgmRel] = useState('');
  const [bgmVolume, setBgmVolume] = useState(0.5);
  const [originalVolume, setOriginalVolume] = useState(1);
  const [replaceOriginal, setReplaceOriginal] = useState(true);
  const [fadeInSec, setFadeInSec] = useState(0);
  const [fadeOutSec, setFadeOutSec] = useState(0);

  /* ---- 拼接选项 ---- */
  const [transitionSec, setTransitionSec] = useState(0);

  /* ---- 工程列表 ---- */
  const [projects, setProjects] = useState<EditProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  /* ---- 出片 ---- */
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<EditRenderResult | null>(null);
  const [renderError, setRenderError] = useState('');

  /** 已发出探测请求的 rel —— 防止同一文件被重复探测 */
  const probedRef = useRef<Set<string>>(new Set());

  /* ------------------------------------------------------ 素材加载 */

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    setMediaError('');
    try {
      const r = await listEditClips();
      setMedia(Array.isArray(r.clips) ? r.clips : []);
    } catch (err) {
      setMediaError(describeError(err));
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => { void loadMedia(); }, [loadMedia]);

  /* ------------------------------------------------------ 工程加载 */

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const r = await listEditProjects();
      setProjects(Array.isArray(r.projects) ? r.projects : []);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setProjectsLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  /* ------------------------------------------------------ 探测片段 */

  /**
   * 给某个片段补探测信息。
   *
   * 为什么要单独探测：用户需要知道每段有多长才能决定掐哪里。
   * 探测失败不要打断编辑 —— 标记 meta 为 null 即可，用户仍可移动/删除。
   */
  const probeClip = useCallback(async (rel: string) => {
    if (probedRef.current.has(rel)) return;
    probedRef.current.add(rel);
    setClips((prev) => prev.map((c) => (c.rel === rel ? { ...c, probing: true } : c)));
    try {
      const meta = await probeEditMedia(rel);
      setClips((prev) => prev.map((c) => (c.rel === rel ? { ...c, meta, probing: false } : c)));
    } catch {
      setClips((prev) => prev.map((c) => (c.rel === rel ? { ...c, probing: false } : c)));
      // 探测失败不弹 toast：素材可能是刚生成、正在写盘的文件
      probedRef.current.delete(rel);
    }
  }, []);

  /* ---------------------------------------------------- 片段操作 */

  const addClip = useCallback((item: EditMediaItem) => {
    if (item.kind !== 'video') {
      toast.error('只能把视频加入剪辑序列；音频请在「音轨」里选为 BGM');
      return;
    }
    const clip: DraftClip = {
      id: newClipId(),
      rel: item.rel,
      name: baseName(item.rel),
      startSec: 0,
      endSec: null,
      meta: null,
      probing: false,
    };
    setClips((prev) => [...prev, clip]);
    setSelectedId(clip.id);
    void probeClip(item.rel);
  }, [probeClip, toast]);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((cur) => (cur === id ? '' : cur));
  }, []);

  /** 上下移动：拼接顺序就是数组顺序，所以「移动」即重排 */
  const moveClip = useCallback((id: string, delta: number) => {
    setClips((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      if (i < 0) return prev;
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next;
    });
  }, []);

  const patchClip = useCallback((id: string, patch: Partial<DraftClip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  /**
   * 设置裁剪区间。
   *
   * 这里做**前端夹取**而不是让后端报错：用户输入 999 秒时，后端会把它夹到
   * 片长并正常出片，但界面上的数字仍是 999，看起来像"设置没生效"。
   * 在前端夹到 [0, 片长] 保证"看到的数字就是实际会用的数字"。
   */
  const setClipRange = useCallback((id: string, field: 'startSec' | 'endSec', rawValue: number) => {
    setClips((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const total = c.meta?.durationSec ?? null;
      let v = Number(rawValue);
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(0, total != null ? Math.min(v, total) : v);
      const next = { ...c, [field]: v } as DraftClip;
      // 起点必须严格小于终点，否则区间为空（后端会直接报 EMPTY_RANGE）
      if (next.startSec != null && next.endSec != null && next.endSec <= next.startSec) {
        if (field === 'startSec') next.endSec = Math.min(total ?? v + 1, v + 0.1);
        else next.startSec = Math.max(0, v - 0.1);
      }
      return next;
    }));
  }, []);

  /* ---------------------------------------------------- 工程操作 */

  const openProject = useCallback(async (id: string) => {
    try {
      const r = await getEditProject(id);
      const p = r.project;
      setProjectId(p.id);
      setProjectName(p.name || '未命名剪辑');
      setClips(p.clips.map((c) => ({
        ...c,
        meta: null,
        probing: false,
      })));
      setSelectedId('');
      if (p.audio) {
        setAudioMode(p.audio.mode ?? 'original');
        setBgmRel(p.audio.bgmRel ?? '');
        setBgmVolume(p.audio.bgmVolume ?? 0.5);
        setOriginalVolume(p.audio.originalVolume ?? 1);
        setReplaceOriginal(p.audio.replaceOriginal !== false);
        setFadeInSec(p.audio.fadeInSec ?? 0);
        setFadeOutSec(p.audio.fadeOutSec ?? 0);
      }
      probedRef.current = new Set();
      setTab('edit');
      toast.ok(`已打开工程「${p.name}」`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }, [toast]);

  const saveCurrent = useCallback(async () => {
    const id = projectId || `edit_${Date.now().toString(36)}`;
    try {
      const r = await saveEditProject(id, {
        name: projectName,
        clips: clips.map((c, i) => ({
          id: c.id,
          rel: c.rel,
          name: c.name,
          startSec: c.startSec,
          endSec: c.endSec,
          order: i,
        })),
        audio: {
          mode: audioMode,
          bgmRel,
          bgmVolume,
          originalVolume,
          replaceOriginal,
          fadeInSec,
          fadeOutSec,
        },
      });
      setProjectId(r.project.id);
      toast.ok(t('app.saved'));
      void loadProjects();
    } catch (err) {
      toast.error(describeError(err));
    }
  }, [
    projectId, projectName, clips, audioMode, bgmRel, bgmVolume,
    originalVolume, replaceOriginal, fadeInSec, fadeOutSec, loadProjects, t, toast,
  ]);

  const removeProject = useCallback(async (id: string) => {
    if (!window.confirm(`删除工程「${id}」？片段本身不会删除，只删工程记录。`)) return;
    try {
      await deleteEditProject(id);
      if (id === projectId) {
        setProjectId('');
        setClips([]);
        setSelectedId('');
      }
      toast.ok('已删除');
      void loadProjects();
    } catch (err) {
      toast.error(describeError(err));
    }
  }, [loadProjects, projectId, toast]);

  const newProject = useCallback(() => {
    setProjectId('');
    setProjectName('未命名剪辑');
    setClips([]);
    setSelectedId('');
    setAudioMode('original');
    setBgmRel('');
    setTransitionSec(0);
    setRenderResult(null);
    setRenderError('');
    probedRef.current = new Set();
    setTab('edit');
  }, []);

  /* -------------------------------------------------------- 出片 */

  const doRender = useCallback(async () => {
    if (!clips.length) {
      toast.error('先加入至少一个片段');
      return;
    }
    setRendering(true);
    setRenderError('');
    setRenderResult(null);
    try {
      const r = await renderEditProject({
        id: projectId || undefined,
        name: projectName || undefined,
        clips: clips.map((c) => ({
          rel: c.rel,
          name: c.name,
          startSec: c.startSec,
          endSec: c.endSec,
        })),
        audio: {
          mode: audioMode,
          bgmRel,
          bgmVolume,
          originalVolume,
          replaceOriginal,
          fadeInSec,
          fadeOutSec,
        },
        transitionSec,
      });
      setRenderResult(r);
      toast.ok(t('edit.renderDone'));
      void loadMedia();
      if (projectId) void loadProjects();
    } catch (err) {
      setRenderError(describeError(err));
    } finally {
      setRendering(false);
    }
  }, [
    clips, projectId, projectName, audioMode, bgmRel, bgmVolume,
    originalVolume, replaceOriginal, fadeInSec, fadeOutSec, transitionSec,
    loadMedia, loadProjects, t, toast,
  ]);

  /* ------------------------------------------------------- 派生值 */

  const selected = clips.find((c) => c.id === selectedId) ?? null;

  /** 预计成片时长：各段裁剪区间之和，减去转场重叠 */
  const estimatedSec = useMemo(() => {
    let total = 0;
    for (const c of clips) {
      const full = c.meta?.durationSec ?? 0;
      const start = c.startSec ?? 0;
      const end = c.endSec ?? full;
      total += Math.max(0, end - start);
    }
    const overlaps = Math.max(0, clips.length - 1) * (transitionSec > 0 ? transitionSec : 0);
    return Math.max(0, total - overlaps);
  }, [clips, transitionSec]);

  const audioItems = useMemo(() => media.filter((m) => m.kind === 'audio'), [media]);
  const videoItems = useMemo(() => media.filter((m) => m.kind === 'video'), [media]);

  /**
   * 音轨下拉的选项。
   *
   * 后端给的是 dataDir 相对路径，这里把「文件名 + 人类可读大小」作为标签 ——
   * 用户认的是文件名，路径对他没有意义。value 仍是 rel（后端要的形态）。
   */
  const bgmOptions = useMemo(
    () => [{ value: '', label: '（不选）' }].concat(
      audioItems.map((m) => ({ value: m.rel, label: `${baseName(m.rel)} · ${formatBytes(m.bytes)}` })),
    ),
    [audioItems],
  );

  return (
    <Page
      title={t('nav.edit')}
      subtitle="裁切 · 拼接 · 音轨 —— 把镜头接成一条成片"
      actions={
        <div className="jz-row" style={{ gap: 8 }}>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void loadMedia()}>
            {t('app.refresh')}
          </Button>
          <Button onClick={newProject}>新建</Button>
          <Button variant="primary" icon={<Icon name="download" size={15} />} onClick={() => void doRender()} loading={rendering}>
            {t('edit.render')}
          </Button>
        </div>
      }
    >
      <Tabs
        items={[
          { value: 'edit', label: t('edit.tabEdit') },
          { value: 'projects', label: `${t('edit.tabProjects')}${projects.length ? ` (${projects.length})` : ''}` },
        ]}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === 'projects' ? (
        <Panel
          title={t('edit.tabProjects')}
          actions={<Button size="sm" icon={<Icon name="refresh" size={14} />} onClick={() => void loadProjects()}>刷新</Button>}
        >
          {projectsLoading && !projects.length ? (
            <Loading />
          ) : projects.length === 0 ? (
            <EmptyState icon="folder" title="还没有剪辑工程" hint="在「剪辑」页拼好片段后保存，就会出现在这里。" />
          ) : (
            <div className="jz-table__wrap">
              <table className="jz-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>片段</th>
                    <th>更新时间</th>
                    <th style={{ textAlign: 'right' }}>{t('app.more')}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          className="jz-linkbtn"
                          onClick={() => void openProject(p.id)}
                          title={p.id}
                        >
                          {p.name || p.id}
                        </button>
                      </td>
                      <td className="jz-xs">{p.clipCount}</td>
                      <td className="jz-xs jz-muted">
                        {p.updatedAt ? formatRelativeTime(Date.parse(p.updatedAt) || null) : '—'}
                      </td>
                      <td>
                        <div className="jz-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          <Button size="sm" onClick={() => void openProject(p.id)}>打开</Button>
                          <Button size="sm" variant="danger" onClick={() => void removeProject(p.id)}>
                            {t('app.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <>
          {mediaError ? <Alert tone="danger">{mediaError}</Alert> : null}
          {renderError ? <Alert tone="danger">{renderError}</Alert> : null}

          {/* 三栏：素材池 / 片段序列 / 设置 + 成片 */}
          <div className="jz-edit">
            {/* ---------------- 左：素材池 ---------------- */}
            <Panel
              title="素材池"
              actions={<Badge tone="default">{videoItems.length}</Badge>}
              className="jz-edit__col"
            >
              {mediaLoading ? (
                <Loading />
              ) : videoItems.length === 0 ? (
                <EmptyState
                  icon="video"
                  title="没有可剪辑的视频"
                  hint="先在「渲染」页生成镜头，产物会自动出现在这里。"
                />
              ) : (
                <div className="jz-edit__list">
                  {videoItems.map((m) => (
                    <div key={m.rel} className="jz-edit__media">
                      <div className="jz-col jz-grow" style={{ gap: 2, minWidth: 0 }}>
                        <span className="jz-sm jz-truncate" title={m.rel}>{baseName(m.rel)}</span>
                        <span className="jz-xs jz-muted">{formatBytes(m.bytes)}</span>
                      </div>
                      <Button
                        size="sm"
                        icon={<Icon name="plus" size={13} />}
                        onClick={() => addClip(m)}
                      >
                        加入
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ---------------- 中：片段序列 ---------------- */}
            <Panel
              title="剪辑序列"
              actions={
                <div className="jz-row" style={{ gap: 6 }}>
                  <Badge tone="default">{clips.length} 段</Badge>
                  <Badge tone="accent">≈ {fmtSec(estimatedSec)}</Badge>
                </div>
              }
              className="jz-edit__col jz-edit__col--wide"
            >
              {clips.length === 0 ? (
                <EmptyState
                  icon="layers"
                  title="序列还是空的"
                  hint="从左边「加入」片段；顺序就是成片顺序，可用箭头调整。"
                />
              ) : (
                <div className="jz-edit__list">
                  {clips.map((c, i) => {
                    const total = c.meta?.durationSec ?? null;
                    const start = c.startSec ?? 0;
                    const end = c.endSec ?? total ?? 0;
                    const isSel = c.id === selectedId;
                    const ratio = total && total > 0 ? Math.min(1, Math.max(0, (end - start) / total)) : 0;
                    return (
                      <div
                        key={c.id}
                        className={isSel ? 'jz-edit__clip jz-edit__clip--active' : 'jz-edit__clip'}
                        onClick={() => setSelectedId(c.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(c.id); }}
                      >
                        <span className="jz-edit__idx">{i + 1}</span>
                        <div className="jz-col jz-grow" style={{ gap: 4, minWidth: 0 }}>
                          <span className="jz-sm jz-truncate" title={c.rel}>{c.name || baseName(c.rel)}</span>
                          <div className="jz-edit__bar" title={`${fmtSec(start)} → ${fmtSec(end)}`}>
                            <div className="jz-edit__barfill" style={{ width: `${ratio * 100}%` }} />
                          </div>
                          <span className="jz-xs jz-muted">
                            {c.probing ? '探测中…' : (
                              end > start
                                ? `${fmtSec(start)} → ${fmtSec(end)}（用 ${fmtSec(end - start)}）`
                                : '整段'
                            )}
                          </span>
                        </div>
                        <div className="jz-row" style={{ gap: 2 }}>
                          <Button size="sm" variant="ghost" disabled={i === 0} title="上移" onClick={(e) => { e.stopPropagation(); moveClip(c.id, -1); }}>↑</Button>
                          <Button size="sm" variant="ghost" disabled={i === clips.length - 1} title="下移" onClick={(e) => { e.stopPropagation(); moveClip(c.id, 1); }}>↓</Button>
                          <Button size="sm" variant="danger" title="移除" onClick={(e) => { e.stopPropagation(); removeClip(c.id); }}>
                            <Icon name="trash" size={13} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 选中片段的裁剪区间 */}
              {selected ? (
                <div className="jz-edit__range">
                  <div className="jz-xs jz-muted" style={{ marginBottom: 6 }}>
                    裁剪区间 —— {selected.name || baseName(selected.rel)}
                    {selected.meta?.durationSec != null ? `（片长 ${fmtSec(selected.meta.durationSec)}）` : ''}
                  </div>
                  <div className="jz-row" style={{ gap: 10 }}>
                    <Field label="起点（秒）" className="jz-grow">
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={selected.startSec}
                        onChange={(e) => setClipRange(selected.id, 'startSec', Number(e.target.value))}
                      />
                    </Field>
                    <Field label="终点（秒）" className="jz-grow">
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder={selected.meta?.durationSec != null ? String(selected.meta.durationSec) : '片尾'}
                        value={selected.endSec ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') patchClip(selected.id, { endSec: null });
                          else setClipRange(selected.id, 'endSec', Number(v));
                        }}
                      />
                    </Field>
                    <Button
                      size="sm"
                      style={{ alignSelf: 'flex-end' }}
                      onClick={() => patchClip(selected.id, { startSec: 0, endSec: null })}
                    >
                      整段
                    </Button>
                  </div>
                </div>
              ) : null}
            </Panel>

            {/* ---------------- 右：设置 + 成片 ---------------- */}
            <Panel title="输出设置" className="jz-edit__col">
              <div className="jz-col" style={{ gap: 12 }}>
                <Field label="工程名称">
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </Field>

                <Field label="拼接转场" hint="0 为硬切；>0 时相邻片段淡入淡出（需重编码）">
                  <Select
                    value={String(transitionSec)}
                    onChange={(v) => setTransitionSec(Number(v))}
                    options={[
                      { value: '0', label: '硬切' },
                      { value: '0.2', label: '0.2 秒' },
                      { value: '0.5', label: '0.5 秒' },
                      { value: '1', label: '1 秒' },
                    ]}
                  />
                </Field>

                <Field label="音轨">
                  <Select
                    value={audioMode}
                    onChange={(v) => setAudioMode(v as EditAudioMode)}
                    options={[
                      { value: 'original', label: '保留原声' },
                      { value: 'strip', label: '静音（去掉音轨）' },
                      { value: 'volume', label: '调整原声音量' },
                      { value: 'bgm', label: '换 / 混 BGM' },
                    ]}
                  />
                </Field>

                {audioMode === 'volume' ? (
                  <Field label={`原声音量 ${originalVolume.toFixed(2)}`} hint="0 = 静音，1 = 原始">
                    <input
                      type="range" min={0} max={2} step={0.05} value={originalVolume}
                      onChange={(e) => setOriginalVolume(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </Field>
                ) : null}

                {audioMode === 'bgm' ? (
                  <>
                    <Field label="BGM 文件" hint="来自素材池里的音频（先上传到素材库）">
                      <Select value={bgmRel} onChange={setBgmRel} options={bgmOptions} />
                    </Field>
                    <Field label={`BGM 音量 ${bgmVolume.toFixed(2)}`}>
                      <input
                        type="range" min={0} max={2} step={0.05} value={bgmVolume}
                        onChange={(e) => setBgmVolume(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </Field>
                    <label className="jz-row jz-sm" style={{ gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={replaceOriginal}
                        onChange={(e) => setReplaceOriginal(e.target.checked)}
                      />
                      完全替换原声（不勾则与原声混音）
                    </label>
                    {!replaceOriginal ? (
                      <Field label={`原声压低到 ${originalVolume.toFixed(2)}`}>
                        <input
                          type="range" min={0} max={1} step={0.05} value={originalVolume}
                          onChange={(e) => setOriginalVolume(Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </Field>
                    ) : null}
                    <div className="jz-row" style={{ gap: 10 }}>
                      <Field label="淡入（秒）" className="jz-grow">
                        <Input
                          type="number" min={0} step={0.1} value={fadeInSec}
                          onChange={(e) => setFadeInSec(Math.max(0, Number(e.target.value) || 0))}
                        />
                      </Field>
                      <Field label="淡出（秒）" className="jz-grow">
                        <Input
                          type="number" min={0} step={0.1} value={fadeOutSec}
                          onChange={(e) => setFadeOutSec(Math.max(0, Number(e.target.value) || 0))}
                        />
                      </Field>
                    </div>
                  </>
                ) : null}

                <div className="jz-row" style={{ gap: 8 }}>
                  <Button className="jz-grow" onClick={() => void saveCurrent()}>{t('app.save')}</Button>
                  <Button className="jz-grow" variant="primary" icon={<Icon name="download" size={15} />} onClick={() => void doRender()} loading={rendering}>
                    出片
                  </Button>
                </div>

                {/* ------- 成片预览 ------- */}
                {renderResult ? (
                  <div className="jz-col" style={{ gap: 6 }}>
                    <div className="jz-xs jz-muted">{t('edit.renderDone')}</div>
                    <video
                      className="jz-edit__preview"
                      src={editFileUrl(renderResult.rel)}
                      controls
                      preload="metadata"
                    />
                    <div className="jz-xs jz-muted">
                      {fmtSec(renderResult.meta?.durationSec)} · {formatBytes(renderResult.bytes)} · {renderResult.segments} 段
                    </div>
                    <a
                      className="jz-xs"
                      href={editFileUrl(renderResult.rel)}
                      download
                      style={{ color: 'var(--jz-accent)' }}
                    >
                      {t('app.download')}
                    </a>
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}

export default EditPage;