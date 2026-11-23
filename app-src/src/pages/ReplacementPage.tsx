/**
 * 角色替换（换人）页 —— 与「渲染」页平行、互不干扰。
 *
 * ============================================================================
 * 为什么不复用渲染页
 * ============================================================================
 *
 * 渲染页是给「从零生成一个镜头」用的：项目 → 镜头卡 → 角色卡 → 221 参数。
 * 换人任务是另一个形状：**一段源视频 + 若干张目标角色图**，其余全部继承源视频。
 *
 * 硬要合在一起，会撞上 `resolveRefImages` 的优先级（角色卡 > 手工图）——
 * 项目里绑着的卡会**顶掉**用户选的参考图，`<Picture 1>` 指向另一个人。
 * 这在换人里是致命的，而且不报错。所以这一页：
 *
 *   · 不读项目、不读镜头卡、不读角色卡
 *   · 素材只来自素材库（图片 + 视频）
 *   · 参考图编号 **= 选择顺序**，所见即所得，中间没有任何插队逻辑
 *   · 参数独立成一份，与渲染页的 config 默认值互不影响
 *
 * ============================================================================
 * 长视频
 * ============================================================================
 *
 * 选择视频后立刻调 `/replace/plan`，把"会切成几段、每段多长"直接显示出来。
 * 超过 `segmentSec`（默认 10s）自动分段，逐段重绘后无损拼接。
 *
 * @module pages/ReplacementPage
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, describeError } from '../api/client';
import { LoraPicker } from '../components/LoraPicker';
import type { LoraChoice } from '../components/LoraPicker';
import {
  Alert, Badge, Button, EmptyState, Field, Input, Panel, Page, Select,
  Spinner, Textarea, useToast, formatRelativeTime,
} from '../ui';

/* --------------------------------------------------------------- 类型 */

interface ReplaceMeta {
  defaults: Record<string, unknown>;
  promptFields: Array<{
    key: string; label: string; hint: string; example: string;
    required: boolean; multiline?: boolean;
  }>;
  presets: Array<{ id: string; label: string; desc: string }>;
  styles: Array<{ id: string; name: string; category: string }>;
  lightings: Array<{ id: string; name: string; ratio: string | null; zh: string }>;
  /**
   * `stepsRange` 存在 = 该方案的步数**用户可调**（目前只有 `none`）。
   * 蒸馏学生没有这个字段：它的步数是训练配置，改了就是分布外。
   */
  accelPlans: Array<{
    id: string;
    label: string;
    steps: number;
    stepsRange?: { min: number; max: number; step: number };
    hint: string;
    isDefault: boolean;
  }>;
  contextLengths: Array<{ id: string; label: string; seg: number }>;
  limits: { segmentSec: number; maxSourceSec: number; maxSegments: number; refImages: number };
}

/** LoRA 选择项类型从 LoraPicker 组件导入（与渲染页共用同一份契约） */

interface PlanSegment {
  index: number;
  startSec: number;
  durationSec: number;
  /** 续写模式才有：采完裁掉重叠后的真实交付时长 */
  deliverSec?: number;
  requestSec?: number;
  overlapSec?: number;
}

interface Plan {
  durationSec: number;
  hasAudio: boolean;
  width: number;
  height: number;
  fps: number;
  segments: PlanSegment[];
  warnings: string[];
  /** independent | continuation */
  mode?: string;
  contextLength?: string;
  trimFrames?: number;
  overlapSec?: number;
  plannedTotalSec?: number;
}

interface RefPick { rel: string; name: string }

interface SegmentState extends PlanSegment {
  status: string;
  outputRel: string | null;
}

interface ReplaceTask {
  id: string;
  title: string;
  status: string;
  sourceRel: string;
  durationSec: number;
  segmentSec: number;
  /** independent | continuation */
  mode?: string;
  continuation?: boolean;
  contextLength?: string | null;
  trimFrames?: number | null;
  overlapSec?: number | null;
  segments: SegmentState[];
  prompt: string;
  finalRel: string | null;
  error: string | null;
  warnings: string[];
  createdAt: number;
  updatedAt: number;
  refImages: Array<{ rel: string; pictureIndex: number }>;
}

interface AssetRow { id: string; rel: string; name?: string; kind?: string; type?: string }

/* ------------------------------------------------------- 素材选择器 */

