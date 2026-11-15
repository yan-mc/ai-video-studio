export interface CodeBlockProps {
  children: string;
  /** 最大高度，超出滚动 */
  maxHeight?: number;
  className?: string;
}

/** 只读代码/文本块（等宽、可换行）。用于显示 prompt、路径、错误详情 */
export function CodeBlock({ children, maxHeight = 320, className }: CodeBlockProps) {
  return (
    <pre
      className={['jz-code', className ?? ''].filter(Boolean).join(' ')}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </pre>
  );
}

export default CodeBlock;