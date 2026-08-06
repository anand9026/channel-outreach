import { useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { useWhatsAppStore } from '../store/WhatsAppStore'

type ReportTab = 'overview' | 'campaigns' | 'channels' | 'creators'

export function ResultsV2() {
  const { state, actions } = useWhatsAppStore()
  const [tab, setTab] = useState<ReportTab>('overview')

  const totals = useMemo(() => {
    return state.analytics.reduce(
      (acc, a) => ({
        sent: acc.sent + a.whatsapp.sent + a.email.sent,
        delivered: acc.delivered + a.whatsapp.delivered + a.email.delivered,
        read: acc.read + a.whatsapp.read + a.email.read,
        replies: acc.replies + a.whatsapp.replied + a.email.replied,
        failed: acc.failed + a.whatsapp.failed + a.email.failed,
        waSent: acc.waSent + a.whatsapp.sent,
        waReplied: acc.waReplied + a.whatsapp.replied,
        emailSent: acc.emailSent + a.email.sent,
        emailReplied: acc.emailReplied + a.email.replied,
      }),
      { sent: 0, delivered: 0, read: 0, replies: 0, failed: 0, waSent: 0, waReplied: 0, emailSent: 0, emailReplied: 0 },
    )
  }, [state.analytics])

  // Compute per-day trend buckets over the last 30 days from state.messages
  const trends = useMemo(() => {
    const days = 30
    const now = Date.now()
    const bucket = (label: string) => ({
      label,
      sent: new Array(days).fill(0) as number[],
      delivered: new Array(days).fill(0) as number[],
      read: new Array(days).fill(0) as number[],
      replied: new Array(days).fill(0) as number[],
    })
    const total = bucket('total')
    for (const m of state.messages) {
      const ts = new Date(m.createdAt).getTime()
      const daysAgo = Math.floor((now - ts) / (24 * 60 * 60 * 1000))
      if (daysAgo < 0 || daysAgo >= days) continue
      const idx = days - 1 - daysAgo
      if (m.direction === 'outbound' && (m.status === 'sent' || m.status === 'delivered' || m.status === 'read')) {
        total.sent[idx] += 1
      }
      if (m.direction === 'outbound' && (m.status === 'delivered' || m.status === 'read')) {
        total.delivered[idx] += 1
      }
      if (m.direction === 'outbound' && m.status === 'read') {
        total.read[idx] += 1
      }
      if (m.direction === 'inbound') {
        total.replied[idx] += 1
      }
    }
    return total
  }, [state.messages])

  const engagement = totals.sent > 0 ? Math.round((totals.replies / totals.sent) * 100) : 0
  const delivery = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0

  const creatorStats = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; campaigns: Set<string>; replies: number; sent: number }
    >()
    for (const m of state.messages) {
      const conv = state.conversations.find((c) => c.id === m.conversationId)
      if (!conv) continue
      const inf = state.influencers.find((i) => i.id === conv.influencerId)
      const id = conv.influencerId
      const cur = map.get(id) || {
        id,
        name: inf?.name || 'Unknown',
        campaigns: new Set<string>(),
        replies: 0,
        sent: 0,
      }
      if (m.campaignId) cur.campaigns.add(m.campaignId)
      if (m.direction === 'outbound') cur.sent += 1
      if (m.direction === 'inbound') cur.replies += 1
      map.set(id, cur)
    }
    return [...map.values()].sort((a, b) => b.replies - a.replies)
  }, [state.messages, state.conversations, state.influencers])

  return (
    <div className="rx-page">
      <PageHeader
        title="Reports"
        subtitle="Delivery, reads, and replies across campaigns — filterable by channel and campaign."
      />

      <div className="rx-detail-tabs rx-mb-4" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['campaigns', 'Campaigns'],
            ['channels', 'Channels'],
            ['creators', 'Creators'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rx-detail-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
            data-testid={`report-tab-${id}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
      <div className="rx-metrics-grid rx-mb-6">
        <MetricCard label="Sent" value={totals.sent} spark={trends.sent} />
        <MetricCard label="Delivered" value={totals.delivered} sub={`${delivery}%`} spark={trends.delivered} />
        <MetricCard label="Read / Opened" value={totals.read} spark={trends.read} />
        <MetricCard
          label="Replies"
          value={totals.replies}
          sub={`${engagement}% engagement`}
          accent
          spark={trends.replied}
        />
        <MetricCard label="Failed" value={totals.failed} muted />
      </div>

      {/* Per-channel */}
      <div className="rx-split">
        <div className="rx-card">
          <div className="rx-section-title">
            <span className="rx-ch-inline">
              <span className="rx-ch-dot wa" /> WhatsApp
            </span>
          </div>
          <ChannelSummary sent={totals.waSent} replied={totals.waReplied} />
        </div>
        <div className="rx-card">
          <div className="rx-section-title">
            <span className="rx-ch-inline">
              <span className="rx-ch-dot email" /> Email
            </span>
          </div>
          <ChannelSummary sent={totals.emailSent} replied={totals.emailReplied} />
        </div>
      </div>
        </>
      ) : null}

      {tab === 'campaigns' ? (
      <>
      <div className="rx-mb-4">
        <div className="rx-section-title">Campaign performance</div>
      </div>
      {state.campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" body="Create an outreach to see results here." />
      ) : (
        <div className="rx-card flush">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>WA sent</th>
                <th>Email sent</th>
                <th>Delivered</th>
                <th>Read/Open</th>
                <th>Replies</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {state.campaigns.map((c) => {
                const a = state.analytics.find((x) => x.campaignId === c.id)
                const sent = (a?.whatsapp.sent || 0) + (a?.email.sent || 0)
                const delivered = (a?.whatsapp.delivered || 0) + (a?.email.delivered || 0)
                const read = (a?.whatsapp.read || 0) + (a?.email.read || 0)
                const replies = (a?.whatsapp.replied || 0) + (a?.email.replied || 0)
                const eng = sent > 0 ? Math.round((replies / sent) * 100) : 0
                return (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        className="rx-link-btn"
                        onClick={() => {
                          actions.selectCampaign(c.id)
                          actions.setDetailCampaign(c.id)
                          actions.setTab('campaigns')
                        }}
                      >
                        {c.name}
                      </button>
                      <div className="rx-text-xs rx-muted">{c.status}</div>
                    </td>
                    <td className="mono">{a?.whatsapp.sent || 0}</td>
                    <td className="mono">{a?.email.sent || 0}</td>
                    <td className="mono">{delivered}</td>
                    <td className="mono">{read}</td>
                    <td className="mono">{replies}</td>
                    <td style={{ minWidth: 140 }}>
                      <div className="rx-progress">
                        <span style={{ width: `${Math.min(100, eng)}%` }} />
                      </div>
                      <div className="mono rx-text-xs rx-muted" style={{ marginTop: 4 }}>
                        {eng}%
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </>
      ) : null}

      {tab === 'channels' ? (
        <div className="rx-split">
          <div className="rx-card">
            <div className="rx-section-title">
              <span className="rx-ch-inline">
                <span className="rx-ch-dot wa" /> WhatsApp
              </span>
            </div>
            <ChannelSummary sent={totals.waSent} replied={totals.waReplied} />
          </div>
          <div className="rx-card">
            <div className="rx-section-title">
              <span className="rx-ch-inline">
                <span className="rx-ch-dot email" /> Email
              </span>
            </div>
            <ChannelSummary sent={totals.emailSent} replied={totals.emailReplied} />
          </div>
          <div className="rx-card">
            <div className="rx-section-title">
              <span className="rx-ch-inline">
                <span className="rx-ch-dot ig" /> Instagram
              </span>
            </div>
            <ChannelSummary sent={0} replied={0} />
          </div>
        </div>
      ) : null}

      {tab === 'creators' ? (
        <div className="rx-card flush">
          {creatorStats.length === 0 ? (
            <div style={{ padding: 24 }}>
              <EmptyState title="No creator activity" body="Send campaigns to populate creator reports." />
            </div>
          ) : (
            <table className="rx-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Campaigns</th>
                  <th>Sent</th>
                  <th>Replies</th>
                  <th>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {creatorStats.map((cr) => {
                  const eng = cr.sent > 0 ? Math.round((cr.replies / cr.sent) * 100) : 0
                  return (
                    <tr key={cr.id}>
                      <td>{cr.name}</td>
                      <td className="mono">{cr.campaigns.size}</td>
                      <td className="mono">{cr.sent}</td>
                      <td className="mono">{cr.replies}</td>
                      <td className="mono">{eng}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  muted,
  spark,
}: {
  label: string
  value: number
  sub?: string
  accent?: boolean
  muted?: boolean
  spark?: number[]
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
      {sub ? <div className="rx-metric-sub">{sub}</div> : null}
      {spark && spark.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Sparkline
            data={spark}
            width={140}
            height={28}
            color={accent ? 'var(--accent)' : 'var(--text)'}
            fill={accent ? 'rgba(255,92,57,0.08)' : 'rgba(0,0,0,0.05)'}
          />
        </div>
      )}
    </div>
  )
}

function ChannelSummary({ sent, replied }: { sent: number; replied: number }) {
  const eng = sent > 0 ? Math.round((replied / sent) * 100) : 0
  return (
    <div className="rx-col rx-gap">
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <span className="rx-text-2">Sent</span>
        <strong className="mono">{sent}</strong>
      </div>
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <span className="rx-text-2">Replies</span>
        <strong className="mono">{replied}</strong>
      </div>
      <div>
        <div className="rx-row rx-mb-2" style={{ justifyContent: 'space-between' }}>
          <span className="rx-text-2">Engagement</span>
          <strong className="mono">{eng}%</strong>
        </div>
        <div className="rx-progress" style={{ width: '100%' }}>
          <span style={{ width: `${Math.min(100, eng)}%` }} />
        </div>
      </div>
    </div>
  )
}
