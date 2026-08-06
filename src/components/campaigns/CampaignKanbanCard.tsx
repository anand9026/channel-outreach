import { AlertTriangle, Clock, Pause, Play } from 'lucide-react'
import type { Campaign } from '../../types'
import { campaignKanbanColumn, campaignStatusLabel } from './campaign-lifecycle'

type Props = {
  campaign: Campaign
  sent: number
  replies: number
  recipientCount: number
  unreadReplies: number
  hasWa: boolean
  hasEmail: boolean
  brandName?: string
  onOpen: () => void
}

export function CampaignKanbanCard({
  campaign: c,
  sent,
  replies,
  recipientCount,
  unreadReplies,
  hasWa,
  hasEmail,
  brandName,
  onOpen,
}: Props) {
  const col = campaignKanbanColumn(c)
  const total = recipientCount || c.influencerIds.length || c.recipientCount || 0
  const progress = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0
  const attention = c.status === 'attention'

  return (
    <button
      type="button"
      className={`rx-kanban-card${attention ? ' is-attention' : ''}`}
      onClick={onOpen}
      data-testid={`kanban-card-${c.id}`}
    >
      <div className="rx-kanban-card-head">
        <div className="rx-kanban-card-title">{c.name}</div>
        {attention ? (
          <span className="rx-kanban-attention" title="Needs attention">
            <AlertTriangle size={12} />
          </span>
        ) : null}
      </div>
      <div className="rx-kanban-card-meta">
        {brandName || 'Org-level'} · {campaignStatusLabel(c)}
      </div>
      <div className="rx-kanban-card-channels">
        {hasWa ? <span className="rx-channel-pill whatsapp">WhatsApp</span> : null}
        {hasEmail ? <span className="rx-channel-pill email">Gmail</span> : null}
        {!hasWa && !hasEmail ? <span className="rx-text-xs rx-muted">No sends yet</span> : null}
      </div>
      {col === 'running' || col === 'scheduled' ? (
        <div className="rx-kanban-progress">
          <div className="rx-kanban-progress-bar" style={{ width: `${progress}%` }} />
          <span className="rx-kanban-progress-label">
            {col === 'scheduled' ? (
              <>
                <Clock size={10} /> Scheduled
              </>
            ) : (
              <>
                <Play size={10} /> {progress}% sent
              </>
            )}
          </span>
        </div>
      ) : null}
      {col === 'paused' ? (
        <div className="rx-kanban-paused-note">
          <Pause size={10} /> Paused
        </div>
      ) : null}
      <div className="rx-kanban-card-stats">
        <span>{sent} sent</span>
        <span>{replies} replies</span>
        {unreadReplies > 0 ? <span className="rx-kanban-unread">{unreadReplies} unread</span> : null}
      </div>
    </button>
  )
}
