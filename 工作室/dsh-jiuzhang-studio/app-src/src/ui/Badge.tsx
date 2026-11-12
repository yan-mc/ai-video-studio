import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'default', children, className, ...rest }: BadgeProps) {
  const cls = ['jz-badge', tone !== 'default' ? `jz-badge--${tone}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

export default Badge;