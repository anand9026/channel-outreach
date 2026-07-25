import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="rx-page-head">
      <div>
        <h1 className="rx-page-title">{title}</h1>
        {subtitle ? <p className="rx-page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="rx-page-head-right">{actions}</div> : null}
    </header>
  )
}
