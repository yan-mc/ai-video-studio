/**
 * 素材库页 —— 14 类资产列表、按类型/项目筛选、上传、空态与失败态。
 *
 * 上传走 POST /luoshu/api/assets/upload（multipart）。
 * 后端已实现完整 multipart 解析（host/api/index.js），支持多文件与字段。
 */
import { useEffect, useMemo, useState } from 'react';

import { useProjectStore } from '../store';
import { uploadAsset, describeError } from '../api/client';
import {
  Alert,
  Badge,
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
                    <th>{t('assets.name')}</th>
                    <th>{t('assets.type')}</th>
                    <th>{t('assets.kind')}</th>
                    <th style={{ textAlign: 'right' }}>{t('assets.size')}</th>
                    <th>{t('assets.createdAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="jz-row" style={{ gap: 8 }}>
                          <span style={{ color: 'var(--jz-accent-text)', display: 'inline-flex' }}>
                            <Icon name={kindIcon(a)} size={15} />
                          </span>
                          <span className="jz-truncate" title={a.name}>
                            {a.name}
                          </span>
                        </span>
                      </td>
                      <td>
                        <Badge>{typeLabel(a.type)}</Badge>
                      </td>
                      <td className="jz-mono jz-xs">{a.kind}</td>
                      <td style={{ textAlign: 'right' }} className="jz-mono jz-xs">
                        {formatBytes(a.bytes)}
                      </td>
                      <td className="jz-xs jz-muted">{formatRelativeTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </Page>
  );

  function typeLabel(value: AssetType): string {
    return assetTypeOptions().find((o) => o.value === value)?.label ?? value;
  }
}

export default AssetsPage;