function MediaPicker({
  kind, value, onChange, multiple, label,
}: {
  kind: 'image' | 'video';
  value: RefPick[];
  onChange: (next: RefPick[]) => void;
  multiple: boolean;
  label: string;
}) {
  const [list, setList] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rows = (await api.listAssets({})) as unknown as AssetRow[];
        if (!alive) return;
        setList(
          (Array.isArray(rows) ? rows : []).filter((a) => {
            if (a.kind) return a.kind === kind;
            const re = kind === 'image' ? /\.(png|jpe?g|webp|bmp)$/i : /\.(mp4|webm|mov|m4v)$/i;
            return re.test(a.rel ?? '');
          }),
        );
      } catch {
        if (alive) setList([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kind]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return list;
    return list.filter((a) => (a.rel ?? '').toLowerCase().includes(k) || (a.name ?? '').toLowerCase().includes(k));
  }, [list, q]);

  const picked = new Set(value.map((v) => v.rel));

  const toggle = (row: AssetRow) => {
    const rel = row.rel;
    const item: RefPick = { rel, name: row.name || rel.split('/').pop() || rel };
    if (picked.has(rel)) {
      onChange(value.filter((v) => v.rel !== rel));
      return;
    }
    onChange(multiple ? [...value, item] : [item]);
  };

  return (
    <div className="jz-col" style={{ gap: 6 }}>
      <div className="jz-row" style={{ gap: 6 }}>
        <Input
          value={q}
          onChange={(e) => setQ((e.target as HTMLInputElement).value)}
          placeholder={kind === 'image' ? '搜索图片…' : '搜索视频…'}
        />
        {value.length && multiple ? <Badge tone="accent">已选 {value.length}</Badge> : null}
      </div>
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="jz-xs jz-muted">素材库里没有{kind === 'image' ? '图片' : '视频'}。</div>
      ) : (
        <div
          className="jz-col"
          style={{
            gap: 4, maxHeight: kind === 'image' ? 260 : 160, overflow: 'auto',
            border: '1px solid var(--jz-border)', borderRadius: 8, padding: 6,
          }}
        >
          {filtered.map((a) => {
            const on = picked.has(a.rel);
            const idx = value.findIndex((v) => v.rel === a.rel);
            return (
              <button
                key={a.id ?? a.rel}
                type="button"
                className="jz-btn jz-btn--sm"
                onClick={() => toggle(a)}
                title={a.rel}
                style={{
                  opacity: on ? 1 : 0.62,
                  borderColor: on ? 'var(--jz-accent)' : undefined,
                  textAlign: 'left',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                {on ? <Badge tone="accent">{multiple ? `Picture ${idx + 1}` : '✓'}</Badge> : null}
                <span className="jz-truncate" style={{ flex: '1 1 auto' }}>
                  {a.name || a.rel.split('/').pop()}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="jz-xs jz-muted">
        {label}
        {multiple ? '（选择顺序 = <Picture N> 编号）' : ''}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- 主页面 */

export function ReplacementPage() {
  const toast = useToast();

  const [meta, setMeta] = useState<ReplaceMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 输入
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<RefPick[]>([]);
  const [refs, setRefs] = useState<RefPick[]>([]);

  /**
   * 提示词 —— **唯一的一个可编辑框**。
   *
   * 早先拆成「原角色特征 / 目标角色特征 / 分段动作 / 附加约束」四个输入框，
   * 由后端拼装。问题是它只能表达**一对一替换**：
   *   · 两个角色互相替换 → 表达不了
   *   · 配角保持不动、只换主角 → 表达不了
   *   · 某个角色只在某几段出现 → 表达不了
   *   想加一条约束就得回头改代码。
   *
   * 现在直接给一段改得动的文本：打开就有填好的模板，
   * `<Picture N>` 的编号与参考图选择顺序一一对应，加一行就是多一个人。
   * 用户不改就用模板（与以前的行为一致），改了就以他写的为准（整段替换）。
   */
  const [promptText, setPromptText] = useState('');
  /**
   * 编译相关状态。
   *
   * `compileWarnings` 是**必须显示**的 —— 翻译失败时退回规则版本，
   * 用户看到的提示词是中文的，不告诉他原因会以为是 bug。
   */
  const [compiling, setCompiling] = useState(false);
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [llmStatus, setLlmStatus] = useState<{ usable: boolean; hint: string } | null>(null);
  /**
   * 编译结果预览（**不自动应用**）。
   *
   * 存 `from` 是为了检测"用户在看预览期间又改了输入框"——
   * 那种情况下预览已经过期，应用会把他新的改动冲掉。
   */
  const [compiled, setCompiled] = useState<{ from: string; to: string; translated: boolean } | null>(null);
  /** 模板原文，用于"恢复默认"和判断用户是否改过 */
  const [promptTemplate, setPromptTemplate] = useState('');

  // LoRA（与渲染页同一套分类/强度语义，但**独立选择**，不影响渲染页）
  const [loraChoices, setLoraChoices] = useState<LoraChoice[]>([]);

  // 参数
  const [segmentSec, setSegmentSec] = useState(4);
  const [accelPlan, setAccelPlan] = useState('dmad8');
  const [preset, setPreset] = useState('draft');
  const [styleId, setStyleId] = useState('none');
  const [lightingId, setLightingId] = useState('none');
  const [steps, setSteps] = useState('8');
  /**
   * 用户是否**手动改过**步数。
   *
   * ⚠️ 这是步数联动的关键状态。
   *
   * 切加速方案时必须把步数换成该方案的推荐值（`none` = 50 步、
   * `dmad8` = 8 步、`dmad4` = 4 步），否则会「不加速却只跑 8 步」——
   * 不报错、不告警，但出片是废的：8 步是给蒸馏学生用的极短轨迹，
   * 原模型在 8 步下去噪根本不够。
   *
   * 但用户如果主动填了步数（比如 20），再切方案就不该覆盖他的输入。
   * 所以用这个标志区分「跟随方案」和「用户指定」：
   *   · 没改过 → 切方案自动同步推荐步数
   *   · 改过   → 保持用户值，只显示「与方案不匹配」的提示
   */
  const [stepsTouched, setStepsTouched] = useState(false);
  const [megapixels, setMegapixels] = useState('0.6');
  const [denoise, setDenoise] = useState('1');
  const [seed, setSeed] = useState('1101');
  const [secondPass, setSecondPass] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  /** 续写链：段间用真实 AV latent 衔接（默认开） */
  const [useContinuation, setUseContinuation] = useState(true);
  /**
   * 重叠窗口默认 22（0.92s），不是 56。
   *
   * 56 帧会在 30s/6 段时占掉目标片段 32%~45% 的帧数 —— 那些帧会被
   * 「上一段实际生成的内容」（含源角色残留）作为关键帧钉住，
   * 参考图压不过张量条件，于是身份漂移。窗口越长漂得越重。
   */
  const [contextLength, setContextLength] = useState('22');
  /**
   * 上下文加噪 —— 抗身份漂移的核心。
   *
   * 干净的上下文会让模型原样拷贝上一段的外观（连源角色残留一起），
   * 而换人要求脸必须变。加噪把外观损坏掉、运动留下来，
   * 逼模型从身份参考重新合成。机制见 vendor/nanfeng/context_taper_noise.py。
   */
  const [taperEnabled, setTaperEnabled] = useState(true);
  const [taperAlpha, setTaperAlpha] = useState('0.45');
  const [taperAlphaEnd, setTaperAlphaEnd] = useState('0.10');

  // 派生
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);

  // 任务
  const [tasks, setTasks] = useState<ReplaceTask[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<ReplaceTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  /* ---------------------------- 初始化 ---------------------------- */

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const m = (await api.replaceMeta()) as unknown as ReplaceMeta;
        if (!alive) return;
        setMeta(m);
        const d = m.defaults ?? {};
        setSegmentSec(Number(d.segmentSec) || 4);
        setAccelPlan(String(d.accelPlan ?? 'dmad8'));
        setPreset(String(d.preset ?? 'draft'));
        setStyleId(String(d.styleId ?? 'none'));
        setLightingId(String(d.lightingId ?? 'none'));
        setSteps(String(d.steps ?? 8));
        setMegapixels(String(d.megapixels ?? 0.6));
        setDenoise(String(d.denoise ?? 1));
        setSecondPass(Boolean(d.secondPass));
        setUseContinuation(d.continuation !== false);
        setContextLength(String(d.contextLength ?? '22'));
      } catch (e) {
        if (alive) setError(describeError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /**
   * 加速方案 → 步数联动。
   *
   * ============================================================================
   * 为什么必须联动
   * ============================================================================
   *
   * 三个方案的推荐步数差了一个数量级：
   *   dmad8 → 8 步（蒸馏学生，8 步就是它的训练设定）
   *   dmad4 → 4 步（同上）
   *   none  → 50 步（**原模型**，不加速时 steps 就是实际去噪迭代次数）
   *
   * 早先 steps 写死初始值 '8'，于是选 `none`（不加速）后仍然只跑 8 步 ——
   * 后端 `checkSteps()` 对 `none` 不做校验（它只校验蒸馏学生），
   * 所以**不报错、不告警，直接出一个模糊废片**。这是本次要修的根因。
   *
   * 策略：
   *   · 用户没手动改过步数 → 切方案时自动跟随推荐值
   *   · 用户改过              → 尊重用户输入，只在下方显示不匹配提示
   */
  useEffect(() => {
    if (stepsTouched) return;
    const plan = (meta?.accelPlans ?? []).find((p) => p.id === accelPlan);
    if (plan && Number(plan.steps) > 0) {
      setSteps(String(plan.steps));
    }
  }, [accelPlan, meta, stepsTouched]);

  /**
   * 当前方案的步数配置，以及「填的值是否合适」。
   *
   * ==========================================================================
   * 两种方案，两套规则
   * ==========================================================================
   *
   * ① **蒸馏学生**（dmad8 / dmad4）：步数是训练设定，不是可调参数。
   *    偏离推荐值属于「分布外」—— 能跑，质量下滑，但不会出废片。
   *
   * ② **原模型**（none）：步数是自由变量，有 `stepsRange`。
   *    · 低于 min → 去噪没跑完，**废片**
   *    · 高于 max → 能跑但只是烧时间
   *    · 区间内   → 正常，不提示
   *
   * 所以这里只对「不合法」的情况返回提示对象，合法时返回 null。
   */
  const stepMismatch = useMemo(() => {
    const plan = (meta?.accelPlans ?? []).find((p) => p.id === accelPlan);
    if (!plan) return null;
    const want = Number(plan.steps) || 0;
    const got = Number(steps) || 0;
    if (!want || !got) return null;

    const range = plan.stepsRange;
    if (range) {
      // 可调方案：只在不合法区间提示，区间内一律放行
      if (got < range.min) {
        return {
          want, got, severe: true, label: plan.label, range,
          message: `不加速却只跑 ${got} 步 —— 原模型建议 ${want} 步，低于 ${range.min} 步去噪远未完成，出片会明显模糊。`,
          fixLabel: `改为 ${Math.min(want, range.max)} 步`,
          fixValue: Math.min(want, range.max),
        };
      }
      if (got > range.max) {
        return {
          want, got, severe: false, label: plan.label, range,
          message: `跑 ${got} 步超过建议上限 ${range.max} 步 —— 能跑，但收益递减、耗时线性增长。`,
          fixLabel: `改为 ${range.max} 步`,
          fixValue: range.max,
        };
      }
      return null;   // 区间内正常
    }

    // 蒸馏学生：偏离即分布外
    if (want === got) return null;
    return {
      want, got, severe: false, label: plan.label, range: undefined,
      message: `「${plan.label}」按 ${want} 步训练，你填了 ${got} 步 —— 可以跑，但属于分布外，质量不保证。`,
      fixLabel: `改为 ${want} 步`,
      fixValue: want,
    };
  }, [meta, accelPlan, steps]);

  const loadTasks = useCallback(async () => {
    try {
      const rows = (await api.replaceList()) as unknown as ReplaceTask[];
      setTasks(Array.isArray(rows) ? rows : []);
    } catch { /* 列表失败不打断主流程 */ }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  /** 加载本地翻译模型状态（页面打开时探一次） */
  useEffect(() => {
    void (async () => {
      try {
        const s = await api.replaceLlmStatus();
        setLlmStatus({ usable: Boolean(s.usable), hint: String(s.hint ?? '') });
      } catch { /* 探测失败不影响主流程，按钮会因 usable=false 而禁用 */ }
    })();
  }, []);

  /**
   * 编译提示词。
   *
   * ⚠️ **不自动覆盖用户的输入框** —— 编译结果先放出来给他看，
   *    他确认后才替换。理由：用户写的内容里有 LoRA 触发词这类
   *    「一个字都不能改」的部分，自动替换一旦出错很难恢复。
   */
  const handleCompile = useCallback(async (useLlm: boolean) => {
    const raw = promptText.trim();
    if (!raw) return;
    setCompiling(true);
    setCompileWarnings([]);
    try {
      const r = await api.replaceCompilePrompt({ prompt: raw, useLlm });
      setCompileWarnings(Array.isArray(r.warnings) ? r.warnings : []);
      if (r.prompt && r.prompt !== raw) {
        setCompiled({ from: raw, to: r.prompt, translated: Boolean(r.translated) });
        toast.ok(r.translated ? '已编译并翻译，请预览后确认' : '已整理结构，请预览后确认');
      } else {
        toast.ok('结构已经规范，无需改动');
      }
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setCompiling(false);
    }
  }, [promptText, toast]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  /* ------------------- 参考图数量变化 → 刷新提示词模板 ------------------- */

  /**
   * 参考图数量变了就重算模板。
   *
   * ⚠️ 只在**用户还没改过提示词**时才覆盖输入框内容。
   *    判据：`promptText` 为空，或与上一版模板逐字相同（= 用户没动它）。
   *    否则用户改了半天、回头调一下参考图顺序，辛苦写的词就被冲掉了 ——
   *    这是最招人烦的一类"功能自己动我的输入"。
   */
  useEffect(() => {
    const refCount = Math.max(1, refs.length);
    let alive = true;
    void (async () => {
      try {
        const r = await api.replacePromptTemplate(refCount);
        if (!alive) return;
        setPromptTemplate(r.prompt);
        setPromptText((cur) => (cur.trim() === '' || cur === promptTemplate ? r.prompt : cur));
      } catch { /* 模板拿不到就留空，用户自己写 */ }
    })();
    return () => { alive = false; };
    // promptTemplate 故意不进依赖：它由本 effect 自己更新，进依赖会死循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.length]);

  /* ------------------- 源视频变化 → 立刻算分段 ------------------- */

  useEffect(() => {
    const rel = source[0]?.rel;
    if (!rel) { setPlan(null); return undefined; }
    let alive = true;
    setPlanning(true);
    void (async () => {
      try {
        const p = (await api.replacePlan({
          sourceRel: rel,
          segmentSec,
          continuation: useContinuation,
          contextLength,
        })) as unknown as Plan;
        if (alive) setPlan(p);
      } catch {
        if (alive) setPlan(null);
      } finally {
        if (alive) setPlanning(false);
      }
    })();
    return () => { alive = false; };
  }, [source, segmentSec, useContinuation, contextLength]);

  /* ------------------------- 轮询进行中的任务 ------------------------- */

  const loadActive = useCallback(async (id: string) => {
    try {
      const t = (await api.replaceGet(id)) as unknown as ReplaceTask;
      setActive(t);
      return t;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!activeId) { setActive(null); return undefined; }
    void loadActive(activeId);
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === 'hidden') {
        pollRef.current = window.setTimeout(tick, 3000);
        return;
      }
      const t = await loadActive(activeId);
      if (!alive) return;
      const done = t && ['completed', 'failed', 'cancelled'].includes(t.status);
      if (done) {
        void loadTasks();
        return;
      }
      pollRef.current = window.setTimeout(tick, 3000);
    };
    pollRef.current = window.setTimeout(tick, 1500);
    return () => {
      alive = false;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [activeId, loadActive, loadTasks]);

  /* ------------------------------ 提交 ------------------------------ */

  const canSubmit = Boolean(
    source[0]?.rel
    && refs.length
    && promptText.trim()
    && !submitting,
  );

  const handleCreate = useCallback(async (startNow: boolean) => {
    if (!source[0]?.rel) { toast.error('先选一个源视频'); return; }
    if (!refs.length) { toast.error('至少选一张目标角色参考图'); return; }
    if (!promptText.trim()) { toast.error('提示词不能为空'); return; }

    setSubmitting(true);
    try {
      const task = await api.replaceCreate({
        title: title.trim() || undefined,
        sourceRel: source[0].rel,
        refImages: refs.map((r) => ({ rel: r.rel })),
        /**
         * 提示词整段提交（后端优先用它）。
         * `roles` / `shotBeats` 不再传 —— 它们只在没给 prompt 时作为兜底，
         * 而这里的文本框永远有内容（打开就预填了模板）。
         */
        prompt: promptText,
        loras: loraChoices,
        segmentSec: Number(segmentSec) || 4,
        continuation: useContinuation,
        contextLength,
        accelPlan, preset, styleId, lightingId,
        /**
         * 步数兜底也必须跟着加速方案走，不能写死 8。
         *
         * 写死 8 的后果：输入框被清空时（`Number('') || 8`），
         * 选 `none` 方案会以 8 步提交 —— 就是「不加速却跑 8 步」的废片组合。
         * 虽然后端 `checkSteps` 会拦住并回退，但那个回退会静默把耗时拉长 6 倍。
         */
        steps: Number(steps) || Number((meta?.accelPlans ?? []).find((p) => p.id === accelPlan)?.steps) || 8,
        megapixels: Number(megapixels) || 0.6,
        denoise: Number(denoise) || 1,
        seed: Number(seed) || 1101,
        secondPass,
        // 续写链的抗身份漂移配方（独立模式后端会忽略）
        taperAlpha: Number(taperAlpha) || 0.45,
        taperAlphaEnd: Number(taperAlphaEnd) || 0.10,
        taperEnabled,
      });
      const id = String((task as { id?: string }).id ?? '');
      toast.ok(`已创建（${id.slice(0, 10)}）`);
      await loadTasks();
      setActiveId(id);

      /**
       * ⚠️ 创建成功 ≠ 执行成功。旧实现把 `replaceRun` 放在同一个 try 里，
       *    一旦它抛错就落进下面的 catch，而 catch 只 toast 一句错误 ——
       *    前半句"已创建"的 toast 还在屏幕上，用户看到的是"成功"。
       *    现在执行失败单独提示，并明确"任务已创建但没跑起来"。
       */
      if (startNow && id) {
        try {
          await api.replaceRun(id);
          toast.ok('已开始执行');
          void loadTasks();
        } catch (runErr) {
          toast.error(`任务已创建，但执行未能启动：${describeError(runErr)}`);
        }
      }
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    source, refs, promptText, loraChoices, title,
    segmentSec, useContinuation, contextLength,
    accelPlan, preset, styleId, lightingId, steps, megapixels,
    denoise, seed, secondPass, toast, loadTasks,
    taperAlpha, taperAlphaEnd, taperEnabled,
  ]);

  const handleRun = useCallback(async (id: string) => {
    try {
      await api.replaceRun(id);
      setActiveId(id);
      toast.ok('已开始执行');
      void loadTasks();
    } catch (e) {
      toast.error(describeError(e));
    }
  }, [toast, loadTasks]);

  /* ------------------------------ 渲染 ------------------------------ */

  if (loading) {
    return <Page title="角色替换"><Spinner /></Page>;
  }

  const limits = meta?.limits;
  const segCount = plan?.segments.length ?? 0;

  return (
    <Page
      title="角色替换"
      subtitle="源视频里的人物 → 换成本地素材库里的角色。与「渲染」页完全独立，互不影响。"
      actions={(
        <Button size="sm" onClick={() => void loadTasks()}>刷新任务</Button>
      )}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 12, alignItems: 'start' }}>
        {/* ---------------------------- 左列 ---------------------------- */}
        <div className="jz-col" style={{ gap: 12 }}>

          <Panel title="1 · 源视频（必须且只能有一个）" tight>
            <MediaPicker
              kind="video"
              multiple={false}
              value={source}
              onChange={setSource}
              label="从素材库选一个视频。超过分段时长会自动切开。"
            />
            {planning ? <div style={{ marginTop: 8 }}><Spinner /></div> : null}
            {plan ? (
              <div className="jz-col" style={{ gap: 6, marginTop: 10 }}>
                <div className="jz-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Badge>{plan.durationSec.toFixed(2)}s</Badge>
                  <Badge>{plan.width}×{plan.height}</Badge>
                  {plan.fps ? <Badge>{plan.fps.toFixed(0)}fps</Badge> : null}
                  <Badge tone={plan.hasAudio ? 'warn' : 'default'}>
                    {plan.hasAudio ? '带音轨（将自动剥除）' : '无音轨'}
                  </Badge>
                  <Badge tone="accent">切成 {segCount} 段</Badge>
                </div>
                {segCount > 1 ? (
                  <div className="jz-xs jz-muted">
                    {plan.segments.map((s) => (
                      <span key={s.index} style={{ marginRight: 8 }}>
                        #{s.index} {s.startSec.toFixed(1)}–{(s.startSec + s.durationSec).toFixed(1)}s
                      </span>
                    ))}
                  </div>
                ) : null}
                {plan.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
                {segCount > 1 ? (
                  <Alert tone="warn">
                    将跑 <b>{segCount}</b> 次生成（每次约 8 分钟，串行），总计约{' '}
                    <b>{Math.round(segCount * 8)}</b> 分钟，最后自动无损拼接。
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel title="2 · 目标角色参考图" tight>
            <MediaPicker
              kind="image"
              multiple
              value={refs}
              onChange={setRefs}
              label={`这些图的顺序就是提示词里的编号。<Picture 1> = 第一张。最多 ${limits?.refImages ?? 9} 张。`}
            />
          </Panel>

          <Panel
            title="3 · 换人提示词"
            tight
            actions={(
              <div className="jz-row" style={{ gap: 6 }}>
                <Badge>{promptText.length} 字符</Badge>
                {promptText !== promptTemplate ? <Badge tone="accent">已修改</Badge> : null}
                {promptText !== promptTemplate ? (
                  <Button size="sm" variant="ghost" onClick={() => setPromptText(promptTemplate)}>
                    恢复默认
                  </Button>
                ) : null}
              </div>
            )}
          >
            <div className="jz-col" style={{ gap: 8 }}>
              {/*
                一个框搞定「谁换成谁 + 分镜 + 附加约束」。
                打开就是填好的模板，`<Picture N>` 编号 = 参考图选择顺序。
                加一行就是多换一个人，删一行就是少换一个 —— 不设上限。
              */}
              <Textarea
                value={promptText}
                onChange={(e) => setPromptText((e.target as HTMLTextAreaElement).value)}
                rows={14}
                spellCheck={false}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 12,
                  lineHeight: 1.7,
                  minHeight: 220,
                }}
                placeholder="在这里写换人提示词…"
              />

              {/*
                编译按钮 —— 把自由文本整理成规范结构。
                
                为什么要单做一个按钮而不是保存时自动编译：
                  · 模型翻译要拉起 7B（5GB 显存），必须用户主动触发
                  · 编译结果要让用户**看一眼再决定**，不能偷偷改掉他写的东西
                  · 规则引擎版本秒回，可反复点；模型版慢，点了有明确反馈
              */}
              <div className="jz-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={compiling || !promptText.trim()}
                  onClick={() => void handleCompile(false)}
                >
                  {compiling ? '编译中…' : '快速整理（规则）'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={compiling || !promptText.trim() || !llmStatus?.usable}
                  onClick={() => void handleCompile(true)}
                  title={llmStatus?.usable ? '用本地 7B 模型翻译成英文' : (llmStatus?.hint ?? '模型不可用')}
                >
                  {compiling ? '编译中…' : '编译 + 英文翻译'}
                </Button>
                {llmStatus && !llmStatus.usable ? (
                  <span className="jz-xs jz-muted">{llmStatus.hint}</span>
                ) : null}
                {compileWarnings.length ? (
                  <span className="jz-xs" style={{ color: 'var(--jz-warn-text, #d97706)' }}>
                    {compileWarnings[0]}
                  </span>
                ) : null}
              </div>

              {/*
                编译结果预览。
                
                刻意**不自动替换输入框** —— 用户写的触发词一个字都不能改，
                让他看清楚"要变成什么"再点确认，是唯一安全的做法。
                过期检测：如果输入框内容已经不是编译时的原文，说明他在预览期间
                又改了东西，此时"应用"会把新改动冲掉，所以禁用按钮。
              */}
              {compiled ? (
                <div className="jz-col" style={{ gap: 6, padding: 10, border: '1px solid var(--jz-border)', borderRadius: 8 }}>
                  <div className="jz-row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b className="jz-sm">编译结果预览</b>
                    {compiled.translated ? <Badge tone="accent">已翻译</Badge> : <Badge>规则整理</Badge>}
                    <span className="jz-xs jz-muted">{compiled.to.length} 字</span>
                  </div>
                  <pre
                    className="jz-xs"
                    style={{
                      margin: 0, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      lineHeight: 1.6, background: 'var(--jz-bg-sunken, rgba(0,0,0,0.03))', padding: 8, borderRadius: 6,
                    }}
                  >
                    {compiled.to}
                  </pre>
                  <div className="jz-row" style={{ gap: 8 }}>
                    <Button
                      size="sm"
                      disabled={promptText.trim() !== compiled.from.trim()}
                      onClick={() => {
                        setPromptText(compiled.to);
                        setPromptTemplate(compiled.to);
                        setCompiled(null);
                        toast.ok('已应用编译结果');
                      }}
                    >
                      {promptText.trim() !== compiled.from.trim() ? '输入框已改动，请重新编译' : '应用到输入框'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCompiled(null)}>放弃</Button>
                  </div>
                </div>
              ) : null}
              <div className="jz-xs jz-muted" style={{ lineHeight: 1.7 }}>
                这段会<b>原样提交</b>。花括号内容（〔…〕）是给你替换的提示，别忘了改掉。
                {' '}
                <b>{'<Picture N>'}</b> 的编号对应参考图选择顺序（第 1 张 = Picture 1）。
                <br />
                多角色就在第二句里多加一组 <code>{'<Subject 2> 是 <Picture 2> 中的…'}</code>，
                首句也要相应加上「将…替换成…」。
                <br />
                不要写「不要 X」这类否定句 —— 本地 CFG=1.0、没有负向分支，写在正文里反而会把该元素拉进画面。
              </div>
            </div>
          </Panel>

          <Panel title="4 · 加速方案与 LoRA" tight>
            <div className="jz-col" style={{ gap: 10 }}>
              {/*
                加速方案放在 LoRA 面板**之上**、同一个 Panel 里。
                理由：这两个决策是耦合的 —— 挂某些语义 LoRA（尤其成人向）
                时加速会明显削弱效果，用户需要同时看到两个选项才能权衡。
                塞进右列"执行"面板会让人只改加速、忘了 LoRA 也受影响。
              */}
              <Field
                label="加速方案"
                hint={
                  accelPlan === 'none'
                    ? '不挂加速 LoRA，用原模型跑满步数（默认 50 步）。慢 5–6 倍，但这是画质与细节的上限 —— 部分语义 LoRA（尤其成人向）在加速下会明显失效。'
                    : '加速学生与步数成套：换方案会自动同步步数'
                }
              >
                <Select
                  value={accelPlan}
                  onChange={(v) => { setAccelPlan(v); }}
                  options={(meta?.accelPlans ?? []).map((p) => ({
                    value: p.id,
                    label: `${p.label} · ${p.steps} 步`,
                  }))}
                />
              </Field>
              <LoraPicker value={loraChoices} onChange={setLoraChoices} maxSlots={8} />
            </div>
          </Panel>
        </div>

        {/* ---------------------------- 右列 ---------------------------- */}
        <div className="jz-col" style={{ gap: 12 }}>

          <Panel title="执行" tight>
            <div className="jz-col" style={{ gap: 8 }}>
              <Field label="任务名（可选）">
                <Input
                  value={title}
                  onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
                  placeholder="自动用时间命名"
                />
              </Field>
              <div className="jz-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  disabled={!canSubmit}
                  onClick={() => void handleCreate(true)}
                >
                  {submitting ? '提交中…' : segCount > 1 ? `创建并跑 ${segCount} 段` : '创建并开始'}
                </Button>
                <Button disabled={!canSubmit} onClick={() => void handleCreate(false)}>
                  只创建
                </Button>
              </div>
              {!canSubmit ? (
                <div className="jz-xs jz-muted">
                  需要：源视频 + 至少一张参考图 + 提示词
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel title="参数（默认已按 DMAD8 + 续写校准）" tight>
            <div className="jz-col" style={{ gap: 8 }}>
              {/*
                续写模式开关 —— 这是解决接缝的核心。
                开启后段间用真实 AV latent 衔接：段 n 的开头重放段 n-1 的末尾，
                采完裁掉。不是靠提示词祈祷模型"接着演"。
              */}
              <Field
                label="段间衔接"
                hint={
                  useContinuation
                    ? '续写链：段间靠真实 AV latent 传递。接缝由机制保证，但必须关闭二采。'
                    : '独立重绘：每段冷启动。段间必然跳变（首帧是模型自己推断的，不是上一段的末帧）。'
                }
              >
                <Select
                  value={useContinuation ? 'cont' : 'indep'}
                  onChange={(v) => setUseContinuation(v === 'cont')}
                  options={[
                    { value: 'cont', label: '续写链（推荐，无缝）' },
                    { value: 'indep', label: '独立重绘（可开二采，有接缝）' },
                  ]}
                />
              </Field>

              {useContinuation ? (
                <Field
                  label="重叠窗口"
                  hint={'段 n 重放段 n-1 末尾的这么多帧，采完裁掉。'
                    + '窗口越大接缝越顺，但被「上一段实际画面」钉住的帧也越多 —— '
                    + '做换人时会拖着重绘回源角色，所以默认用 22 而不是 56。'}
                >
                  <Select
                    value={contextLength}
                    onChange={setContextLength}
                    options={(meta?.contextLengths ?? [
                      { id: '22', label: '22 帧 · 0.92s（默认）' },
                    ]).map((c) => ({ value: c.id, label: c.label }))}
                  />
                </Field>
              ) : null}

              <Field
                label="分段时长（秒）"
                hint={useContinuation
                  ? '续写段的「请求时长」含重叠，实际新增时长更短。段越短越稳。'
                  : '超过就自动切段'}
              >
                <Input
                  type="number"
                  min={2}
                  max={15}
                  value={segmentSec}
                  onChange={(e) => setSegmentSec(Number((e.target as HTMLInputElement).value) || 4)}
                />
              </Field>
              <Field label="画风" hint="默认 none —— 换人应继承源视频画风">
                <Select
                  value={styleId}
                  onChange={setStyleId}
                  options={[
                    { value: 'none', label: '不指定（继承源视频）' },
                    ...(meta?.styles ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.category}` })),
                  ]}
                />
              </Field>
              <Field label="光影" hint="默认 none。换人应继承源视频光影，手写会导致背景重绘">
                <Select
                  value={lightingId}
                  onChange={setLightingId}
                  options={(meta?.lightings ?? []).map((l) => ({
                    value: l.id,
                    label: l.ratio ? `${l.name}（${l.ratio}）` : l.name,
                  }))}
                />
              </Field>

              <Button size="sm" variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? '收起高级' : '展开高级'}
              </Button>

              {showAdvanced ? (
                <div className="jz-col" style={{ gap: 8 }}>
                  <Field label="预设">
                    <Select
                      value={preset}
                      onChange={setPreset}
                      options={(meta?.presets ?? []).map((p) => ({ value: p.id, label: p.label }))}
                    />
                  </Field>
                  <Field
                    label={
                      stepMismatch?.range
                        ? `采样步数（可调 ${stepMismatch.range.min}–${stepMismatch.range.max}）`
                        : '采样步数'
                    }
                    hint={
                      stepMismatch?.range
                        ? `原模型步数自由可调。默认 ${stepMismatch.want} 步是质量优先，`
                          + `想快可以先试 ${stepMismatch.range.min + 5}–${stepMismatch.range.min + 10} 步。`
                        : stepMismatch
                          ? `当前方案「${stepMismatch.label}」推荐 ${stepMismatch.want} 步，你填了 ${stepMismatch.got} 步`
                          : '与加速方案成套：切方案会自动同步推荐步数，手动改过后不再自动覆盖'
                    }
                  >
                    <Input
                      type="number"
                      value={steps}
                      min={stepMismatch?.range?.min}
                      max={stepMismatch?.range?.max}
                      step={stepMismatch?.range?.step ?? 1}
                      onChange={(e) => {
                        setStepsTouched(true);
                        setSteps((e.target as HTMLInputElement).value);
                      }}
                    />
                  </Field>

                  {/*
                    只有在「不合法」时才提示：
                      · none 低于 min  → 红色（废片级：去噪没跑完）
                      · none 高于 max  → 黄色（烧时间）
                      · 蒸馏偏离训练步数 → 黄色（分布外）
                    区间内不打扰用户。
                  */}
                  {stepMismatch ? (
                    <Alert tone={stepMismatch.severe ? 'danger' : 'warn'}>
                      {stepMismatch.message}
                      <div style={{ marginTop: 6 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setStepsTouched(false);
                            setSteps(String(stepMismatch.fixValue));
                          }}
                        >
                          {stepMismatch.fixLabel}
                        </Button>
                      </div>
                    </Alert>
                  ) : null}
                  <Field label="百万像素">
                    <Input
                      type="number"
                      step={0.1}
                      value={megapixels}
                      onChange={(e) => setMegapixels((e.target as HTMLInputElement).value)}
                    />
                  </Field>
                  <Field label="降噪强度">
                    <Input
                      type="number"
                      step={0.05}
                      value={denoise}
                      onChange={(e) => setDenoise((e.target as HTMLInputElement).value)}
                    />
                  </Field>
                  <Field label="随机种子">
                    <Input
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed((e.target as HTMLInputElement).value)}
                    />
                  </Field>
                  <Field
                    label="二采"
                    hint={useContinuation
                      ? '续写模式下强制关闭 —— latent 不可缩放，二采会让下一段画布对不上直接报错。'
                      : '换人默认关闭：源视频已是结构锚点，二采收益低、耗时翻倍'}
                  >
                    <Select
                      value={useContinuation ? 'off' : (secondPass ? 'on' : 'off')}
                      onChange={(v) => setSecondPass(v === 'on')}
                      options={useContinuation
                        ? [{ value: 'off', label: '关闭（续写强制）' }]
                        : [
                          { value: 'off', label: '关闭（默认）' },
                          { value: 'on', label: '开启（慢一倍）' },
                        ]}
                    />
                  </Field>
                  {useContinuation ? (
                    <>
                      <Field
                        label="上下文加噪"
                        hint={'把上一段末帧作为上下文钉进本段时，先损坏它的外观、'
                          + '保留它的运动。不这么做的话模型会原样拷贝上一段的长相 —— '
                          + '而换人恰恰要求脸必须变。'}
                      >
                        <Select
                          value={taperEnabled ? 'on' : 'off'}
                          onChange={(v) => setTaperEnabled(v === 'on')}
                          options={[
                            { value: 'on', label: '开启（推荐，抗身份漂移）' },
                            { value: 'off', label: '关闭（画面会抄上一段外观）' },
                          ]}
                        />
                      </Field>
                      {taperEnabled ? (
                        <>
                          <Field label="加噪强度" hint="0.45 是社区验证值。调低保留更多上一段外观（更容易漂），调高更强迫模型回到参考图。">
                            <Input
                              type="number"
                              step={0.05}
                              min={0}
                              max={1}
                              value={taperAlpha}
                              onChange={(e) => setTaperAlpha((e.target as HTMLInputElement).value)}
                            />
                          </Field>
                          <Field label="末档强度" hint="贴着接缝那一步的强度，必须不大于加噪强度。这一步越干净，上一段外观越容易被抄过去。">
                            <Input
                              type="number"
                              step={0.05}
                              min={0}
                              max={1}
                              value={taperAlphaEnd}
                              onChange={(e) => setTaperAlphaEnd((e.target as HTMLInputElement).value)}
                            />
                          </Field>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel title="进度" tight>
            {!active ? (
              <EmptyState title="还没有运行中的任务" hint="创建任务后这里显示每段进度" />
            ) : (
              <div className="jz-col" style={{ gap: 8 }}>
                <div className="jz-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Badge tone={active.status === 'completed' ? 'ok' : active.status === 'failed' ? 'danger' : 'accent'}>
                    {active.status}
                  </Badge>
                  <Badge tone={active.mode === 'continuation' ? 'accent' : 'default'}>
                    {active.mode === 'continuation'
                      ? `续写链 · 重叠 ${active.overlapSec?.toFixed(2) ?? '?'}s`
                      : '独立重绘'}
                  </Badge>
                  <span className="jz-xs jz-muted">{active.id.slice(0, 12)}</span>
                </div>

                {active.error ? <Alert tone="danger">{active.error}</Alert> : null}

                <div className="jz-col" style={{ gap: 3 }}>
                  {(active.segments ?? []).map((s) => (
                    <div key={s.index} className="jz-row" style={{ gap: 6, fontSize: 12 }}>
                      <span>
                        <b>#{s.index}</b>{' '}
                        <span className="jz-muted">
                          {s.startSec.toFixed(1)}–{(s.startSec + s.durationSec).toFixed(1)}s
                          {s.deliverSec != null && s.deliverSec !== s.durationSec
                            ? ` · 交付 ${s.deliverSec.toFixed(2)}s`
                            : ''}
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Badge
                          tone={
                            s.status === 'completed' ? 'ok'
                              : s.status === 'failed' ? 'danger'
                                : s.status === 'running' ? 'accent' : 'default'
                          }
                        >
                          {s.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>

                {active.finalRel ? (
                  <div className="jz-col" style={{ gap: 4 }}>
                    <div className="jz-xs"><b>成片</b></div>
                    <a
                      href={`/jiuzhang/api/file?path=${encodeURIComponent(active.finalRel)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="jz-xs"
                      style={{ color: 'var(--jz-accent)', wordBreak: 'break-all' }}
                    >
                      {active.finalRel}
                    </a>
                  </div>
                ) : null}

                {(active.warnings ?? []).slice(-4).map((w) => (
                  <Alert key={w} tone="warn">{w}</Alert>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="历史任务" tight flush>
            {tasks.length === 0 ? (
              <div className="jz-xs jz-muted" style={{ padding: 10 }}>还没有任务</div>
            ) : (
              <div className="jz-col" style={{ gap: 0 }}>
                {tasks.slice(0, 12).map((t) => (
                  <div
                    key={t.id}
                    className="jz-row"
                    style={{ padding: '7px 10px', gap: 6, cursor: 'pointer' }}
                    onClick={() => setActiveId(t.id)}
                  >
                    <span className="jz-truncate" style={{ flex: '1 1 auto', fontSize: 12 }}>
                      {t.title || t.id.slice(0, 10)}
                      <span className="jz-muted" style={{ marginLeft: 6 }}>
                        {formatRelativeTime(t.createdAt)}
                      </span>
                    </span>
                    <Badge
                      tone={t.status === 'completed' ? 'ok' : t.status === 'failed' ? 'danger' : 'default'}
                    >
                      {t.status}
                    </Badge>
                    {t.status !== 'running' && t.status !== 'completed' ? (
                      <button
                        type="button"
                        className="jz-btn jz-btn--sm"
                        onClick={(ev) => { ev.stopPropagation(); void handleRun(t.id); }}
                      >
                        运行
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}

export default ReplacementPage;
