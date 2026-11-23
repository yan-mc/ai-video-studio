/**
 * 渲染页 —— 南风 V15 驱动的渲染台。
 *
 * ============================================================================
 * 由南风 V15 驱动：217 个参数（12 组折叠）+ 7 个预设 + 二采 + 跨镜头续写。
 * 旧的固定 30 参数 / h3.json 模板替换实现已在 2.0.0 移除。
 *
 * ============================================================================
 * 布局
 * ============================================================================
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ 顶栏：项目 / 预设 / [开始渲染]                              │
 *   ├──────────────┬──────────────────────────┬──────────────────┤
 *   │ 左：素材      │ 中：提示词 + 概览         │ 右：参数面板      │
 *   │ · 角色卡      │                          │ · 搜索框          │
 *   │ · 参考图×9    │                          │ · A 核心          │
 *   │ · 视频×3      │                          │ · B 素材          │
 *   │ · 音频×3      │                          │ · C 模式          │
 *   │              │                          │ · D 二次采样      │
 *   │              │                          │ · E-L（折叠）     │
 *   └──────────────┴──────────────────────────┴──────────────────┘
 *
 * 每个参数都带一句话中文说明；「死参数/缺依赖参数」默认折叠，
 * 组头显示被隐藏的数量。另有「参数速查」抽屉可全局搜索。
 *
 * @module pages/RenderPage
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, describeError } from '../api/client';
import { subscribeEvents, useStudioEventsConnected } from '../api/events';
import { Alert, Badge, Button, Field, Input, Page, Panel, Select, Spinner, useToast } from '../ui';
import { useProjectStore } from '../store/project';
import {
  NanfengParams, ParamReference,
  type GroupDef, type ParamDef,
} from '../components/NanfengParams';
import { AssetPicker, type AssetItem, type PickedMedia } from '../components/AssetPicker';
import { ContinuationPanel } from '../components/ContinuationPanel';
import { LoraPicker, type LoraChoice } from '../components/LoraPicker';

/** 生成模式 */
const MODES: Array<{ id: string; label: string }> = [
  { id: 'ref2va', label: 'Ref2VA（参考图/视频/音频）' },
  { id: 'i2va', label: 'I2VA（图生视频）' },
  { id: 'fl2va', label: 'FL2VA（首尾帧）' },
  { id: 't2va', label: 'T2VA（文生视频）' },
];

/**
 * 镜头卡（本页用到的最小子集）。
 *
 * ⚠️ 以前这里只有 6 个字段，而 handleRender 会提交 10 多个 —— 于是"回填"只能
 *    覆盖其中两个，其余字段在切换镜头时保持上一个镜头的值，最终被静默写进
 *    新镜头卡。现在把这个类型补齐到与实际提交形状一致；新增提交字段时
 *    必须同步加在这里（否则 tsc 会在回填处报错，这正是我们想要的护栏）。
 */
interface ShotLite {
  id: string;
  title?: string;
  durationSec?: number;
  ratio?: string;
  mode?: string;
  updatedAt?: number;
  /** 编译后的提示词 */
  prompt?: string;
  /** 老镜头卡只有 description（就是提示词原文） */
  description?: string;
  styleId?: string;
  lightingId?: string;
  accelPlan?: string;
  refs?: { images?: string[]; videos?: string[]; audios?: string[] };
  nanfeng?: {
    presets?: string | { inherit?: string; chain?: string[]; overrides?: Record<string, unknown> };
    overrides?: Record<string, unknown>;
  };
}

interface SchemaPayload {
  paramCount: number;
  groups: Record<string, GroupDef>;
  params: Record<string, ParamDef>;
  /** 死参数/禁用参数清单 */
  inert?: Array<{ name: string; flag: string; zh: string; hint: string }>;
}

