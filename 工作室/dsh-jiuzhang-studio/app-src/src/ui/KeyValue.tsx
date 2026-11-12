import type { ReactNode } from 'react';

export interface KeyValueRow {
  key: string;
  value: ReactNode;
}

export interface KeyValueProps {
  rows: ReadonlyArray<KeyValueRow>;
  className?: string;
}

/** 键值对列表 —— 详情页/状态卡的统一排版 */
export function KeyValue({ rows, className }: KeyValueProps) {
  return (
    <div className={['jz-kv', className ?? ''].filter(Boolean).join(' ')}>
      {rows.map((row) => (
        <div key={row.key} style={{ display: 'contents' }}>
          <span className="jz-kv__k">{row.key}</span>
          <span className="jz-kv__v">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export default KeyValue;