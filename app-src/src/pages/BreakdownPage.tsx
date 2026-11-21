/**
 * 立绘拆解 —— 把一张立绘转成可复用的**角色设定卡**（三视图 + 服装部件拆解）。
 *
 * ============================================================================
 * 设计变更：从"填表"改成"一个大提示词框"
 * ============================================================================
 *
 * 历史版本拆成 ① 选立绘 → ② 描述角色（角色名 / 服装清单 / 附属部件 / 视角 /
 * 补充说明）→ ③ 档位与尺寸 → ④ 结果，正文由后端按档位拼装。
 * 实际问题是**改不动结构**：想换一套衣服，只能往服装清单里加词，
 * 而正文口径仍是"逐件拆出参考图里已有的服装"；想加视角，正文里
 * "三个视角"的措辞与排版说明不会跟着变；档位里的 `full` 与 `standard`
 * 更是逐字相同（表情差分区 1.0.2 已移除）。
 *
 * 现在页面只做三件事：
 *   ① 选立绘（参考图，必填）
 *   ② 改提示词（一个整段可编辑的文本框，默认填好三视图设定卡提示词）
 *   ③ 生成 → 看结果 → 存角色卡
 *
 * 前端**不做任何拼装**：文本框里是什么，提交的就是什么（后端同样不做拼装，
 * 见 host/services/breakdown.js）。"所见即所提交"是这一页唯一需要保证的事。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api/client';
import { outputUrl } from '../api/url';
import type { JobOutput } from '../api/url';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Textarea, useToast,
} from '../ui';

interface SizeInfo { id: string; name: string; w: number; h: number; mp: number }
interface Asset {
  id: string; type: string; name: string; kind: string; rel?: string;
  /** 字节数：用来把"明显不是一张图"的占位文件挡在默认选择之外 */
  bytes?: number;
}

/**
 * 一张能真正当立绘用的图，最小多大？
 *
 * 为什么需要这道过滤：素材目录里存在 155 字节的 64×64 占位 PNG（冒烟测试传的
 * `jz-test.png`），ComfyUI 读它会报
 *   `COMFY_EXEC_ERROR @LoadImage: avcodec_receive_frame()`
 * —— 一个来自解码器的、完全看不出根因的错误。而页面此前是"取了列表第一个"
 * 当默认选中项，于是**每次进页面都默认选中那张废图**，用户点生成必然失败，
 * 还得自己去猜是哪张图有问题。
 *
 * 阈值取 32 KB：真实立绘都在百 KB 以上（本机素材 280 KB – 6 MB），
 * 而 64×64 的纯色占位图只有一百多字节。这一刀切得很干净。
 */
const MIN_REF_IMAGE_BYTES = 32 * 1024;

export function isUsableRefImage(a: Asset): boolean {
  if (a.kind !== 'image' || !a.rel) return false;
  // 没有 bytes 字段的老记录不拦（宁可放过，也不要误伤真实素材）
  return a.bytes == null || Number(a.bytes) >= MIN_REF_IMAGE_BYTES;
}

interface Meta {
  defaultPrompt: string;
  maxChars: number;
  size: SizeInfo;
  removedFields?: string[];
}

type Step = 'source' | 'prompt' | 'result';

/**
 * 提示词草稿的本地存储键。
 *
 * 为什么存 localStorage 而不是后端：
 *   · 默认提示词很长，用户改了几行之后刷新页面/切页再回来，改动不能丢；
 *   · 这是**编辑器草稿**，不是配置 —— 用户很可能每张立绘写不同的方向，
 *     存到全局配置里反而会互相覆盖。
 * 存的是**用户当前文本**（含"就是默认值"的情况），恢复时与默认值逐一比对，
 * 一致就回到"未改动"态。
 */
const DRAFT_KEY = 'jz.breakdown.promptDraft.v1';

