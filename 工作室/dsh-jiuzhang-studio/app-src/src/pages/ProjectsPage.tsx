/**
 * 项目页 —— 列表 / 新建 / 选择 / 删除。
 * 新建只需要名称与分类，其余字段（rootPath/description）选填。
 */
import { useCallback, useEffect, useState } from 'react';

import { api, describeError } from '../api/client';
import type { ProjectCategory } from '../api/types';
import { useProjectStore } from '../store';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  Input,
  Loading,
  Page,
  Panel,
  Select,
  Textarea,
  formatRelativeTime,
  useT,
} from '../ui';
import { useToast } from '../ui/Toast';

export function ProjectsPage() {
  const t = useT();
  const toast = useToast();

  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.projectsLoading);
  const loaded = useProjectStore((s) => s.projectsLoaded);
  const error = useProjectStore((s) => s.projectsError);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const categoryOptions = useProjectStore((s) => s.categoryOptions);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProjectCategory>('free');
  const [rootPath, setRootPath] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError(t('projects.newNamePlaceholder'));
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const created = await createProject({
        name: trimmed,
        category,
        ...(rootPath.trim() ? { rootPath: rootPath.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setName('');
      setRootPath('');
      setDescription('');
      toast.ok(`${t('app.saved')} · ${created.name}`);
    } catch (err) {
      setFormError(describeError(err));
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('projects.deleteConfirm'))) return;
    try {
      await deleteProject(id);
      toast.ok(t('app.saved'));
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const categories = categoryOptions();

  return (
    <Page
      title={t('projects.title')}
      subtitle={t('projects.subtitle')}
      actions={
        <Button icon={<Icon name="refresh" size={15} />} onClick={() => void loadProjects(true)}>
          {t('app.refresh')}
        </Button>
      }
    >
      <div className="jz-split">
        {/* ------------------------------ 左：列表 ------------------------------ */}
        <div className="jz-col" style={{ gap: 'var(--jz-sp-4)' }}>
          {error ? <Alert tone="danger">{describeError(error)}</Alert> : null}
          {loading && !loaded ? (
            <Loading />
          ) : projects.length === 0 ? (
            <EmptyState icon="projects" title={t('projects.empty')} hint={t('projects.emptyHint')} />
          ) : (
            <div className="jz-cards">
              {projects.map((p) => {
                const active = p.id === currentProjectId;
                return (
                  <Card key={p.id} interactive selected={active}>
                    <div className="jz-row-between">
                      <span className="jz-card__title" title={p.name}>
                        {p.name}
                      </span>
                      {active ? <Badge tone="accent">{t('projects.current')}</Badge> : null}
                    </div>
                    <div className="jz-card__meta">
                      <Badge>
                        {categories.find((c) => c.value === p.category)?.label ?? p.category}
                      </Badge>
                      <span>
                        {t('projects.nodeCount')} {p.nodeCount}
                      </span>
                      <span>{formatRelativeTime(p.updatedAt)}</span>
                    </div>
                    {p.description ? (
                      <div className="jz-sm jz-muted jz-truncate" title={p.description}>
                        {p.description}
                      </div>
                    ) : null}
                    <div className="jz-row" style={{ marginTop: 'auto', gap: 6 }}>
                      <Button
                        size="sm"
                        variant={active ? 'default' : 'primary'}
                        onClick={() => selectProject(p.id)}
                        disabled={active}
                      >
                        {active ? t('projects.current') : t('projects.open')}
                      </Button>
                      <span className="jz-spacer" />
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Icon name="trash" size={13} />}
                        onClick={() => void handleDelete(p.id)}
                        aria-label={t('app.delete')}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ------------------------------ 右：新建 ------------------------------ */}
        <Panel title={t('projects.new')}>
          <div className="jz-col" style={{ gap: 'var(--jz-sp-3)' }}>
            <Field label={t('projects.newName')} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('projects.newNamePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                }}
              />
            </Field>

            <Field label={t('projects.category')}>
              <Select<ProjectCategory>
                value={category}
                onChange={setCategory}
                options={
                  categories.length > 0
                    ? (categories as Array<{ value: ProjectCategory; label: string }>)
                    : [{ value: 'free' as ProjectCategory, label: '自由创作' }]
                }
              />
            </Field>

            <Field label={t('projects.rootPath')} hint={t('app.unknown')}>
              <Input
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="作品\\某项目（也可用绝对路径）"
                mono
              />
            </Field>

            <Field label={t('projects.description')}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('projects.descriptionPlaceholder')}
                rows={3}
              />
            </Field>

            {formError ? <Alert tone="danger">{formError}</Alert> : null}

            <Button
              variant="primary"
              block
              loading={busy}
              icon={<Icon name="plus" size={15} />}
              onClick={() => void handleCreate()}
            >
              {t('app.create')}
            </Button>
          </div>
        </Panel>

        {/* --------------------------- 右：本项目角色卡 --------------------------- */}
        <Panel title="本项目角色卡">
          <ProjectCardsCard
            projectId={currentProjectId ?? ''}
            onSaved={() => { /* 选卡后无需刷新列表 */ }}
          />
        </Panel>
      </div>
    </Page>
  );
}

export default ProjectsPage;

/* ========================================================================== */
/* 项目 ⇄ 角色卡选择器                                                         */
/* ========================================================================== */

interface VaultCardLite {
  id: string; name: string; description: string;
  imageCount: number; resolvedImages: { slot: string; rel: string }[];
}

/**
 * 选本项目要用哪些角色卡。
 *
 * 关键：选完立刻显示**参考图预算**（几张 / 上限 9）。
 * 超限是硬约束——到生成时才报错就太晚了。
 */
function ProjectCardsCard({ projectId, onSaved }: { projectId: string; onSaved?: () => void }) {
  const toast = useToast();
  const [all, setAll] = useState<VaultCardLite[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState(9);

  const load = useCallback(async () => {
    if (!projectId) { setAll([]); setPicked([]); return; }
    setLoading(true);
    try {
      const [cards, bound, meta] = await Promise.all([
        api.vaultCards(), api.projectCards(projectId), api.vaultMeta(),
      ]);
      setAll(cards as VaultCardLite[]);
      setPicked(((bound as { cardIds?: string[] }).cardIds ?? []));
      setLimit((meta as { limits?: { maxRefImages?: number } }).limits?.maxRefImages ?? 9);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveProjectCards(projectId, picked);
      toast.ok('已保存本项目的角色卡');
      onSaved?.();
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  const used = all.filter((c) => picked.includes(c.id)).reduce((n, c) => n + c.imageCount, 0);
  const over = used > limit;

  if (!projectId) {
    return <div className="jz-sm jz-muted">先在左侧选中一个项目。</div>;
  }
  if (loading) return <Loading text="载入角色卡" />;

  return (
    <div className="jz-col" style={{ gap: 10 }}>
      <Alert tone={over ? 'danger' : used > limit - 2 ? 'warn' : 'info'}>
        参考图占用 <b>{used}</b> / {limit} 张
        {over ? ' —— 超出上限，生成时会被强制裁剪' : ''}
      </Alert>

      {all.length === 0 ? (
        <div className="jz-sm jz-muted">
          仓库里还没有角色卡。去「角色卡」页新建。
        </div>
      ) : (
        <div className="jz-col" style={{ gap: 6, maxHeight: 320, overflow: 'auto' }}>
          {all.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="jz-card"
                style={{
                  padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                  borderColor: on ? 'var(--jz-accent)' : undefined,
                  borderWidth: on ? 2 : 1,
                }}
              >
                <div className="jz-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <b className="jz-truncate">{c.name}</b>
                  <div className="jz-row" style={{ gap: 4 }}>
                    <Badge>{c.imageCount} 图</Badge>
                    {on ? <Badge tone="ok">已选</Badge> : null}
                  </div>
                </div>
                <div className="jz-xs jz-muted jz-truncate" style={{ marginTop: 3 }}>
                  {c.description || '（无描述）'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Button variant="primary" block loading={saving} onClick={() => void save()} disabled={saving}>
        保存选择
      </Button>
      <div className="jz-xs jz-muted">
        保存后，本项目每个分镜生成时都会自动带上这些角色的图与文字设定。
      </div>
    </div>
  );
}