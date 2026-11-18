/**
 * 错误边界 —— 防止"任何一处抛错 = 永久载入中"。
 *
 * 为什么必须有这一层：
 *   SPA 的 index.html 在 #root 为空时用 `#root:empty::after` 显示「载入中…」。
 *   React 18 在渲染期抛错时会**卸载整棵树**，root 重新变空 —— 于是用户
 *   看到的永远是「载入中…」，控制台之外没有任何线索。这个项目历史上
 *   反复出现"页面打不开 / 一直修不好"的描述，很大一部分就是这个表现：
 *   真正的错误被一个 loading 占位符盖住了。
 *
 * 现在的行为：捕获渲染错误，把错误信息、组件栈和"重试 / 回到渲染页"
 * 两个出口直接画在页面上。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 出错时的上下文名（页面名 / 区块名），便于定位 */
  scope?: string;
  /** 变化时自动复位（例如路由切换） */
  resetKey?: string;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    // 控制台留一份完整堆栈，方便从 DevTools 复制
    // eslint-disable-next-line no-console
    console.error(`[jiuzhang] 渲染失败（${this.props.scope ?? 'unknown'}）:`, error, info);
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  private reload = (): void => {
    window.location.reload();
  };

  private home = (): void => {
    window.location.hash = '#/render';
    this.setState({ error: null, info: null });
  };

  override render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          padding: '24px 20px',
          color: 'var(--jz-text-primary)',
          background: 'var(--jz-bg-base)',
          height: '100%',
          overflow: 'auto',
          lineHeight: 1.65,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6 }}>
          这个页面渲染失败了{this.props.scope ? ` · ${this.props.scope}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--jz-text-secondary)', marginBottom: 14 }}>
          错误已经被捕获，界面没有整体崩溃。下面是原始错误与组件栈，
          复制出来即可定位；「重试」会重置这个区块，「回到渲染页」会换一个页面。
        </div>

        <pre
          style={{
            margin: '0 0 12px',
            padding: 12,
            background: 'var(--jz-bg-sunken)',
            border: '1px solid var(--jz-border)',
            borderRadius: 'var(--jz-r-sm)',
            fontSize: 11.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--jz-font-mono)',
          }}
        >
          {error.name}: {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
          {info?.componentStack ? `\n\n--- component stack ---${info.componentStack}` : ''}
        </pre>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="jz-btn" onClick={this.reload}>重试（刷新页面）</button>
          <button type="button" className="jz-btn" onClick={this.home}>回到渲染页</button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
