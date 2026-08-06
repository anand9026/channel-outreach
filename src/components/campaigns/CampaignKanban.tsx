import { useMemo } from 'react'
import type { Campaign, CampaignAnalytics, CampaignChannel, Conversation } from '../../types'
import { CampaignKanbanCard } from './CampaignKanbanCard'
import { kanbanColumns, campaignKanbanColumn } from './campaign-lifecycle'

type Props = {
  campaigns: Campaign[]
  channels: CampaignChannel[]
  analytics: CampaignAnalytics[]
  conversations: Conversation[]
  brands: Array<{ id: string; name: string }>
  onOpenCampaign: (id: string) => void
}

export function CampaignKanban({
  campaigns,
  channels,
  analytics,
  conversations,
  brands,
  onOpenCampaign,
}: Props) {
  const grouped = useMemo(() => {
    const map = Object.fromEntries(kanbanColumns.map((c) => [c.id, [] as Campaign[]])) as Record<
      string,
      Campaign[]
    >
    for (const c of campaigns) {
      map[campaignKanbanColumn(c)].push(c)
    }
    for (const col of kanbanColumns) {
      map[col.id].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return map
  }, [campaigns])

  return (
    <div className="rx-kanban" data-testid="campaigns-kanban">
      {kanbanColumns.map((col) => {
        const list = grouped[col.id] || []
        return (
          <div key={col.id} className="rx-kanban-col" data-testid={`kanban-col-${col.id}`}>
            <div className="rx-kanban-col-head">
              <span className="rx-kanban-col-title">{col.label}</span>
              <span className="rx-kanban-col-count">{list.length}</span>
            </div>
            <div className="rx-kanban-col-body">
              {list.length === 0 ? (
                <div className="rx-kanban-empty">No campaigns</div>
              ) : (
                list.map((c) => {
                  const a = analytics.find((x) => x.campaignId === c.id)
                  const dbSent = c.source === 'db' ? (c.sentCount ?? 0) : null
                  const sent =
                    dbSent !== null
                      ? dbSent
                      : (a?.whatsapp.sent || 0) + (a?.email.sent || 0)
                  const replies = (a?.whatsapp.replied || 0) + (a?.email.replied || 0)
                  const chs = channels.filter((ch) => ch.campaignId === c.id)
                  const unreadReplies = conversations.filter(
                    (conv) =>
                      conv.campaignIds.includes(c.id) &&
                      conv.unreadCount > 0 &&
                      conv.status !== 'resolved',
                  ).length
                  return (
                    <CampaignKanbanCard
                      key={c.id}
                      campaign={c}
                      sent={sent}
                      replies={replies}
                      recipientCount={c.recipientCount ?? c.influencerIds.length}
                      unreadReplies={unreadReplies}
                      hasWa={chs.some((ch) => ch.channel === 'whatsapp')}
                      hasEmail={chs.some((ch) => ch.channel === 'email')}
                      brandName={brands.find((b) => b.id === c.brandId)?.name}
                      onOpen={() => onOpenCampaign(c.id)}
                    />
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