export function RenderPage() {
  const toast = useToast();
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  // ---- 后端元信息 ----
  const [schema, setSchema] = useState<SchemaPayload | null>(null);
  const [presets, setPresets] = useState<Array<{ id: string; label: string; desc: string }>>([]);
  const [styles, setStyles] = useState<Array<{ id: string; name: string; category: string; changesAppearance: boolean }>>([]);
  const [lightings, setLightings] = useState<Array<{ id: string; name: string; ratio: string | null; zh: string }>>([]);
  const [accelPlans, setAccelPlans] = useState<Array<{ id: string; label: string; steps: number; lora: string | null; hint: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---- 表单状态 ----
  const [presetId, setPresetId] = useState('standard');
  const [mode, setMode] = useState('ref2va');
  const [prompt, setPrompt] = useState('');
  const [durationSec, setDurationSec] = useState('5');
  const [seed, setSeed] = useState('');
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [loras, setLoras] = useState<LoraChoice[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ---- 画风 / 打光 / 加速（正交通道）----
  /**
   * 画风默认值是 `none`（不指定），不是 ova90s。
   *
   * 理由：默认塞一个画风串会让"用画风 LoRA"这条正常路径必然冲突 ——
   * 用户选了 claymation LoRA，提示词里还带着 90 年代 OVA 的整串描述，
   * 两个通道互相拉扯。默认不指定，需要时再挑，才是正确默认。
   */
  const [styleId, setStyleId] = useState('none');
  const [lightingId, setLightingId] = useState('none');
  const [accelPlanId, setAccelPlanId] = useState('dmad8');

  // ---- 素材 ----
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [images, setImages] = useState<PickedMedia[]>([]);
  const [videos, setVideos] = useState<PickedMedia[]>([]);
  const [audios, setAudios] = useState<PickedMedia[]>([]);

  // ---- 镜头 ----
  const [shots, setShots] = useState<ShotLite[]>([]);
  const [shotId, setShotId] = useState('');
  /** SSE 连接状态：必须用响应式 hook，否则徽章永远显示离线 */
  const eventsAlive = useStudioEventsConnected();

  // ---- 参数面板 ----
  const [paramFilter, setParamFilter] = useState('');
  const [showReference, setShowReference] = useState(false);

  /* ------------------------------ 初始化 ------------------------------ */

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [sch, pre, pm] = await Promise.all([
          api.nanfengSchema(),
          api.nanfengPresets(),
          api.promptMeta() as unknown as Promise<{
            styles?: Array<{ id: string; name: string; category: string; changesAppearance: boolean }>;
            lightings?: Array<{ id: string; name: string; ratio: string | null; zh: string }>;
          }>,
        ]);
        if (cancelled) return;
        setSchema(sch as unknown as SchemaPayload);
        setPresets(pre.presets);
        setPresetId(pre.default || 'standard');
        // 打光 / 加速方案随预设接口一起下发
        const preAny = pre as unknown as {
          accelPlans?: Array<{ id: string; label: string; steps: number; lora: string | null; hint: string }>;
        };
        if (Array.isArray(preAny.accelPlans)) {
          setAccelPlans(preAny.accelPlans);
          const def = preAny.accelPlans.find((p) => p.id === 'dmad8');
          if (def) setAccelPlanId(def.id);
        }
        if (Array.isArray(pm.styles) && pm.styles.length) setStyles(pm.styles);
        if (Array.isArray(pm.lightings) && pm.lightings.length) setLightings(pm.lightings);
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * 镜头列表。
   *
   * ⚠️⚠️ 历史 P0（本次修复）：`loadShots` 曾经**无条件**把 shotId 设为
   *      `updatedAt` 最新的那个镜头。
   *
   *      用户正在编辑镜头 A（较早）→ DSH Agent 改了镜头 B →
   *      SSE `shot-updated` → `loadShots()` → shotId 被改成 B →
   *      回填 effect 把 B 的字段灌进表单 → 用户以为还在编辑 A，
   *      下一次点「渲染」就把 B 的内容写进 A（或反向），**输入被静默回滚**。
   *
   * 现在：默认**保留当前选中镜头**，只有三种情况才切换 ——
   *   ① 还没有选中（首次进入 / 新建项目）
   *   ② 当前选中的镜头已经不存在了（被删）
   *   ③ 显式传 `preferId`（保存后要跳到刚保存的那张）
   */
  const loadShots = useCallback(async (pid: string, opts: { preferId?: string } = {}) => {
    if (!pid) { setShots([]); setShotId(''); return; }
    try {
      const list = (await api.listShots(pid)) as unknown as ShotLite[];
      const sorted = (Array.isArray(list) ? list : []).slice().sort(
        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
      );
      setShots(sorted);
      setShotId((prev) => {
        const wanted = opts.preferId ?? prev;
        if (wanted && sorted.some((s) => s.id === wanted)) return wanted;
        return sorted[0]?.id ?? '';
      });
    } catch {
      setShots([]);
      setShotId('');
    }
  }, []);

  useEffect(() => {
    void loadShots(currentProjectId ?? '');
  }, [currentProjectId, loadShots]);

  /** 加载素材库 */
  const loadAssets = useCallback(async () => {
    try {
      const list = (await api.listAssets({})) as unknown as AssetItem[];
      setAssets(Array.isArray(list) ? list : []);
    } catch {
      setAssets([]);
    }
  }, []);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  /**
   * 订阅服务端事件。
   *
   * 关键场景：DSH Agent 调 studio_shot 改了镜头卡 → 后端广播 shot-updated
   * → 这里收到后重新拉镜头列表 → 用户界面上立刻看到 Agent 改了什么。
   *
   * 这是本项目的核心交互：**Agent 和浏览器操作同一份状态**。
   */
  useEffect(() => {
    const off = subscribeEvents((e) => {
      if (e.type === 'shot-updated' && e.projectId === currentProjectId) {
        void loadShots(currentProjectId ?? '');
      }
    });
    return off;
  }, [currentProjectId, loadShots]);

  /**
   * 选中镜头时把它的**全部可编辑字段**回填到表单。
   *
   * ⚠️ 这里必须回填所有会在 handleRender 里被写回镜头卡的字段。
   *    历史缺陷：只回填了 durationSec / mode，提示词、素材、画风、打光、
   *    加速方案、预设都还停在上一个镜头 —— 用户从下拉切到镜头 B 后看到的是
   *    A 的提示词，点「渲染」就把 A 的提示词静默写进 B 的镜头卡，
   *    A 的素材也一起搬过去了。数据被覆盖且没有任何提示。
   *
   *    规则：**凡是 handleRender 提交的字段，这里都要回填**。
   *    新增字段时两边一起改（同一个对象形状）。
   */
  useEffect(() => {
    if (!shotId) return;
    const s = shots.find((x) => x.id === shotId);
    if (!s) return;

    if (typeof s.durationSec === 'number') setDurationSec(String(s.durationSec));
    if (s.mode) setMode(s.mode);

    // 提示词/描述：优先 prompt，回退 description（老镜头卡只有 description）
    setPrompt(s.prompt || s.description || '');

    // 画风 / 打光 / 加速方案
    if (s.styleId) setStyleId(s.styleId);
    if (s.lightingId) setLightingId(s.lightingId);
    if (s.accelPlan) setAccelPlanId(s.accelPlan);

    // 素材：必须是全量替换，不能沿用上一个镜头的选择
    const asPicked = (rel: string): PickedMedia => ({
      rel,
      name: rel.split('/').pop() ?? rel,
    });
    setImages((s.refs?.images ?? []).map(asPicked));
    setVideos((s.refs?.videos ?? []).map(asPicked));
    setAudios((s.refs?.audios ?? []).map(asPicked));

    // 南风预设 + 单镜覆盖
    const nf = (s as {
      nanfeng?: {
        presets?: unknown;
        overrides?: Record<string, unknown>;
        loras?: LoraChoice[];
      };
    }).nanfeng;
    if (typeof nf?.presets === 'string') setPresetId(nf.presets);
    setOverrides(nf?.overrides && typeof nf.overrides === 'object' ? nf.overrides : {});
    // LoRA 栈跟着镜头卡走 —— 换镜头要看到那个镜头自己的选择
    setLoras(Array.isArray(nf?.loras) ? nf.loras : []);
  }, [shotId]);   // ⚠️ 不能加 shots：否则任何列表刷新都会把用户正在输入的内容回滚

  /* ------------------------------ 计算 ------------------------------ */

  // 当前生效参数 = schema 默认 + 覆盖
  const effectiveValues = useMemo(() => {
    const base: Record<string, unknown> = {};
    if (schema) {
      for (const [k, d] of Object.entries(schema.params)) base[k] = d.default;
    }
    return { ...base, ...overrides };
  }, [schema, overrides]);

  // 已改数量（只统计真正有效、且与默认不同的）
  const changedTotal = useMemo(() => {
    let n = 0;
    for (const [k, v] of Object.entries(overrides)) {
      const d = schema?.params[k];
      if (!d) continue;
      if (v === d.default) continue;
      if (d.flag) continue;      // 死参数不算"已改"
      n += 1;
    }
    return n;
  }, [overrides, schema]);

  const setParam = useCallback((key: string, value: unknown) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ------------------------------ 提交 ------------------------------ */

  const handleRender = useCallback(async () => {
    if (!currentProjectId) { toast.error('先选一个项目'); return; }
    setSubmitting(true);
    try {
      // 1) 先把当前表单存成镜头卡（保留 id 复用）
      const saved = await api.saveShot(currentProjectId, {
        ...(shotId ? { id: shotId } : {}),
        title: prompt.slice(0, 40) || `镜头 ${new Date().toLocaleTimeString('zh-CN')}`,
        durationSec: Number(durationSec) || 5,
        mode,
        description: prompt,
        // 画风 / 打光是正交通道，写进镜头卡后编译提示词时会带上
        styleId,
        lightingId,
        // 加速方案写进镜头卡 → runH3Nanfeng 据此填 LoRA / 采样器 / 步数
        accelPlan: accelPlanId,
        refs: {
          images: images.map((m) => m.rel),
          videos: videos.map((m) => m.rel),
          audios: audios.map((m) => m.rel),
        },
        nanfeng: {
          presets: presetId,
          overrides,
          // LoRA 栈随镜头卡一起存：换镜头能恢复、生成时按分类求解
          loras,
        },
      });

      if (!saved?.id) throw new Error('镜头卡保存失败');
      setShotId(String(saved.id));

      // 2) 提交生成
      //
      // ⚠️ 不写 `as never`：GenerateInput 是真实契约，类型对不上就该让 tsc 报错。
      //    否则字段名写错（例如 backend 拼成 backendId）会一路无声无息地
      //    被后端按默认值处理，用户只看到"设置了但没生效"。
      const job = await api.generate({
        projectId: currentProjectId,
        shotId: String(saved.id),
        backend: 'h3-nanfeng',
        ...(seed ? { seed: Number(seed) } : {}),
      });

      toast.ok(`已提交（任务 ${String(job.id).slice(0, 8)}）`);
      // 保存后显式跳到刚保存的那张（而不是让 loadShots 猜）
      void loadShots(currentProjectId, { preferId: String(saved.id) });
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setSubmitting(false);
    }
  }, [currentProjectId, shotId, prompt, durationSec, mode, images, videos, audios, presetId, overrides, loras, seed, toast, loadShots, styleId, lightingId, accelPlanId]);

  /* ------------------------------ 渲染 ------------------------------ */

  if (loading) {
    return (
      <Page title="渲染">
        <Spinner />
      </Page>
    );
  }

  const inertCount = schema?.inert?.length ?? 0;

  return (
    <Page
      title="渲染"
      subtitle={`南风 V15 · ${schema?.paramCount ?? 0} 个参数 · ${presets.length} 个预设`}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* 顶栏 */}
      <Panel flush tight>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', padding: 12 }}>
          <Field label="项目">
            <Select
              value={currentProjectId ?? ''}
              onChange={(v) => selectProject(v || null)}
              options={[
                { value: '', label: '（未选择）' },
                ...projects.map((p) => ({ value: p.id, label: p.name ?? p.id })),
              ]}
            />
          </Field>
          <Field label="预设">
            <Select
              value={presetId}
              onChange={setPresetId}
              options={presets.map((p) => ({ value: p.id, label: p.label }))}
            />
          </Field>
          <Field label="模式">
            <Select value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} />
          </Field>
          <Field label="画风">
            <Select
              value={styleId}
              onChange={setStyleId}
              options={styles.map((s) => ({ value: s.id, label: `${s.name}（${s.category}）` }))}
            />
          </Field>
          <Field label="打光（光比）">
            <Select
              value={lightingId}
              onChange={setLightingId}
              options={lightings.map((l) => ({
                value: l.id,
                label: l.ratio ? `${l.name} · ${l.ratio}` : l.name,
              }))}
            />
          </Field>
          <Field label="加速">
            <Select
              value={accelPlanId}
              onChange={setAccelPlanId}
              options={accelPlans.map((p) => ({
                value: p.id,
                label: p.lora ? `${p.label} · ${p.steps}步` : p.label,
              }))}
            />
          </Field>
          <Field label="时长（秒）">
            <Input
              type="number"
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              mono
            />
          </Field>
          <Field label="种子（留空随机）">
            <Input value={seed} onChange={(e) => setSeed(e.target.value)} mono />
          </Field>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={eventsAlive ? 'ok' : 'default'}>
              {eventsAlive ? '实时同步' : '离线'}
            </Badge>
            {changedTotal > 0 ? <Badge tone="accent">已改 {changedTotal} 项</Badge> : null}
            <Button onClick={() => void handleRender()} disabled={submitting}>
              {submitting ? '提交中…' : '开始渲染'}
            </Button>
          </div>
        </div>
      </Panel>

      {/* 三栏 */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 420px', gap: 12 }}>
        {/* 左：素材 */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Panel title="镜头" tight>
            <div style={{ display: 'grid', gap: 8 }}>
              <Select
                value={shotId}
                onChange={setShotId}
                options={[
                  { value: '', label: '（新建镜头）' },
                  ...shots.map((s) => ({
                    value: s.id,
                    label: s.title || s.id,
                  })),
                ]}
              />
              <div className="jz-xs jz-muted">共 {shots.length} 个镜头</div>
            </div>
          </Panel>

          <AssetPicker
            assets={assets}
            images={images}
            videos={videos}
            audios={audios}
            onImages={setImages}
            onVideos={setVideos}
            onAudios={setAudios}
            onRefresh={() => void loadAssets()}
          />
        </div>

        {/* 中：提示词 */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Panel title="提示词">
            <textarea
              className="jz-input"
              rows={14}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={'[Shot 1] 00:00.000，[景别] [主体]，[动作]。The camera [运镜]…'}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Panel>

          <Panel title="将提交的参数" tight>
            <div className="jz-xs jz-muted" style={{ lineHeight: 1.8 }}>
              预设：<b>{presets.find((p) => p.id === presetId)?.label ?? presetId}</b>
              <br />
              画风：<b>{styles.find((s) => s.id === styleId)?.name ?? styleId}</b>
              {' · '}
              打光：<b>{lightings.find((l) => l.id === lightingId)?.name ?? '不指定'}</b>
              <br />
              加速：<b>{accelPlans.find((p) => p.id === accelPlanId)?.label ?? accelPlanId}</b>
              {(() => {
                const a = accelPlans.find((p) => p.id === accelPlanId);
                if (!a) return null;
                return a.lora
                  ? `（${a.steps} 步 · ${a.lora.replace(/\.safetensors$/, '')}）`
                  : `（${a.steps} 步 · 无 LoRA）`;
              })()}
              <br />
              二采：
              <b>{effectiveValues['启用H3潜空间放大二采'] ? '开' : '关'}</b>
              {effectiveValues['启用H3潜空间放大二采']
                ? `（${String(effectiveValues['H3一采步数'])}步 → ${String(effectiveValues['H3潜空间目标百万像素'])}MP → ${String(effectiveValues['H3二采步数'])}步）`
                : ''}
              <br />
              采样：{String(effectiveValues['采样器'])} + {String(effectiveValues['调度器'])} ·{' '}
              {String(effectiveValues['采样步数'])} 步
              <br />
              画布：{String(effectiveValues['百万像素'])} MP · {String(effectiveValues['画面比例'])}
            </div>
          </Panel>

          {/* LoRA 选择器：按功能分类选，单选类自动替换，多挂类自动衰减 */}
          <LoraPicker value={loras} onChange={setLoras} maxSlots={8} />

          {/*
            ⚠️ 画风冲突提示。
            画风有两条通道：内置画风串（提示词）和画风 LoRA（权重）。
            同时开会让模型收到两个矛盾的美学指令，产出"两边都不像"的中间态。
            这里不强行改用户的选择，但必须让他看见。
          */}
          {styleId !== 'none' && loras.some((l) => /[\\/]30_style[\\/]/.test(l.name)) ? (
            <Alert tone="warn">
              已选内置画风「{styles.find((s) => s.id === styleId)?.name ?? styleId}」，
              同时挂了画风 LoRA。两者会互相拉扯 ——
              建议把画风改成「不指定（交给 LoRA）」，让权重决定风格。
            </Alert>
          ) : null}

          <ContinuationPanel
            projectId={currentProjectId}
            shots={shots}
            onSubmitted={() => void loadShots(currentProjectId ?? '')}
          />

          {inertCount > 0 ? (
            <Panel title="参数说明" tight>
              <div className="jz-xs jz-muted" style={{ lineHeight: 1.7 }}>
                南风 V15 的 217 个参数里，有 <b>{inertCount}</b> 个在本版本上
                <b>不产生任何效果</b>或<b>缺少依赖会直接报错</b>（已在上游源码核实）。
                它们默认折叠，可在右侧面板勾选「显示无效参数」查看。
                <br />
                典型代表：<code>启用高清二采</code>（上游硬编码 False）、
                <code>启用双采样</code>（分支写死）、
                <code>启用H3 SLA</code> / <code>启用RTX视频超分</code> / <code>启用TRT视频VAE</code>
                （本机缺插件）。
                <br />
                真正管画质的是 <b>H3 潜空间放大二采</b>（一采 → 潜空间放大 → 二采）。
              </div>
            </Panel>
          ) : null}
        </div>

        {/* 右：参数面板 */}
        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
          <Panel tight>
            <div style={{ display: 'grid', gap: 8 }}>
              <Input
                placeholder="搜索参数名 / 说明，例如「二采」「注意力」「LoRA」"
                value={paramFilter}
                onChange={(e) => setParamFilter(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="ghost"
                  onClick={() => setShowReference((v) => !v)}
                >
                  {showReference ? '收起参数速查' : '参数速查表'}
                </Button>
                {paramFilter ? (
                  <Button variant="ghost" onClick={() => setParamFilter('')}>清空搜索</Button>
                ) : null}
              </div>
            </div>
          </Panel>

          {showReference && schema ? (
            <Panel title="参数速查表" tight>
              <ParamReference params={schema.params} groups={schema.groups} />
            </Panel>
          ) : null}

          {schema ? (
            <NanfengParams
              params={schema.params}
              groups={schema.groups}
              values={effectiveValues}
              onChange={setParam}
              filter={paramFilter}
            />
          ) : null}
        </div>
      </div>
    </Page>
  );
}

export default RenderPage;
