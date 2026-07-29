import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Clock,
  Filter,
  RotateCcw,
  Search,
  UserCheck,
} from 'lucide-react'
import {
  ChannelBadge,
  ConversationStatusBadge,
  DeliveryStatusBadge,
} from '../components/StatusBadge'
import {
  getGmailThread,
  getWhatsAppInboxMessages,
  listGmailThreads,
  listWhatsAppInbox,
  sendWhatsAppText,
  whatsappMediaUrl,
  type GmailThreadMessage,
  type GmailThreadMeta,
  type InboxMessage,
  type InboxThread,
} from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { DeliveryStatus, OutreachChannel } from '../types'

const replyPresets = ['YES, interested!', 'Can you share the brief?', 'Not available this month.']

function within24hOf(iso: string | null | undefined) {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return Date.now() - t < 24 * 60 * 60 * 1000
}

function mapStatus(status: string): DeliveryStatus {
  const s = status.toLowerCase()
  if (
    s === 'queued' ||
    s === 'scheduled' ||
    s === 'sent' ||
    s === 'delivered' ||
    s === 'read' ||
    s === 'failed' ||
    s === 'cancelled'
  ) {
    return s
  }
  if (s === 'received') return 'delivered'
  return 'sent'
}

/**
 * Unified inbox:
 * - WhatsApp threads/messages come from reelax-server (webhooks + outbound record)
 * - Email / local demo threads stay in the browser store
 */
