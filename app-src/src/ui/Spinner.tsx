export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="jz-spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="载入中"
    />
  );
}

export function Loading({ text = '载入中…' }: { text?: string }) {
  return (
    <div className="jz-loading">
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export default Spinner;