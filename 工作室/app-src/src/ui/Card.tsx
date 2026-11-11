import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  children: ReactNode;
}

export function Card({ interactive, selected, children, className, ...rest }: CardProps) {
  const cls = [
    'jz-card',
    interactive ? 'jz-card--interactive' : '',
    selected ? 'jz-card--selected' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export default Card;