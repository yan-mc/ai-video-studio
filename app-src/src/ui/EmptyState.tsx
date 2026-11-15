import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: IconName;
  actions?: ReactNode;
}

export function EmptyState({ title, hint, icon = 'layers', actions }: EmptyStateProps) {
  return (
    <div className="jz-empty">
      <div className="jz-empty__icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="jz-empty__title">{title}</div>
      {hint ? <div className="jz-empty__hint">{hint}</div> : null}
      {actions ? <div className="jz-empty__actions">{actions}</div> : null}
    </div>
  );
}

export default EmptyState;