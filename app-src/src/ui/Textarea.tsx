import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
  /** 最小行高，默认交给 CSS（96px） */
  minRows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { mono, minRows, className, rows, ...rest },
  ref,
) {
  const cls = ['jz-textarea', mono ? 'jz-input--mono' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const style = minRows ? { minHeight: `${minRows * 20 + 16}px` } : undefined;
  return <textarea ref={ref} className={cls} rows={rows} style={style} {...rest} />;
});

export default Textarea;