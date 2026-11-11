import type { ReactNode } from 'react';

export type AlertTone = 'info' | 'ok' | 'warn' | 'danger';

export interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', children, className }: AlertProps) {
  const cls = [
    'jz-alert',
    tone !== 'info' ? `jz-alert--${tone}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} role={tone === 'danger' || tone === 'warn' ? 'alert' : undefined}>
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</span>
    </div>
  );
}

export default Alert;