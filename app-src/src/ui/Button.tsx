import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** 加载态：自动 disabled 并前置转圈 */
  loading?: boolean;
  /** 前置图标 */
  icon?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'jz-btn',
    variant !== 'default' ? `jz-btn--${variant}` : '',
    size === 'sm' ? 'jz-btn--sm' : '',
    block ? 'jz-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="jz-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export default Button;