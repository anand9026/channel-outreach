import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

type Shortcut = { keys: string[]; label: string }
type Group = { title: string; items: Shortcut[] }

const isMac =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipod|ipad/i.test(navigator.platform || navigator.userAgent)
const cmdKey = isMac ? '\u2318' : 'Ctrl'

const groups: Group[] = [
  {
    title: 'Global',
    items: [
      { keys: [cmdKey, 'K'], label: 'Open command palette' },
      { keys: ['?'], label: 'Show this shortcuts panel' },
      { keys: ['Esc'], label: 'Close any open modal or popover' },
    ],
  },
  {
    title: 'Composer',
    items: [
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['Shift', 'Enter'], label: 'Insert a new line' },
    ],
  },
  {
    title: 'Inbox',
    items: [
      { keys: ['\u2191', '\u2193'], label: 'Move between threads' },
      { keys: ['Enter'], label: 'Open selected thread' },
    ],
  },
]

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Open on `?` when not typing in a field
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (e.key === '?' && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="rx-shortcuts-scrim"
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      data-testid="shortcuts-overlay"
    >
      <div className="rx-shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="rx-shortcuts-head">
          <div>
            <div className="rx-shortcuts-title">Keyboard shortcuts</div>
            <div className="rx-shortcuts-sub">
              Speed up your outreach. Press <span className="rx-kbd">?</span> anywhere to open this
              panel.
            </div>
          </div>
          <button
            type="button"
            className="rx-icon-btn"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <div className="rx-shortcuts-group-title">{g.title}</div>
            {g.items.map((s) => (
              <div key={s.label} className="rx-shortcuts-row">
                <div className="rx-shortcuts-label">{s.label}</div>
                <div className="rx-shortcuts-keys">
                  {s.keys.map((k, i) => (
                    <span key={i} className="rx-kbd">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
