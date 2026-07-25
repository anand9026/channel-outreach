import { Send, Sparkles, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { SendDrawer } from '../components/SendDrawer'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { CampaignDetail } from './CampaignDetail'

export function CampaignsHub() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const [sendOpen, setSendOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all')

  const campaigns = useMemo(() => {
    const list = state.campaigns.filter((c) =>
      filter === 'all' ? true : filter === 'active' ? c.status === 'active' : c.status === 'draft',
    )
    return list
  }, [state.campaigns, filter])

  const totals = useMemo(() => {
    return state.analytics.reduce(
      (acc, a) => ({
        sent: acc.sent + a.whatsapp.sent + a.email.sent,
        delivered: acc.delivered + a.whatsapp.delivered + a.email.delivered,
        replies: acc.replies + a.whatsapp.replied + a.email.replied,
      }),
      { sent: 0, delivered: 0, replies: 0 },
    )
  }, [state.analytics])

  if (detailId) {
    return <CampaignDetail campaignId={detailId} onBack={() => setDetailId(null)} />
  }

  const emptyReady = mode !== 'none' && state.campaigns.length === 0

  return (
    <div className="rx-page">
      <PageHeader
        title="Campaigns"
        subtitle="Everything you're sending, in one place. Start a new outreach or check on one in flight."
        actions={
          <button
            type="button"
            className="rx-btn accent lg"
            onClick={() => setSendOpen(true)}
            data-testid="new-outreach"
          >
            <Send size={15} />
            New outreach
          </button>
        }
      />

      {/* Hero — light, purposeful */}
      <div className="rx-hero">
        <div>
          <div className="rx-hero-title">
            <Sparkles size={16} style={{ display: 'inline', verticalAlign: -2, marginRight: 8, color: 'var(--accent)' }} />
            {mode === 'both'
              ? 'WhatsApp + Email ready to go'
              : mode === 'whatsapp'
                ? 'WhatsApp ready — Email is one click away'
                : mode === 'email'
                  ? 'Email ready — WhatsApp is one click away'
                  : 'Connect a channel to get started'}
          </div>
          <p className="rx-hero-lead">
            Pick a saved list of creators, choose a message, and pick a strategy. Reelax handles
            delivery, follow-ups, and pulls replies into a single inbox.
          </p>
          <div className="rx-quick-stats">
            <div className="rx-quick-stat">
              <div className="rx-quick-stat-label">Sent</div>
              <div className="rx-quick-stat-value">{totals.sent}</div>
            </div>
            <div className="rx-quick-stat">
              <div className="rx-quick-stat-label">Delivered</div>
              <div className="rx-quick-stat-value">{totals.delivered}</div>
            </div>
            <div className="rx-quick-stat">
              <div className="rx-quick-stat-label">Replies</div>
              <div className="rx-quick-stat-value">{totals.replies}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="rx-row rx-mb-4" style={{ justifyContent: 'space-between' }}>
        <div className="rx-seg">
          <button
            className={`rx-seg-btn${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`rx-seg-btn${filter === 'active' ? ' is-active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`rx-seg-btn${filter === 'draft' ? ' is-active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Draft
          </button>
        </div>
        <div className="rx-text-2 rx-text-sm">
          {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}
        </div>
      </div>

      {emptyReady ? (
        <EmptyState
          icon={<Send size={20} />}
          title="Send your first outreach"
          body="You have channels connected. Pick a creator list, choose a message, and Reelax will handle the rest."
          primaryAction={
            <button type="button" className="rx-btn accent" onClick={() => setSendOpen(true)}>
              <Send size={14} /> New outreach
            </button>
          }
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={20} />}
          title={`No ${filter} campaigns`}
          body="Try another filter, or start a new one."
        />
      ) : (
        <div className="rx-campaigns-list">
          {campaigns.map((c) => {
            const analytics = state.analytics.find((a) => a.campaignId === c.id)
            const sent = (analytics?.whatsapp.sent || 0) + (analytics?.email.sent || 0)
            const delivered = (analytics?.whatsapp.delivered || 0) + (analytics?.email.delivered || 0)
            const replies = (analytics?.whatsapp.replied || 0) + (analytics?.email.replied || 0)
            const engagement = sent > 0 ? Math.round((replies / sent) * 100) : 0
            const channels = state.channels.filter((ch) => ch.campaignId === c.id)
            const hasWa = channels.some((ch) => ch.channel === 'whatsapp')
            const hasEmail = channels.some((ch) => ch.channel === 'email')
            const brand = state.brands.find((b) => b.id === c.brandId)
            return (
              <button
                key={c.id}
                type="button"
                className="rx-camp-row"
                onClick={() => {
                  actions.selectCampaign(c.id)
                  setDetailId(c.id)
                }}
                data-testid={`campaign-${c.id}`}
              >
                <div className="rx-camp-name">
                  <div className="rx-camp-title">{c.name}</div>
                  <div className="rx-camp-meta">
                    {brand?.name || 'Org-level'} ·{' '}
                    <span className={`rx-badge ${c.status === 'active' ? 'dark' : ''}`}>
                      {c.status}
                    </span>{' '}
                    · {c.influencerIds.length} creators
                  </div>
                </div>
                <div className="rx-camp-channels">
                  {hasWa && <span className="rx-badge wa">WhatsApp</span>}
                  {hasEmail && <span className="rx-badge email">Email</span>}
                  {!hasWa && !hasEmail && <span className="rx-badge">Not sent</span>}
                </div>
                <div className="rx-camp-metric">
                  <div className="rx-camp-metric-label">Sent</div>
                  <div className="rx-camp-metric-value">{sent}</div>
                </div>
                <div className="rx-camp-metric">
                  <div className="rx-camp-metric-label">Replies</div>
                  <div className="rx-camp-metric-value">{replies}</div>
                </div>
                <div className="rx-camp-metric" style={{ minWidth: 100 }}>
                  <div className="rx-camp-metric-label">Engagement</div>
                  <div className="rx-progress" style={{ marginTop: 4 }}>
                    <span style={{ width: `${Math.min(100, engagement)}%` }} />
                  </div>
                  <div className="rx-text-xs rx-muted mono" style={{ marginTop: 2 }}>
                    {engagement}%
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <SendDrawer open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  )
}
