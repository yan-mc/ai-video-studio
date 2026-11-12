/**
 * 项目页 —— 列表 / 新建 / 选择 / 删除。
 * 新建只需要名称与分类，其余字段（rootPath/description）选填。
 */
import { useState } from 'react';

import { describeError } from '../api/client';
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
                placeholder="D:\\作品\\某项目"
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
      </div>
    </Page>
  );
}

export default ProjectsPage;