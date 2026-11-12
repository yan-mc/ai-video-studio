import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍标签（必填，图标按钮没有可见文字） */
  label: string;
  size?: number;
  variant?: 'default' | 'ghost';
  children: ReactNode;
}

export function IconButton({
  label,
  size = 18,
  variant = 'ghost',
  children,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = [
    'jz-btn',
    'jz-btn--icon',
    variant === 'ghost' ? 'jz-btn--ghost' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={cls} aria-label={label} title={label} {...rest}>
      <span style={{ display: 'inline-flex', width: size, height: size }}>{children}</span>
    </button>
  );
}

export default IconButton;