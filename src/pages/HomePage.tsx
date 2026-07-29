import {
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Flame,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { useMemo } from 'react'
import { IgIcon } from '../components/BrandIcons'
import { PageHeader } from '../components/PageHeader'
import { Sparkline } from '../components/Sparkline'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel } from '../types'

const CHANNEL_META: Record<
  OutreachChannel,
  { label: string; className: string; iconBg: string }
> = {
  whatsapp: { label: 'WhatsApp', className: 'wa', iconBg: 'wa' },
  instagram: { label: 'Instagram', className: 'ig', iconBg: 'ig' },
  email: { label: 'Email', className: 'email', iconBg: 'email' },
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Working late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Working late'
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Build a 7-day count of outbound messages for a channel.
 * Returns [oldest ... today].
 */
function last7DaysSends(
  messages: Array<{ createdAt: string; channel: OutreachChannel; direction: string }>,
  channel: OutreachChannel,
): number[] {
  const counts = new Array(7).fill(0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const today = now.getTime()
  for (const m of messages) {
    if (m.direction !== 'outbound' || m.channel !== channel) continue
    const t = new Date(m.createdAt)
    t.setHours(0, 0, 0, 0)
    const diff = Math.floor((today - t.getTime()) / 86400000)
    if (diff >= 0 && diff < 7) counts[6 - diff] += 1
  }
  return counts
}

export function HomePage() {
  const { state, actions } = useWhatsAppStore()

  const stats = useMemo(() => {
    const perChannel: Record<
      OutreachChannel,
      {
        sends: number[]
        totalSent: number
        unread: number
        threads: number
        latestPreview: string | null
        latestName: string | null
        latestAt: string | null
        latestChannel: OutreachChannel
      }
    > = {
      whatsapp: {
        sends: last7DaysSends(state.messages, 'whatsapp'),
        totalSent: 0,
        unread: 0,
        threads: 0,
        latestPreview: null,
        latestName: null,
        latestAt: null,
        latestChannel: 'whatsapp',
      },
      instagram: {
        sends: last7DaysSends(state.messages, 'instagram'),
        totalSent: 0,
        unread: 0,
        threads: 0,
        latestPreview: null,
        latestName: null,
        latestAt: null,
        latestChannel: 'instagram',
      },
      email: {
        sends: last7DaysSends(state.messages, 'email'),
        totalSent: 0,
        unread: 0,
        threads: 0,
        latestPreview: null,
        latestName: null,
        latestAt: null,
        latestChannel: 'email',
      },
    }
    for (const c of state.conversations) {
      const bucket = perChannel[c.channel]
      if (!bucket) continue
      bucket.threads += 1
      bucket.unread += c.unreadCount
      if (
        c.lastInboundAt &&
        (!bucket.latestAt || c.lastInboundAt > bucket.latestAt)
      ) {
        const inf = state.influencers.find((i) => i.id === c.influencerId)
        bucket.latestAt = c.lastInboundAt
        bucket.latestName = inf?.name || 'Creator'
        bucket.latestPreview = c.lastPreview || ''
      }
    }
    for (const m of state.messages) {
      if (m.direction === 'outbound' && perChannel[m.channel]) {
        perChannel[m.channel].totalSent += 1
      }
    }
    return perChannel
  }, [state.conversations, state.messages, state.influencers])

  const totalUnread =
    stats.whatsapp.unread + stats.instagram.unread + stats.email.unread
  const totalSent7d = [
    ...stats.whatsapp.sends,
    ...stats.instagram.sends,
    ...stats.email.sends,
  ].reduce((a, b) => a + b, 0)
  const hotLeads = state.conversations.filter((c) =>
    (c.labels || []).some((l) => l.toLowerCase().includes('hot')),
  ).length
  const activeCampaigns = state.campaigns.filter((c) => c.status === 'active').length

  // Recent activity — last 6 inbound messages across all channels
  const recentActivity = useMemo(() => {
    return state.messages
      .filter((m) => m.direction === 'inbound')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((m) => {
        const conv = state.conversations.find((c) => c.id === m.conversationId)
        const inf = conv
          ? state.influencers.find((i) => i.id === conv.influencerId)
          : undefined
        return {
          id: m.id,
          conversationId: m.conversationId,
          channel: m.channel,
          name: inf?.name || 'Unknown',
          body: m.body || '',
          at: m.createdAt,
        }
      })
  }, [state.messages, state.conversations, state.influencers])

  const openConversation = (convId: string) => {
    actions.selectConversation(convId)
    actions.setTab('inbox')
  }

  const channels: OutreachChannel[] = ['whatsapp', 'instagram', 'email']

  const isConnected = (ch: OutreachChannel): boolean => {
    if (ch === 'whatsapp') return state.whatsAppNumbers.length > 0
    if (ch === 'instagram') return state.instagramAccounts.length > 0
    return state.emailAccounts.length > 0
  }

  return (
    <div className="rx-page">
      <PageHeader
        title={`${greeting()}, ${state.organization?.name || 'team'}`}
        subtitle="Your outreach at a glance across WhatsApp, Instagram, and Email."
        actions={
          <>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => {
                if (state.prefs.notifyEnabled) actions.disableNotifications()
                else void actions.enableNotifications()
              }}
              title="Toggle desktop notifications"
              data-testid="home-notify-toggle"
            >
              {state.prefs.notifyEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {state.prefs.notifyEnabled ? 'Notify on' : 'Notify'}
            </button>
            <button
              type="button"
              className="rx-btn primary"
              onClick={() => actions.setTab('quicksend')}
              data-testid="home-quicksend"
            >
              <Send size={14} /> Quick Send
            </button>
          </>
        }
      />

      {/* Snapshot stats */}
      <div className="rx-home-stats">
        <div className="rx-home-stat">
          <div className="rx-home-stat-label">
            <TrendingUp size={12} /> Sent · last 7 days
          </div>
          <div className="rx-home-stat-value mono">{totalSent7d.toLocaleString()}</div>
        </div>
        <div className="rx-home-stat">
          <div className="rx-home-stat-label">
            <Bell size={12} /> Unread
          </div>
          <div className="rx-home-stat-value mono">
            {totalUnread}
            {totalUnread > 0 ? (
              <span className="rx-badge danger" style={{ marginLeft: 8 }}>
                {totalUnread}
              </span>
            ) : null}
          </div>
        </div>
        <div className="rx-home-stat">
          <div className="rx-home-stat-label">
            <Flame size={12} /> Hot leads
          </div>
          <div className="rx-home-stat-value mono">{hotLeads}</div>
        </div>
        <div className="rx-home-stat">
          <div className="rx-home-stat-label">
            <Sparkles size={12} /> Active campaigns
          </div>
          <div className="rx-home-stat-value mono">{activeCampaigns}</div>
        </div>
      </div>

      {/* Per-channel cards */}
      <div className="rx-section-title" style={{ marginTop: 32 }}>
        Channels
      </div>
      <div className="rx-home-channels">
        {channels.map((ch) => {
          const meta = CHANNEL_META[ch]
          const s = stats[ch]
          const connected = isConnected(ch)
          const responseRate =
            s.totalSent > 0
              ? Math.round(
                  (state.messages.filter(
                    (m) => m.direction === 'inbound' && m.channel === ch,
                  ).length /
                    s.totalSent) *
                    100,
                )
              : 0
          return (
            <div
              key={ch}
              className={`rx-home-channel ${meta.className}`}
              data-channel={ch}
              data-testid={`home-channel-${ch}`}
            >
              <div className="rx-home-channel-head">
                <div className={`rx-home-channel-icon ${meta.iconBg}`}>
                  {ch === 'whatsapp' ? (
                    <MessageCircle size={16} />
                  ) : ch === 'instagram' ? (
                    <IgIcon size={16} />
                  ) : (
                    <Mail size={16} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="rx-home-channel-title">{meta.label}</div>
                  <div className="rx-home-channel-sub">
                    {connected ? (
                      <>
                        <span className="rx-conn-dot on" /> Live
                        {ch === 'whatsapp' &&
                        state.liveInbox.connection?.phone_number_id ? (
                          <span className="mono rx-muted rx-text-xs">
                            {' '}
                            · pnid {state.liveInbox.connection.phone_number_id.slice(-6)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="rx-conn-dot off" /> Not connected
                      </>
                    )}
                  </div>
                </div>
                {!connected ? (
                  <button
                    type="button"
                    className="rx-btn secondary sm"
                    onClick={() => actions.setTab('connect')}
                    data-testid={`home-connect-${ch}`}
                  >
                    <Plus size={12} /> Connect
                  </button>
                ) : null}
              </div>

              <div className="rx-home-channel-metrics">
                <div className="rx-home-metric">
                  <div className="rx-home-metric-label">Sent · 7d</div>
                  <div className="rx-home-metric-value mono">
                    {s.sends.reduce((a, b) => a + b, 0)}
                  </div>
                </div>
                <div className="rx-home-metric">
                  <div className="rx-home-metric-label">Threads</div>
                  <div className="rx-home-metric-value mono">{s.threads}</div>
                </div>
                <div className="rx-home-metric">
                  <div className="rx-home-metric-label">Unread</div>
                  <div className="rx-home-metric-value mono">
                    {s.unread || 0}
                  </div>
                </div>
                <div className="rx-home-metric">
                  <div className="rx-home-metric-label">Response</div>
                  <div className="rx-home-metric-value mono">
                    {responseRate}%
                  </div>
                </div>
              </div>

              <div className="rx-home-channel-spark">
                <Sparkline data={s.sends} height={38} />
                <div className="rx-text-xs rx-muted">Sends · last 7 days</div>
              </div>

              {s.latestPreview ? (
                <button
                  type="button"
                  className="rx-home-latest"
                  onClick={() => {
                    const conv = state.conversations.find(
                      (c) =>
                        c.channel === ch &&
                        c.lastInboundAt === s.latestAt,
                    )
                    if (conv) openConversation(conv.id)
                    else actions.setTab('inbox')
                  }}
                >
                  <div className="rx-home-latest-name">{s.latestName}</div>
                  <div className="rx-home-latest-body">{s.latestPreview}</div>
                  <ArrowUpRight size={12} className="rx-home-latest-arrow" />
                </button>
              ) : (
                <div className="rx-home-latest empty">
                  <div className="rx-text-xs rx-muted">
                    No replies yet. Kick things off from Quick Send.
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recent activity + quick actions */}
      <div className="rx-home-row">
        <div className="rx-home-panel">
          <div className="rx-home-panel-head">
            <div className="rx-section-title" style={{ margin: 0 }}>
              Recent activity
            </div>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => actions.setTab('inbox')}
              data-testid="home-view-inbox"
            >
              View inbox
            </button>
          </div>
          {recentActivity.length === 0 ? (
            <div className="rx-empty">
              <MessageCircle size={22} className="rx-empty-icon" />
              <div className="rx-empty-title">No replies yet</div>
              <div className="rx-empty-body">
                Send a campaign or a Quick Send to spark the first conversation.
              </div>
              <div className="rx-empty-actions">
                <button
                  type="button"
                  className="rx-btn primary sm"
                  onClick={() => actions.setTab('quicksend')}
                >
                  <Send size={13} /> Quick Send
                </button>
              </div>
            </div>
          ) : (
            <div className="rx-home-activity">
              {recentActivity.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="rx-home-activity-item"
                  data-channel={a.channel}
                  onClick={() => openConversation(a.conversationId)}
                >
                  <div className={`rx-home-activity-dot ${a.channel}`} />
                  <div className="rx-home-activity-body">
                    <div className="rx-home-activity-name">{a.name}</div>
                    <div className="rx-home-activity-preview">{a.body}</div>
                  </div>
                  <div className="rx-home-activity-time mono">
                    {new Date(a.at).toLocaleTimeString('en', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rx-home-panel">
          <div className="rx-home-panel-head">
            <div className="rx-section-title" style={{ margin: 0 }}>
              Quick actions
            </div>
          </div>
          <div className="rx-home-actions">
            <button
              type="button"
              className="rx-home-action"
              onClick={() => actions.setTab('quicksend')}
            >
              <div className="rx-home-action-icon"><Send size={16} /></div>
              <div>
                <div className="rx-home-action-title">Quick Send</div>
                <div className="rx-home-action-sub">CSV or paste numbers, send in minutes</div>
              </div>
            </button>
            <button
              type="button"
              className="rx-home-action"
              onClick={() => actions.setTab('campaigns')}
            >
              <div className="rx-home-action-icon"><Sparkles size={16} /></div>
              <div>
                <div className="rx-home-action-title">New campaign</div>
                <div className="rx-home-action-sub">Sequences with cascade + follow-ups</div>
              </div>
            </button>
            <button
              type="button"
              className="rx-home-action"
              onClick={() => actions.setTab('templates')}
            >
              <div className="rx-home-action-icon"><Zap size={16} /></div>
              <div>
                <div className="rx-home-action-title">Templates</div>
                <div className="rx-home-action-sub">Full Meta builder + Gmail templates</div>
              </div>
            </button>
            <button
              type="button"
              className="rx-home-action"
              onClick={() => actions.setTab('connect')}
            >
              <div className="rx-home-action-icon"><Users size={16} /></div>
              <div>
                <div className="rx-home-action-title">Channels</div>
                <div className="rx-home-action-sub">Connect WhatsApp / Instagram / Gmail</div>
              </div>
            </button>
          </div>

          {state.autoLabelRules.filter((r) => r.enabled).length > 0 ? (
            <div className="rx-home-panel-foot">
              <Sparkles size={11} /> {state.autoLabelRules.filter((r) => r.enabled).length}{' '}
              auto-label rule
              {state.autoLabelRules.filter((r) => r.enabled).length > 1 ? 's' : ''} active
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
