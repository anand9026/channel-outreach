import { useMemo } from 'react'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { ChannelMetrics } from '../types'

function sumMetrics(a: ChannelMetrics, b: ChannelMetrics): ChannelMetrics {
  return {
    sent: a.sent + b.sent,
    delivered: a.delivered + b.delivered,
    read: a.read + b.read,
    replied: a.replied + b.replied,
    failed: a.failed + b.failed,
  }
}

export function AnalyticsPage() {
  const { state } = useWhatsAppStore()

  const rows = useMemo(
    () =>
      state.campaigns.map((c) => {
        const stats = state.analytics.find((a) => a.campaignId === c.id) ?? {
          whatsapp: { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 },
          email: { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 },
        }
        const combined = sumMetrics(stats.whatsapp, stats.email)
        const deliveryRate = combined.sent
          ? Math.round((combined.delivered / combined.sent) * 100)
          : 0
        const readRate = combined.sent ? Math.round((combined.read / combined.sent) * 100) : 0
        const replyRate = combined.sent
          ? Math.round((combined.replied / combined.sent) * 100)
          : 0
        return { campaign: c, stats, combined, deliveryRate, readRate, replyRate }
      }),
    [state.campaigns, state.analytics],
  )

  const totals = rows.reduce(
    (acc, r) => sumMetrics(acc, r.combined),
    { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 },
  )

  const waTotals = rows.reduce(
    (acc, r) => sumMetrics(acc, r.stats.whatsapp),
    { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 },
  )
  const emailTotals = rows.reduce(
    (acc, r) => sumMetrics(acc, r.stats.email),
    { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 },
  )

  return (
    <div className="page-grid">
      <section className="metrics-row">
        {(
          [
            ['Sent (all)', totals.sent, 'var(--text)'],
            ['Delivered', totals.delivered, 'var(--accent-blue)'],
            ['Read / Opened', totals.read, 'var(--accent-teal)'],
            ['Replies', totals.replied, 'var(--wa-green-dark)'],
            ['Failed', totals.failed, 'var(--danger)'],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="metric-card card">
            <p className="muted-xs">{label}</p>
            <p className="metric-value" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="channel-metrics">
        <div className="card channel-metric-card wa">
          <h3>WhatsApp</h3>
          <dl className="stat-dl">
            <div>
              <dt>Sent</dt>
              <dd>{waTotals.sent}</dd>
            </div>
            <div>
              <dt>Delivered</dt>
              <dd>{waTotals.delivered}</dd>
            </div>
            <div>
              <dt>Read</dt>
              <dd>{waTotals.read}</dd>
            </div>
            <div>
              <dt>Replies</dt>
              <dd>{waTotals.replied}</dd>
            </div>
          </dl>
        </div>
        <div className="card channel-metric-card email">
          <h3>Email</h3>
          <dl className="stat-dl">
            <div>
              <dt>Sent</dt>
              <dd>{emailTotals.sent}</dd>
            </div>
            <div>
              <dt>Delivered</dt>
              <dd>{emailTotals.delivered}</dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd>{emailTotals.read}</dd>
            </div>
            <div>
              <dt>Replies</dt>
              <dd>{emailTotals.replied}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card">
        <h2>Campaign performance by channel</h2>
        <p className="card-lead">
          Combined and per-channel metrics update as delivery webhooks and replies arrive.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>WA sent</th>
                <th>Email sent</th>
                <th>Delivered</th>
                <th>Read/Open</th>
                <th>Replies</th>
                <th>Delivery %</th>
                <th>Engagement %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ campaign, stats, combined, deliveryRate, replyRate }) => (
                <tr key={campaign.id}>
                  <td>
                    <strong>{campaign.name}</strong>
                    <p className="muted-xs">{campaign.status}</p>
                  </td>
                  <td>{stats.whatsapp.sent}</td>
                  <td>{stats.email.sent}</td>
                  <td>{combined.delivered}</td>
                  <td>{combined.read}</td>
                  <td>{combined.replied}</td>
                  <td>
                    <div className="bar-cell">
                      <div className="bar" style={{ width: `${deliveryRate}%` }} />
                      <span>{deliveryRate}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="bar-cell">
                      <div className="bar wa" style={{ width: `${replyRate}%` }} />
                      <span>{replyRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
