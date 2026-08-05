import {
  AlertTriangle,
  Bell,
  BellOff,
  Bookmark,
  Check,
  CheckCheck,
  CheckSquare,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  Heart,
  Inbox as InboxIcon,
  Mail,
  MessageCircle,
  Paperclip,
  Play,
  RefreshCcw,
  Search,
  Send,
  Smile,
  Square,
  Tag,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmojiPicker } from '../components/EmojiPicker'
import { EmptyState } from '../components/EmptyState'
import { IgIcon } from '../components/BrandIcons'
import { whatsappMediaUrl, resolveOrgId } from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { Conversation, Message, OutreachChannel } from '../types'

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

const SUGGESTED_LABELS = [
  'hot lead',
  'follow-up',
  'contract sent',
  'paid',
  'ghosted',
  'not interested',
]

const REACTION_QUICKPICK = ['\u2764\uFE0F', '\u{1F44D}', '\u{1F44E}', '\u{1F602}', '\u{1F62E}', '\u{1F525}']

type SavedView =
  | 'all'
  | 'unread'
  | 'hot'
  | 'unanswered_24h'
  | 'replied'
  | 'live'

const savedViewDefs: Array<{ id: SavedView; label: string; icon: typeof Bookmark }> = [
  { id: 'all', label: 'All', icon: InboxIcon },
  { id: 'unread', label: 'Unread', icon: Bell },
  { id: 'hot', label: 'Hot leads', icon: Flame },
  { id: 'unanswered_24h', label: 'Unanswered 24h', icon: AlertTriangle },
  { id: 'replied', label: 'Replied', icon: MessageCircle },
  { id: 'live', label: 'Live only', icon: Wifi },
]

function passesSavedView(c: Conversation, view: SavedView, messagesForConv: Message[]): boolean {
  switch (view) {
    case 'unread':
      return c.unreadCount > 0
    case 'hot':
      return (c.labels || []).some((l) => l.toLowerCase().includes('hot'))
    case 'unanswered_24h': {
      if (!c.lastInboundAt) return false
      const lastOut = messagesForConv
        .filter((m) => m.direction === 'outbound')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const inboundAt = new Date(c.lastInboundAt).getTime()
      const ageHrs = (Date.now() - inboundAt) / 36e5
      if (ageHrs > 24) return false
      if (!lastOut) return true
      return new Date(lastOut.createdAt).getTime() < inboundAt
    }
    case 'replied':
      return messagesForConv.some((m) => m.direction === 'inbound')
    case 'live':
      return Boolean(c.isLive)
    default:
      return true
  }
}

function channelBadgeLetter(ch: OutreachChannel) {
  if (ch === 'whatsapp') return 'W'
  if (ch === 'instagram') return 'I'
  return 'E'
}

function channelLabelShort(ch: OutreachChannel) {
  if (ch === 'whatsapp') return 'WhatsApp'
  if (ch === 'instagram') return 'Instagram'
  return 'Gmail'
}

