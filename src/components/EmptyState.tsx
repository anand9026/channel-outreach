import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  body?: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
}

export function EmptyState({ icon, title, body, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <div className="rx-empty">
      {icon ? <div className="rx-empty-icon">{icon}</div> : null}
      <div className="rx-empty-title">{title}</div>
      {body ? <p className="rx-empty-body">{body}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div className="rx-empty-actions">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
