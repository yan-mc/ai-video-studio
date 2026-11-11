import type { HTMLAttributes, ReactNode } from 'react';

export interface LabelProps extends HTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

export function Label({ required, children, className, ...rest }: LabelProps) {
  return (
    <label className={['jz-label', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
      {required ? (
        <span className="jz-label__req" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export interface FieldProps {
  label?: string;
  hint?: string;
  required?: boolean;
  /** 布局：stack 竖排（默认）/ inline 左右 */
  inline?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, required, inline, children, className }: FieldProps) {
  const cls = ['jz-field', className ?? ''].filter(Boolean).join(' ');
  if (inline) {
    return (
      <div className={cls} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {label ? (
          <span className="jz-field__inline-label" style={{ minWidth: 96, flex: '0 0 auto' }}>
            <Label required={required}>{label}</Label>
          </span>
        ) : null}
        <div className="jz-grow jz-col" style={{ gap: 4 }}>
          {children}
          {hint ? <span className="jz-hint">{hint}</span> : null}
        </div>
      </div>
    );
  }
  return (
    <div className={cls}>
      {label ? <Label required={required}>{label}</Label> : null}
      {children}
      {hint ? <span className="jz-hint">{hint}</span> : null}
    </div>
  );
}

export default Field;