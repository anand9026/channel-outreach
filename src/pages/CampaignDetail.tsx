import { ArrowLeft, Loader2, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { SendDrawer } from '../components/SendDrawer'
import { getOutreachCampaign, resolveOrgId, type OutreachCampaignRow } from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'

export function CampaignDetail({
  campaignId,
  onBack,
}: {
  campaignId: string
  onBack: () => void
}) {
  const { state, actions } = useWhatsAppStore()
  const campaign = state.campaigns.find((c) => c.id === campaignId)
  const [sendOpen, setSendOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dbRow, setDbRow] = useState<OutreachCampaignRow | null>(null)

  const refreshFromApi = async () => {
    if (!campaign || campaign.source !== 'db') return
    setRefreshing(true)
    try {
      const data = await getOutreachCampaign(campaignId, resolveOrgId())
      setDbRow(data?.campaign ?? null)
    } catch {
      /* keep local snapshot */
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void refreshFromApi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, campaign?.source])

  const analytics = state.analytics.find((a) => a.campaignId === campaignId)
  const messages = useMemo(
    () =>
      state.messages
        .filter((m) => m.campaignId === campaignId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30),
    [state.messages, campaignId],
  )

  if (!campaign) {
    return (
      <div className="rx-page">
        <EmptyState title="Campaign not found" body="It may have been deleted." />
      </div>
    )
  }

  const totalSent =
    dbRow?.sent_count ??
    campaign.sentCount ??
    (analytics?.whatsapp.sent || 0) + (analytics?.email.sent || 0)
  const totalDelivered = (analytics?.whatsapp.delivered || 0) + (analytics?.email.delivered || 0)
  const totalRead = (analytics?.whatsapp.read || 0) + (analytics?.email.read || 0)
  const totalReplies = (analytics?.whatsapp.replied || 0) + (analytics?.email.replied || 0)
  const totalFailed =
    dbRow?.failed_count ?? campaign.failedCount ?? (analytics?.whatsapp.failed || 0) + (analytics?.email.failed || 0)
  const brand = state.brands.find((b) => b.id === campaign.brandId)

  return (
    <div className="rx-page">
      <div className="rx-detail-head">
        <div>
          <button className="rx-back-btn" onClick={onBack} data-testid="detail-back">
            <ArrowLeft size={13} /> Campaigns
          </button>
          <h1 className="rx-detail-title">{campaign.name}</h1>
          <div className="rx-detail-meta">
            <span className={`rx-badge ${campaign.status === 'active' ? 'dark' : ''}`}>
              {campaign.status}
            </span>
            <span>·</span>
            <span>{brand?.name || 'Org-level'}</span>
            <span>·</span>
            <span>{campaign.influencerIds.length} creators</span>
            <span>·</span>
            <span>{campaign.kind}</span>
            {campaign.source === 'db' ? (
              <>
                <span>·</span>
                <span className="rx-badge db">SQL · org {resolveOrgId()}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="rx-row" style={{ gap: 8 }}>
          {campaign.source === 'db' ? (
            <button
              type="button"
              className="rx-btn ghost sm"
              disabled={refreshing}
              onClick={() => void refreshFromApi()}
              title="Refresh from database"
            >
              {refreshing ? (
                <Loader2 size={14} className="rx-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="rx-btn secondary"
            onClick={() => actions.setTab('inbox')}
          >
            <MessageCircle size={14} /> Open inbox
          </button>
          <button
            type="button"
            className="rx-btn accent"
            onClick={() => setSendOpen(true)}
            data-testid="detail-send-again"
          >
            <Send size={14} /> Send again
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="rx-metrics-grid">
        <Metric label="Sent" value={totalSent} />
        <Metric label="Delivered" value={totalDelivered} />
        <Metric label="Read / Opened" value={totalRead} />
        <Metric label="Replies" value={totalReplies} accent />
        <Metric label="Failed" value={totalFailed} muted />
      </div>

      {/* Channel breakdown */}
      <div className="rx-split">
        <div className="rx-card">
          <div className="rx-section-title">Recent activity</div>
          {messages.length === 0 ? (
            <EmptyState title="Nothing sent yet" body="Send this campaign to see live activity here." />
          ) : (
            <ul className="rx-feed">
              {messages.map((m) => {
                const conv = state.conversations.find((c) => c.id === m.conversationId)
                const inf = conv ? state.influencers.find((i) => i.id === conv.influencerId) : null
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="rx-feed-item"
                      onClick={() => {
                        actions.selectConversation(conv?.id ?? null)
                        actions.setTab('inbox')
                      }}
                    >
                      <div className={`rx-feed-dot ${m.channel === 'whatsapp' ? 'wa' : 'email'}`}>
                        {m.channel === 'whatsapp' ? 'W' : 'E'}
                      </div>
                      <div className="rx-feed-who">{inf?.name || 'Unknown'}</div>
                      <div className="rx-feed-preview">{m.body.slice(0, 100)}</div>
                      <div className="rx-feed-time">
                        <span className={`rx-badge ${statusBadge(m.status)}`}>{m.status}</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rx-card">
          <div className="rx-section-title">Channel breakdown</div>
          <div className="rx-col rx-gap">
            <ChBreakdown
              label="WhatsApp"
              dotClass="wa"
              m={analytics?.whatsapp}
            />
            <ChBreakdown label="Email" dotClass="email" m={analytics?.email} />
          </div>
        </div>
      </div>

      <SendDrawer
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        presetCampaignId={campaign.id}
        presetName={campaign.name}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
  muted,
}: {
  label: string
  value: number
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div className="rx-metric">
      <div className="rx-metric-label">{label}</div>
      <div
        className="rx-metric-value"
        style={{
          color: accent ? 'var(--accent)' : muted ? 'var(--text-3)' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ChBreakdown({
  label,
  dotClass,
  m,
}: {
  label: string
  dotClass: 'wa' | 'email'
  m?: { sent: number; delivered: number; read: number; replied: number; failed: number }
}) {
  const sent = m?.sent ?? 0
  const delivered = m?.delivered ?? 0
  const read = m?.read ?? 0
  const replied = m?.replied ?? 0
  const failed = m?.failed ?? 0
  const delRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0
  const engRate = sent > 0 ? Math.round((replied / sent) * 100) : 0
  return (
    <div className="rx-card compact" style={{ background: 'var(--surface-2)', border: 'none' }}>
      <div className="rx-row rx-mb-2">
        <span className={`rx-ch-dot ${dotClass}`} />
        <strong>{label}</strong>
        <span className="rx-spacer" />
        <span className="rx-text-sm rx-muted mono">{sent} sent</span>
      </div>
      <div className="rx-row rx-gap" style={{ flexWrap: 'wrap' }}>
        <MicroStat label="Delivered" value={delivered} />
        <MicroStat label="Read" value={read} />
        <MicroStat label="Replied" value={replied} />
        <MicroStat label="Failed" value={failed} />
        <div className="rx-spacer" />
        <MicroStat label="Delivery" value={`${delRate}%`} />
        <MicroStat label="Engagement" value={`${engRate}%`} />
      </div>
    </div>
  )
}

function MicroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 62 }}>
      <div className="rx-text-xs rx-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  )
}

function statusBadge(s: string) {
  switch (s) {
    case 'delivered':
    case 'read':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'danger'
    case 'scheduled':
      return 'warning'
    default:
      return ''
  }
}
