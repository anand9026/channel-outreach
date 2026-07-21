import { useMemo, useState } from 'react'
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
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel } from '../types'

const replyPresets = ['YES, interested!', 'Can you share the brief?', 'Not available this month.']

/**
 * Unified inbox (expert model):
 * - One thread per org · channel · account · influencer (WhatsApp reality)
 * - Messages tagged with campaignId so 2 campaigns → same influencer stay one chat
 * - Filter by channel and/or campaign; highlight campaign context in the thread
 */
export function InboxPage() {
  const { state, actions } = useWhatsAppStore()
  const [reply, setReply] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | OutreachChannel>('all')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [highlightCampaign, setHighlightCampaign] = useState<string>('all')

  const selectedId = state.selectedConversationId
  const selected = state.conversations.find((c) => c.id === selectedId)

  const sortedConversations = useMemo(() => {
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

  const thread = useMemo(() => {
    if (!selected) return []
    let msgs = state.messages
      .filter((m) => m.conversationId === selected.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (highlightCampaign !== 'all') {
      // Show all messages but we'll visually dim non-matching; keep full context
      return msgs
    }
    return msgs
  }, [state.messages, selected, highlightCampaign])

  const canReply = selected ? actions.canFreeformReply(selected.id) : false
  const within24h = selected ? actions.isWithin24hWindow(selected.id) : false
  const influencer = selected ? actions.getConversationInfluencer(selected) : undefined

  const relatedCampaigns = useMemo(() => {
    if (!selected) return []
    return selected.campaignIds
      .map((id) => state.campaigns.find((c) => c.id === id))
      .filter(Boolean) as typeof state.campaigns
  }, [selected, state.campaigns])

  const sendReply = () => {
    if (!selected || !reply.trim()) return
    const ok = actions.sendReply(selected.id, reply.trim())
    if (!ok) {
      actions.toast('24-hour window closed — send a template from Campaigns', 'error')
      return
    }
    setReply('')
    actions.toast('Reply sent', 'success')
  }

  const simulateReply = (body: string) => {
    if (!selected) return
    actions.simulateInbound(selected.id, body)
    actions.toast('Simulated inbound message', 'info')
  }

  const campaignName = (id?: string) =>
    id ? state.campaigns.find((c) => c.id === id)?.name ?? 'Campaign' : null

  return (
    <div className="inbox-layout unified">
      <aside className="inbox-list card">
        <div className="inbox-list-head">
          <h3>Unified inbox</h3>
          <p className="muted-xs">
            One chat per influencer + channel. Campaigns tag messages — not separate WA threads.
          </p>
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

        {sortedConversations.length === 0 ? (
          <p className="muted">No threads yet. Send from Home or Campaigns.</p>
        ) : (
          <ul className="conv-list">
            {sortedConversations.map((c) => {
              const inf = actions.getConversationInfluencer(c)
              const camps = c.campaignIds
                .map((id) => state.campaigns.find((x) => x.id === id)?.name)
                .filter(Boolean)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`conv-item${c.id === selectedId ? ' active' : ''}`}
                    onClick={() => {
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
            })}
          </ul>
        )}
      </aside>

      <section className="inbox-thread card">
        {!selected ? (
          <div className="empty-panel">
            <p>Select a conversation</p>
            <p className="muted-xs">
              Tip: send the same influencer from two campaigns — you still get one WhatsApp chat,
              with campaign labels on each message.
            </p>
          </div>
        ) : (
          <>
            <div className="thread-header">
              <div>
                <h3>
                  {influencer?.name}{' '}
                  <ChannelBadge channel={selected.channel} />
                </h3>
                <p className="muted-xs">
                  {selected.channel === 'email' ? influencer?.email : influencer?.phone}
                  {' · '}
                  {relatedCampaigns.length} campaign
                  {relatedCampaigns.length === 1 ? '' : 's'} in this thread
                </p>
              </div>
              <div className="thread-actions">
                <label className="field inline">
                  <span>Assign</span>
                  <select
                    value={selected.assignedTo ?? ''}
                    onChange={(e) =>
                      actions.assignConversation(selected.id, e.target.value || undefined)
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
                {selected.status === 'resolved' ? (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => actions.reopenConversation(selected.id)}
                  >
                    <RotateCcw size={14} /> Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      actions.resolveConversation(selected.id)
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

            {selected.channel === 'whatsapp' ? (
              <div className={`window-banner${within24h ? ' open' : ' closed'}`}>
                <Clock size={16} />
                {within24h
                  ? '24h window open — free-form replies allowed'
                  : '24h window closed — simulate inbound or send a template'}
              </div>
            ) : (
              <div className="window-banner open email">
                <Clock size={16} />
                Email thread — free-form replies always allowed
              </div>
            )}

            <div className="message-thread">
              {thread.map((m) => {
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
                    if (e.key === 'Enter') sendReply()
                  }}
                />
                <button
                  type="button"
                  className={`btn primary ${selected.channel === 'email' ? 'email' : 'wa'}`}
                  disabled={!canReply}
                  onClick={sendReply}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selected && influencer ? (
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
            <ChannelBadge channel={selected.channel} />
            <p className="muted-xs mono" style={{ marginTop: 8 }}>
              {selected.id}
            </p>
          </div>
          <div className="context-block">
            <p className="context-label">Campaigns in this chat</p>
            {relatedCampaigns.length === 0 ? (
              <p className="muted-xs">No campaign sends yet</p>
            ) : (
              <ul className="context-camps">
                {relatedCampaigns.map((c) => {
                  const count = state.messages.filter(
                    (m) =>
                      m.conversationId === selected.id &&
                      m.campaignId === c.id &&
                      m.direction === 'outbound',
                  ).length
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={highlightCampaign === c.id ? 'on' : ''}
                        onClick={() =>
                          setHighlightCampaign((prev) => (prev === c.id ? 'all' : c.id))
                        }
                      >
                        <strong>{c.name}</strong>
                        <span>{count} sends</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <p className="muted-xs context-note">
            Why one thread? WhatsApp is number-to-number. Campaign B messaging the same creator
            continues the same chat — we attribute each message to its campaign.
          </p>
        </aside>
      ) : null}
    </div>
  )
}
