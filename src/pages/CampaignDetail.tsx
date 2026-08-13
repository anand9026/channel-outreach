import { ArrowLeft, Loader2, MessageCircle, Pause, Play, RefreshCw, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { SendDrawer } from '../components/SendDrawer'
import { expandToInboxCampaignRows } from '../components/inbox/inbox-campaign-rows'
import { campaignKanbanColumn, campaignStatusLabel } from '../components/campaigns/campaign-lifecycle'
import { getOutreachCampaign, resolveOrgId, type OutreachCampaignRow } from '../lib/api'
import {
  AI_MODE_LABELS,
  AI_OBJECTIVE_LABELS,
} from '../lib/outreach-scope'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { CampaignAiMode, CampaignAiObjective } from '../types'

type DetailTab = 'overview' | 'messages' | 'conversations' | 'reports' | 'settings'

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'messages', label: 'Messages' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

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
  const [tab, setTab] = useState<DetailTab>('overview')

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
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.messages, campaignId],
  )

  const inboxRows = useMemo(() => {
    return expandToInboxCampaignRows(
      state.conversations,
      state.messages,
      state.campaignParticipantIndex,
      state.campaigns,
    ).filter((r) => r.campaignId === campaignId)
  }, [state.conversations, state.messages, state.campaignParticipantIndex, campaignId])

  useEffect(() => {
    if (campaign?.source !== 'db') return
    void actions.syncCampaignParticipants([campaignId])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, campaign?.source, tab])

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
  const lifecycle = campaignStatusLabel(campaign)
  const channels = state.channels.filter((ch) => ch.campaignId === campaignId)
  const aiObjective = campaign.aiObjective || dbRow?.ai_objective || 'gauge_interest'
  const aiMode = campaign.aiMode || dbRow?.ai_mode || 'assist'

  const openInbox = (rowCampaignId?: string) => {
    actions.setInboxCampaignFilter(rowCampaignId || campaignId)
    actions.setTab('inbox')
  }

  return (
    <div className="rx-page">
      <div className="rx-detail-head">
        <div>
          <button className="rx-back-btn" onClick={onBack} data-testid="detail-back">
            <ArrowLeft size={13} /> Campaigns
          </button>
          <h1 className="rx-detail-title">{campaign.name}</h1>
          <div className="rx-detail-meta">
            <span className="rx-badge dark">{lifecycle}</span>
            <span>·</span>
            <span>{brand?.name || 'Org-level'}</span>
            <span>·</span>
            <span>{campaign.influencerIds.length || campaign.recipientCount || 0} creators</span>
            <span>·</span>
            <span>{AI_OBJECTIVE_LABELS[aiObjective]}</span>
            {campaign.source === 'db' ? (
              <>
                <span>·</span>
                <span className="rx-badge db">SQL</span>
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
            >
              {refreshing ? <Loader2 size={14} className="rx-spin" /> : <RefreshCw size={14} />}
            </button>
          ) : null}
          <button type="button" className="rx-btn secondary" onClick={() => openInbox()}>
            <MessageCircle size={14} /> Inbox
          </button>
          <button type="button" className="rx-btn accent" onClick={() => setSendOpen(true)}>
            <Send size={14} /> Send again
          </button>
        </div>
      </div>

      <div className="rx-detail-tabs" role="tablist" data-testid="campaign-detail-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rx-detail-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
            data-testid={`campaign-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <div className="rx-metrics-grid">
            <Metric label="Sent" value={totalSent} />
            <Metric label="Delivered" value={totalDelivered} />
            <Metric label="Read / Opened" value={totalRead} />
            <Metric label="Replies" value={totalReplies} accent />
            <Metric label="Failed" value={totalFailed} muted />
          </div>
          <div className="rx-split">
            <div className="rx-card">
              <div className="rx-section-title">Funnel</div>
              <FunnelRow label="Queued" value={campaign.recipientCount ?? campaign.influencerIds.length} />
              <FunnelRow label="Sent" value={totalSent} />
              <FunnelRow label="Delivered" value={totalDelivered} />
              <FunnelRow label="Replied" value={totalReplies} />
            </div>
            <div className="rx-card">
              <div className="rx-section-title">AI tracking</div>
              <dl className="rx-dl">
                <dt>Objective</dt>
                <dd>{AI_OBJECTIVE_LABELS[aiObjective]}</dd>
                <dt>Mode</dt>
                <dd>{aiMode}</dd>
              </dl>
            </div>
            <div className="rx-card">
              <div className="rx-section-title">Channels</div>
              {channels.length === 0 ? (
                <p className="rx-text-sm rx-muted">No channel config yet.</p>
              ) : (
                channels.map((ch) => (
                  <div key={ch.id} className="rx-row rx-mb-2">
                    <span className={`rx-channel-pill ${ch.channel}`}>{ch.channel}</span>
                    <span className="rx-text-xs rx-muted">{ch.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === 'messages' ? (
        <div className="rx-card">
          <div className="rx-section-title">Recent messages</div>
          {messages.length === 0 ? (
            <EmptyState title="Nothing sent yet" body="Send this campaign to see activity." />
          ) : (
            <ul className="rx-feed">
              {messages.slice(0, 40).map((m) => {
                const conv = state.conversations.find((c) => c.id === m.conversationId)
                const inf = conv ? state.influencers.find((i) => i.id === conv.influencerId) : null
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="rx-feed-item"
                      onClick={() => {
                        actions.selectConversation(conv?.id ?? null, campaignId)
                        openInbox()
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
      ) : null}

      {tab === 'conversations' ? (
        <div className="rx-card flush">
          {inboxRows.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState title="No conversations" body="Replies will appear here once creators respond." />
            </div>
          ) : (
            <table className="rx-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Channels</th>
                  <th>Intent</th>
                  <th>Tags</th>
                  <th>Unread</th>
                  <th>Last message</th>
                </tr>
              </thead>
              <tbody>
                {inboxRows.map((row) => {
                  const inf = state.influencers.find((i) => i.id === row.influencerId)
                  return (
                    <tr key={row.rowId}>
                      <td>
                        <button
                          type="button"
                          className="rx-link-btn"
                          onClick={() => {
                            actions.selectConversation(row.conversationId, row.campaignId)
                            openInbox()
                          }}
                        >
                          {inf?.name || 'Unknown'}
                        </button>
                      </td>
                      <td>{row.channels.join(', ')}</td>
                      <td>{row.intent || '—'}</td>
                      <td>{row.labels?.length ? row.labels.join(', ') : '—'}</td>
                      <td>{row.unreadCount || '—'}</td>
                      <td className="rx-muted">{row.lastPreview?.slice(0, 60)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="rx-split">
          <div className="rx-card">
            <div className="rx-section-title">WhatsApp</div>
            <ChBreakdown label="WhatsApp" dotClass="wa" m={analytics?.whatsapp} />
          </div>
          <div className="rx-card">
            <div className="rx-section-title">Email</div>
            <ChBreakdown label="Email" dotClass="email" m={analytics?.email} />
          </div>
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div className="rx-card">
          <div className="rx-section-title">Campaign settings</div>
          <dl className="rx-dl">
            <dt>Status</dt>
            <dd>{lifecycle}</dd>
            <dt>Audience</dt>
            <dd>{campaign.audienceSource}</dd>
            <dt>Kind</dt>
            <dd>{campaign.kind}</dd>
            <dt>Created</dt>
            <dd>{new Date(campaign.createdAt).toLocaleString()}</dd>
          </dl>
          <div className="rx-section-title rx-mt-4">AI scope</div>
          <p className="rx-text-sm rx-muted rx-mb-2">
            Intent, tags, and reply suggestions are tracked per creator within this campaign.
          </p>
          <div className="form-grid-2">
            <label className="field">
              <span>Objective</span>
              <select
                value={aiObjective}
                disabled={campaign.source !== 'db'}
                onChange={(e) => {
                  void actions.updateCampaignAiSettings(campaignId, {
                    aiObjective: e.target.value as CampaignAiObjective,
                  })
                }}
              >
                {(Object.entries(AI_OBJECTIVE_LABELS) as Array<[CampaignAiObjective, string]>).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              <span>Mode</span>
              <select
                value={aiMode}
                disabled={campaign.source !== 'db'}
                onChange={(e) => {
                  void actions.updateCampaignAiSettings(campaignId, {
                    aiMode: e.target.value as CampaignAiMode,
                  })
                }}
              >
                {(Object.entries(AI_MODE_LABELS) as Array<[CampaignAiMode, string]>).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="rx-row rx-mt-4" style={{ gap: 8 }}>
            {campaignKanbanColumn(campaign) === 'running' ? (
              <button type="button" className="rx-btn secondary sm">
                <Pause size={12} /> Pause campaign
              </button>
            ) : (
              <button type="button" className="rx-btn secondary sm">
                <Play size={12} /> Resume campaign
              </button>
            )}
            <button type="button" className="rx-btn ghost sm" onClick={() => actions.setTab('templates')}>
              Manage templates
            </button>
          </div>
        </div>
      ) : null}

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
        style={{ color: accent ? 'var(--accent)' : muted ? 'var(--text-3)' : undefined }}
      >
        {value}
      </div>
    </div>
  )
}

function FunnelRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="rx-funnel-row">
      <span>{label}</span>
      <span className="mono">{value}</span>
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
  return (
    <div className="rx-col rx-gap">
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <span className="rx-ch-inline">
          <span className={`rx-ch-dot ${dotClass}`} /> {label}
        </span>
        <span className="mono">{sent} sent</span>
      </div>
      <div className="rx-text-xs rx-muted">
        Delivered {m?.delivered ?? 0} · Read {m?.read ?? 0} · Replies {m?.replied ?? 0} · Failed{' '}
        {m?.failed ?? 0}
      </div>
    </div>
  )
}

function statusBadge(status: string): string {
  if (status === 'failed') return 'err'
  if (status === 'read') return 'dark'
  if (status === 'delivered') return ''
  return ''
}
