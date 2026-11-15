export function Kbd({ children }: { children: string }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '1px 5px',
        border: '1px solid var(--jz-border-strong)',
        borderRadius: 4,
        borderBottomWidth: 2,
        background: 'var(--jz-bg-layer-3)',
        color: 'var(--jz-text-secondary)',
        fontSize: 'var(--jz-fs-xs)',
        fontFamily: 'var(--jz-font-mono)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </kbd>
  );
}

export default Kbd;