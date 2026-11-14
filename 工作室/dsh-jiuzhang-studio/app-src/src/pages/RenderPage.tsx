/**
 * 渲染页 —— 一条镜头的完整制作闭环。
 *
 * ============================================================================
 * 为什么要有这个页面
 * ============================================================================
 *
 * 之前做一个镜头要跨 5 个页面：提示词在「提示词工作台」写、参考图在「镜头卡」挂、
 * 渲染去「任务」看、成片回「素材库」找。这个割裂是当前最难用的地方。
 *
 * 本页把 ④写提示词 → ⑤选素材 → ⑥渲染 → ⑦预览 合成一个工作台：
 *
 *   左栏 选素材（角色卡 / 首尾帧 / 手动参考）
 *   中栏 预览（渲染结果 / 首尾帧）
 *   右栏 参数（模式 / 画风 / 时长 / 档位 / 种子）
 *   底部 提示词编辑器（可折叠，实时编译预览）
 *
 * ============================================================================
 * 关键设计
 * ============================================================================
 *
 * 1. **参考图编号由后端算**（`/render/plan`），前端不拼 `<Picture N>`。
 *    手填编号必然与实际上传顺序错位 —— 这个坑已经踩过一次。
 *
 * 2. **预算始终可见**。H3 的 ref_images 上限 9 张是整条提示词共享，
 *    超限会被裁。必须在**点渲染之前**就看到"用了 5/9、还剩 4"，
 *    而不是渲染完才发现丢图。
 *
 * 3. **提示词与素材同屏**。改角色卡勾选，提示词实时跟着变
 *    （因为 subject_definitions 的编号来自渲染计划）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, describeError } from '../api/client';
import { outputUrl } from '../api/url';
import { useProjectStore } from '../store';
import type { ShotActor } from '../api/types';
import {
  Alert, Badge, Button, Field, Icon, Input, KeyValue, Loading, Page, Panel,
  Select, Tabs, Textarea, useToast,
} from '../ui';

/* ------------------------------------------------------------------ 类型 */

interface VaultCardLite {
  id: string;
  name: string;
  description: string;
  traits: string[];
  imageCount: number;
  resolvedImages: { slot: string; rel: string }[];
}

interface AssetItem { id: string; name: string; rel?: string; kind: string }
interface MediaPick { rel: string; name: string; hasAudio?: boolean }

/** 3D 模型资产（glb/gltf/fbx/obj） */
interface ModelAsset { rel: string; name: string; ext: string; kind: 'actor' | 'prop'; bytes: number }
/** 模型内置动作（Mixamo 的 Action 名形如 Armature|Armature|walk） */
interface AssetAction { name: string; frames: [number, number]; durationFrames: number }

interface PlanImage { index: number; rel: string; source: string; cardId?: string; cardName?: string; slot?: string }

interface RenderPlan {
  images: PlanImage[];
  subjects: Array<{ id: string; name: string; pictureIndex: number | null; hasImage: boolean }>;
  suggestedMode: string;
  refImageSize?: string;
  refImageSizeRequested?: string;
  refImageSizeDowngraded?: boolean;
  warnings: string[];
  stats: {
    total: number; limit: number; remaining: number;
    bySource: Record<string, number>;
    cardsWithImage: number; cardsWithoutImage: number;
    /** 参考视频 + 音频的合计时长（秒） */
    mediaSec?: number;
    /** 合计时长上限（默认 14.8s） */
    mediaSecLimit?: number;
    mediaSecRemaining?: number;
    /** 是否超限（超限时后端会自动裁剪并告警） */
    mediaSecOver?: boolean;
  };
}

interface CompileResult { prompt: string; mode: string; chars: number; warnings: string[]; plan: RenderPlan }

interface JobLite {
  id: string; status: string; error?: string | null;
  outputs?: { rel?: string; path?: string; role?: string }[];
}

const MODES = [
  { value: 'ref2va', label: 'Ref2VA · 全参考（有参考图时用这个）' },
  { value: 'fl2va', label: 'FL2VA · 首尾帧' },
  { value: 'i2va', label: 'I2VA · 首帧' },
  { value: 't2va', label: 'T2VA · 纯文本' },
];

/**
 * 走位可用动作 —— 必须与 host/store/models.js 的 ACTIONS 白名单一致。
 * 不一致的后果：前端能选、后端会被 normalizeActors 静默改成 stand，
 * 表现为"选了半天动作没生效"。
 */
const ACTOR_ACTIONS = [
  'stand', 'wait', 'idle-breathe', 'turn',
  'walk', 'fast-walk', 'run', 'follow', 'pass-by', 'dodge', 'step-forward', 'step-back',
  'look-up', 'look-down', 'look-at', 'look-back', 'glance', 'inspect',
  'speak', 'listen', 'nod', 'shake-head', 'face-to-face', 'hand-over', 'receive',
  'reach', 'hold', 'pick-up', 'put-down', 'point', 'wave', 'raise-hand',
  'clap', 'knock', 'phone', 'drink',
  'sit', 'stand-up', 'crouch', 'kneel', 'lie-down', 'fall', 'get-up',
  'bow', 'cross-arms', 'hands-on-hips',
  'hesitate', 'hug',
  'read', 'write', 'sew', 'open-door', 'close-door', 'push', 'pull',
  'enter-car', 'exit-car',
];

const SOURCE_LABEL: Record<string, string> = {
  'card-sheet': '角色设定卡',
  'card-origin': '角色原立绘',
  manual: '手工参考',
  'previz-first': '预演首帧',
  'previz-last': '预演尾帧',
  scene: '场景/道具',
};

/* ------------------------------------------------------------------ 页面 */

