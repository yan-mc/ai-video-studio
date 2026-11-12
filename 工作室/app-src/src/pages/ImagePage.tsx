/**
 * 图像生成页 —— H3-Image 文生图 / 参考图编辑。
 *
 * 模型特性（决定了 UI 设计）：
 *  - **6 步固定采样**，guidance 1.0，无 CFG → 没有"步数/CFG"滑块可调
 *  - **无负面提示词** → 只能写正向描述，UI 里给出提示
 *  - 提示词最长 **4096 token** → 鼓励写长、写详细
 *  - width/height=0 → 自动 2048×2048（模型调优面积）
 *  - 接参考图 = 编辑模式，最多 16 张
 */
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import {
  Alert, Badge, Button, Field, Icon, Input, Loading, Page, Panel, Select, Textarea, useToast,
} from '../ui';

interface SizeOpt { id: string; name: string; w: number; h: number; mp: number }
interface ModelStatus {
  ready: boolean; unet: string | null; vae: string | null; clip: string | null;
  missing: string[]; root: string;
}
interface ImageMeta {
  models: Record<string, string>;
  vae: string; clip: string;
  sampling: { steps: number; guidance: number; sampler: string; scheduler: string };
  sizes: SizeOpt[];
  status: ModelStatus;
}
interface Job {
  id: string; status: string; prompt?: string;
  outputs?: { role?: string; path?: string; bytes?: number }[];
  error?: string;
}

export function ImagePage() {
  const toast = useToast();
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [prompt, setPrompt] = useState('');
  const [sizeId, setSizeId] = useState('auto');
  const [seed, setSeed] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [preview, setPreview] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await api.imageMeta() as ImageMeta;
      setMeta(m);
      setErr('');
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 轮询图像任务
  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const all = await api.listJobs() as Job[];
          const imgs = (all ?? []).filter((j) => /^h3-image$|image/i.test(String((j as unknown as { backendId?: string }).backendId ?? '')));
          setJobs(imgs.slice(0, 12));
        } catch { /* ignore */ }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) { toast.error('请写提示词'); return; }
    if (!meta?.status?.ready) { toast.error('模型未就绪，请先完成下载'); return; }
    setBusy(true);
    try {
      const r = await api.imageGenerate({
        prompt,
        sizeId,
        ...(seed.trim() ? { seed: Number(seed) } : {}),
      }) as { id: string; status: string };
      toast.ok(`已提交任务 ${r.id.slice(0, 12)}…`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const curSize = meta?.sizes?.find((s) => s.id === sizeId);
  const ready = Boolean(meta?.status?.ready);

  if (loading) return <Page title="图像生成"><Loading text="载入中" /></Page>;

  return (
    <Page
      title="图像生成"
      subtitle="MiniMax H3-Image · 6 步采样 · 原生 16MP"
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void load()} disabled={busy}>刷新</Button>
          <Button variant="primary" icon={<Icon name="image" size={15} />} onClick={() => void handleGenerate()} disabled={busy || !ready}>
            {busy ? '提交中…' : '生成'}
          </Button>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        {err ? <Alert tone="danger">{err}</Alert> : null}

        {/* 模型状态 */}
        <Panel title="模型状态">
          <div className="jz-col" style={{ gap: 8 }}>
            <div className="jz-row jz-wrap" style={{ gap: 8 }}>
              <Badge tone={ready ? 'ok' : 'danger'}>{ready ? '模型就绪' : '模型缺失'}</Badge>
              {meta?.status?.unet ? <Badge>{meta.status.unet.replace('.safetensors', '')}</Badge> : null}
              <Badge>{meta?.sampling?.steps} 步</Badge>
              <Badge>guidance {meta?.sampling?.guidance}</Badge>
              <Badge>无 CFG</Badge>
            </div>
            {!ready ? (
              <>
                <Alert tone="warn">
                  缺少文件：{meta?.status?.missing?.join('、')}
                </Alert>
                <div className="jz-xs jz-muted jz-mono">模型根目录：{meta?.status?.root}</div>
              </>
            ) : null}
            <div className="jz-xs jz-muted">
              采样参数由 checkpoint 蒸馏固定，无可调项；该模型<b>不支持负面提示词</b>，请用正向描述。
            </div>
          </div>
        </Panel>

        <Panel title="提示词">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder={`详细描述画面（最长 4096 token，越长越准）：\n\n一位银蓝色长发的少女站在排练厅舞台中央，深蓝色礼服，蓝色发饰，\n暖色顶光从上方打下，深色幕布背景，电影感构图，浅景深，高质量动画渲染`}
          />
          <div className="jz-row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span className="jz-xs jz-muted">{prompt.length} / 4096 字符</span>
            {prompt.length > 4096 ? <Badge tone="danger">超长会被截断</Badge> : null}
          </div>
        </Panel>

        <Panel title="输出设置">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--jz-sp-3)' }}>
            <Field label="尺寸">
              <Select<string>
                value={sizeId}
                onChange={setSizeId}
                options={(meta?.sizes ?? []).map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.w ? ` · ${s.w}×${s.h}` : ''} · ${s.mp}MP`,
                }))}
              />
            </Field>
            <Field label="种子（留空随机）">
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} mono />
            </Field>
          </div>
          {curSize ? (
            <div className="jz-xs jz-muted" style={{ marginTop: 6 }}>
              {curSize.w === 0
                ? '自动尺寸：无参考图时输出 2048×2048'
                : `输出 ${curSize.w}×${curSize.h}（约 ${curSize.mp} MP）`}
            </div>
          ) : null}
        </Panel>

        <Panel title={`最近任务（${jobs.length}）`}>
          {jobs.length === 0 ? (
            <div className="jz-sm jz-muted">还没有图像任务。</div>
          ) : (
            <div className="jz-col" style={{ gap: 6 }}>
              {jobs.map((j) => (
                <div key={j.id} className="jz-card" style={{ padding: '8px 10px' }}>
                  <div className="jz-row" style={{ justifyContent: 'space-between' }}>
                    <div className="jz-row" style={{ gap: 8 }}>
                      <code className="jz-mono jz-xs">{j.id.slice(0, 16)}</code>
                      <Badge tone={j.status === 'completed' ? 'ok' : j.status === 'failed' ? 'danger' : 'warn'}>
                        {j.status === 'completed' ? '完成' : j.status === 'failed' ? '失败' : '进行中'}
                      </Badge>
                      {j.outputs?.[0]?.bytes ? <span className="jz-xs jz-muted">{Math.round(j.outputs[0].bytes / 1024)} KB</span> : null}
                    </div>
                    {j.outputs?.[0]?.path ? (
                      <Button onClick={() => {
                        const m = String(j.outputs?.[0]?.path).replace(/\\/g, '/').match(/outputs\/(.+)$/);
                        if (m) setPreview(`/luoshu/api/file?path=${encodeURIComponent(`outputs/${m[1]}`)}`);
                      }}>查看</Button>
                    ) : null}
                  </div>
                  <div className="jz-xs jz-muted" style={{ marginTop: 4 }}>{(j.prompt ?? '').slice(0, 100)}</div>
                  {j.error ? <div className="jz-xs" style={{ color: 'var(--jz-danger)' }}>{j.error}</div> : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {preview ? (
          <Panel title="预览">
            <img src={preview} alt="生成结果" style={{ maxWidth: '100%', borderRadius: 6 }} />
          </Panel>
        ) : null}
      </div>
    </Page>
  );
}

export default ImagePage;