import type { ReactNode } from 'react';

export interface PanelProps {
  title?: ReactNode;
  /** 标题右侧的操作区 */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 内容区去掉内边距（用于表格/列表） */
  flush?: boolean;
  /** 紧凑内边距 */
  tight?: boolean;
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
  flush,
  tight,
}: PanelProps) {
  const bodyCls = [
    'jz-panel__body',
    flush ? 'jz-panel__body--flush' : '',
    tight ? 'jz-panel__body--tight' : '',
    bodyClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['jz-panel', className ?? ''].filter(Boolean).join(' ')}>
      {title || actions ? (
        <div className="jz-panel__head">
          <div className="jz-panel__title">{title}</div>
          {actions ? <div className="jz-row">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyCls}>{children}</div>
    </div>
  );
}

export default Panel;