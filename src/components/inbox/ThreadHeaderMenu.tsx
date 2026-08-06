import { MoreHorizontal, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ConversationIntent } from '../../types'

type Props = {
  conversationId: string
  intent: ConversationIntent | null | undefined
  labels: string[]
  suggestedLabels: string[]
  onIntentChange: (intent: ConversationIntent | null) => void
  onAddLabel: (label: string) => void
  onRemoveLabel: (label: string) => void
}

export function ThreadHeaderMenu({
  conversationId,
  intent,
  labels,
  suggestedLabels,
  onIntentChange,
  onAddLabel,
  onRemoveLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [labelInput, setLabelInput] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const intentSummary =
    intent === 'interested'
      ? 'Interested'
      : intent === 'pricing'
        ? 'Pricing'
        : intent === 'negotiation'
          ? 'Negotiation'
          : intent === 'accepted'
            ? 'Accepted'
            : intent === 'rejected'
              ? 'Rejected'
              : 'Set intent'

  const labelSummary =
    labels.length > 0 ? `${labels.length} label${labels.length === 1 ? '' : 's'}` : 'Add labels'

  return (
    <div className="rx-thread-menu" ref={rootRef}>
      <button
        type="button"
        className="rx-btn ghost sm rx-thread-menu-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        data-testid="thread-header-menu"
        title="Intent and labels"
      >
        <MoreHorizontal size={16} />
        <span className="rx-thread-menu-trigger-copy">
          <span>{intentSummary}</span>
          <span className="rx-thread-menu-trigger-sep">·</span>
          <span>{labelSummary}</span>
        </span>
      </button>

      {open ? (
        <div className="rx-thread-menu-panel" role="dialog" aria-label="Thread options">
          <div className="rx-thread-menu-section">
            <div className="rx-thread-menu-label">Intent</div>
            <select
              className="rx-select sm rx-thread-menu-select"
              value={intent || ''}
              onChange={(e) =>
                onIntentChange((e.target.value || null) as ConversationIntent | null)
              }
              data-testid="conversation-intent"
            >
              <option value="">None</option>
              <option value="interested">Interested</option>
              <option value="pricing">Pricing</option>
              <option value="negotiation">Negotiation</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="rx-thread-menu-section">
            <div className="rx-thread-menu-label">Labels</div>
            <div className="rx-thread-menu-chips">
              {labels.length === 0 ? (
                <span className="rx-text-xs rx-muted">No labels yet</span>
              ) : (
                labels.map((l) => (
                  <span key={l} className="rx-chip xs">
                    <Tag size={9} /> {l}
                    <button
                      type="button"
                      className="rx-chip-x"
                      aria-label={`Remove label ${l}`}
                      onClick={() => onRemoveLabel(l)}
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))
              )}
            </div>
            <input
              className="rx-input rx-thread-menu-input"
              placeholder="Add a label…"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (labelInput.trim()) {
                    onAddLabel(labelInput)
                    setLabelInput('')
                  }
                }
                if (e.key === 'Escape') setOpen(false)
              }}
            />
            <div className="rx-label-suggest">
              {suggestedLabels
                .filter((l) => !labels.includes(l))
                .map((l) => (
                  <button
                    key={`${conversationId}-${l}`}
                    type="button"
                    className="rx-chip"
                    onClick={() => onAddLabel(l)}
                  >
                    <Tag size={10} /> {l}
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
