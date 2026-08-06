import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Message } from '../../types'

type Props = {
  messages: Message[]
  creatorName: string
  onInsert: (text: string) => void
}

/** Stub AI suggest-reply strip (blueprint §11) — never auto-sends. */
export function AiSuggestReply({ messages, creatorName, onInsert }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
    if (!lastInbound) {
      setSuggestion(null)
      return
    }
    const body = (lastInbound.body || '').toLowerCase()
    let text = `Thanks ${creatorName.split(' ')[0] || 'there'} — happy to share more details. What timeline works for you?`
    if (body.includes('price') || body.includes('rate') || body.includes('inr') || body.includes('₹')) {
      text = `Thanks for sharing your rates, ${creatorName.split(' ')[0] || 'there'}. Can we align on deliverables and usage rights before we finalize?`
    } else if (body.includes('interested') || body.includes('love') || body.includes('keen')) {
      text = `Great to hear you're interested! I'll send the brief and next steps shortly.`
    }
    setSuggestion(text)
  }, [messages, creatorName])

  if (!suggestion || dismissed) return null

  return (
    <div className="rx-ai-suggest" data-testid="ai-suggest-reply">
      <div className="rx-ai-suggest-head">
        <Sparkles size={14} />
        <span>Suggested reply</span>
        <button
          type="button"
          className="rx-btn ghost sm"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss suggestion"
        >
          <X size={12} />
        </button>
      </div>
      <p className="rx-ai-suggest-body">{suggestion}</p>
      <button
        type="button"
        className="rx-btn secondary sm"
        onClick={() => onInsert(suggestion)}
        data-testid="ai-suggest-insert"
      >
        Use suggestion
      </button>
    </div>
  )
}
