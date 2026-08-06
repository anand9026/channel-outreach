import {
  BarChart3,
  Inbox,
  LayoutTemplate,
  Mail,
  Search,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IgIcon, WaIcon } from './BrandIcons'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { Conversation, OutreachChannel } from '../types'

type CommandGroup = 'nav' | 'action' | 'campaign' | 'conversation'

type Command = {
  id: string
  label: string
  hint?: string
  sub?: string
  icon: React.ReactNode
  keywords?: string
  group: CommandGroup
  action: () => void
}

const groupOrder: CommandGroup[] = ['nav', 'action', 'campaign', 'conversation']
const groupTitle: Record<CommandGroup, string> = {
  nav: 'Navigate',
  action: 'Actions',
  campaign: 'Campaigns',
  conversation: 'Conversations',
}

function channelIcon(ch: OutreachChannel) {
  if (ch === 'whatsapp') return <WaIcon size={13} />
  if (ch === 'instagram') return <IgIcon size={13} />
  return <Mail size={13} />
}

function channelLabel(ch: OutreachChannel) {
  if (ch === 'whatsapp') return 'WhatsApp'
  if (ch === 'instagram') return 'Instagram'
  return 'Gmail'
}

/** Strip HTML tags so email previews display cleanly in the palette. */
function stripHtml(input: string | undefined): string {
  if (!input) return ''
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Global command palette (⌘K / Ctrl+K).
 * Search + jump to pages, primary actions, campaigns, and live conversations
 * (matches on contact name, handle, phone, email, and message content).
 */
export function CommandPalette() {
  const { state, actions } = useWhatsAppStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const close = () => setOpen(false)

  /** Index messages by conversation for content search. */
  const messagesByConv = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of state.messages) {
      const prev = map.get(m.conversationId) || ''
      // Keep it small — enough for a match & a preview.
      map.set(m.conversationId, `${prev} ${stripHtml(m.subject)} ${stripHtml(m.body)}`.slice(0, 2000))
    }
    return map
  }, [state.messages])

  const openConversation = (c: Conversation) => {
    actions.selectConversation(c.id)
    actions.setTab('inbox')
    close()
  }

  const commands: Command[] = useMemo(() => {
    const nav =
      (id: 'overview' | 'campaigns' | 'quicksend' | 'inbox' | 'templates' | 'reports' | 'channels') => () => {
        actions.setTab(id)
        close()
      }
    const list: Command[] = [
      { id: 'go-overview', label: 'Go to Overview', icon: <Sparkles size={14} />, action: nav('overview'), keywords: 'dashboard home', group: 'nav' },
      { id: 'go-campaigns', label: 'Go to Campaigns', icon: <Send size={14} />, action: nav('campaigns'), keywords: 'outreach kanban', group: 'nav' },
      { id: 'go-quicksend', label: 'Go to Quick Send', icon: <Zap size={14} />, action: nav('quicksend'), keywords: 'sandbox test csv', group: 'nav' },
      { id: 'go-inbox', label: 'Go to Inbox', icon: <Inbox size={14} />, action: nav('inbox'), keywords: 'chat reply messages', group: 'nav' },
      { id: 'go-templates', label: 'Go to Templates', icon: <LayoutTemplate size={14} />, action: nav('templates'), keywords: 'templates library messages', group: 'nav' },
      { id: 'go-reports', label: 'Go to Reports', icon: <BarChart3 size={14} />, action: nav('reports'), keywords: 'analytics stats results', group: 'nav' },
      { id: 'go-channels', label: 'Go to Channels', icon: <Mail size={14} />, action: nav('channels'), keywords: 'connect whatsapp gmail', group: 'nav' },
      {
        id: 'new-outreach',
        label: 'New outreach',
        hint: 'Open the send wizard',
        icon: <Sparkles size={14} />,
        group: 'action',
        action: () => {
          actions.setTab('campaigns')
          close()
          window.dispatchEvent(new CustomEvent('rx-open-send-drawer'))
        },
      },
    ]

    state.campaigns.slice(0, 12).forEach((c) => {
      list.push({
        id: `camp-${c.id}`,
        label: c.name,
        hint: c.status,
        icon: <Send size={14} />,
        group: 'campaign',
        keywords: `${c.kind} ${c.status}`,
        action: () => {
          actions.selectCampaign(c.id)
          actions.setTab('campaigns')
          close()
        },
      })
    })

    // Conversations — indexed lightly so we can search bodies too.
    for (const c of state.conversations) {
      const inf = state.influencers.find((i) => i.id === c.influencerId)
      const preview = stripHtml(c.lastPreview)
      const bodyIndex = messagesByConv.get(c.id) || ''
      list.push({
        id: `conv-${c.id}`,
        label: inf?.name || inf?.handle || 'Conversation',
        hint: channelLabel(c.channel),
        sub: preview || bodyIndex.slice(0, 90),
        icon: channelIcon(c.channel),
        group: 'conversation',
        keywords: [
          inf?.handle,
          inf?.phone,
          inf?.email,
          inf?.niche,
          ...(c.labels || []),
          preview,
          bodyIndex,
        ]
          .filter(Boolean)
          .join(' '),
        action: () => openConversation(c),
      })
    }
    return list
  }, [state.campaigns, state.conversations, state.influencers, messagesByConv, actions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // No query — show nav + top campaigns + a few conversations.
      const convHead = commands.filter((c) => c.group === 'conversation').slice(0, 6)
      const rest = commands.filter((c) => c.group !== 'conversation')
      return [...rest, ...convHead]
    }
    return commands
      .filter((c) => {
        const hay = (c.label + ' ' + (c.hint ?? '') + ' ' + (c.sub ?? '') + ' ' + (c.keywords ?? '')).toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 40)
  }, [commands, query])

  // Group filtered commands preserving insertion order.
  const grouped = useMemo(() => {
    const buckets: Record<CommandGroup, Command[]> = {
      nav: [], action: [], campaign: [], conversation: [],
    }
    for (const c of filtered) buckets[c.group].push(c)
    return groupOrder
      .map((g) => ({ group: g, items: buckets[g] }))
      .filter((s) => s.items.length > 0)
  }, [filtered])

  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0)
  }, [filtered.length, cursor])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(filtered.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[cursor]?.action()
    }
  }

  // Cursor → position within full filtered list, used to highlight in grouped view.
  const activeId = filtered[cursor]?.id

  return (
    <div className="rx-cmdk-scrim" role="dialog" aria-modal="true" onClick={close}>
      <div className="rx-cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="rx-cmdk-input-row">
          <Search size={16} style={{ color: 'var(--text-3)' }} />
          <input
            ref={inputRef}
            className="rx-cmdk-input"
            placeholder="Search commands, campaigns, conversations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            data-testid="cmdk-input"
          />
          <kbd className="rx-kbd">ESC</kbd>
        </div>
        <div className="rx-cmdk-list">
          {filtered.length === 0 ? (
            <div className="rx-cmdk-empty">
              No matches for “{query}”. Try a contact name, phone, or a phrase from a message.
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="rx-cmdk-group">
                <div className="rx-cmdk-group-head">{groupTitle[group]}</div>
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`rx-cmdk-item${activeId === c.id ? ' is-active' : ''}`}
                    onMouseEnter={() => {
                      const idx = filtered.findIndex((f) => f.id === c.id)
                      if (idx >= 0) setCursor(idx)
                    }}
                    onClick={c.action}
                    data-testid={`cmdk-item-${c.id}`}
                  >
                    <span className={`rx-cmdk-icon ${c.group === 'conversation' ? 'is-' + (c.hint || '').toLowerCase() : ''}`}>
                      {c.icon}
                    </span>
                    <span className="rx-cmdk-body">
                      <span className="rx-cmdk-label">{c.label}</span>
                      {c.sub && <span className="rx-cmdk-sub">{c.sub}</span>}
                    </span>
                    {c.hint && <span className="rx-cmdk-hint">{c.hint}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="rx-cmdk-foot">
          <span>
            <kbd className="rx-kbd">↑ ↓</kbd> navigate
          </span>
          <span>
            <kbd className="rx-kbd">↵</kbd> select
          </span>
          <span>
            Press <kbd className="rx-kbd">⌘K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  )
}

export function CmdKHint() {
  return (
    <div className="rx-cmdk-hint-btn" onClick={() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    }}>
      <Search size={12} /> Search <kbd className="rx-kbd">⌘K</kbd>
    </div>
  )
}
