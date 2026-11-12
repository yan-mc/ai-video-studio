export type MeterTone = 'accent' | 'ok' | 'warn' | 'danger';

export interface MeterProps {
  /** 0—100 */
  value: number;
  tone?: MeterTone;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function Meter({ value, tone = 'accent', label, showValue, className }: MeterProps) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const fillCls = tone === 'accent' ? 'jz-meter__fill' : `jz-meter__fill jz-meter__fill--${tone}`;
  return (
    <div className={className}>
      {label || showValue ? (
        <div className="jz-row-between" style={{ marginBottom: 5 }}>
          <span className="jz-xs jz-muted">{label}</span>
          {showValue ? <span className="jz-xs jz-mono jz-secondary">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div
        className="jz-meter"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={fillCls} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default Meter;