export function RenderPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'shot' | 'film'>('shot');

  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const profileOptions = useProjectStore((s) => s.profileOptions);

  /* 素材 */
  const [cards, setCards] = useState<VaultCardLite[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [pickedVideos, setPickedVideos] = useState<MediaPick[]>([]);
  const [pickedAudios, setPickedAudios] = useState<MediaPick[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category: string; content: string }>>([]);
  const [pickedCards, setPickedCards] = useState<string[]>([]);
  const [styles, setStyles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  /* 计划与编译 */
  const [plan, setPlan] = useState<RenderPlan | null>(null);
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [error, setError] = useState('');

  /* 参数 */
  const [mode, setMode] = useState('ref2va');
  const [styleId, setStyleId] = useState('ghibli');
  const [durationSec, setDurationSec] = useState('5');
  const [ratio, setRatio] = useState('16:9');
  const [profile, setProfile] = useState('P24-quality');
  const [seed, setSeed] = useState('');
  const [summary, setSummary] = useState('');
  const [shotAction, setShotAction] = useState('');
  const [soundscape, setSoundscape] = useState('');
  const [music, setMusic] = useState('N/A');
  const [customStyle, setCustomStyle] = useState('');
  const [refImageSize, setRefImageSize] = useState<'match' | 'max'>('match');

  /* 控制视频（H3 Fun ControlNet Union）—— 锁空间结构与时间推进 */
  const [controlRel, setControlRel] = useState('');
  const [controlStrength, setControlStrength] = useState('1.0');
  const [controlStart, setControlStart] = useState('0.0');
  const [controlEnd, setControlEnd] = useState('0.8');
  const [blenderBusy, setBlenderBusy] = useState('');
  const [blenderMsg, setBlenderMsg] = useState('');

  /* 3D 走位（Blender 渲染的输入）
     ⚠️ 坐标系 (x, y=高度, z=深度) —— 与预演引擎一致；后端转 Blender Z-up。
     没有这些数据时 Blender 只能渲"默认两人对峙"，等于没用。 */
  const [actors, setActors] = useState<ShotActor[]>([]);
  const [stagingOpen, setStagingOpen] = useState(false);
  /* 3D 资产库 + 每个模型内置的动作（懒加载：选模型时才启 Blender 读） */
  const [modelAssets, setModelAssets] = useState<ModelAsset[]>([]);
  const [assetActions, setAssetActions] = useState<Record<string, AssetAction[]>>({});

  /* 提示词编辑器（可折叠） */
  const [editorOpen, setEditorOpen] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [useManualPrompt, setUseManualPrompt] = useState(false);

  /* 渲染 */
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobLite | null>(null);
  const pollRef = useRef<number | null>(null);

  /* ------------------------------------------------------------ 载入 */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, meta, as, tpl, asts] = await Promise.all([
        api.vaultCards(),
        api.promptMeta(),
        api.listAssets({}),
        api.toolboxTemplates(),
        // 3D 资产库拿不到不影响渲染，单独 catch 掉
        api.blenderAssets().catch(() => ({ assets: [] })),
      ]);
      setCards(cs as VaultCardLite[]);
      setAssets((as as AssetItem[]).filter((x) => x.rel));
      setTemplates((tpl as Array<{ id: string; name: string; category: string; content: string }>) ?? []);
      const m = meta as { styles?: Array<{ id: string; name: string }> };
      setStyles(m.styles ?? []);
      setModelAssets((asts as { assets?: ModelAsset[] })?.assets ?? []);
      if (!projects.length) await loadProjects();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [loadProjects, projects.length]);

  useEffect(() => { void load(); }, [load]);

  /* 项目切换时，带上项目绑定的角色卡 */
  useEffect(() => {
    if (!currentProjectId) return;
    void (async () => {
      try {
        const bound = await api.projectCards(currentProjectId) as { cardIds?: string[] };
        if (bound.cardIds?.length) setPickedCards(bound.cardIds);
      } catch { /* ignore */ }
    })();
  }, [currentProjectId]);

  /* ------------------------------------------------------ 计划 / 编译 */

  const refreshPlan = useCallback(async () => {
    try {
      const p = await api.renderPlan({
        cardIds: pickedCards,
        videos: pickedVideos.map((v) => ({ rel: v.rel, name: v.name, hasAudio: v.hasAudio !== false })),
        audios: pickedAudios.map((a) => ({ rel: a.rel, name: a.name })),
        refImageSize,
      }) as RenderPlan;
      setPlan(p);
      // 模式跟着计划推荐（用户手动改过就不覆盖）
      return p;
    } catch (e) {
      setError(describeError(e));
      return null;
    }
  }, [pickedCards, pickedVideos, pickedAudios, refImageSize]);

  useEffect(() => { void refreshPlan(); }, [refreshPlan]);

  const recompile = useCallback(async () => {
    try {
      const r = await api.renderCompile({
        cardIds: pickedCards,
        videos: pickedVideos.map((v) => ({ rel: v.rel, name: v.name, hasAudio: v.hasAudio !== false })),
        audios: pickedAudios.map((a) => ({ rel: a.rel, name: a.name })),
        refImageSize,
        mode,
        styleId,
        durationSec: Number(durationSec) || 5,
        ratio,
        summary,
        sceneLayout: shotAction,
        ...(soundscape.trim() ? { overall_soundscape: soundscape.trim() } : {}),
        ...(music.trim() && music !== 'N/A' ? { non_diegetic_music: music.trim() } : {}),
        ...(customStyle.trim() ? { styleEn: customStyle.trim() } : {}),
      }) as CompileResult;
      setCompiled(r);
      setError('');
    } catch (e) {
      setError(describeError(e));
    }
  }, [pickedCards, pickedVideos, pickedAudios, refImageSize, mode, styleId, durationSec, ratio, summary, shotAction, soundscape, music, customStyle]);

  useEffect(() => { void recompile(); }, [recompile]);

  /* --------------------------------------------------------- 渲染 */

  const stopPolling = () => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => stopPolling, []);

  /**
   * 用 Blender 现渲一路控制序列。
   *
   * 渲完直接写进 controlRel —— 用户的心智是"给我一个控制视频"，
   * 而不是"先去别的页面渲染，回来再选文件"。
   *
   * 实测耗时：124 帧 @864×480 约 20 秒（H3 本身要 3—4 分钟）。
   */
  /* ---------------------------- 走位编辑 ---------------------------- */

  function addActor() {
    const n = actors.length;
    setActors([...actors, {
      name: `角色${n + 1}`,
      heightM: 1.7,
      color: '#e1e3e7',
      // 加人时左右均匀排开，避免全叠在原点（叠在一起等于只有一个人）
      position: [n === 0 ? -0.6 : n * 0.6 - 0.6, 0, 0],
      rotationDeg: 0,
      action: 'stand',
      startFrame: 0,
      emotion: 'neutral',
      intensity: 1,
    }]);
    setStagingOpen(true);
  }

  function removeActor(i: number) {
    setActors(actors.filter((_, k) => k !== i));
  }

  function updateActor(i: number, patch: Partial<ShotActor>) {
    setActors(actors.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  }

  function updateActorPos(i: number, axis: 0 | 1 | 2, value: number) {
    setActors(actors.map((a, k) => {
      if (k !== i) return a;
      const pos = [...a.position] as [number, number, number];
      pos[axis] = value;
      return { ...a, position: pos };
    }));
  }

  /**
   * 选模型时顺带把它的动作列出来。
   *
   * 为什么要现读：Mixamo 导出的 Action 名是 `Armature|Armature|walk` 这种，
   * 用户不可能猜得到；与其让人试错，不如真启一次 Blender 读出来（1—3 秒）。
   */
  async function pickActorAsset(i: number, rel: string) {
    updateActor(i, { assetRel: rel || undefined, action: rel ? '' : 'stand' });
    if (!rel || assetActions[rel]) return;
    try {
      const r = await api.blenderActions(rel);
      setAssetActions((prev) => ({ ...prev, [rel]: r.actions }));
      if (r.actions.length === 1) {
        // 只有一个动作时直接选上——少一次点击，也避免用户忘了选
        updateActor(i, { action: r.actions[0].name });
      }
    } catch (e) {
      toast.error(`读动作失败：${describeError(e)}`);
    }
  }

  async function renderWithBlender(mode: string) {    if (!currentProjectId) { toast.error('先选一个项目'); return; }
    setBlenderBusy(mode);
    setBlenderMsg('');
    try {
      // 先把当前参数存成镜头卡 —— Blender 从镜头卡读 durationSec / ratio / actors
      const saved = await api.saveShot(currentProjectId, {
        title: summary.slice(0, 40) || `镜头 ${new Date().toLocaleTimeString('zh-CN')}`,
        durationSec: Number(durationSec) || 5,
        ratio,
        profile,
        backend: 'h3-local',
        mode,
        refImageSize,
        description: [summary, shotAction].filter(Boolean).join('。'),
        cardIds: pickedCards,
        ...(actors.length ? { actors } : {}),
      } as never) as { id?: string };
      if (!saved?.id) throw new Error('镜头卡保存失败');

      const r = await api.blenderRender({ mode, projectId: currentProjectId, shotId: saved.id });
      setControlRel(r.rel);
      setBlenderMsg(`已生成 ${r.frames} 帧 / ${r.seconds}s → ${r.rel}`);
      toast.ok(`控制视频就绪（${r.seconds}s）`);
    } catch (e) {
      const msg = describeError(e);
      setBlenderMsg(msg);
      toast.error(msg);
    } finally {
      setBlenderBusy('');
    }
  }

  async function doRender() {
    if (!currentProjectId) { toast.error('先选一个项目'); return; }
    setBusy(true);
    setError('');
    try {
      // 手工编辑过的提示词必须**随镜头卡一起存**。
      //
      // 为什么：`manualPrompt` 原先只活在本地 state 里，`saveShot` 不传 `prompt`，
      // 生成时后端拿镜头卡重新 `compilePrompt(shot)` → 用户在编辑器里写的东西
      // **完全被丢掉**，而且没有任何提示（实测：填入 2151 字手写提示词，
      // 送进模型的却是 1134 字的自动编译版，摘要退化成"一段戏"）。
      const manual = useManualPrompt ? manualPrompt.trim() : '';
      // 1) 先把当前配置存成镜头卡（渲染以镜头卡为单位）
      const saved = await api.saveShot(currentProjectId, {
        title: summary.slice(0, 40) || `镜头 ${new Date().toLocaleTimeString('zh-CN')}`,
        durationSec: Number(durationSec) || 5,
        ratio,
        profile,
        backend: 'h3-local',
        mode,
        refImageSize,
        description: [summary, shotAction].filter(Boolean).join('。'),
        // 手工提示词优先；后端 compilePrompt 会优先用 shot.prompt
        ...(manual ? { prompt: manual } : {}),
        // 角色卡通过 cardIds 传，后端解析成图与文字
        cardIds: pickedCards,
        refs: {
          images: [],
          videos: pickedVideos.map((v) => ({ rel: v.rel, name: v.name, hasAudio: v.hasAudio !== false })),
          audios: pickedAudios.map((a) => ({ rel: a.rel, name: a.name })),
        },
        // 控制视频：只传 rel，后端 resolveControl 统一收敛强度/区间
        control: controlRel
          ? {
            videoRel: controlRel,
            strength: Number(controlStrength) || 1,
            startPercent: Number(controlStart) || 0,
            endPercent: Number(controlEnd) || 0.8,
          }
          : null,
        // 走位：有才传，没配就不覆盖已有数据
        ...(actors.length ? { actors } : {}),
      } as never) as { id?: string };

      if (!saved?.id) throw new Error('镜头卡保存失败');

      // 2) 提交
      const j = await api.generate({
        projectId: currentProjectId,
        shotId: saved.id,
        backend: 'h3-local',
        ...(seed.trim() ? { seed: Number(seed) } : {}),
      } as never) as JobLite;

      setJob(j);
      toast.ok(`已提交 ${String(j.id).slice(0, 12)}…`);

      // 3) 轮询
      stopPolling();
      pollRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const list = await api.listJobs() as JobLite[];
            const cur = list.find((x) => x.id === j.id);
            if (!cur) return;
            setJob({ ...cur });
            if (['completed', 'failed', 'cancelled'].includes(cur.status)) {
              stopPolling();
              setBusy(false);
              if (cur.status === 'completed') toast.ok('渲染完成');
              else toast.error(cur.error || `渲染${cur.status}`);
            }
          } catch { /* 网络抖动不中断 */ }
        })();
      }, 4000);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------ 视图 */

  const previewUrl = useMemo(() => {
    const out = job?.outputs?.[0];
    if (!out) return '';
    return outputUrl(out);
  }, [job]);

  const budget = plan?.stats;
  const over = Boolean(budget && budget.total > budget.limit);
  // 参考视频 + 音频的合计时长预算（后端上限 14.8s，超了会自动裁剪并告警）
  const mediaSec = budget?.mediaSec ?? 0;
  const mediaLimit = budget?.mediaSecLimit ?? 14.8;
  const mediaOver = Boolean(budget?.mediaSecOver);
  const mediaTone = mediaOver ? 'danger' : (mediaLimit - mediaSec) <= 1.5 ? 'warn' : 'ok';

  if (loading) return <Page title="渲染"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="渲染"
      subtitle="选素材 → 编译提示词 → 渲染 → 预览，一条镜头在这里做完"
      actions={
        <>
          <Tabs<'shot' | 'film'>
            items={[
              { value: 'shot', label: '单镜头渲染' },
              { value: 'film', label: '成片合成' },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="渲染模式"
          />
          <Badge tone={over ? 'danger' : (budget?.remaining ?? 9) <= 1 ? 'warn' : 'ok'}>
            参考图 {budget?.total ?? 0}/{budget?.limit ?? 9}
          </Badge>
          <Badge tone={mediaTone}>
            音视频 {mediaSec.toFixed(1)}/{mediaLimit}s
          </Badge>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          {tab === 'shot' ? (
            <Button variant="primary" icon={<Icon name="video" size={15} />} onClick={() => void doRender()} disabled={busy}>
              {busy ? '渲染中…' : '开始渲染'}
            </Button>
          ) : null}
        </>
      }
    >
      {tab === 'film' ? (
        <FilmComposer />
      ) : (
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {(plan?.warnings ?? []).map((w, i) => (
          <Alert key={i} tone="warn">{w}</Alert>
        ))}

        {/* 顶栏：项目 / 镜头描述 */}
        <Panel title="镜头">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 'var(--jz-sp-3)' }}>
            <Field label="项目">
              <Select<string>
                value={currentProjectId ?? ''}
                onChange={(v) => { void selectProject(v); }}
                options={[
                  { value: '', label: projects.length ? '请选择…' : '（还没有项目）' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>
            <Field label="画面概要" hint="一句话说清这一镜拍什么">
              <Input value={summary} onChange={(e) => setSummary(e.target.value)}
                placeholder="两人在夜晚天台并肩而立" />
            </Field>
            <Field label="动作 / 运镜">
              <Input value={shotAction} onChange={(e) => setShotAction(e.target.value)}
                placeholder="中景缓慢推进，微风吹动发丝" />
            </Field>
          </div>
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 'var(--jz-sp-4)', alignItems: 'start' }}>
          {/* ---------------- 左：素材 ---------------- */}
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title={`角色卡（已选 ${pickedCards.length}）`}>
              {cards.length === 0 ? (
                <div className="jz-sm jz-muted">仓库里还没有角色卡。</div>
              ) : (
                <div className="jz-col" style={{ gap: 6, maxHeight: 320, overflow: 'auto' }}>
                  {cards.map((c) => {
                    const on = pickedCards.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPickedCards((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                        className="jz-card"
                        style={{
                          padding: '7px 9px', textAlign: 'left', cursor: 'pointer',
                          borderColor: on ? 'var(--jz-accent)' : undefined,
                          borderWidth: on ? 2 : 1,
                        }}
                      >
                        <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                          <b className="jz-truncate jz-sm">{c.name}</b>
                          {on ? <Badge tone="ok">✓</Badge> : <Badge>{c.imageCount} 图</Badge>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="参考图清单">
              {!plan || plan.images.length === 0 ? (
                <div className="jz-sm jz-muted">还没有参考图。</div>
              ) : (
                <div className="jz-col" style={{ gap: 4 }}>
                  {plan.images.map((im) => (
                    <div key={`${im.index}-${im.rel}`} className="jz-row" style={{ gap: 6, justifyContent: 'space-between' }}>
                      <span className="jz-xs jz-mono">P{im.index}</span>
                      <span className="jz-xs jz-truncate" style={{ flex: 1 }}>
                        {im.cardName ? `${im.cardName} · ${SOURCE_LABEL[im.source] ?? im.source}` : (SOURCE_LABEL[im.source] ?? im.source)}
                      </span>
                    </div>
                  ))}
                  <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
                    这些图会按顺序上传，提示词里的 &lt;Picture N&gt; 就指它们。
                  </div>
                </div>
              )}
            </Panel>

            {/* 参考视频 / 音频 —— 来自素材库，按 H3 的四类参考输入组织 */}
            <MediaPicker
              assets={assets}
              videos={pickedVideos}
              audios={pickedAudios}
              onVideos={setPickedVideos}
              onAudios={setPickedAudios}
            />
          </div>

          {/* ---------------- 中：预览 ---------------- */}
          <Panel title={job ? `渲染结果 · ${job.status}` : '预览'}>
            {previewUrl ? (
              <div className="jz-col" style={{ gap: 8 }}>
                {job?.outputs?.[0]?.role === 'video' ? (
                  <video src={previewUrl} controls style={{ width: '100%', borderRadius: 6 }} />
                ) : (
                  <img src={previewUrl} alt="渲染结果" style={{ width: '100%', borderRadius: 6 }} />
                )}
                <div className="jz-row" style={{ gap: 8 }}>
                  <a href={previewUrl} download className="jz-sm">下载</a>
                  <span className="jz-xs jz-muted">{job?.outputs?.[0]?.rel}</span>
                </div>
              </div>
            ) : busy ? (
              <div className="jz-col" style={{ alignItems: 'center', gap: 10, padding: 60 }}>
                <Icon name="video" size={40} />
                <div className="jz-muted">渲染中…（5 秒片约 2—6 分钟）</div>
                <div className="jz-xs jz-mono">{job?.id?.slice(0, 20)}…</div>
              </div>
            ) : (
              <div className="jz-col" style={{ alignItems: 'center', gap: 10, padding: 60 }}>
                <Icon name="video" size={40} />
                <div className="jz-muted">选好素材与参数，点「开始渲染」。</div>
              </div>
            )}
          </Panel>

          {/* ---------------- 右：参数 ---------------- */}
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title="参数">
              <Field label="模式">
                <Select<string> value={mode} onChange={setMode} options={MODES} />
              </Field>
              <Field label="画风">
                <Select<string>
                  value={styleId}
                  onChange={setStyleId}
                  options={styles.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <Field label="时长（秒）">
                <Input value={durationSec} onChange={(e) => setDurationSec(e.target.value)} mono />
              </Field>
              <Field label="画幅">
                <Select<string>
                  value={ratio}
                  onChange={setRatio}
                  options={['16:9', '9:16', '1:1', '4:3', '3:4'].map((v) => ({ value: v, label: v }))}
                />
              </Field>
              <Field label="档位">
                <Select<string>
                  value={profile}
                  onChange={setProfile}
                  options={profileOptions()}
                />
              </Field>
              <Field label="种子（留空随机）">
                <Input value={seed} onChange={(e) => setSeed(e.target.value)} mono />
              </Field>
              <Field label="参考图保真" hint="max 一致性更好但明显更慢；12G 显存谨慎使用">
                <Select<'match' | 'max'>
                  value={refImageSize}
                  onChange={setRefImageSize}
                  options={[
                    { value: 'match', label: '跟随生成面积（快）' },
                    { value: 'max', label: '最高保真（慢）' },
                  ]}
                />
              </Field>
              <Field label="环境声" hint="H3 要求这一项不能为空">
                <Input value={soundscape} onChange={(e) => setSoundscape(e.target.value)}
                  placeholder="雨声、远处车流、轻柔空气声" />
              </Field>
              <Field label="配乐（留空=无）">
                <Input value={music} onChange={(e) => setMusic(e.target.value)} placeholder="N/A" />
              </Field>
              <Field label="自定义画风（英文，覆盖画风选择）">
                <Input value={customStyle} onChange={(e) => setCustomStyle(e.target.value)}
                  placeholder="90s OVA, cel animation, high saturation" />
              </Field>
            </Panel>

            {/* 3D 走位 —— Blender 渲染的输入
                没有这块数据时 Blender 只能渲"默认两人对峙"，等于没用。
                坐标系 (x, y=高度, z=深度)；单位米。 */}
            <Panel
              title={`3D 走位（${actors.length} 人）`}
              actions={(
                <Button onClick={() => setStagingOpen((v) => !v)}>
                  {stagingOpen ? '收起' : '编辑'}
                </Button>
              )}
            >
              {!actors.length ? (
                <div className="jz-xs jz-muted">
                  还没配走位。Blender 渲控制视频时会用「默认两人对峙」占位——
                  那只能验证链路，不能当真实预演。点「编辑」加角色。
                </div>
              ) : (
                <div className="jz-col" style={{ gap: 6 }}>
                  {actors.map((a, i) => (
                    <div key={i} className="jz-row" style={{ gap: 6, justifyContent: 'space-between' }}>
                      <span className="jz-sm">
                        {a.name} · {a.heightM}m · {a.action}
                      </span>
                      <span className="jz-xs jz-muted jz-mono">
                        [{a.position.map((v) => v.toFixed(1)).join(', ')}]
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {stagingOpen ? (
                <div className="jz-col" style={{ gap: 10, marginTop: 10 }}>
                  {actors.map((a, i) => (
                    <div key={i} className="jz-card" style={{ padding: 8 }}>
                      <div className="jz-row" style={{ gap: 6, marginBottom: 6 }}>
                        <Input
                          value={a.name}
                          onChange={(e) => updateActor(i, { name: e.target.value })}
                          placeholder="角色名"
                        />
                        <Button variant="danger" onClick={() => removeActor(i)}>删除</Button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 6 }}>
                        <Field label="身高(m)">
                          <Input value={String(a.heightM)} mono
                            onChange={(e) => updateActor(i, { heightM: Number(e.target.value) || 1.72 })} />
                        </Field>
                        <Field label="动作">
                          <Select<string>
                            value={a.action}
                            onChange={(v) => updateActor(i, { action: v })}
                            options={ACTOR_ACTIONS.map((v) => ({ value: v, label: v }))}
                          />
                        </Field>
                        <Field label="X（左右）">
                          <Input value={String(a.position[0])} mono
                            onChange={(e) => updateActorPos(i, 0, Number(e.target.value) || 0)} />
                        </Field>
                        <Field label="Y（高度）">
                          <Input value={String(a.position[1])} mono
                            onChange={(e) => updateActorPos(i, 1, Number(e.target.value) || 0)} />
                        </Field>
                        <Field label="Z（深度）">
                          <Input value={String(a.position[2])} mono
                            onChange={(e) => updateActorPos(i, 2, Number(e.target.value) || 0)} />
                        </Field>
                      </div>
                      {/* 导入模型（glb/fbx）—— 选中后替换程序化人偶。
                          选了模型之后，「动作」下拉会切到该模型自带的动作列表
                          （Mixamo 的 Action 名是 Armature|Armature|walk 这种，
                           不给用户看名字就只能靠猜）。 */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 6, marginTop: 6 }}>
                        <Field label="模型（可选）" hint="选 glb/fbx 后用它代替程序化人偶">
                          <Select<string>
                            value={a.assetRel ?? ''}
                            onChange={(v) => void pickActorAsset(i, v)}
                            options={[
                              { value: '', label: '（程序化人偶）' },
                              ...modelAssets.map((m) => ({ value: m.rel, label: m.name })),
                            ]}
                          />
                        </Field>
                        {a.assetRel ? (
                          <Field label="模型动作" hint="导入模型自带的 Action">
                            <Select<string>
                              value={a.action}
                              onChange={(v) => updateActor(i, { action: v })}
                              options={[
                                { value: '', label: '（不播放动作）' },
                                ...(assetActions[a.assetRel] ?? []).map((x) => ({
                                  value: x.name,
                                  label: `${x.name} (${x.durationFrames}f)`,
                                })),
                              ]}
                            />
                          </Field>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <Button onClick={addActor}>＋ 加一个角色</Button>
                </div>
              ) : null}
            </Panel>

            {/* 控制视频 —— H3 Fun ControlNet Union
                与「参考视频」的区别：参考视频只是让模型"参考"运镜，
                控制视频是逐帧约束结构（深度/姿态/边缘），会真的跟着走。
                实测见 docs/probes/h3-controlnet-2026-11-14/ */}
            <Panel title="控制视频（结构约束）">
              <Field label="控制视频" hint="留空=不启用。选中素材库里的视频，通常由 Blender/预演导出的 depth/pose 序列">
                <Select<string>
                  value={controlRel}
                  onChange={setControlRel}
                  options={[
                    { value: '', label: '（不启用）' },
                    ...assets
                      .filter((a) => /\.(mp4|webm|mov)$/i.test(a.rel ?? ''))
                      .map((a) => ({ value: a.rel ?? '', label: a.name })),
                  ]}
                />
              </Field>

              {/* 用 Blender 现渲一路控制序列。
                  为什么放在这里：用户的心智是"给我一个控制视频"，
                  而不是"先去另一个页面渲染，再回来选文件"。 */}
              <div className="jz-row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span className="jz-xs jz-muted">用 Blender 现渲：</span>
                {['depth', 'pose', 'canny', 'gray'].map((m) => (
                  <Button
                    key={m}
                    disabled={Boolean(blenderBusy)}
                    onClick={() => void renderWithBlender(m)}
                  >
                    {blenderBusy === m ? '渲染中…' : m}
                  </Button>
                ))}
              </div>
              {blenderMsg ? <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>{blenderMsg}</div> : null}

              {controlRel ? (
                <>
                  <Field label="控制强度" hint="1.0 起调；画面发僵往下调，控制不住往上调">
                    <Input value={controlStrength} onChange={(e) => setControlStrength(e.target.value)} mono />
                  </Field>
                  <Field label="生效区间（去噪百分比）" hint="0—0.8 = 前 80% 受控，尾部留给模型补细节">
                    <div className="jz-row" style={{ gap: 6 }}>
                      <Input value={controlStart} onChange={(e) => setControlStart(e.target.value)} mono />
                      <span className="jz-muted">→</span>
                      <Input value={controlEnd} onChange={(e) => setControlEnd(e.target.value)} mono />
                    </div>
                  </Field>
                  <div className="jz-xs jz-muted">
                    控制视频会逐帧约束结构与运动；提示词请描述**画面里真实存在的东西**
                    （人数、主要道具、机位方向），否则前几秒会被提示词抢走。
                  </div>
                </>
              ) : null}
            </Panel>

            <Panel title="预算">
              {budget ? (
                <KeyValue rows={[
                  { key: '角色卡', value: `${budget.cardsWithImage} 张有图` },
                  { key: '参考图合计', value: `${budget.total} / ${budget.limit}` },
                  { key: '剩余名额', value: String(budget.remaining) },
                  {
                    key: '保真档位',
                    value: plan?.refImageSizeDowngraded
                      ? `已降级（请求 ${plan.refImageSizeRequested}）`
                      : (plan?.refImageSize ?? 'match'),
                  },
                  ...(budget.cardsWithoutImage ? [{ key: '无图角色', value: String(budget.cardsWithoutImage) }] : []),
                ]} />
              ) : <div className="jz-sm jz-muted">—</div>}
            </Panel>
          </div>
        </div>

        {/* ---------------- 底部：提示词编辑器 ---------------- */}
        <Panel title={`提示词 ${compiled ? `（${compiled.chars} 字）` : ''}`}>
          <div className="jz-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="jz-row" style={{ gap: 8 }}>
              <Badge tone="ok">{compiled?.mode ?? mode}</Badge>
              {(compiled?.warnings ?? []).length ? <Badge tone="warn">{compiled?.warnings.length} 条警告</Badge> : null}
            </div>
            <Button onClick={() => setEditorOpen((v) => !v)}>
              {editorOpen ? '收起' : '展开编辑'}
            </Button>
          </div>

          {editorOpen ? (
            <div className="jz-col" style={{ gap: 8 }}>
              <div className="jz-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={() => setUseManualPrompt(false)}>用自动编译</Button>
                <Button onClick={() => { setManualPrompt(compiled?.prompt ?? ''); setUseManualPrompt(true); }}>
                  改为手工编辑
                </Button>
                {/* 提示词模板：原来只在「工具箱」里存着，没人消费。这里接上。
                    模板是"写作指导"，套用时插到光标处/末尾，不是覆盖全部。 */}
                <Select<string>
                  value=""
                  onChange={(id) => {
                    const tpl = templates.find((t) => t.id === id);
                    if (!tpl) return;
                    const cur = useManualPrompt ? manualPrompt : (compiled?.prompt ?? '');
                    setManualPrompt(`${cur}\n\n${tpl.content}`.trim());
                    setUseManualPrompt(true);
                  }}
                  options={[
                    { value: '', label: `套用模板…（${templates.length}）` },
                    ...templates.map((t) => ({ value: t.id, label: `${t.category} · ${t.name}` })),
                  ]}
                />
              </div>
              <Textarea
                value={useManualPrompt ? manualPrompt : (compiled?.prompt ?? '')}
                onChange={(e) => { setManualPrompt(e.target.value); setUseManualPrompt(true); }}
                rows={16}
              />
              <div className="jz-xs jz-muted">
                自动编译已把角色卡的文字设定填进 subject_definitions，
                并用真实编号引用 &lt;Picture N&gt;。手工修改会覆盖这些。
              </div>
            </div>
          ) : (
            <pre className="jz-mono jz-xs" style={{
              whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto',
              background: 'var(--jz-bg-sunken)', padding: 10, borderRadius: 6, lineHeight: 1.7,
            }}>{compiled?.prompt ?? '（编译中…）'}</pre>
          )}

          {(compiled?.warnings ?? []).length ? (
            <div style={{ marginTop: 8 }}>
              {compiled?.warnings.map((w, i) => <div key={i} className="jz-xs" style={{ color: 'var(--jz-warn-text)' }}>· {w}</div>)}
            </div>
          ) : null}
        </Panel>
      </div>
      )}
    </Page>
  );
}

/* ========================================================================== */
/* 成片合成 —— 把多条已生成的分段视频拼成一条                        */
/* ========================================================================== */

/**
 * 原来挂在「H3 工坊」页里的一个 tab。
 * 它做的是 ffmpeg concat + 可选字幕烧录，属于**后处理**，
 * 和"写提示词→渲染"不是一回事，但下游就在渲染之后，放同一页最顺手。
 */
function FilmComposer() {
  const toast = useToast();
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const [status, setStatus] = useState<{ status: string; progress: number; message: string; ffmpeg: string; output?: string } | null>(null);
  const [inputs, setInputs] = useState('');
  const [output, setOutput] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  /* 素材来源：项目已完成任务的视频产物（自动归档后可直接用） */
  const [candidates, setCandidates] = useState<Array<{ rel: string; name: string; at: number }>>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loadingCand, setLoadingCand] = useState(false);

  useEffect(() => {
    void api.h3FilmStatus()
      .then((s) => setStatus(s as never))
      .catch(() => setStatus(null));
    if (!projects.length) void loadProjects();
  }, [loadProjects, projects.length]);

  /** 拉取本项目的视频产物 + 素材库里的视频 */
  useEffect(() => {
    if (!currentProjectId) { setCandidates([]); return; }
    setLoadingCand(true);
    void (async () => {
      try {
        const [jobs, assets] = await Promise.all([
          api.listJobs(),
          api.listAssets({ projectId: currentProjectId }),
        ]);
        const out: Array<{ rel: string; name: string; at: number }> = [];
        // 1) 本项目任务产物
        for (const j of (jobs as Array<{ projectId?: string; status?: string; updatedAt?: number; outputs?: { rel?: string; role?: string }[] }>)) {
          if (j.projectId !== currentProjectId) continue;
          if (j.status !== 'completed') continue;
          for (const o of (j.outputs ?? [])) {
            if (o?.rel && (o.role === 'video' || /\.(mp4|webm|mov)$/i.test(o.rel))) {
              out.push({ rel: o.rel, name: o.rel.split('/').pop() ?? o.rel, at: j.updatedAt ?? 0 });
            }
          }
        }
        // 2) 素材库里的视频
        for (const a of (assets as Array<{ rel?: string; name?: string; kind?: string }>)) {
          if (a.kind === 'video' && a.rel && !out.some((x) => x.rel === a.rel)) {
            out.push({ rel: a.rel, name: a.name ?? a.rel, at: 0 });
          }
        }
        out.sort((x, y) => x.at - y.at);
        setCandidates(out);
      } catch { /* ignore */ } finally { setLoadingCand(false); }
    })();
  }, [currentProjectId]);

  /* 手工填的路径（保留，用于外部文件） */
  const manualList = inputs.split('\n').map((s) => s.trim()).filter(Boolean);

  async function run() {
    setErr('');
    // 勾选的按顺序 + 手工填的（绝对路径）
    const list = [
      ...picked,
      ...manualList,
    ];
    if (!list.length) { setErr('至少勾选或填写一个视频'); return; }
    setBusy(true);
    try {
      const r = await api.h3FilmRender({
        inputs: list,
        ...(output.trim() ? { output: output.trim() } : {}),
        ...(subtitle.trim() ? { subtitleFile: subtitle.trim() } : {}),
      }) as { message?: string };
      toast.ok(r.message || '已提交');
      const s = await api.h3FilmStatus();
      setStatus(s as never);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...picked];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setPicked(next);
  }

  return (
    <div className="jz-split">
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        <Panel title="选择片段">
          <Field label="项目">
            <Select<string>
              value={currentProjectId ?? ''}
              onChange={(v) => { void selectProject(v); setPicked([]); }}
              options={[
                { value: '', label: projects.length ? '请选择…' : '（还没有项目）' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Field>

          <div className="jz-xs jz-muted" style={{ margin: '8px 0' }}>
            可用片段（项目已完成任务的视频 + 素材库视频）。
            {loadingCand ? ' 载入中…' : ` 共 ${candidates.length} 段。`}
          </div>

          <div className="jz-col" style={{ gap: 4, maxHeight: 220, overflow: 'auto' }}>
            {candidates.map((c) => {
              const on = picked.includes(c.rel);
              return (
                <button
                  key={c.rel}
                  type="button"
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.rel) : [...p, c.rel]))}
                  className="jz-card"
                  style={{
                    padding: '5px 8px', textAlign: 'left', cursor: 'pointer',
                    borderColor: on ? 'var(--jz-accent)' : undefined,
                    borderWidth: on ? 2 : 1,
                  }}
                >
                  <span className="jz-xs jz-truncate">{c.name}</span>
                </button>
              );
            })}
            {!candidates.length && !loadingCand ? (
              <div className="jz-sm jz-muted">这个项目还没有已完成的视频。</div>
            ) : null}
          </div>

          {picked.length ? (
            <div style={{ marginTop: 10 }}>
              <div className="jz-xs jz-muted" style={{ marginBottom: 4 }}>拼接顺序：</div>
              {picked.map((rel, i) => (
                <div key={rel} className="jz-row" style={{ gap: 6, justifyContent: 'space-between' }}>
                  <span className="jz-xs jz-truncate" style={{ flex: 1 }}>{i + 1}. {rel.split('/').pop()}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1}>↓</button>
                  <button type="button" onClick={() => setPicked((p) => p.filter((x) => x !== rel))}>×</button>
                </div>
              ))}
            </div>
          ) : null}

          <Field label="额外文件（可选，每行一个绝对路径）">
            <Textarea value={inputs} onChange={(e) => setInputs(e.target.value)} mono rows={3}
              placeholder={'F:\\…\\外部片段.mp4'} />
          </Field>
        </Panel>
      </div>

      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        <Panel title="输出">
          <Field label="输出文件名">
            <Input value={output} onChange={(e) => setOutput(e.target.value)} placeholder="film.mp4" />
          </Field>
          <Field label="字幕文件（.srt，可选）">
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} mono />
          </Field>
          {err ? <Alert tone="danger">{err}</Alert> : null}
          <Button variant="primary" block loading={busy} onClick={() => void run()} disabled={busy}>
            {busy ? '合成中…' : `合成 ${picked.length + manualList.length} 段`}
          </Button>
        </Panel>

        <Panel title="状态">
          {status ? (
            <KeyValue rows={[
              { key: 'ffmpeg', value: status.ffmpeg === 'ready' ? '就绪' : '缺失' },
              { key: '状态', value: status.status },
              { key: '进度', value: `${status.progress}%` },
              ...(status.message ? [{ key: '消息', value: status.message }] : []),
              ...(status.output ? [{ key: '输出', value: status.output }] : []),
            ]} />
          ) : <div className="jz-sm jz-muted">—</div>}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 参考视频 / 音频选择器                                                       */
/* ========================================================================== */

/**
 * 从素材库勾选参考视频与音频。
 *
 * H3 的参考输入有四类（见 docs/H3参考输入契约.md）：
 *   ref_images / ref_videos / ref_video_audios / ref_audios
 *
 * 这里的"视频自带音轨"开关很重要：开了它，这段视频的音轨会占用一个
 * `<Audio>` 编号，后面独立音频的编号会顺延。关掉则不占用。
 */
function MediaPicker({
  assets, videos, audios, onVideos, onAudios,
}: {
  assets: AssetItem[];
  videos: MediaPick[];
  audios: MediaPick[];
  onVideos: (v: MediaPick[]) => void;
  onAudios: (v: MediaPick[]) => void;
}) {
  const videoAssets = assets.filter((a) => a.kind === 'video');
  const audioAssets = assets.filter((a) => a.kind === 'audio');

  const toggle = (list: MediaPick[], set: (v: MediaPick[]) => void, a: AssetItem) => {
    const rel = a.rel ?? '';
    if (!rel) return;
    if (list.some((x) => x.rel === rel)) set(list.filter((x) => x.rel !== rel));
    else if (list.length >= 3) return;   // H3 上限 3
    else set([...list, { rel, name: a.name, hasAudio: true }]);
  };

  return (
    <>
      <Panel title={`参考视频（${videos.length}/3）`}>
        {videoAssets.length === 0 ? (
          <div className="jz-sm jz-muted">素材库里没有视频。先用「素材库」上传，或从画布/渲染页生成后自动归档。</div>
        ) : (
          <div className="jz-col" style={{ gap: 6 }}>
            {videoAssets.map((a) => {
              const hit = videos.find((v) => v.rel === a.rel);
              const on = Boolean(hit);
              return (
                <div key={a.id} className="jz-col" style={{ gap: 3 }}>
                  <button
                    type="button"
                    onClick={() => toggle(videos, onVideos, a)}
                    className="jz-card"
                    style={{
                      padding: '6px 8px', textAlign: 'left', cursor: 'pointer',
                      borderColor: on ? 'var(--jz-accent)' : undefined,
                      borderWidth: on ? 2 : 1,
                    }}
                  >
                    <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                      <b className="jz-xs jz-truncate">{a.name}</b>
                      {on ? <Badge tone="ok">V{videos.findIndex((v) => v.rel === a.rel) + 1}</Badge> : null}
                    </div>
                  </button>
                  {on ? (
                    <label className="jz-xs jz-muted" style={{ marginLeft: 8 }}>
                      <input
                        type="checkbox"
                        checked={hit?.hasAudio !== false}
                        onChange={(e) => onVideos(videos.map((v) => (
                          v.rel === a.rel ? { ...v, hasAudio: e.target.checked } : v
                        )))}
                      />{' '}
                      带上音轨（会占用一个 &lt;Audio&gt; 编号）
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title={`参考音频（${audios.length}/3）`}>
        {audioAssets.length === 0 ? (
          <div className="jz-sm jz-muted">素材库里没有音频。</div>
        ) : (
          <div className="jz-col" style={{ gap: 6 }}>
            {audioAssets.map((a) => {
              const on = audios.some((x) => x.rel === a.rel);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(audios, onAudios, a)}
                  className="jz-card"
                  style={{
                    padding: '6px 8px', textAlign: 'left', cursor: 'pointer',
                    borderColor: on ? 'var(--jz-accent)' : undefined,
                    borderWidth: on ? 2 : 1,
                  }}
                >
                  <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                    <b className="jz-xs jz-truncate">{a.name}</b>
                    {on ? <Badge tone="ok">已选</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
          音频用于音色/氛围参考。注意：视频音轨会先占 &lt;Audio&gt; 编号，独立音频顺延。
        </div>
      </Panel>
    </>
  );
}

export default RenderPage;
