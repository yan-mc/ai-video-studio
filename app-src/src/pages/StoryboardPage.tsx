/**
 * 智能分镜页 —— 用 DSH 内部 LLM 看图并写分镜提示词。
 *
 * ============================================================================
 * 流程
 * ============================================================================
 *
 *   选参考图 → 选模式/段数 → [生成分镜]
 *       ↓ 后端逐图视觉分析
 *       ↓ 文本模型按 modeContract 写分镜
 *       ↓ parseStoryboard 校验段号
 *   ← 返回 N 段可直接用的提示词
 *
 * ============================================================================
 * 7 种模式
 * ============================================================================
 *
 *   ref2va               Ref2VA 多参参考（六段式）
 *   reference_i2va       非首帧 I2V 图片参考
 *   i2va                 I2VA 图生视频（首帧对齐）
 *   fl2va                FL2VA 首尾帧
 *   t2va                 T2VA 文生视频
 *   oneshot_continuation 续写·一镜到底
 *   continuation_cuts    续写·可切镜
 *
 * @module pages/StoryboardPage
 */
import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from '../api/client';
import { Alert, Badge, Button, Field, Input, Page, Panel, Select, Spinner, useToast } from '../ui';
import { AssetPicker, type AssetItem, type PickedMedia } from '../components/AssetPicker';

/** 智能分镜不用视频/音频；给 AssetPicker 一个只读空数组占位（kinds 已把入口去掉） */
const EMPTY_MEDIA: PickedMedia[] = [];

interface StoryboardResult {
  mode: string;
  count: number;
  global: string;
  segments: string[];
  analysis: string;
  raw: string;
}

