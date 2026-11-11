/**
 * 素材库页 —— 14 类资产列表、按类型/项目筛选、空态与失败态。
 *
 * 上传能力取决于后端是否暴露 multipart 路由；当前 host/api/index.js 的
 * POST /assets/upload 明确返回 USE_MULTIPART 占位，故这里只做列表与筛选，
 * 上传按钮在有真实 multipart 路由前保持禁用并给出说明。
 */
import { useEffect, useMemo, useState } from 'react';

import { useProjectStore } from '../store';
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
          <Button variant="primary" icon={<Icon name="upload" size={15} />} disabled title={t('assets.uploadHint')}>
            {t('assets.upload')}
          </Button>
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