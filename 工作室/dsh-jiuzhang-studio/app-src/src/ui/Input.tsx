import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 等宽字体（用于路径、ID 等） */
  mono?: boolean;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, invalid, className, type = 'text', ...rest },
  ref,
) {
  const cls = [
    'jz-input',
    mono ? 'jz-input--mono' : '',
    invalid ? 'jz-input--invalid' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <input ref={ref} type={type} className={cls} aria-invalid={invalid || undefined} {...rest} />;
});

export default Input;