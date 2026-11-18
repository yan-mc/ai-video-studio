/**
 * 续写批次面板 —— 管理「连续镜头」的跨段 AV latent 续接。
 *
 * ============================================================================
 * 南风续写机制（用户视角）
 * ============================================================================
 *
 * 12 GB 卡做不了长镜头，必须拆段。续写的价值是：**段与段之间的动作连续**。
 *
 *   段1 生成 → 存下 AV latent
 *   段2 读取段1 的 latent → 从段1 的末态继续 → 存下自己的 latent
 *   段3 读段2 ……
 *
 * 每段会裁掉与前一段重叠的 context_length 帧（默认 22 帧 ≈ 0.92 秒），
 * 所以第 2 段起实际时长会比配置的短。
 *
 * ============================================================================
 * UI 职责
 * ============================================================================
 *
 *   · 建批次（选镜头序列 + context_length）
 *   · 显示进度（第几段 / 共几段）
 *   · 逐段"取任务 → 渲染 → 回写状态"
 *
 * @module components/ContinuationPanel
 */
import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from '../api/client';
import { Badge, Button, Field, Panel, Select, useToast } from '../ui';
import { subscribeEvents } from '../api/events';

interface ShotLite {
  id: string;
  title?: string;
}

interface BatchShot {
  index: number;
  shotId: string;
  status: string;
  jobId?: string | null;
  outputRel?: string | null;
  frames?: number | null;
}

interface Batch {
  batchId: string;
  projectId: string;
  preset: string;
  contextLength: string;
  audioContextLength: number;
  contextFolder: string;
  shots: BatchShot[];
  status: string;
  createdAt: number;
}

const CONTEXT_OPTIONS = [
  { value: '5', label: '5 帧（极少重叠）' },
  { value: '22', label: '22 帧（默认，约 0.92s）' },
  { value: '39', label: '39 帧（约 1.63s）' },
  { value: '56', label: '56 帧（约 2.33s）' },
];

