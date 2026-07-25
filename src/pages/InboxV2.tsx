import {
  AlertTriangle,
  Check,
  CheckCheck,
  MessageCircle,
  RefreshCcw,
  Search,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { useWhatsAppStore } from '../store/WhatsAppStore'

function formatSince(ts: string | null): string {
  if (!ts) return 'never'
  const diff = Math.max(0, Date.now() - new Date(ts).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

export function InboxV2() {
  const { state, actions } = useWhatsAppStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'whatsapp' | 'email'>('all')
  const [syncing, setSyncing] = useState(false)

  // Force re-render every 20s so the "last synced Xs ago" label ticks
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 20000)
    return () => window.clearInterval(id)
  }, [])

  const conversations = useMemo(() => {
    return state.conversations
      .filter((c) => (tab === 'all' ? true : c.channel === tab))
      .filter((c) => {
        if (!search) return true
        const inf = state.influencers.find((i) => i.id === c.influencerId)
        return (
          inf?.name.toLowerCase().includes(search.toLowerCase()) ||
          inf?.handle.toLowerCase().includes(search.toLowerCase()) ||
          inf?.phone.toLowerCase().includes(search.toLowerCase()) ||
          c.lastPreview?.toLowerCase().includes(search.toLowerCase())
        )
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  }, [state.conversations, state.influencers, tab, search])

  const selected = state.conversations.find((c) => c.id === state.selectedConversationId)

  useEffect(() => {
    if (!selected && conversations.length > 0) {
      actions.selectConversation(conversations[0].id)
    }
  }, [conversations, selected, actions])

  const { polling, lastSyncedAt, lastError, connection } = state.liveInbox
  const liveThreadCount = state.conversations.filter((c) => c.isLive).length

  const onSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await actions.syncLiveInboxNow()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <div style={{ padding: '32px 40px 20px' }}>
        <div className="rx-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 className="rx-page-title">Inbox</h1>
            <p className="rx-page-sub">
              Every reply from every channel, unified per creator. Campaign context stays with the chat.
            </p>
          </div>
          <div
            className="rx-live-bar"
            data-testid="live-inbox-bar"
            role="status"
            aria-live="polite"
          >
            <span
              className={`rx-live-dot${polling && !lastError ? ' is-on' : lastError ? ' is-err' : ''}`}
              aria-hidden
            />
            <div className="rx-live-meta">
              <div className="rx-live-title">
                {polling ? (lastError ? 'Live · retrying' : 'Live') : 'Paused'}
                {liveThreadCount > 0 ? (
                  <span className="rx-live-count mono">· {liveThreadCount}</span>
                ) : null}
              </div>
              <div className="rx-live-sub mono">
                {lastError ? (
                  <span className="rx-live-err" title={lastError}>
                    <AlertTriangle size={11} /> {lastError.slice(0, 40)}
                  </span>
                ) : (
                  <>synced {formatSince(lastSyncedAt)}</>
                )}
                {connection?.phone_number_id ? (
                  <span className="rx-live-pnid" title={connection.phone_number_id}>
                    · pnid {connection.phone_number_id.slice(-6)}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={onSyncNow}
              disabled={syncing}
              title="Sync now"
              data-testid="sync-inbox-now"
            >
              <RefreshCcw size={13} className={syncing ? 'rx-spin' : ''} />
            </button>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => actions.setLivePolling(!polling)}
              title={polling ? 'Pause live polling' : 'Resume live polling'}
              data-testid="toggle-live-polling"
            >
              {polling ? <Wifi size={13} /> : <WifiOff size={13} />}
            </button>
          </div>
        </div>
      </div>
      <div className="rx-inbox">
        <div className="rx-inbox-list">
          <div className="rx-inbox-list-head">
            <div className="rx-search">
              <Search size={14} className="rx-search-icon" />
              <input
                className="rx-input"
                placeholder="Search creators, phone, or messages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="rx-seg">
              <button
                className={`rx-seg-btn${tab === 'all' ? ' is-active' : ''}`}
                onClick={() => setTab('all')}
              >
                All
              </button>
              <button
                className={`rx-seg-btn${tab === 'whatsapp' ? ' is-active' : ''}`}
                onClick={() => setTab('whatsapp')}
              >
                WhatsApp
              </button>
              <button
                className={`rx-seg-btn${tab === 'email' ? ' is-active' : ''}`}
                onClick={() => setTab('email')}
              >
                Email
              </button>
            </div>
          </div>

          {conversations.length === 0 ? (
            <div style={{ padding: 32 }}>
              <EmptyState
                title="No conversations yet"
                body="Once creators reply to your outreach, their chats show up here."
              />
            </div>
          ) : (
            conversations.map((c) => {
              const inf = state.influencers.find((i) => i.id === c.influencerId)
              const initials = inf?.name.split(' ').map((x) => x[0]).slice(0, 2).join('') || '?'
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`rx-conv${state.selectedConversationId === c.id ? ' is-selected' : ''}`}
                  onClick={() => actions.selectConversation(c.id)}
                  data-testid={`conv-${c.id}`}
                >
                  <div className="rx-conv-avatar">
                    {initials}
                    <span className={`rx-conv-badge ${c.channel === 'whatsapp' ? 'wa' : 'email'}`}>
                      {c.channel === 'whatsapp' ? 'W' : 'E'}
                    </span>
                  </div>
                  <div className="rx-conv-body">
                    <div className="rx-conv-row">
                      <div className="rx-conv-name">
                        {inf?.name || 'Unknown'}
                        {c.isLive ? (
                          <span className="rx-live-tag mono" title="Live from WhatsApp Cloud API">
                            LIVE
                          </span>
                        ) : null}
                      </div>
                      <div className="rx-conv-time">
                        {new Date(c.lastMessageAt).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="rx-conv-row">
                      <div className="rx-conv-preview">{c.lastPreview || '—'}</div>
                      {c.unreadCount > 0 ? (
                        <span className="rx-unread-pill">{c.unreadCount}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {selected ? <Thread /> : <EmptyThread />}
      </div>
    </>
  )
}

function EmptyThread() {
  return (
    <div className="rx-thread">
      <div style={{ margin: 'auto', padding: 40 }}>
        <EmptyState
          icon={<MessageCircle size={20} />}
          title="Pick a conversation"
          body="Select a chat from the list to see the thread."
        />
      </div>
    </div>
  )
}

function Thread() {
  const { state, actions } = useWhatsAppStore()
  const conv = state.conversations.find((c) => c.id === state.selectedConversationId)!
  const inf = state.influencers.find((i) => i.id === conv.influencerId)
  const messages = state.messages
    .filter((m) => m.conversationId === conv.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const [draft, setDraft] = useState('')
  const [replying, setReplying] = useState(false)
  const canReply = actions.canFreeformReply(conv.id)
  const windowOpen = conv.channel === 'email' || actions.isWithin24hWindow(conv.id)

  // Auto-scroll to newest on message change / selection change
  const bodyRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [conv.id, messages.length])

  const send = async () => {
    const text = draft.trim()
    if (!text || replying) return
    setDraft('')
    setReplying(true)
    try {
      if (conv.channel === 'whatsapp' && conv.isLive) {
        const ok = await actions.sendWhatsAppReplyLive(conv.id, text)
        if (!ok) {
          setDraft(text)
        }
      } else {
        const ok = actions.sendReply(conv.id, text)
        if (!ok) {
          setDraft(text)
          actions.toast('Reply window closed — send a template first', 'error')
        }
      }
    } finally {
      setReplying(false)
    }
  }

  const initials = inf?.name.split(' ').map((x) => x[0]).slice(0, 2).join('') || '?'

  return (
    <div className="rx-thread">
      <div className="rx-thread-head">
        <div className="rx-thread-head-left">
          <div className="rx-conv-avatar" style={{ width: 40, height: 40 }}>
            {initials}
            <span className={`rx-conv-badge ${conv.channel === 'whatsapp' ? 'wa' : 'email'}`}>
              {conv.channel === 'whatsapp' ? 'W' : 'E'}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em' }}>
              {inf?.name}
              {conv.isLive ? (
                <span className="rx-live-tag mono" style={{ marginLeft: 8 }}>
                  LIVE
                </span>
              ) : null}
            </div>
            <div className="rx-text-xs rx-muted mono">
              {conv.channel === 'whatsapp' ? inf?.phone : inf?.email}
            </div>
          </div>
        </div>
        <div className="rx-row" style={{ gap: 6 }}>
          {conv.campaignIds.slice(0, 2).map((cid) => {
            const c = state.campaigns.find((x) => x.id === cid)
            if (!c) return null
            return (
              <span key={cid} className="rx-badge">
                {c.name}
              </span>
            )
          })}
          {conv.status === 'resolved' ? (
            <button
              className="rx-btn secondary sm"
              onClick={() => actions.reopenConversation(conv.id)}
            >
              Reopen
            </button>
          ) : (
            <button
              className="rx-btn secondary sm"
              onClick={() => actions.resolveConversation(conv.id)}
              data-testid="resolve-conversation"
            >
              <Check size={12} /> Resolve
            </button>
          )}
        </div>
      </div>

      <div className="rx-thread-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', color: 'var(--text-3)' }}>
            {conv.isLive ? 'Waiting for messages to sync…' : 'No messages yet.'}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`rx-msg-row ${m.direction === 'outbound' ? 'out' : 'in'}`}>
              <div>
                {m.subject ? (
                  <div className="rx-text-xs rx-muted rx-mb-2">
                    <strong>{m.subject}</strong>
                  </div>
                ) : null}
                <div className="rx-msg">{m.body}</div>
                <div className="rx-msg-meta">
                  <span>
                    {new Date(m.createdAt).toLocaleTimeString('en', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {m.direction === 'outbound' ? (
                    <>
                      <span>·</span>
                      <span>{m.status}</span>
                      {m.status === 'read' ? (
                        <CheckCheck size={12} />
                      ) : m.status === 'delivered' ? (
                        <Check size={12} />
                      ) : m.status === 'failed' ? (
                        <AlertTriangle size={12} />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rx-composer">
        {conv.channel === 'whatsapp' && (
          <div className={`rx-window-note ${windowOpen ? 'open' : 'closed'}`}>
            <span>
              {windowOpen
                ? conv.isLive
                  ? '● 24-hour reply window open · sending via WhatsApp Cloud API'
                  : '● 24-hour reply window open'
                : '● Window closed — use a template'}
            </span>
          </div>
        )}
        <div className="rx-composer-row">
          <textarea
            className="rx-textarea"
            placeholder={canReply ? 'Type a reply…' : 'Reply window closed'}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!canReply || replying}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button
            type="button"
            className="rx-btn primary"
            onClick={send}
            disabled={!canReply || !draft.trim() || replying}
            data-testid="composer-send"
          >
            <Send size={14} /> {replying ? 'Sending…' : 'Send'}
          </button>
        </div>
        {!conv.isLive ? (
          <div className="rx-row" style={{ gap: 6, marginTop: 4 }}>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() =>
                actions.simulateInbound(
                  conv.id,
                  'Yes, sounds great! Would love to know more.',
                )
              }
            >
              Simulate creator reply
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