export function BreakdownPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  /**
   * 默认直接落在「② 改提示词」。
   *
   * ⚠️ 这里以前是 'source'（选立绘）。但这一页的核心是**改提示词**，
   *    而参考图在 load() 里已经自动选中第一张可用的图了 ——
   *    让用户先看一屏缩略图、再点一次"下一步"，纯属多一道无意义的手续，
   *    而且那个巨大的提示词框（和它的复制/恢复按钮）在第一屏根本看不到。
   *    选图仍然能通过步骤条或「换一张」回到 ①。
   */
  const [step, setStep] = useState<Step>('prompt');
  const [busy, setBusy] = useState(false);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [refRel, setRefRel] = useState('');
  const [prompt, setPrompt] = useState('');
  /** 用户是否动过提示词（决定"恢复默认"按钮是否可点、标题显示"已改/默认"） */
  const [dirty, setDirty] = useState(false);

  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState<JobOutput | null>(null);
  const [cardName, setCardName] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [lastJobPrompt, setLastJobPrompt] = useState('');
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const defaultPrompt = meta?.defaultPrompt ?? '';
  const maxChars = meta?.maxChars ?? 4096;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([api.breakdownMeta(), api.listAssets({})]);
      const info = m as Meta;
      setMeta(info);
      // 提示词：优先恢复本地草稿，否则用后端下发的默认值
      const saved = (() => {
        try { return window.localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
      })();
      const initial = saved || info.defaultPrompt || '';
      setPrompt(initial);
      setDirty(initial.trim() !== String(info.defaultPrompt ?? '').trim());

      const imgs = (a as Asset[]).filter((x) => x.kind === 'image' && x.rel);
      setAssets(imgs);
      /**
       * 默认选中项必须是**能用的**图。
       *
       * ⚠️ 这里曾经直接 `imgs[0]?.rel`。素材列表首个元素是冒烟测试留下的
       *    155 字节占位 PNG，于是每次进页面都默认选中一张解码必失败的图
       *    （ComfyUI 报 avcodec_receive_frame，看不出根因）。
       *    现在优先选第一张体积正常的图；一张都没筛出来就不预选，
       *    让用户自己挑 —— 比"替你选一张坏的"好。
       */
      setRefRel((prev) => prev || imgs.find(isUsableRefImage)?.rel || '');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  /* --------------------------------------------------- 草稿持久化 */

  useEffect(() => {
    if (!meta) return;   // meta 没到之前不要写，否则会用空串覆盖掉草稿
    try { window.localStorage.setItem(DRAFT_KEY, prompt); } catch { /* 隐私模式忽略 */ }
    setDirty(prompt.trim() !== defaultPrompt.trim());
  }, [prompt, meta, defaultPrompt]);

  /** 恢复默认提示词（可撤销：先把当前文本留在 toast 里提示已覆盖） */
  const handleResetPrompt = useCallback(() => {
    setPrompt(defaultPrompt);
    window.setTimeout(() => promptRef.current?.focus(), 0);
    toast.ok('已恢复默认三视图提示词');
  }, [defaultPrompt, toast]);

  /** 清空输入框（等价于"用默认值"：后端 body.prompt 为空会回落默认） */
  const handleClearPrompt = useCallback(() => {
    setPrompt('');
    promptRef.current?.focus();
    toast.ok('输入框已清空 —— 提交时会自动用默认三视图提示词');
  }, [toast]);

  /**
   * 复制一段文本到剪贴板。
   *
   * 为什么要有降级路径：
   *   `navigator.clipboard` 只在**安全上下文**可用（https / localhost / 127.0.0.1）。
   *   本 SPA 由 Host 同源提供，正常是 http://127.0.0.1:<port>，属于安全上下文；
   *   但 DSH Desktop 的窗口 origin 是 `dsh-app://app`（自定义协议），
   *   那里 `navigator.clipboard` 可能不存在或抛 NotAllowedError。
   *   所以失败时退回 `textarea + execCommand('copy')` —— 老 API，但在自定义协议下能用。
   *
   * @returns 是否复制成功（调用方据此给不同的 toast）
   */
  const copyText = useCallback(async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* 走降级 */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      // 必须留在文档流里才能选中；用 fixed + 透明避免滚动跳动与闪动
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, []);

  /** 复制**当前文本框内容**（= 实际会提交的那段） */
  const handleCopyCurrent = useCallback(async () => {
    const text = prompt.trim() ? prompt : defaultPrompt;
    const ok = await copyText(text);
    if (!ok) { toast.error('复制失败，请手动全选复制'); return; }
    toast.ok(
      prompt.trim()
        ? `已复制当前提示词（${text.length} 字符）`
        : `输入框为空，已复制默认提示词（${text.length} 字符）`,
    );
  }, [prompt, defaultPrompt, copyText, toast]);

  /** 复制**默认提示词**（不管输入框里现在是什么） */
  const handleCopyDefault = useCallback(async () => {
    if (!defaultPrompt) { toast.error('默认提示词还没加载出来'); return; }
    const ok = await copyText(defaultPrompt);
    if (!ok) { toast.error('复制失败，请手动全选复制'); return; }
    toast.ok(`已复制默认提示词（${defaultPrompt.length} 字符）`);
  }, [defaultPrompt, copyText, toast]);

  /* ------------------------------------------------------ 生成 */

  async function doPreview() {
    setBusy(true);
    try {
      const r = await api.breakdownPreview({ prompt }) as {
        prompt: string; chars: number; isDefault?: boolean;
      };
      // 预览**不回写**输入框：用户看到的就是自己写的那段（后端只做 trim）
      toast.ok(`提交用词 ${r.chars} 字符${r.isDefault ? '（默认提示词）' : ''}`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function doGenerate() {
    if (!refRel) { toast.error('请先选一张立绘'); return; }
    if (prompt.trim().length > maxChars) {
      toast.error(`提示词 ${prompt.trim().length} 字符，超过上限 ${maxChars}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api.breakdownGenerate({
        prompt,
        refImages: [refRel],
      }) as { id: string; chars?: number };
      setJobId(r.id);
      setLastJobPrompt(prompt);
      setStep('result');
      toast.ok('已提交，正在生成拆解图…');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------- 轮询结果 */

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const jobs = await api.listJobs() as { id: string; status: string; outputs?: JobOutput[]; error?: string }[];
          const cur = jobs.find((j) => j.id === jobId);
          if (cur && ['completed', 'failed', 'cancelled'].includes(cur.status)) {
            /**
             * ⚠️ 成功判据必须认 `rel`，不能只认 `path`。
             *
             * 历史缺陷：守卫写的是 `cur.outputs?.[0]?.path`，而
             * `outputUrl()` 优先用 `rel`（comfy-client 的 toRel 在跨盘/相对
             * 路径失败时会给空 rel，但也存在只有 rel 有值的产物）。
             * `path` 为空就判"生成失败"，哪怕图已经成功产出、rel 就在对象里。
             * 现在按 `rel || path` 判，与 url.ts 的优先级保持一致。
             */
            const out = cur.outputs?.[0] as (JobOutput & { assetId?: string }) | undefined;
            if (cur.status === 'completed' && (out?.rel || out?.path)) {
              setResult(out ?? null);
              toast.ok(out?.assetId ? '拆解图完成，已归档到素材库' : '拆解图完成');
            } else {
              toast.error(cur.error || '生成失败');
            }
            setJobId('');
            window.clearInterval(timer);
          }
        } catch { /* 网络抖动不中断 */ }
      })();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobId, toast]);

  /**
   * 把刚出的拆解图直接存成角色卡。
   *
   * 设计文档承诺过 `POST /vault/cards/:id/from-sheet`，但那条路由从没实现，
   * 于是「立绘 → 拆解 → 设定卡 → 角色卡仓库」这条主线在第三步断掉：
   * 用户只能去仓库页手动新建，再从几百张自动归档的素材里靠缩略图找。
   *
   * 这里用已有的 `vaultUpsert` 直接建卡（后端无需新路由）。
   *
   * ⚠️ 必须用 **archivedRel**（素材库里的正式副本），不能用产物原始 rel。
   *    产物落在 `data/outputs/`，那是可清理的临时区 —— 用户跑一次「清理孤儿」
   *    或换个 dataDir，卡片图就全裂了。后端 runAndArchive 已经算好 archivedRel
   *    附在 output 上，直接用即可。
   */
  async function handleSaveAsCard() {
    const name = cardName.trim();
    if (!name) { toast.error('请先填角色名'); return; }
    const sheetRel = result?.archivedRel || result?.rel || result?.path || '';
    if (!sheetRel) { toast.error('还没有可用的拆解图'); return; }
    setSavingCard(true);
    try {
      await api.vaultUpsert({
        name,
        description: '由立绘拆解生成',
        // 拆解图进设定卡；原立绘如果有的话一并放进 origin 槽位，
        // 这样卡的 refPolicy 才有"两个来源"可选。
        images: {
          sheet: [sheetRel],
          ...(refRel ? { origin: [refRel] } : {}),
        },
        refPolicy: { mode: refRel ? 'both' : 'sheet-first', maxImages: refRel ? 2 : 1 },
      });
      toast.ok(`已建角色卡「${name}」，可在角色卡仓库查看`);
      setCardName('');
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setSavingCard(false);
    }
  }

  const previewUrl = outputUrl(result);
  const chars = prompt.trim().length;
  const overLimit = chars > maxChars;

  const steps = useMemo(() => ([
    { value: 'source' as Step, label: '① 选立绘' },
    { value: 'prompt' as Step, label: '② 改提示词' },
    { value: 'result' as Step, label: '③ 结果' },
  ]), []);

  if (loading) return <Page title="立绘拆解"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="立绘拆解"
      subtitle="立绘 → 三视图角色设定卡（提示词可整段改写）"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button variant="primary" icon={<Icon name="image" size={15} />} onClick={() => void doGenerate()} disabled={busy || !refRel}>
            {busy ? '提交中…' : '生成拆解图'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {/*
          步骤条保留，但只有三步。
          原来第四步"档位与尺寸"已整块删除 —— 那一屏的两个选项（档位/尺寸）
          一个与另一个重复、一个根本跑不稳，都属于"看起来能调、实际调不动"。
        */}
        <div className="jz-row jz-wrap" style={{ gap: 8 }}>
          {steps.map((s) => (
            <Button
              key={s.value}
              variant={step === s.value ? 'primary' : 'ghost'}
              onClick={() => setStep(s.value)}
            >
              {s.label}
            </Button>
          ))}
          <span className="jz-xs jz-muted" style={{ marginLeft: 'auto' }}>
            固定输出 {meta?.size?.w}×{meta?.size?.h}（{meta?.size?.name}）
          </span>
        </div>

        {step === 'source' ? (
          <Panel title="选择立绘">
            {assets.length === 0 ? (
              <Alert tone="warn">素材库里还没有图片，请先在「素材库」上传立绘。</Alert>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {assets.map((a) => {
                  /*
                   * 太小的图（典型的 64×64 占位 PNG）仍然列出来，但标成"不可用"
                   * 并且不给点 —— 直接隐藏会让人以为是素材丢了。
                   * ComfyUI 解码这种文件会报 avcodec 错误，看不清根因。
                   */
                  const usable = isUsableRefImage(a);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!usable}
                      title={usable ? a.name : `这张图只有 ${a.bytes ?? '?'} 字节，可能不是有效图片`}
                      onClick={() => usable && setRefRel(a.rel ?? '')}
                      className="jz-card"
                      style={{
                        padding: 6, cursor: usable ? 'pointer' : 'not-allowed', textAlign: 'left',
                        opacity: usable ? 1 : 0.45,
                        borderColor: refRel === a.rel ? 'var(--jz-accent)' : undefined,
                        borderWidth: refRel === a.rel ? 2 : 1,
                      }}
                    >
                      <img
                        src={`/jiuzhang/api/assets/item?id=${encodeURIComponent(a.id)}`}
                        alt={a.name}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4, background: 'var(--jz-bg-sunken)' }}
                      />
                      <div className="jz-xs jz-truncate" style={{ marginTop: 4 }}>{a.name}</div>
                      {usable ? null : <div className="jz-xs" style={{ color: 'var(--jz-warn)' }}>体积过小，不可用</div>}
                    </button>
                  );
                })}
              </div>
            )}
            {refRel ? <div className="jz-xs jz-muted" style={{ marginTop: 8 }}>已选：{refRel}</div> : null}
            <div className="jz-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <Button onClick={() => setStep('prompt')}>下一步 · 改提示词</Button>
            </div>
          </Panel>
        ) : null}

        {step === 'prompt' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Alert tone="info">
              这一段就是<b>提交给模型的全部提示词</b>，后端不会再拼装任何内容。默认值是一份可用的三视图设定卡；
              想让角色换装、加视角、改排版/画风，直接改这里 —— 例如把「上衣」那一件替换成你要的衣服，
              并在开头保留「文字里明确写出的要求优先于参考图」这条授权句，改动才会真正生效。
            </Alert>

            <Panel
              title="提示词"
              actions={
                <div className="jz-row jz-wrap" style={{ gap: 6 }}>
                  <Badge tone={dirty ? 'accent' : undefined}>{dirty ? '已改动' : '默认值'}</Badge>
                  {/*
                    两个复制按钮：
                      · 复制默认值 —— 不管框里现在是什么，拿到的永远是后端下发的默认三视图提示词
                        （用来备份、发给别人、或粘到别处对照）
                      · 复制当前  —— 复制框里这段，也就是**实际会提交的那段**
                    放在输入框旁边（Panel 的 actions 区），符合"改提示词时就在手边"。
                  */}
                  <Button
                    variant="ghost"
                    icon={<Icon name="copy" size={14} />}
                    onClick={() => void handleCopyDefault()}
                    disabled={!defaultPrompt}
                    title="复制后端下发的默认三视图提示词（不受输入框当前内容影响）"
                  >
                    复制默认值
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<Icon name="copy" size={14} />}
                    onClick={() => void handleCopyCurrent()}
                    title="复制输入框里的这段提示词（即实际提交给模型的全部内容）"
                  >
                    复制当前
                  </Button>
                  <Button variant="ghost" onClick={handleResetPrompt} disabled={!dirty}>恢复默认</Button>
                  <Button variant="ghost" onClick={handleClearPrompt}>清空</Button>
                  <Button variant="ghost" onClick={() => void doPreview()} disabled={busy}>校验</Button>
                </div>
              }
            >
              <Textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                /*
                 * 这是一个"巨大的"输入框：
                 *   · rows 给足 26 行（约等于默认提示词的可视长度，长文不用先滚动）；
                 *   · minHeight 用视口高度兜底（60vh），窄屏也会占满大半屏；
                 *   · 等宽字体 + 自动折行，长段落读起来有结构感。
                 *
                 * ⚠️ 高度必须写在 **style** 里，不能只靠 `minRows`：
                 *    本项目的 Textarea 实现是 `<textarea style={minRows ? … : undefined} {...rest} />`
                 *    —— `{...rest}` 在 style 之后展开，传了 style 就会**整个覆盖**掉
                 *    minRows 算出来的 minHeight。两者同时传的话 minRows 静默失效，
                 *    输入框会缩回默认的 96px，"巨大的输入框"就没了。
                 */
                className="jz-input--mono"
                style={{ lineHeight: 1.75, fontSize: 13, minHeight: '60vh' }}
                placeholder="整段提示词（留空则使用默认三视图设定卡提示词）"
              />
              <div className="jz-row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="jz-xs jz-muted">
                  {chars} / {maxChars} 字符
                  {prompt.trim() === '' ? '　（空 = 使用默认提示词）' : ''}
                </span>
                {overLimit ? <Badge tone="danger">超长，提交会被拒绝（不会静默截断）</Badge> : null}
              </div>
            </Panel>

            <Panel title="参考图">
              <div className="jz-row jz-wrap" style={{ gap: 10, alignItems: 'center' }}>
                {refRel ? (
                  <img
                    src={`/jiuzhang/api/file?path=${encodeURIComponent(refRel)}`}
                    alt="立绘"
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--jz-border)' }}
                  />
                ) : null}
                <div className="jz-col" style={{ gap: 4 }}>
                  <div className="jz-sm">{refRel || '未选立绘'}</div>
                  <div className="jz-xs jz-muted">参考图会以视觉块直接进编码器，所以提示词里不必复述外观。</div>
                </div>
                <Button variant="ghost" onClick={() => setStep('source')} style={{ marginLeft: 'auto' }}>换一张</Button>
              </div>
            </Panel>

            <div className="jz-row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="primary" icon={<Icon name="image" size={15} />} onClick={() => void doGenerate()} disabled={busy || !refRel || overLimit}>
                {busy ? '提交中…' : '生成拆解图'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'result' ? (
          <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
            <Panel title={jobId ? '生成中…' : '拆解图结果'}>
              {jobId ? (
                <div className="jz-col" style={{ alignItems: 'center', gap: 10, padding: 40 }}>
                  <Icon name="image" size={40} />
                  <div className="jz-muted">正在拆解…（约 1-2 分钟）</div>
                  <div className="jz-xs jz-mono">{jobId.slice(0, 20)}…</div>
                </div>
              ) : previewUrl ? (
                <div className="jz-col" style={{ gap: 12 }}>
                  <img src={previewUrl} alt="拆解图" style={{ maxWidth: '100%', borderRadius: 6 }} />
                  <div className="jz-row jz-wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ minWidth: 200, flex: '0 0 auto' }}>
                      <Field label="角色名" hint="填了就能一键建角色卡，省得去仓库页手动挂图">
                        <Input
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="如：三角初华"
                        />
                      </Field>
                    </div>
                    <Button
                      variant="primary"
                      icon={<Icon name="check" size={15} />}
                      onClick={() => void handleSaveAsCard()}
                      disabled={savingCard || !cardName.trim()}
                    >
                      {savingCard ? '建卡中…' : '存为角色卡'}
                    </Button>
                    <Button variant="ghost" onClick={() => setStep('prompt')}>改提示词再出一张</Button>
                  </div>
                  <div className="jz-xs jz-muted">拆解图已归档进素材库，建卡后即可在渲染页作为一致性锚点引用。</div>
                </div>
              ) : (
                <div className="jz-muted">还没有结果。回到「② 改提示词」点「生成拆解图」。</div>
              )}
            </Panel>

            {/*
              把这次实际提交的提示词留在这里。
              作用：改了提示词但出图看着没变化时，用户能立刻确认"提交的到底是哪一版"，
              而不是怀疑自己改错了地方。
            */}
            {lastJobPrompt ? (
              <Panel title={`本次提交的提示词（${lastJobPrompt.trim().length} 字符）`}>
                <pre className="jz-mono jz-xs" style={{
                  whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto',
                  background: 'var(--jz-bg-sunken)', padding: 10, borderRadius: 6, lineHeight: 1.7,
                }}>{lastJobPrompt.trim() || '（空 —— 提交时使用了默认提示词）'}</pre>
              </Panel>
            ) : null}
          </div>
        ) : null}
      </div>
    </Page>
  );
}

export default BreakdownPage;