export function StoryboardPage() {
  const toast = useToast();

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [images, setImages] = useState<PickedMedia[]>([]);

  const [meta, setMeta] = useState<{
    modes: Record<string, string>;
    skills: Array<{ id: string; label: string; desc: string }>;
    llm: { available: boolean; reason: string; text: unknown; vision: unknown };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [idea, setIdea] = useState('');
  const [count, setCount] = useState('3');
  const [mode, setMode] = useState('ref2va');
  /** 提示词 skill（regular_storyboard / ns_storyboard）—— 续写模式下不适用 */
  const [skillId, setSkillId] = useState('regular_storyboard');
  const [durationSec, setDurationSec] = useState('5');
  const [contextLength, setContextLength] = useState('22');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<StoryboardResult | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      const list = (await api.listAssets({})) as unknown as AssetItem[];
      setAssets(Array.isArray(list) ? list : []);
    } catch { setAssets([]); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [m] = await Promise.all([api.storyboardMeta(), loadAssets()]);
        setMeta(m);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAssets]);

  const isContinuation = mode === 'oneshot_continuation' || mode === 'continuation_cuts';

  const generate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const r = await api.storyboardGenerate({
        idea,
        count: Math.max(1, Math.min(12, Number(count) || 1)),
        mode,
        // 续写模式走专用 skill，后端会忽略 skillId
        ...(isContinuation ? {} : { skillId }),
        imageRels: images.map((m) => m.rel),
        durationSec: Number(durationSec) || 5,
        ...(isContinuation ? { contextLength: Number(contextLength) } : {}),
      });
      setResult(r);
      toast.ok(`已生成 ${r.segments.length} 段`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setGenerating(false);
    }
  }, [idea, count, mode, skillId, images, durationSec, contextLength, isContinuation, toast]);

  if (loading) return <Page title="智能分镜"><Spinner /></Page>;

  const llmOk = Boolean(meta?.llm?.available);

  return (
    <Page title="智能分镜" subtitle="用 DSH 内部模型看图并写分镜提示词（无需 API Key）">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {!llmOk ? (
        <Alert tone="warn">
          LLM 不可用：{meta?.llm?.reason || '未配置模型'}。
          请在 DSH 设置里配置默认模型后再用本页。
        </Alert>
      ) : (
        <Alert tone="info">
          使用模型：{JSON.stringify(meta?.llm?.text)}
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        {/* 左：配置 */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <AssetPicker
            assets={assets}
            images={images}
            videos={EMPTY_MEDIA}
            audios={EMPTY_MEDIA}
            onImages={setImages}
            /**
             * ⚠️ 智能分镜的接口只接受参考图（imageRels）。
             *    旧代码这里传的是 () => {} —— 视频/音频 tab 点得动、
             *    选了却什么都不会发生，是**UI 在撒谎**。
             *    现在用 kinds={['image']} 把假入口整个去掉。
             */
            onVideos={() => {}}
            onAudios={() => {}}
            kinds={['image']}
            onRefresh={() => void loadAssets()}
          />

          <Panel title="生成设置" tight>
            <div style={{ display: 'grid', gap: 8 }}>
              <Field label="模式">
                <Select
                  value={mode}
                  onChange={setMode}
                  options={Object.entries(meta?.modes ?? {}).map(([v, l]) => ({ value: v, label: l }))}
                />
              </Field>
              <Field label="段数" hint="1-12">
                <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} mono />
              </Field>
              {/**
               * 提示词 Skill —— 决定"用什么规范写分镜"。
               *
               * ⚠️ 以前前端**没有这个选择器**，后端 `skillId` 也是死参数，
               *    所以「NS 提示词分镜（海螺，26.7KB 那份）」永远不可达。
               *    现在两处都打通了。
               */}
              {!isContinuation && meta?.skills?.length ? (
                <Field label="提示词 Skill" hint="决定分镜的写作规范">
                  <Select
                    value={skillId}
                    onChange={setSkillId}
                    options={meta.skills.map((s) => ({ value: s.id, label: s.label }))}
                  />
                </Field>
              ) : null}
              <Field label="每段时长（秒）">
                <Input type="number" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} mono />
              </Field>
              {isContinuation ? (
                <Field label="重叠帧数" hint="续写模式专用">
                  <Select
                    value={contextLength}
                    onChange={setContextLength}
                    options={[
                      { value: '5', label: '5 帧' },
                      { value: '22', label: '22 帧（默认）' },
                      { value: '39', label: '39 帧' },
                      { value: '56', label: '56 帧' },
                    ]}
                  />
                </Field>
              ) : null}
              <Button onClick={() => void generate()} disabled={generating || !llmOk}>
                {generating ? '生成中…' : '生成分镜'}
              </Button>
            </div>
          </Panel>
        </div>

        {/* 右：输入 + 结果 */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Panel title="你的想法">
            <textarea
              className="jz-input"
              rows={5}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="例：两人在海边散步，走到长椅前坐下，然后相向亲吻。要一段连续的长镜头感。"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Panel>

          {result ? (
            <>
              {result.global ? (
                <Panel title="全局提示词" tight>
                  <div className="jz-xs jz-mono" style={{ whiteSpace: 'pre-wrap' }}>{result.global}</div>
                </Panel>
              ) : null}

              {result.analysis ? (
                <Panel title="逐图分析" tight>
                  <div className="jz-xs jz-muted" style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                    {result.analysis}
                  </div>
                </Panel>
              ) : null}

              <Panel
                title={<span>分镜（{result.segments.length} 段）</span>}
                actions={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard?.writeText(result.segments.join('\n\n---\n\n'));
                      toast.ok('已复制');
                    }}
                  >
                    全部复制
                  </Button>
                }
                tight
              >
                <div style={{ display: 'grid', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
                  {result.segments.map((seg, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 8,
                        background: 'var(--jz-bg-sunken)',
                        border: '1px solid var(--jz-border)',
                        borderRadius: 'var(--jz-r-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Badge tone="accent">段 {i + 1}</Badge>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            void navigator.clipboard?.writeText(seg);
                            toast.ok(`段 ${i + 1} 已复制`);
                          }}
                        >
                          复制
                        </Button>
                      </div>
                      <div className="jz-xs jz-mono" style={{ whiteSpace: 'pre-wrap' }}>{seg}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          ) : (
            <Panel title="分镜结果" tight>
              <div className="jz-xs jz-muted">选好参考图和模式后，点「生成分镜」。</div>
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}

export default StoryboardPage;
