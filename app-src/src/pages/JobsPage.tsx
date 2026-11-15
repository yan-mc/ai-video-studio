/**
 * 任务中心 —— 任务列表、状态徽标、取消/重试。
 *
 * 数据源：store/jobs.ts（与顶栏任务数共用，避免重复轮询）。
 */
import { useEffect } from 'react';

import { describeError } from '../api/client';
import type { Job, JobStatus } from '../api/types';
import { useJobsStore } from '../store';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Icon,
  Loading,
  Page,
  Panel,
  formatRelativeTime,
  useT,
} from '../ui';
import type { BadgeTone } from '../ui/Badge';
import { useToast } from '../ui/Toast';

function statusMeta(status: JobStatus, t: (k: string) => string): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'queued':
      return { label: t('jobs.statusQueued'), tone: 'default' };
    case 'running':
      return { label: t('jobs.statusRunning'), tone: 'accent' };
    case 'completed':
      return { label: t('jobs.statusCompleted'), tone: 'ok' };
    case 'failed':
      return { label: t('jobs.statusFailed'), tone: 'danger' };
    case 'cancelled':
      return { label: t('jobs.statusCancelled'), tone: 'warn' };
    case 'interrupted':
      return { label: t('jobs.statusInterrupted'), tone: 'warn' };
    default:
      return { label: String(status), tone: 'default' };
  }
}

export function JobsPage() {
  const t = useT();
  const toast = useToast();

  const jobs = useJobsStore((s) => s.jobs);
  const loading = useJobsStore((s) => s.loading);
  const loaded = useJobsStore((s) => s.loaded);
  const error = useJobsStore((s) => s.error);
  const loadJobs = useJobsStore((s) => s.loadJobs);
  const cancelJob = useJobsStore((s) => s.cancelJob);
  const retryJob = useJobsStore((s) => s.retryJob);

  useEffect(() => {
    void loadJobs();
    // 运行中任务存在时轮询，结束后自动停
    const hasActive = jobs.some((j) => j.status === 'running' || j.status === 'queued');
    if (!hasActive) return undefined;
    const timer = window.setInterval(() => void loadJobs(true), 2500);
    return () => window.clearInterval(timer);
  }, [loadJobs, jobs]);

  async function handleCancel(job: Job) {
    if (!window.confirm(t('jobs.cancelConfirm'))) return;
    try {
      await cancelJob(job.id);
      toast.ok(t('jobs.cancelled'));
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleRetry(job: Job) {
    try {
      await retryJob(job.id);
      toast.ok(t('jobs.retried'));
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const canCancel = (s: JobStatus) => s === 'running' || s === 'queued';
  const canRetry = (s: JobStatus) => s === 'failed' || s === 'cancelled' || s === 'interrupted';

  return (
    <Page
      title={t('jobs.title')}
      subtitle={t('jobs.subtitle')}
      actions={
        <Button icon={<Icon name="refresh" size={15} />} onClick={() => void loadJobs(true)}>
          {t('app.refresh')}
        </Button>
      }
    >
      {error ? <Alert tone="danger">{describeError(error)}</Alert> : null}

      {loading && !loaded ? (
        <Loading />
      ) : jobs.length === 0 ? (
        <EmptyState icon="jobs" title={t('jobs.empty')} hint={t('jobs.emptyHint')} />
      ) : (
        <Panel flush>
          <div className="jz-table__wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="jz-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('jobs.status')}</th>
                  <th>{t('jobs.backend')}</th>
                  <th>{t('jobs.prompt')}</th>
                  <th>{t('jobs.updatedAt')}</th>
                  <th style={{ textAlign: 'right' }}>{t('app.more')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const meta = statusMeta(job.status, t);
                  return (
                    <tr key={job.id}>
                      <td className="jz-mono jz-xs">{job.id.slice(0, 14)}…</td>
                      <td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="jz-xs">{job.backendId}</td>
                      <td>
                        <span className="jz-truncate jz-sm" title={job.prompt} style={{ display: 'inline-block', maxWidth: 360 }}>
                          {job.prompt || '—'}
                        </span>
                      </td>
                      <td className="jz-xs jz-muted">{formatRelativeTime(job.updatedAt)}</td>
                      <td>
                        <div className="jz-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                          {canCancel(job.status) ? (
                            <Button size="sm" onClick={() => void handleCancel(job)}>
                              {t('jobs.cancel')}
                            </Button>
                          ) : null}
                          {canRetry(job.status) ? (
                            <Button size="sm" onClick={() => void handleRetry(job)}>
                              {t('jobs.retry')}
                            </Button>
                          ) : null}
                          {job.error ? (
                            <Badge tone="danger" title={job.error}>
                              {t('jobs.error')}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </Page>
  );
}

export default JobsPage;