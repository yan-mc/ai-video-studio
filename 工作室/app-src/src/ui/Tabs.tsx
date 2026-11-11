export interface TabItem<V extends string = string> {
  value: V;
  label: string;
  badge?: string | number;
}

export interface TabsProps<V extends string = string> {
  items: ReadonlyArray<TabItem<V>>;
  value: V;
  onChange: (value: V) => void;
  className?: string;
  ariaLabel?: string;
}

export function Tabs<V extends string = string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: TabsProps<V>) {
  return (
    <div
      className={['jz-tabs', className ?? ''].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={['jz-tab', item.value === value ? 'jz-tab--active' : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.badge !== undefined ? (
            <span className="jz-badge" style={{ marginLeft: 6, height: 16, padding: '0 5px' }}>
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default Tabs;