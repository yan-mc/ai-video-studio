/**
 * 素材库页 —— 14 类资产列表、按类型/项目筛选、上传、空态与失败态。
 *
 * 上传走 POST /jiuzhang/api/assets/upload（multipart）。
 * 后端已实现完整 multipart 解析（host/api/index.js），支持多文件与字段。
 */
import { useEffect, useMemo, useState } from 'react';

import { useProjectStore } from '../store';
import { api, uploadAsset, describeError } from '../api/client';
import {
  Alert,
  Badge,
  IconButton,
  KeyValue,
  Field,
  Input,
  Button,
  EmptyState,
  Icon,
  Loading,
  Page,
  Panel,
  Select,
  Tabs,
  formatBytes,
  formatRelativeTime,
  useT,
} from '../ui';
import type { Asset, AssetType } from '../api/types';

type FilterValue = 'all' | AssetType;

export function AssetsPage() {
  const t = useT();
  const assets = useProjectStore((s) => s.assets);
  const loading = useProjectStore((s) => s.assetsLoading);
  const error = useProjectStore((s) => s.assetsError);
  const loadAssets = useProjectStore((s) => s.loadAssets);
  const assetTypeOptions = useProjectStore((s) => s.assetTypeOptions);

  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const selectProject = useProjectStore((s) => s.selectProject);

  const [type, setType] = useState<FilterValue>('all');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [detail, setDetail] = useState<Asset | null>(null);

  /** 删除资产（带确认） */
  async function handleDelete(e: React.MouseEvent, a: Asset) {
    e.stopPropagation();
    if (!window.confirm(`确定删除「${a.name}」？此操作不可恢复。`)) return;
    try {
      await api.deleteAsset(a.id);
      setDetail((d) => (d?.id === a.id ? null : d));
      setUploadMsg(`已删除「${a.name}」`);
      await loadAssets({
        ...(type !== 'all' ? { type } : {}),
        ...(currentProjectId ? { projectId: currentProjectId } : {}),
      });
    } catch (err) {
      setUploadMsg(`删除失败：${describeError(err)}`);
    }
  }

  /** 上传文件（支持多选）：逐个 POST /assets/upload，再刷新列表 */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';                       // 允许重复选同一文件
    if (!files.length) return;
    setUploading(true);
    setUploadMsg('');
    let ok = 0;
    const fails: string[] = [];
    for (const f of files) {
      try {
        await uploadAsset(f, {
          type: type !== 'all' ? String(type) : undefined,
          projectId: currentProjectId ?? undefined,
          name: f.name,
        });
        ok += 1;
      } catch (err) {
        fails.push(`${f.name}: ${describeError(err)}`);
      }
    }
    setUploading(false);
    setUploadMsg(ok ? `已上传 ${ok} 个${fails.length ? `，失败 ${fails.length} 个` : ''}` : `上传失败：${fails[0] ?? ''}`);
    await loadAssets({
      ...(type !== 'all' ? { type } : {}),
      ...(currentProjectId ? { projectId: currentProjectId } : {}),
    });
  }

  useEffect(() => {
    void loadAssets({
      ...(type !== 'all' ? { type } : {}),
      ...(currentProjectId ? { projectId: currentProjectId } : {}),
    });
  }, [loadAssets, type, currentProjectId]);

  const typeTabs = useMemo(() => {
    const opts = assetTypeOptions();
    return [
      { value: 'all' as FilterValue, label: t('app.all') },
      ...opts.map((o) => ({ value: o.value as FilterValue, label: o.label })),
    ];
  }, [assetTypeOptions, t]);

  const kindIcon = (a: Asset) => {
    switch (a.kind) {
      case 'image':
        return 'image' as const;
      case 'video':
        return 'video' as const;
      case 'audio':
        return 'audio' as const;
      case 'model3d':
        return 'cube' as const;
      case 'doc':
        return 'file' as const;
      default:
        return 'layers' as const;
    }
  };

  return (
    <Page
      title={t('assets.title')}
      subtitle={t('assets.subtitle')}
      actions={
        <>
          <Button icon={<Icon name="refresh" size={15} />} onClick={() => void loadAssets()}>
            {t('app.refresh')}
          </Button>
          <label className="jz-btn jz-btn--primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="upload" size={15} />
            <span>{uploading ? '上传中…' : t('assets.upload')}</span>
            <input
              type="file"
              multiple
              hidden
              accept="image/*,video/*,audio/*,.glb,.gltf,.fbx,.obj,.json,.txt,.md"
              onChange={(e) => void handleUpload(e)}
            />
          </label>
        </>
      }
    >
      <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
        <div className="jz-row jz-wrap" style={{ gap: 'var(--jz-sp-3)' }}>
          <label className="jz-row" style={{ gap: 8 }}>
            <span className="jz-label" style={{ margin: 0 }}>
              {t('assets.project')}
            </span>
            <Select<string>
              value={currentProjectId ?? ''}
              onChange={(v) => selectProject(v || null)}
              options={[
                { value: '', label: t('app.all') },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </label>
          <span className="jz-spacer" />
          <span className="jz-sm jz-muted">
            {assets.length} {t('assets.count')}
          </span>
        </div>

        <Tabs<FilterValue>
          items={typeTabs}
          value={type}
          onChange={setType}
          ariaLabel={t('assets.filterByType')}
        />

        {error ? <Alert tone="danger">{`${t('assets.loadFailed')} · ${error}`}</Alert> : null}
        {uploadMsg ? <Alert tone={uploadMsg.startsWith('上传失败') ? 'danger' : 'ok'}>{uploadMsg}</Alert> : null}

        {loading && assets.length === 0 ? (
          <Loading text={t('app.loading')} />
        ) : assets.length === 0 ? (
          <EmptyState
            icon="assets"
            title={t('assets.empty')}
            hint={t('assets.emptyHint')}
            actions={
              <Button icon={<Icon name="refresh" size={15} />} onClick={() => void loadAssets()}>
                {t('app.refresh')}
              </Button>
            }
          />
        ) : (
          <Panel flush>
            <div className="jz-table__wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="jz-table">
                <thead>
                  <tr>
                    <th style={{ width: 56 }}>{t('assets.name')}</th>
                    <th></th>
                    <th style={{ width: 110 }}>{t('assets.type')}</th>
                    <th style={{ width: 80 }}>{t('assets.kind')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{t('assets.size')}</th>
                    <th style={{ width: 100 }}>{t('assets.createdAt')}</th>
                    <th style={{ width: 76 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} onClick={() => setDetail(a)} style={{ cursor: 'pointer' }}>
                      <td>
                        {/* 缩略图：图片类显示预览，其他显示类型图标 */}
                        {a.kind === 'image' && a.rel ? (
                          <img
                            src={`/jiuzhang/api/assets/item?id=${encodeURIComponent(a.id)}`}
                            alt={a.name}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, display: 'block', background: 'var(--jz-bg-sunken)' }}
                            loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span style={{ display: 'inline-flex', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--jz-bg-sunken)', color: 'var(--jz-accent-text)' }}>
                            <Icon name={kindIcon(a)} size={18} />
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="jz-truncate" title={a.name}>{a.name}</span>
                      </td>
                      <td>
                        <Badge>{typeLabel(a.type)}</Badge>
                      </td>
                      <td className="jz-mono jz-xs">{a.kind}</td>
                      <td style={{ textAlign: 'right' }} className="jz-mono jz-xs">
                        {formatBytes(a.bytes)}
                      </td>
                      <td className="jz-xs jz-muted">{formatRelativeTime(a.createdAt)}</td>
                      <td>
                        <div className="jz-row" style={{ gap: 4 }}>
                          {a.rel ? (
                            <IconButton
                              label="下载"
                              title="下载"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/jiuzhang/api/assets/item?id=${encodeURIComponent(a.id)}`, '_blank');
                              }}
                            ><Icon name="download" size={14} /></IconButton>
                          ) : null}
                          <IconButton
                            label="删除"
                            title="删除"
                            onClick={(e) => void handleDelete(e, a)}
                          ><Icon name="trash" size={14} /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* 详情抽屉 */}
        {detail ? (
          <Panel
            title={`资产详情 · ${detail.name}`}
            actions={<Button onClick={() => setDetail(null)}>关闭</Button>}
          >
            <div className="jz-col" style={{ gap: 8 }}>
              {detail.kind === 'image' && detail.rel ? (
                <img
                  src={`/jiuzhang/api/assets/item?id=${encodeURIComponent(detail.id)}`}
                  alt={detail.name}
                  style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, objectFit: 'contain', background: 'var(--jz-bg-sunken)' }}
                />
              ) : null}
              {detail.kind === 'video' && detail.rel ? (
                <video
                  src={`/jiuzhang/api/assets/item?id=${encodeURIComponent(detail.id)}`}
                  controls
                  style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }}
                />
              ) : null}
              <KeyValue
                rows={[
                  { key: 'ID', value: <code className="jz-mono jz-xs">{detail.id}</code> },
                  { key: '类型', value: typeLabel(detail.type) },
                  { key: 'kind', value: detail.kind },
                  { key: '原始文件名', value: detail.originalName ?? '—' },
                  { key: '大小', value: formatBytes(detail.bytes) },
                  { key: '路径', value: <code className="jz-mono jz-xs">{detail.rel ?? '—'}</code> },
                  { key: '创建时间', value: formatRelativeTime(detail.createdAt) },
                ]}
              />
              <Field label="备注（只读）">
                <Input value={String((detail as unknown as { note?: string }).note ?? '')} readOnly />
              </Field>
            </div>
          </Panel>
        ) : null}
      </div>
    </Page>
  );

  function typeLabel(value: AssetType): string {
    return assetTypeOptions().find((o) => o.value === value)?.label ?? value;
  }
}

export default AssetsPage;


