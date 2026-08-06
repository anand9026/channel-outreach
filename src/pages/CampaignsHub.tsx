import { Send, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { CampaignKanban } from '../components/campaigns/CampaignKanban'
import { SendDrawer } from '../components/SendDrawer'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { CampaignDetail } from './CampaignDetail'

export function CampaignsHub() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const [sendOpen, setSendOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(state.detailCampaignId)
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all')

  useEffect(() => {
    const open = () => setSendOpen(true)
    window.addEventListener('rx-open-send-drawer', open)
    return () => window.removeEventListener('rx-open-send-drawer', open)
  }, [])

  useEffect(() => {
    if (state.detailCampaignId) setDetailId(state.detailCampaignId)
  }, [state.detailCampaignId])

  const openDetail = (id: string) => {
    actions.selectCampaign(id)
    setDetailId(id)
    actions.setDetailCampaign(id)
  }

  const closeDetail = () => {
    setDetailId(null)
    actions.setDetailCampaign(null)
  }

  const campaigns = useMemo(() => {
    const list = state.campaigns.filter((c) =>
      filter === 'all' ? true : filter === 'active' ? c.status === 'active' : c.status === 'draft',
    )
    return list
  }, [state.campaigns, filter])

  const totals = useMemo(() => {
    const fromDb = state.campaigns
      .filter((c) => c.source === 'db')
      .reduce(
        (acc, c) => ({
          sent: acc.sent + (c.sentCount ?? 0),
          failed: acc.failed + (c.failedCount ?? 0),
        }),
        { sent: 0, failed: 0 },
      )
    const local = state.analytics.reduce(
      (acc, a) => ({
        sent: acc.sent + a.whatsapp.sent + a.email.sent,
        delivered: acc.delivered + a.whatsapp.delivered + a.email.delivered,
        replies: acc.replies + a.whatsapp.replied + a.email.replied,
      }),
      { sent: 0, delivered: 0, replies: 0 },
    )
    return {
      sent: Math.max(local.sent, fromDb.sent),
      delivered: local.delivered,
      replies: local.replies,
      failed: fromDb.failed,
      dbCampaigns: state.campaigns.filter((c) => c.source === 'db').length,
    }
  }, [state.analytics, state.campaigns])

  if (detailId) {
    return <CampaignDetail campaignId={detailId} onBack={closeDetail} />
  }

  const emptyReady = mode !== 'none' && state.campaigns.length === 0
  const connectNeeded = mode === 'none'

  return (
    <div className="rx-page">
      <PageHeader
        title="Campaigns"
        subtitle="Campaign-first outreach — draft, schedule, launch, and track every send."
        actions={
          <button
            type="button"
            className="rx-btn accent lg"
            onClick={() => setSendOpen(true)}
            data-testid="new-outreach"
          >
            <Send size={15} />
            New campaign
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
          {connectNeeded ? (
            <div className="rx-card compact" style={{ marginTop: 16, maxWidth: 560 }}>
              <div className="rx-card-title">Start here</div>
              <div className="rx-card-sub">
                No channels are connected yet. Open the Connect screen to add WhatsApp, Gmail, or
                both.
              </div>
              <div className="rx-row" style={{ marginTop: 12, gap: 12 }}>
                <button
                  type="button"
                  className="rx-btn accent"
                  onClick={() => actions.setTab('campaigns')}
                  data-testid="goto-connect"
                >
                  Connect channels
                </button>
                <button
                  type="button"
                  className="rx-btn secondary"
                  onClick={() => actions.setTab('templates')}
                >
                  View templates
                </button>
              </div>
            </div>
          ) : null}
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
            {totals.dbCampaigns > 0 ? (
              <div className="rx-quick-stat">
                <div className="rx-quick-stat-label">In database</div>
                <div className="rx-quick-stat-value">{totals.dbCampaigns}</div>
              </div>
            ) : null}
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
        <CampaignKanban
          campaigns={campaigns}
          channels={state.channels}
          analytics={state.analytics}
          conversations={state.conversations}
          brands={state.brands}
          onOpenCampaign={openDetail}
        />
      )}

      <SendDrawer open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  )
}
