/**
 * 画布页 —— 只负责页面级框架（标题、项目提示、尺寸铺满）。
 * 真正的节点画布由 src/canvas/CanvasArea 提供（并行实现，此处仅挂载）。
 */
import CanvasArea from '../canvas/CanvasArea';
import { useProjectStore } from '../store';
import { Alert, Badge, Page, useT } from '../ui';

export function CanvasPage() {
  const t = useT();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.currentProjectId) ?? null);

  return (
    <Page
      title={project?.name ?? t('canvas.title')}
      subtitle={
        project
          ? `${t('projects.current')} · ${t('projects.nodeCount')} ${project.nodeCount}`
          : t('canvas.untitled')
      }
      actions={
        project ? (
          <Badge tone="accent">
            {t('projects.nodeCount')} {project.nodeCount}
          </Badge>
        ) : null
      }
      flush
    >
      {project ? (
        <CanvasArea />
      ) : (
        <div style={{ padding: 'var(--jz-sp-5) var(--jz-sp-6)' }}>
          <Alert tone="info">{t('projects.selectFirst')}</Alert>
        </div>
      )}
    </Page>
  );
}

export default CanvasPage;