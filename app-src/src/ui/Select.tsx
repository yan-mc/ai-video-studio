import type { SelectHTMLAttributes } from 'react';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<V extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  options: ReadonlyArray<SelectOption<V>>;
  value: V;
  onChange: (value: V) => void;
  placeholder?: string;
}

/**
 * 受控下拉：onChange 直接给值，省掉组件里的 e.target.value 噪音。
 * 泛型化以便 value 收敛到具体联合类型（如 BackendId）。
 */
export function Select<V extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  className,
  ...rest
}: SelectProps<V>) {
  const cls = ['jz-select', className ?? ''].filter(Boolean).join(' ');
  return (
    <select
      className={cls}
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
      {...rest}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default Select;