export function InboxPage() {
  const { state, actions } = useWhatsAppStore()
  const [reply, setReply] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | OutreachChannel>('whatsapp')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [highlightCampaign, setHighlightCampaign] = useState<string>('all')
  const [liveThreads, setLiveThreads] = useState<InboxThread[]>([])
  const [liveMessages, setLiveMessages] = useState<InboxMessage[]>([])
  const [liveSelectedPhone, setLiveSelectedPhone] = useState<string | null>(null)
  const [gmailThreads, setGmailThreads] = useState<GmailThreadMeta[]>([])
  const [gmailMessages, setGmailMessages] = useState<GmailThreadMessage[]>([])
  const [gmailSelectedThreadId, setGmailSelectedThreadId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [gmailError, setGmailError] = useState<string | null>(null)

  const refreshLiveThreads = useCallback(async () => {
    try {
      const threads = await listWhatsAppInbox()
      setLiveThreads(threads)
      setLiveError(null)
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Failed to load inbox')
    }
  }, [])

  const refreshLiveMessages = useCallback(async (phone: string) => {
    try {
      const msgs = await getWhatsAppInboxMessages(phone)
      setLiveMessages(msgs)
    } catch {
      // keep previous messages on transient errors
    }
  }, [])

  const refreshGmailThreads = useCallback(async () => {
    try {
      const threads = await listGmailThreads()
      setGmailThreads(threads)
      setGmailError(null)
    } catch (e) {
      setGmailError(e instanceof Error ? e.message : 'Failed to load Gmail threads')
    }
  }, [])

  const refreshGmailThread = useCallback(async (threadId: string) => {
    try {
      const data = await getGmailThread({ thread_id: threadId })
      setGmailMessages(data?.messages || [])
    } catch {
      // keep previous messages on transient errors
    }
  }, [])

  useEffect(() => {
    void refreshLiveThreads()
    const id = window.setInterval(() => {
      void refreshLiveThreads()
    }, 4000)
    return () => window.clearInterval(id)
  }, [refreshLiveThreads])

  useEffect(() => {
    void refreshGmailThreads()
    const id = window.setInterval(() => {
      void refreshGmailThreads()
    }, 7000)
    return () => window.clearInterval(id)
  }, [refreshGmailThreads])

  useEffect(() => {
    if (!liveSelectedPhone) {
      setLiveMessages([])
      return
    }
    void refreshLiveMessages(liveSelectedPhone)
    const id = window.setInterval(() => {
      void refreshLiveMessages(liveSelectedPhone)
    }, 3000)
    return () => window.clearInterval(id)
  }, [liveSelectedPhone, refreshLiveMessages])

  useEffect(() => {
    if (!gmailSelectedThreadId) {
      setGmailMessages([])
      return
    }
    void refreshGmailThread(gmailSelectedThreadId)
    const id = window.setInterval(() => {
      void refreshGmailThread(gmailSelectedThreadId)
    }, 5000)
    return () => window.clearInterval(id)
  }, [gmailSelectedThreadId, refreshGmailThread])

  const selectedId = state.selectedConversationId
  const selectedLocal = state.conversations.find((c) => c.id === selectedId)
  const selectedLive = liveSelectedPhone
    ? liveThreads.find((t) => t.phone === liveSelectedPhone) || {
        phone: liveSelectedPhone,
        display_name: liveSelectedPhone,
        phone_number_id: null,
        last_message_at: new Date().toISOString(),
        last_preview: '',
        last_inbound_at: null,
        unread_count: 0,
      }
    : null
  const selectedGmailThread = gmailSelectedThreadId
    ? gmailThreads.find((t) => t.thread_id === gmailSelectedThreadId) || null
    : null

  const sortedLocal = useMemo(() => {
    let list = [...state.conversations]
    if (channelFilter !== 'all') {
      list = list.filter((c) => c.channel === channelFilter)
    }
    if (campaignFilter !== 'all') {
      list = list.filter((c) => c.campaignIds.includes(campaignFilter))
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((c) => {
        const inf = state.influencers.find((i) => i.id === c.influencerId)
        return (
          inf?.name.toLowerCase().includes(q) ||
          inf?.handle.toLowerCase().includes(q) ||
          inf?.phone.includes(q) ||
          inf?.email.toLowerCase().includes(q)
        )
      })
    }
    return list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  }, [
    state.conversations,
    state.influencers,
    channelFilter,
    campaignFilter,
    query,
  ])

  const filteredLive = useMemo(() => {
    if (channelFilter === 'email') return []
    let list = [...liveThreads]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.phone.includes(q) ||
          t.display_name.toLowerCase().includes(q) ||
          t.last_preview.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) =>
      String(b.last_message_at).localeCompare(String(a.last_message_at)),
    )
  }, [liveThreads, channelFilter, query])

  // Prefer server WhatsApp threads; keep email (and local-only) from store
  const showLiveWhatsApp = channelFilter === 'all' || channelFilter === 'whatsapp'
  const showLocalEmail = channelFilter === 'all' || channelFilter === 'email'
  const localEmailOnly = sortedLocal.filter((c) => c.channel === 'email')

  const within24h = selectedLive
    ? within24hOf(selectedLive.last_inbound_at)
    : selectedLocal
      ? actions.isWithin24hWindow(selectedLocal.id)
      : false
  const canReply = selectedLive
    ? within24h
    : selectedLocal
      ? actions.canFreeformReply(selectedLocal.id)
      : false

  const influencer = selectedLocal
    ? actions.getConversationInfluencer(selectedLocal)
    : undefined

  const relatedCampaigns = useMemo(() => {
    if (!selectedLocal) return []
    return selectedLocal.campaignIds
      .map((id) => state.campaigns.find((c) => c.id === id))
      .filter(Boolean) as typeof state.campaigns
  }, [selectedLocal, state.campaigns])

  const localThread = useMemo(() => {
    if (!selectedLocal || liveSelectedPhone) return []
    return state.messages
      .filter((m) => m.conversationId === selectedLocal.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [state.messages, selectedLocal, liveSelectedPhone])

  const sendReply = async () => {
    if (!reply.trim()) return

    if (liveSelectedPhone) {
      if (!within24h) {
        actions.toast('24-hour window closed — wait for inbound or send a template', 'error')
        return
      }
      setSending(true)
      try {
        await sendWhatsAppText({
          to: liveSelectedPhone,
          text: reply.trim(),
          phone_number_id: selectedLive?.phone_number_id || undefined,
        })
        setReply('')
        actions.toast('Reply sent', 'success')
        await refreshLiveMessages(liveSelectedPhone)
        await refreshLiveThreads()
      } catch (e) {
        actions.toast(e instanceof Error ? e.message : 'Send failed', 'error')
      } finally {
        setSending(false)
      }
      return
    }

    if (!selectedLocal) return
    const ok = actions.sendReply(selectedLocal.id, reply.trim())
    if (!ok) {
      actions.toast('24-hour window closed — send a template from Campaigns', 'error')
      return
    }
    setReply('')
    actions.toast('Reply sent', 'success')
  }

  const simulateReply = (body: string) => {
    if (liveSelectedPhone) {
      actions.toast(
        'Simulate is local-only. For real inbound, configure Meta webhook → /whatsapp-outreach/webhook',
        'info',
      )
      return
    }
    if (!selectedLocal) return
    actions.simulateInbound(selectedLocal.id, body)
    actions.toast('Simulated inbound message', 'info')
  }

  const campaignName = (id?: string) =>
    id ? state.campaigns.find((c) => c.id === id)?.name ?? 'Campaign' : null

  const hasAnyThread =
    (showLiveWhatsApp && filteredLive.length > 0) ||
    (showLocalEmail && gmailThreads.length > 0) ||
    (showLocalEmail && localEmailOnly.length > 0) ||
    (!showLiveWhatsApp && sortedLocal.length > 0)

  return (
    <div className="inbox-layout unified">
      <aside className="inbox-list card">
        <div className="inbox-list-head">
          <h3>Unified inbox</h3>
          <p className="muted-xs">
            WhatsApp threads load from the API after you send a template. Live replies need Meta
            webhooks pointing at{' '}
            <code>api.dev.getreelax.com/whatsapp-outreach/webhook</code>.
          </p>
          {liveError ? <p className="muted-xs" style={{ color: 'var(--danger, #b91c1c)' }}>{liveError}</p> : null}
          {gmailError ? <p className="muted-xs" style={{ color: 'var(--danger, #b91c1c)' }}>{gmailError}</p> : null}
        </div>

        <label className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators…"
          />
        </label>

        <div className="segmented full">
          {(['all', 'whatsapp', 'email'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={channelFilter === f ? 'active' : ''}
              onClick={() => setChannelFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </button>
          ))}
        </div>

        <label className="field">
          <span>
            <Filter size={12} /> Campaign
          </span>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
          >
            <option value="all">All campaigns</option>
            {state.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {!hasAnyThread ? (
          <p className="muted">No threads yet. Send from Home or Campaigns.</p>
        ) : (
          <ul className="conv-list">
            {showLiveWhatsApp
              ? filteredLive.map((t) => (
                  <li key={`live_${t.phone}`}>
                    <button
                      type="button"
                      className={`conv-item${liveSelectedPhone === t.phone ? ' active' : ''}`}
                      onClick={() => {
                        setLiveSelectedPhone(t.phone)
                        setGmailSelectedThreadId(null)
                        actions.selectConversation(null)
                        setHighlightCampaign('all')
                      }}
                    >
                      <div className="conv-head">
                        <strong>{t.display_name || t.phone}</strong>
                        {t.unread_count > 0 ? (
                          <span className="nav-badge">{t.unread_count}</span>
                        ) : null}
                      </div>
                      <div className="conv-meta-row">
                        <ChannelBadge channel="whatsapp" />
                        <span className="muted-xs">{t.phone}</span>
                      </div>
                      {t.last_preview ? (
                        <p className="conv-preview">{t.last_preview}</p>
                      ) : null}
                      <ConversationStatusBadge status="open" />
                    </button>
                  </li>
                ))
              : null}

            {showLocalEmail && gmailThreads.length > 0
              ? gmailThreads.map((t) => (
                  <li key={`gmail_${t.thread_id}`}>
                    <button
                      type="button"
                      className={`conv-item${
                        !liveSelectedPhone && gmailSelectedThreadId === t.thread_id ? ' active' : ''
                      }`}
                      onClick={() => {
                        setLiveSelectedPhone(null)
                        actions.selectConversation(null)
                        setGmailSelectedThreadId(t.thread_id)
                        setHighlightCampaign('all')
                      }}
                    >
                      <div className="conv-head">
                        <strong>{t.subject || t.to || t.thread_id}</strong>
                      </div>
                      <div className="conv-meta-row">
                        <ChannelBadge channel="email" />
                        <span className="muted-xs">{t.to || 'recipient unavailable'}</span>
                      </div>
                      {t.snippet ? <p className="conv-preview">{t.snippet}</p> : null}
                      <ConversationStatusBadge status="open" />
                    </button>
                  </li>
                ))
              : (showLocalEmail ? localEmailOnly : []).map((c) => {
                const inf = actions.getConversationInfluencer(c)
                const camps = c.campaignIds
                  .map((id) => state.campaigns.find((x) => x.id === id)?.name)
                  .filter(Boolean)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`conv-item${
                        !liveSelectedPhone && c.id === selectedId ? ' active' : ''
                      }`}
                      onClick={() => {
                        setLiveSelectedPhone(null)
                        setGmailSelectedThreadId(null)
                        actions.selectConversation(c.id)
                        setHighlightCampaign('all')
                      }}
                    >
                      <div className="conv-head">
                        <strong>{inf?.name ?? c.influencerId}</strong>
                        {c.unreadCount > 0 ? (
                          <span className="nav-badge">{c.unreadCount}</span>
                        ) : null}
                      </div>
                      <div className="conv-meta-row">
                        <ChannelBadge channel={c.channel} />
                        <span className="muted-xs">
                          {c.channel === 'email' ? inf?.email : inf?.phone}
                        </span>
                      </div>
                      {c.lastPreview ? (
                        <p className="conv-preview">{c.lastPreview}</p>
                      ) : null}
                      {camps.length > 0 ? (
                        <div className="camp-tags">
                          {camps.map((name) => (
                            <span key={name} className="camp-tag">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <ConversationStatusBadge status={c.status} />
                    </button>
                  </li>
                )
              },
            )}
          </ul>
        )}
      </aside>

      <section className="inbox-thread card">
        {!selectedLive && !selectedLocal && !selectedGmailThread ? (
          <div className="empty-panel">
            <p>Select a conversation</p>
            <p className="muted-xs">
              After Meta webhooks are configured, phone replies appear here automatically.
            </p>
          </div>
        ) : selectedLive ? (
          <>
            <div className="thread-header">
              <div>
                <h3>
                  {selectedLive.display_name || selectedLive.phone}{' '}
                  <ChannelBadge channel="whatsapp" />
                </h3>
                <p className="muted-xs">
                  {selectedLive.phone}
                  {' · '}
                  live thread from server
                </p>
              </div>
            </div>

            <div className={`window-banner${within24h ? ' open' : ' closed'}`}>
              <Clock size={16} />
              {within24h
                ? '24h window open — free-form replies allowed'
                : '24h window closed — reply from phone (webhook) or send a template'}
            </div>

            <div className="message-thread">
              {liveMessages.map((m) => {
                const isMedia =
                  Boolean(m.media_id) &&
                  (m.message_type === 'image' ||
                    m.message_type === 'sticker' ||
                    (m.mime_type || '').startsWith('image/'))
                const isReaction = m.message_type === 'reaction' || Boolean(m.emoji)
                return (
                  <div
                    key={m.id}
                    className={`msg-row ${m.direction === 'outbound' ? 'out' : 'in'}`}
                  >
                    <div className={`msg-bubble whatsapp${isReaction ? ' reaction' : ''}`}>
                      {isMedia && m.media_id ? (
                        <a
                          href={whatsappMediaUrl(m.media_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="msg-media-link"
                        >
                          <img
                            className={`msg-media${m.message_type === 'sticker' ? ' sticker' : ''}`}
                            src={whatsappMediaUrl(m.media_id)}
                            alt={m.caption || m.body || 'media'}
                            loading="lazy"
                          />
                        </a>
                      ) : null}
                      {isReaction ? (
                        <p className="msg-emoji">{m.emoji || m.body}</p>
                      ) : m.caption || (!isMedia && m.body) ? (
                        <p className="msg-body-pre">{m.caption || m.body}</p>
                      ) : null}
                      <div className="msg-meta">
                        <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                        {m.direction === 'outbound' ? (
                          <DeliveryStatusBadge status={mapStatus(m.status)} />
                        ) : null}
                        {m.is_template ? <span className="muted-xs">template</span> : null}
                        {m.message_type && m.message_type !== 'text' ? (
                          <span className="muted-xs">{m.message_type}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="composer">
              <div className="preset-row">
                {replyPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="chip"
                    onClick={() => simulateReply(p)}
                  >
                    Simulate: {p.slice(0, 18)}…
                  </button>
                ))}
              </div>
              <div className="composer-row">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    canReply ? 'Type a reply…' : 'Window closed — inbound reply required first'
                  }
                  disabled={!canReply || sending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void sendReply()
                  }}
                />
                <button
                  type="button"
                  className="btn primary wa"
                  disabled={!canReply || sending}
                  onClick={() => void sendReply()}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : selectedGmailThread ? (
          <>
            <div className="thread-header">
              <div>
                <h3>
                  {selectedGmailThread.subject || 'Email thread'}{' '}
                  <ChannelBadge channel="email" />
                </h3>
                <p className="muted-xs">
                  {selectedGmailThread.to || 'recipient unavailable'}
                  {' · '}
                  live thread from server
                </p>
              </div>
            </div>

            <div className="window-banner open email">
              <Clock size={16} />
              Replies are synced from Gmail thread API
            </div>

            <div className="message-thread">
              {gmailMessages.map((m) => (
                <div
                  key={m.id}
                  className={`msg-row ${m.direction === 'outbound' ? 'out' : 'in'}`}
                >
                  <div className="msg-bubble email">
                    {m.subject ? <p className="msg-subject">{m.subject}</p> : null}
                    <p className="msg-body-pre">{m.snippet}</p>
                    <div className="msg-meta">
                      <span>{new Date(m.internal_date).toLocaleTimeString()}</span>
                      <span className="muted-xs">
                        {m.direction === 'outbound' ? 'sent' : m.direction === 'inbound' ? 'reply' : 'message'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="composer">
              <div className="composer-row">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply from connected Gmail mailbox (UI is read-only for this MVP)"
                  disabled
                />
                <button type="button" className="btn primary email" disabled>
                  Send
                </button>
              </div>
            </div>
          </>
        ) : selectedLocal ? (
          <>
            <div className="thread-header">
              <div>
                <h3>
                  {influencer?.name}{' '}
                  <ChannelBadge channel={selectedLocal.channel} />
                </h3>
                <p className="muted-xs">
                  {selectedLocal.channel === 'email' ? influencer?.email : influencer?.phone}
                  {' · '}
                  {relatedCampaigns.length} campaign
                  {relatedCampaigns.length === 1 ? '' : 's'} in this thread
                </p>
              </div>
              <div className="thread-actions">
                <label className="field inline">
                  <span>Assign</span>
                  <select
                    value={selectedLocal.assignedTo ?? ''}
                    onChange={(e) =>
                      actions.assignConversation(
                        selectedLocal.id,
                        e.target.value || undefined,
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {state.team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedLocal.status === 'resolved' ? (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => actions.reopenConversation(selectedLocal.id)}
                  >
                    <RotateCcw size={14} /> Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      actions.resolveConversation(selectedLocal.id)
                      actions.toast('Conversation resolved', 'success')
                    }}
                  >
                    <UserCheck size={14} /> Resolve
                  </button>
                )}
              </div>
            </div>

            {relatedCampaigns.length > 1 ? (
              <div className="campaign-lens">
                <span className="muted-xs">Focus campaign in chat:</span>
                <button
                  type="button"
                  className={`chip${highlightCampaign === 'all' ? ' on' : ''}`}
                  onClick={() => setHighlightCampaign('all')}
                >
                  All
                </button>
                {relatedCampaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip${highlightCampaign === c.id ? ' on' : ''}`}
                    onClick={() => setHighlightCampaign(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}

            {selectedLocal.channel === 'whatsapp' ? (
              <div className={`window-banner${within24h ? ' open' : ' closed'}`}>
                <Clock size={16} />
                {within24h
                  ? '24h window open — free-form replies allowed'
                  : '24h window closed — use live WhatsApp list (API) or send a template'}
              </div>
            ) : (
              <div className="window-banner open email">
                <Clock size={16} />
                Email thread — free-form replies always allowed
              </div>
            )}

            <div className="message-thread">
              {localThread.map((m) => {
                const dim =
                  highlightCampaign !== 'all' &&
                  m.campaignId &&
                  m.campaignId !== highlightCampaign
                const camp = campaignName(m.campaignId)
                return (
                  <div
                    key={m.id}
                    className={`msg-row ${m.direction === 'outbound' ? 'out' : 'in'}${dim ? ' dim' : ''}`}
                  >
                    <div className={`msg-bubble ${m.channel}`}>
                      {camp ? <span className="msg-camp">{camp}</span> : null}
                      {m.subject ? <p className="msg-subject">{m.subject}</p> : null}
                      <p className="msg-body-pre">{m.body}</p>
                      <div className="msg-meta">
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        {m.direction === 'outbound' ? (
                          <DeliveryStatusBadge status={m.status} />
                        ) : null}
                        {m.isTemplate ? <span className="muted-xs">template</span> : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="composer">
              <div className="preset-row">
                {replyPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="chip"
                    onClick={() => simulateReply(p)}
                  >
                    Simulate: {p.slice(0, 18)}…
                  </button>
                ))}
              </div>
              <div className="composer-row">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    canReply ? 'Type a reply…' : 'Window closed — simulate inbound first'
                  }
                  disabled={!canReply}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void sendReply()
                  }}
                />
                <button
                  type="button"
                  className={`btn primary ${selectedLocal.channel === 'email' ? 'email' : 'wa'}`}
                  disabled={!canReply}
                  onClick={() => void sendReply()}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {selectedLocal && influencer && !liveSelectedPhone ? (
        <aside className="inbox-context card">
          <h3>Context</h3>
          <div className="context-block">
            <p className="context-label">Influencer</p>
            <strong>{influencer.name}</strong>
            <p className="muted-xs">{influencer.handle}</p>
            <p className="muted-xs">
              {influencer.followers} · {influencer.niche}
            </p>
          </div>
          <div className="context-block">
            <p className="context-label">Channel</p>
            <ChannelBadge channel={selectedLocal.channel} />
            <p className="muted-xs mono" style={{ marginTop: 8 }}>
              {selectedLocal.id}
            </p>
          </div>
          <div className="context-block">
            <p className="context-label">Campaigns in this chat</p>
            {relatedCampaigns.length === 0 ? (
              <p className="muted-xs">No campaign tags</p>
            ) : (
              relatedCampaigns.map((c) => (
                <p key={c.id} className="muted-xs">
                  {c.name}
                </p>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </div>
  )
}
