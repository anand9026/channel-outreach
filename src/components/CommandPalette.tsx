import {
  BarChart3,
  Inbox,
  LayoutTemplate,
  Search,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWhatsAppStore } from '../store/WhatsAppStore'

type Command = {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  keywords?: string
  action: () => void
}

/**
 * Global command palette (⌘K / Ctrl+K).
 * Search + jump to pages + primary actions.
 */
export function CommandPalette() {
  const { state, actions } = useWhatsAppStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut listener
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

  const commands: Command[] = useMemo(() => {
    const nav = (id: 'campaigns' | 'quicksend' | 'inbox' | 'templates' | 'analytics') => () => {
      actions.setTab(id)
      close()
    }
    const list: Command[] = [
      { id: 'go-campaigns', label: 'Go to Campaigns', icon: <Send size={14} />, action: nav('campaigns'), keywords: 'home' },
      { id: 'go-quicksend', label: 'Go to Quick Send', icon: <Zap size={14} />, action: nav('quicksend'), keywords: 'sandbox test' },
      { id: 'go-inbox', label: 'Go to Inbox', icon: <Inbox size={14} />, action: nav('inbox'), keywords: 'chat reply' },
      { id: 'go-templates', label: 'Go to Messages', icon: <LayoutTemplate size={14} />, action: nav('templates'), keywords: 'templates library' },
      { id: 'go-analytics', label: 'Go to Results', icon: <BarChart3 size={14} />, action: nav('analytics'), keywords: 'analytics stats' },
      {
        id: 'new-outreach',
        label: 'New outreach',
        hint: 'Open the send wizard',
        icon: <Sparkles size={14} />,
        action: () => {
          actions.setTab('campaigns')
          close()
          // Broadcast an event so CampaignsHub can open its send drawer
          window.dispatchEvent(new CustomEvent('rx-open-send-drawer'))
        },
      },
    ]
    // Deep links: campaigns & conversations
    state.campaigns.slice(0, 8).forEach((c) => {
      list.push({
        id: `camp-${c.id}`,
        label: c.name,
        hint: 'Campaign',
        icon: <Send size={14} />,
        keywords: c.status,
        action: () => {
          actions.selectCampaign(c.id)
          actions.setTab('campaigns')
          close()
        },
      })
    })
    state.conversations.slice(0, 8).forEach((c) => {
      const inf = state.influencers.find((i) => i.id === c.influencerId)
      list.push({
        id: `conv-${c.id}`,
        label: inf?.name || 'Conversation',
        hint: `Inbox · ${c.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}`,
        icon: <Inbox size={14} />,
        action: () => {
          actions.selectConversation(c.id)
          actions.setTab('inbox')
          close()
        },
      })
    })
    return list
  }, [state.campaigns, state.conversations, state.influencers, actions])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((c) =>
      (c.label + ' ' + (c.hint ?? '') + ' ' + (c.keywords ?? '')).toLowerCase().includes(q),
    )
  }, [commands, query])

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
            <div className="rx-cmdk-empty">No matches. Try a page name or "new outreach".</div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`rx-cmdk-item${i === cursor ? ' is-active' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onClick={c.action}
                data-testid={`cmdk-item-${c.id}`}
              >
                <span className="rx-cmdk-icon">{c.icon}</span>
                <span className="rx-cmdk-label">{c.label}</span>
                {c.hint && <span className="rx-cmdk-hint">{c.hint}</span>}
              </button>
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
      // Simulate ⌘K
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    }}>
      <Search size={12} /> Search <kbd className="rx-kbd">⌘K</kbd>
    </div>
  )
}