export function InboxV2() {
  const { state, actions } = useWhatsAppStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | OutreachChannel>('all')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [savedView, setSavedView] = useState<SavedView>('all')
  const [syncing, setSyncing] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  // Force re-render every 20s so the "last synced Xs ago" label ticks.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 20000)
    return () => window.clearInterval(id)
  }, [])

  const messagesByConv = useMemo(() => {
    const map = new Map<string, Message[]>()
    for (const m of state.messages) {
      const list = map.get(m.conversationId) || []
      list.push(m)
      map.set(m.conversationId, list)
    }
    return map
  }, [state.messages])

  const allLabels = useMemo(() => {
    const s = new Set<string>()
    for (const c of state.conversations) for (const l of c.labels || []) s.add(l)
    return [...s].sort()
  }, [state.conversations])

  const conversations = useMemo(() => {
    return state.conversations
      .filter((c) => (tab === 'all' ? true : c.channel === tab))
      .filter((c) => (labelFilter ? (c.labels || []).includes(labelFilter) : true))
      .filter((c) =>
        passesSavedView(c, savedView, messagesByConv.get(c.id) || []),
      )
      .filter((c) => {
        if (!search) return true
        const inf = state.influencers.find((i) => i.id === c.influencerId)
        return (
          inf?.name.toLowerCase().includes(search.toLowerCase()) ||
          inf?.handle.toLowerCase().includes(search.toLowerCase()) ||
          inf?.phone.toLowerCase().includes(search.toLowerCase()) ||
          (inf?.email || '').toLowerCase().includes(search.toLowerCase()) ||
          c.lastPreview?.toLowerCase().includes(search.toLowerCase()) ||
          (c.labels || []).some((l) => l.toLowerCase().includes(search.toLowerCase()))
        )
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  }, [state.conversations, state.influencers, tab, labelFilter, savedView, search, messagesByConv])

  const selected = state.conversations.find((c) => c.id === state.selectedConversationId)

  useEffect(() => {
    if (!selected && conversations.length > 0 && !selectMode) {
      actions.selectConversation(conversations[0].id)
    }
  }, [conversations, selected, actions, selectMode])

  const { polling, lastSyncedAt, lastError, connection } = state.liveInbox
  const liveThreadCount = state.conversations.filter((c) => c.isLive).length
  const notifyEnabled = state.prefs.notifyEnabled

  const onSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await actions.syncLiveInboxNow()
    } finally {
      setSyncing(false)
    }
  }

  const toggleSelected = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => {
    setSelection(new Set())
    setSelectMode(false)
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
          <div className="rx-row" style={{ gap: 8 }}>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => {
                if (notifyEnabled) actions.disableNotifications()
                else void actions.enableNotifications()
              }}
              data-testid="toggle-notifications"
              title={notifyEnabled ? 'Notifications on' : 'Enable desktop notifications'}
            >
              {notifyEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {notifyEnabled ? 'Notify on' : 'Notify'}
            </button>
            <div className="rx-live-bar" data-testid="live-inbox-bar" role="status" aria-live="polite">
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
                  <span className="rx-live-pnid" title="Outreach org_id">
                    · org {resolveOrgId()}
                  </span>
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

        {/* Saved views strip */}
        <div className="rx-saved-views" data-testid="saved-views">
          <div className="rx-text-xs rx-muted" style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Filter size={11} /> Views
          </div>
          {savedViewDefs.map((v) => {
            const Icon = v.icon
            return (
              <button
                key={v.id}
                type="button"
                className={`rx-chip${savedView === v.id ? ' is-active' : ''}`}
                onClick={() => setSavedView(v.id)}
                data-testid={`view-${v.id}`}
              >
                <Icon size={11} /> {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="rx-bulk-bar" data-testid="bulk-bar">
          <span className="rx-text-sm">{selection.size} selected</span>
          <div className="rx-row" style={{ gap: 8 }}>
            <button
              type="button"
              className="rx-btn secondary sm"
              disabled={selection.size === 0}
              onClick={() => {
                actions.bulkResolve([...selection])
                actions.toast(`Resolved ${selection.size} thread${selection.size > 1 ? 's' : ''}`, 'success')
                clearSelection()
              }}
              data-testid="bulk-resolve"
            >
              <Check size={12} /> Resolve
            </button>
            <select
              className="rx-select sm"
              defaultValue=""
              onChange={(e) => {
                const memberId = e.target.value || undefined
                if (selection.size > 0) {
                  actions.bulkAssign([...selection], memberId)
                  actions.toast(`Assigned ${selection.size} thread${selection.size > 1 ? 's' : ''}`, 'success')
                  clearSelection()
                }
                e.currentTarget.value = ''
              }}
              data-testid="bulk-assign"
            >
              <option value="">Assign to…</option>
              {state.team.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button type="button" className="rx-btn ghost sm" onClick={clearSelection}>
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

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
            <div className="rx-row" style={{ gap: 6, alignItems: 'center' }}>
              <div className="rx-seg">
                <button className={`rx-seg-btn${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>All</button>
                <button className={`rx-seg-btn${tab === 'whatsapp' ? ' is-active' : ''}`} onClick={() => setTab('whatsapp')} title="WhatsApp"><MessageCircle size={12} /></button>
                <button className={`rx-seg-btn${tab === 'instagram' ? ' is-active' : ''}`} onClick={() => setTab('instagram')} title="Instagram"><IgIcon size={12} /></button>
                <button className={`rx-seg-btn${tab === 'email' ? ' is-active' : ''}`} onClick={() => setTab('email')} title="Email"><Mail size={12} /></button>
              </div>
              <button
                type="button"
                className={`rx-btn ghost sm${selectMode ? ' is-active' : ''}`}
                onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
                title="Multi-select"
                data-testid="toggle-select-mode"
              >
                <CheckSquare size={12} />
              </button>
            </div>
            {allLabels.length > 0 && (
              <div className="rx-label-filter">
                <button
                  className={`rx-chip${!labelFilter ? ' is-active' : ''}`}
                  onClick={() => setLabelFilter(null)}
                >
                  All labels
                </button>
                {allLabels.map((l) => (
                  <button
                    key={l}
                    className={`rx-chip${labelFilter === l ? ' is-active' : ''}`}
                    onClick={() => setLabelFilter(l === labelFilter ? null : l)}
                  >
                    <Tag size={10} /> {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {conversations.length === 0 ? (
            <div style={{ padding: 32 }}>
              <EmptyState
                title="No conversations match"
                body="Try switching the saved view or clearing filters."
              />
            </div>
          ) : (
            conversations.map((c) => {
              const inf = state.influencers.find((i) => i.id === c.influencerId)
              const initials = inf?.name.split(' ').map((x) => x[0]).slice(0, 2).join('') || '?'
              const isSelected = selection.has(c.id)
              return (
                <div
                  key={c.id}
                  className={`rx-conv${state.selectedConversationId === c.id ? ' is-selected' : ''}`}
                  data-testid={`conv-${c.id}`}
                  data-channel={c.channel}
                  onClick={() => {
                    if (selectMode) toggleSelected(c.id)
                    else actions.selectConversation(c.id)
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {selectMode ? (
                    <button
                      type="button"
                      className="rx-check"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelected(c.id)
                      }}
                      aria-label={isSelected ? 'Deselect' : 'Select'}
                    >
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  ) : (
                    <div className="rx-conv-avatar">
                      {initials}
                      <span className={`rx-conv-badge ${c.channel}`}>
                        {channelBadgeLetter(c.channel)}
                      </span>
                    </div>
                  )}
                  <div className="rx-conv-body">
                    <div className="rx-conv-row">
                      <div className="rx-conv-name">
                        {inf?.name || 'Unknown'}
                        {c.isLive ? (
                          <span className="rx-live-tag mono" title="Live from the Cloud API">LIVE</span>
                        ) : null}
                        {c.outreachThreadId ? (
                          <span className="rx-sql-tag mono" title={`SQL thread ${c.outreachThreadId}`}>SQL</span>
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
                    {c.labels && c.labels.length > 0 && (
                      <div className="rx-conv-labels">
                        {c.labels.map((l) => (
                          <span key={l} className="rx-chip xs"><Tag size={9} /> {l}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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

function InboundMedia({ msg }: { msg: Message }) {
  if (!msg.mediaId || !msg.mediaKind) return null
  const url = whatsappMediaUrl(msg.mediaId)
  if (msg.mediaKind === 'image' || msg.mediaKind === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="rx-msg-media">
        <img src={url} alt={msg.caption || 'image'} loading="lazy" />
      </a>
    )
  }
  if (msg.mediaKind === 'video') {
    return <video src={url} controls className="rx-msg-media video" preload="metadata" />
  }
  if (msg.mediaKind === 'audio') {
    return <audio src={url} controls className="rx-msg-audio" preload="metadata" />
  }
  if (msg.mediaKind === 'document') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="rx-msg-doc">
        <FileText size={14} /> Document ({msg.mediaMime || 'file'})
        <ExternalLink size={12} />
      </a>
    )
  }
  return null
}

function MessageBubble({
  msg,
  channel,
  showChannelChip,
  onReact,
  onRemoveReaction,
}: {
  msg: Message
  channel: OutreachChannel
  showChannelChip?: boolean
  onReact: (msgId: string, emoji: string) => void
  onRemoveReaction: (msgId: string) => void
}) {
  const [showReactMenu, setShowReactMenu] = useState(false)
  const myReaction = (msg.reactions || []).find((r) => r.by === 'me')

  return (
    <div className={`rx-msg-row ${msg.direction === 'outbound' ? 'out' : 'in'}`}>
      <div className="rx-msg-wrap">
        {showChannelChip ? (
          <div className={`rx-msg-channel-chip ${channel}`} aria-label={channelLabelShort(channel)}>
            <span className="rx-msg-channel-dot" />
            {channelLabelShort(channel)}
          </div>
        ) : null}
        {msg.subject ? (
          <div className="rx-text-xs rx-muted rx-mb-2">
            <strong>{msg.subject}</strong>
          </div>
        ) : null}
        {msg.mediaId ? <InboundMedia msg={msg} /> : null}
        {msg.body ? <div className="rx-msg" data-channel={channel}>{msg.body}</div> : null}
        <div className="rx-msg-meta">
          <span>
            {new Date(msg.createdAt).toLocaleTimeString('en', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {msg.direction === 'outbound' ? (
            <>
              <span>·</span>
              <span>{msg.status}</span>
              {msg.status === 'read' ? (
                <CheckCheck size={12} />
              ) : msg.status === 'delivered' ? (
                <Check size={12} />
              ) : msg.status === 'failed' ? (
                <AlertTriangle size={12} />
              ) : null}
            </>
          ) : null}
        </div>
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="rx-msg-reactions">
            {msg.reactions.map((r, i) => (
              <button
                key={i}
                type="button"
                className={`rx-msg-reaction${r.by === 'me' ? ' mine' : ''}`}
                onClick={() => r.by === 'me' && onRemoveReaction(msg.id)}
                title={r.by === 'me' ? 'Remove your reaction' : 'Reaction from creator'}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
        <div className="rx-msg-actions">
          <button
            type="button"
            className="rx-msg-react-btn"
            onClick={() => setShowReactMenu((v) => !v)}
            title="React"
            aria-label="React to message"
          >
            <Heart size={12} />
          </button>
          {showReactMenu && (
            <div className="rx-react-menu" onMouseLeave={() => setShowReactMenu(false)}>
              {REACTION_QUICKPICK.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`rx-react-menu-btn${myReaction?.emoji === em ? ' is-mine' : ''}`}
                  onClick={() => {
                    onReact(msg.id, em)
                    setShowReactMenu(false)
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Thread() {
  const { state, actions } = useWhatsAppStore()
  const conv = state.conversations.find((c) => c.id === state.selectedConversationId)!
  const inf = state.influencers.find((i) => i.id === conv.influencerId)

  // Sibling conversations — same influencer on other channels (WA / IG / Gmail).
  const siblings = useMemo(
    () => state.conversations.filter((c) => c.influencerId === conv.influencerId),
    [state.conversations, conv.influencerId],
  )
  const availableChannels = useMemo(() => {
    const set = new Set<OutreachChannel>()
    for (const s of siblings) set.add(s.channel)
    return Array.from(set)
  }, [siblings])
  const canUnify = availableChannels.length >= 2

  // Unified toggle (per-thread, defaults to single so nothing breaks).
  const [unified, setUnified] = useState(false)
  useEffect(() => {
    // Reset when switching to a thread that can't unify.
    if (!canUnify && unified) setUnified(false)
  }, [canUnify, unified])

  // Which channel the composer will reply on (unified mode only).
  const [replyChannel, setReplyChannel] = useState<OutreachChannel>(conv.channel)
  useEffect(() => {
    setReplyChannel(conv.channel)
  }, [conv.channel, conv.id])

  // Map from conversationId → channel for bubble decoration in unified view.
  const convChannelById = useMemo(() => {
    const map = new Map<string, OutreachChannel>()
    for (const c of siblings) map.set(c.id, c.channel)
    return map
  }, [siblings])

  const messages = useMemo(() => {
    if (unified) {
      const siblingIds = new Set(siblings.map((s) => s.id))
      return state.messages
        .filter((m) => siblingIds.has(m.conversationId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return state.messages
      .filter((m) => m.conversationId === conv.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [state.messages, unified, siblings, conv.id])

  // The conversation the composer is currently attached to.
  const activeConv: Conversation = useMemo(() => {
    if (!unified) return conv
    return siblings.find((s) => s.channel === replyChannel) || conv
  }, [unified, siblings, replyChannel, conv])

  const [draft, setDraft] = useState('')
  const [replying, setReplying] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [showLabelEditor, setShowLabelEditor] = useState(false)
  const [labelInput, setLabelInput] = useState('')
  const attachRef = useRef<HTMLInputElement | null>(null)

  const canReply = actions.canFreeformReply(activeConv.id)
  const windowOpen = activeConv.channel === 'email' || actions.isWithin24hWindow(activeConv.id)

  const bodyRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [conv.id, unified, messages.length])

  const send = async () => {
    const text = draft.trim()
    if (!text || replying) return
    setDraft('')
    setReplying(true)
    try {
      if (activeConv.channel === 'whatsapp' && activeConv.isLive) {
        const ok = await actions.sendWhatsAppReplyLive(activeConv.id, text)
        if (!ok) setDraft(text)
      } else if (activeConv.channel === 'email' && activeConv.isLive) {
        const ok = await actions.sendGmailReplyLive(activeConv.id, text)
        if (!ok) setDraft(text)
      } else {
        const ok = actions.sendReply(activeConv.id, text)
        if (!ok) {
          setDraft(text)
          actions.toast(
            activeConv.channel === 'email'
              ? 'Could not send'
              : 'Reply window closed — send a template first',
            'error',
          )
        }
      }
    } finally {
      setReplying(false)
    }
  }

  const insertAtCaret = (s: string) => {
    setDraft((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + s)
  }

  const addLabel = (l: string) => {
    const clean = l.trim().toLowerCase()
    if (!clean) return
    const cur = conv.labels || []
    if (cur.includes(clean)) return
    actions.setConversationLabels(conv.id, [...cur, clean])
    setLabelInput('')
  }
  const removeLabel = (l: string) => {
    actions.setConversationLabels(conv.id, (conv.labels || []).filter((x) => x !== l))
  }

  const initials = inf?.name.split(' ').map((x) => x[0]).slice(0, 2).join('') || '?'
  const canReact = !activeConv.isLive || activeConv.channel !== 'whatsapp'
  const handle = inf?.handle?.startsWith('@') ? inf.handle : inf?.handle ? `@${inf.handle}` : ''

  return (
    <div className="rx-thread" data-channel={unified ? 'unified' : conv.channel}>
      <div className="rx-thread-head">
        <div className="rx-thread-head-left">
          <div className="rx-conv-avatar" style={{ width: 40, height: 40 }}>
            {initials}
            <span className={`rx-conv-badge ${conv.channel}`}>
              {channelBadgeLetter(conv.channel)}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em' }}>
              {inf?.name}
              {conv.isLive ? <span className="rx-live-tag mono" style={{ marginLeft: 8 }}>LIVE</span> : null}
              {conv.outreachThreadId ? (
                <span className="rx-sql-tag mono" style={{ marginLeft: 6 }} title={`SQL thread ${conv.outreachThreadId}`}>SQL</span>
              ) : null}
            </div>
            <div className="rx-text-xs rx-muted mono">
              {unified
                ? `${availableChannels.length} channels · ${availableChannels.map(channelLabelShort).join(' · ')}`
                : conv.channel === 'whatsapp' ? inf?.phone
                : conv.channel === 'instagram' ? (handle || 'no handle')
                : inf?.email}
            </div>
          </div>
        </div>
        <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canUnify && (
            <div className="rx-seg sm" role="tablist" aria-label="Thread view mode" data-testid="unified-toggle">
              <button
                type="button"
                role="tab"
                aria-selected={!unified}
                className={`rx-seg-btn${!unified ? ' is-active' : ''}`}
                onClick={() => setUnified(false)}
                data-testid="thread-mode-single"
              >
                Single
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={unified}
                className={`rx-seg-btn${unified ? ' is-active' : ''}`}
                onClick={() => setUnified(true)}
                data-testid="thread-mode-unified"
                title={`Merge ${availableChannels.map(channelLabelShort).join(' + ')}`}
              >
                Unified
              </button>
            </div>
          )}
          {(conv.labels || []).map((l) => (
            <span key={l} className="rx-chip xs">
              <Tag size={9} /> {l}
              <button
                type="button"
                className="rx-chip-x"
                aria-label={`Remove label ${l}`}
                onClick={() => removeLabel(l)}
              >
                <X size={9} />
              </button>
            </span>
          ))}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => setShowLabelEditor((v) => !v)}
              data-testid="add-label-btn"
            >
              <Tag size={12} /> Label
            </button>
            {showLabelEditor && (
              <div className="rx-label-popover" data-testid="label-popover">
                <input
                  className="rx-input"
                  placeholder="Add a label…"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addLabel(labelInput) }
                    if (e.key === 'Escape') setShowLabelEditor(false)
                  }}
                  autoFocus
                />
                <div className="rx-label-suggest">
                  {SUGGESTED_LABELS.filter((l) => !(conv.labels || []).includes(l)).map((l) => (
                    <button key={l} type="button" className="rx-chip" onClick={() => addLabel(l)}>
                      <Tag size={10} /> {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {conv.campaignIds.slice(0, 2).map((cid) => {
            const c = state.campaigns.find((x) => x.id === cid)
            if (!c) return null
            return <span key={cid} className="rx-badge">{c.name}</span>
          })}
          {conv.status === 'resolved' ? (
            <button className="rx-btn secondary sm" onClick={() => actions.reopenConversation(conv.id)}>
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

      <div className="rx-thread-body" ref={bodyRef} data-channel={unified ? 'unified' : conv.channel}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', color: 'var(--text-3)' }}>
            {conv.isLive ? 'Waiting for messages to sync…' : 'No messages yet.'}
          </div>
        ) : (
          messages.map((m) => {
            const msgChannel = unified
              ? (convChannelById.get(m.conversationId) || conv.channel)
              : conv.channel
            return (
              <MessageBubble
                key={m.id}
                msg={m}
                channel={msgChannel}
                showChannelChip={unified}
                onReact={(id, em) => {
                  if (!canReact) {
                    actions.toast(
                      'Reactions on live WhatsApp threads need proxy support — UI ready.',
                      'info',
                    )
                    return
                  }
                  actions.reactToMessage(id, em, 'me')
                }}
                onRemoveReaction={(id) => actions.removeReaction(id, 'me')}
              />
            )
          })
        )}
      </div>

      <div className="rx-composer" data-channel={activeConv.channel}>
        {unified && canUnify && (
          <div className="rx-composer-channel-row" data-testid="reply-channel-picker">
            <span className="rx-text-xs rx-muted">Reply via</span>
            <div className="rx-seg sm">
              {availableChannels.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`rx-seg-btn${replyChannel === ch ? ' is-active' : ''}`}
                  onClick={() => setReplyChannel(ch)}
                  data-testid={`reply-channel-${ch}`}
                >
                  {channelLabelShort(ch)}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeConv.channel === 'whatsapp' && (
          <div className={`rx-window-note ${windowOpen ? 'open' : 'closed'}`}>
            <span>
              {windowOpen
                ? activeConv.isLive
                  ? '● 24-hour reply window open · sending via WhatsApp Cloud API'
                  : '● 24-hour reply window open'
                : '● Window closed — use a template'}
            </span>
          </div>
        )}
        {activeConv.channel === 'email' && (
          <div className={`rx-window-note open`}>
            <span>
              {activeConv.isLive
                ? '● Live Gmail thread · replies send from your connected account'
                : '● Email thread'}
            </span>
          </div>
        )}
        {activeConv.channel === 'instagram' && (
          <div className={`rx-window-note ig ${windowOpen ? 'open' : 'closed'}`}>
            <span>
              {windowOpen
                ? '● Instagram 24-hour DM window open'
                : '● DM window closed — send a story reply or template'}
            </span>
          </div>
        )}
        <div className="rx-composer-row">
          <div className="rx-composer-tools">
            <button
              type="button"
              className="rx-icon-btn"
              onClick={() => setShowEmoji((v) => !v)}
              disabled={!canReply}
              title="Emoji"
              data-testid="composer-emoji"
            >
              <Smile size={15} />
            </button>
            <button
              type="button"
              className="rx-icon-btn"
              onClick={() => setShowCanned((v) => !v)}
              disabled={!canReply || state.cannedReplies.length === 0}
              title="Canned replies"
              data-testid="composer-canned"
            >
              <Zap size={15} />
            </button>
            <button
              type="button"
              className="rx-icon-btn"
              onClick={() => attachRef.current?.click()}
              disabled={!canReply}
              title={
                activeConv.channel === 'whatsapp' && activeConv.isLive
                  ? 'Media send is pending backend support — coming soon'
                  : 'Attach a file'
              }
              data-testid="composer-attach"
            >
              <Paperclip size={15} />
            </button>
            <input
              ref={attachRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (activeConv.channel === 'whatsapp' && activeConv.isLive) {
                  actions.toast(
                    'WhatsApp media send requires proxy support — UI ready, endpoint pending',
                    'info',
                  )
                } else {
                  const url = URL.createObjectURL(file)
                  actions.toast(`Attached ${file.name} (mock preview)`, 'info')
                  window.open(url, '_blank', 'noopener')
                }
                if (attachRef.current) attachRef.current.value = ''
              }}
            />
            {showEmoji && (
              <EmojiPicker
                onPick={(em) => setDraft((d) => d + em)}
                onClose={() => setShowEmoji(false)}
              />
            )}
            {showCanned && (
              <div className="rx-canned-pop" data-testid="canned-pop">
                <div className="rx-canned-head">
                  <span className="rx-text-xs rx-muted">Quick replies</span>
                </div>
                <div className="rx-canned-list">
                  {state.cannedReplies.length === 0 ? (
                    <div className="rx-text-xs rx-muted" style={{ padding: 8 }}>
                      Add canned replies in Settings.
                    </div>
                  ) : (
                    state.cannedReplies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="rx-canned-item"
                        onClick={() => {
                          insertAtCaret(c.body)
                          setShowCanned(false)
                        }}
                      >
                        <div className="rx-canned-title">
                          <Play size={10} /> {c.title}
                        </div>
                        <div className="rx-canned-preview">{c.body}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <textarea
            className="rx-textarea"
            placeholder={
              canReply
                ? unified
                  ? `Reply on ${channelLabelShort(activeConv.channel)}…`
                  : 'Type a reply…'
                : 'Reply window closed'
            }
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
        {!activeConv.isLive ? (
          <div className="rx-row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className="rx-text-xs rx-muted">Demo:</span>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() =>
                actions.simulateInbound(
                  activeConv.id,
                  'Sure! Could you share your rates and the brief?',
                )
              }
              data-testid="sim-hot"
            >
              Sim hot lead
            </button>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() =>
                actions.simulateInbound(
                  activeConv.id,
                  'Just processed the invoice \u2014 payment received!',
                )
              }
              data-testid="sim-paid"
            >
              Sim paid
            </button>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() =>
                actions.simulateInbound(
                  activeConv.id,
                  'Yes, sounds great! Would love to know more.',
                )
              }
              data-testid="sim-neutral"
            >
              Sim neutral
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