export function ContinuationPanel({
  projectId,
  shots,
  onSubmitted,
}: {
  projectId: string | null;
  shots: ShotLite[];
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeId, setActiveId] = useState('');
  const [pickedShotIds, setPickedShotIds] = useState<string[]>([]);
  const [contextLength, setContextLength] = useState('22');
  const [busy, setBusy] = useState(false);

  const active = batches.find((b) => b.batchId === activeId) ?? null;

  const loadBatches = useCallback(async () => {
    if (!projectId) { setBatches([]); return; }
    try {
      const list = (await api.continuationList(projectId)) as unknown as Batch[];
      setBatches(Array.isArray(list) ? list : []);
    } catch { setBatches([]); }
  }, [projectId]);

  useEffect(() => { void loadBatches(); }, [loadBatches]);

  // 订阅批次进度
  useEffect(() => {
    const off = subscribeEvents((e) => {
      if (e.type === 'batch-progress') void loadBatches();
    });
    return off;
  }, [loadBatches]);

  const createBatch = useCallback(async () => {
    if (!projectId) { toast.error('先选项目'); return; }
    if (pickedShotIds.length < 2) { toast.error('至少选 2 个镜头'); return; }
    setBusy(true);
    try {
      const b = await api.continuationCreate({
        projectId,
        shotIds: pickedShotIds,
        preset: 'continuation',
        contextLength,
        audioContextLength: 24,
      }) as unknown as Batch;
      setActiveId(b.batchId);
      setPickedShotIds([]);
      await loadBatches();
      toast.ok(`批次已建（${b.shots.length} 段）`);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }, [projectId, pickedShotIds, contextLength, toast, loadBatches]);

  /**
   * 跑下一段。
   *
   * 流程：取任务 JSON → 存进镜头卡的 nanfeng.continuation → 提交生成。
   * 后续段的 job 完成由 jobs 轮询回写状态（此处只负责提交）。
   */
  const runNext = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try {
      const next = await api.continuationNext(active.batchId);
      if (next.done) { toast.info('批次已完成'); return; }
      if (!next.shotId || !next.task) { toast.error('取任务失败'); return; }

      // 把续写任务写进镜头卡的 nanfeng 字段
      await api.saveShot(active.projectId, {
        id: next.shotId,
        nanfeng: {
          presets: 'continuation',
          overrides: {
            启用潜空间续写: true,
            潜空间续写任务: next.task,
            context_length: active.contextLength,
            audio_context_length: active.audioContextLength,
          },
        },
      } as never);

      const job = await api.generate({
        projectId: active.projectId,
        shotId: next.shotId,
        backend: 'h3-nanfeng',
      } as never) as { id?: string };

      await api.continuationSegment({
        batchId: active.batchId,
        index: next.index!,
        status: 'running',
        jobId: String(job.id ?? ''),
      });

      toast.ok(`第 ${next.index} 段已提交`);
      await loadBatches();
      onSubmitted?.();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }, [active, toast, loadBatches, onSubmitted]);

  if (!projectId) {
    return <Panel title="续写批次" tight><div className="jz-xs jz-muted">先选一个项目</div></Panel>;
  }

  return (
    <Panel
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          续写批次
          {active ? <Badge tone={active.status === 'completed' ? 'ok' : 'accent'}>{active.status}</Badge> : null}
        </span>
      }
      actions={<Button variant="ghost" onClick={() => void loadBatches()}>刷新</Button>}
      tight
    >
      {/* 建批次 */}
      <div style={{ display: 'grid', gap: 8 }}>
        <Field label="选择镜头序列（按顺序）">
          <div style={{ display: 'grid', gap: 3, maxHeight: 140, overflowY: 'auto' }}>
            {shots.length === 0 ? (
              <div className="jz-xs jz-muted">还没有镜头卡</div>
            ) : shots.map((s) => {
              const idx = pickedShotIds.indexOf(s.id);
              const on = idx >= 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPickedShotIds((prev) => (
                      on ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                    ));
                  }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 6,
                    padding: '4px 8px', textAlign: 'left', font: 'inherit', color: 'var(--jz-text-primary)',
                    background: on ? 'var(--jz-accent-soft)' : 'var(--jz-bg-sunken)',
                    border: `1px solid ${on ? 'var(--jz-accent)' : 'var(--jz-border)'}`,
                    borderRadius: 'var(--jz-r-sm)', cursor: 'pointer',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || s.id}
                  </span>
                  {on ? <Badge tone="ok">#{idx + 1}</Badge> : null}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="重叠帧数（context_length）" hint="越大越连贯，但每段裁掉的越多">
          <Select value={contextLength} onChange={setContextLength} options={CONTEXT_OPTIONS} />
        </Field>

        <Button onClick={() => void createBatch()} disabled={busy || pickedShotIds.length < 2}>
          建批次（{pickedShotIds.length} 段）
        </Button>
      </div>

      {/* 批次列表 */}
      {batches.length > 0 ? (
        <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
          <div className="jz-xs jz-muted">已有批次：</div>
          {batches.slice(0, 5).map((b) => {
            const done = b.shots.filter((s) => s.status === 'completed').length;
            const on = b.batchId === activeId;
            return (
              <button
                key={b.batchId}
                type="button"
                onClick={() => setActiveId(b.batchId)}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 6,
                  padding: '4px 8px', textAlign: 'left', font: 'inherit', color: 'var(--jz-text-primary)',
                  background: on ? 'var(--jz-accent-soft)' : 'var(--jz-bg-sunken)',
                  border: `1px solid ${on ? 'var(--jz-accent)' : 'var(--jz-border)'}`,
                  borderRadius: 'var(--jz-r-sm)', cursor: 'pointer',
                }}
              >
                <span className="jz-mono jz-xs">{b.batchId.slice(0, 8)}</span>
                <span className="jz-xs">{done}/{b.shots.length}</span>
                <Badge tone={b.status === 'completed' ? 'ok' : 'default'}>{b.status}</Badge>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* 当前批次详情 */}
      {active ? (
        <div style={{ marginTop: 10 }}>
          <div className="jz-xs jz-muted" style={{ marginBottom: 4 }}>
            context 目录：<span className="jz-mono">{active.contextFolder.slice(0, 40)}…</span>
          </div>
          <div style={{ display: 'grid', gap: 2, marginBottom: 8 }}>
            {active.shots.map((s) => (
              <div key={s.index} className="jz-xs" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="jz-mono">#{s.index}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.shotId}
                </span>
                <Badge tone={s.status === 'completed' ? 'ok' : s.status === 'running' ? 'accent' : 'default'}>
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
          <Button
            onClick={() => void runNext()}
            disabled={busy || active.status === 'completed'}
          >
            {busy ? '提交中…' : '跑下一段'}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
