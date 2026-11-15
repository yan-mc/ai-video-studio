import type { ReactNode } from 'react';

export interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** 内容区去掉内边距（画布这类需要铺满的页面） */
  flush?: boolean;
  className?: string;
}

export function Page({ title, subtitle, actions, children, flush, className }: PageProps) {
  return (
    <section className={['jz-page', className ?? ''].filter(Boolean).join(' ')}>
      <header className="jz-page__head">
        <div>
          <h1 className="jz-page__title">{title}</h1>
          {subtitle ? <p className="jz-page__sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="jz-page__actions">{actions}</div> : null}
      </header>
      <div className={flush ? 'jz-page__body jz-page__body--flush' : 'jz-page__body'}>{children}</div>
    </section>
  );
}

export default Page;