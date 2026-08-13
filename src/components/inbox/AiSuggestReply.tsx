import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatEmailForDisplay } from '../../lib/format-email-for-display'
import {
  AI_OBJECTIVE_LABELS,
  AI_MODE_LABELS,
  type OutreachAiScope,
} from '../../lib/outreach-scope'
import type { CampaignAiObjective, Message } from '../../types'

type Props = {
  scope: OutreachAiScope
  messages: Message[]
  creatorName: string
  onInsert: (text: string) => void
}

function inboundText(msg: Message): string {
  if (msg.channel === 'email') {
    return formatEmailForDisplay(msg.rawBody || msg.htmlBody || msg.body).primary
  }
  return msg.body || ''
}

function suggestForObjective(
  objective: CampaignAiObjective,
  creatorFirst: string,
  inboundBody: string,
  scope: OutreachAiScope,
): string {
  const body = inboundBody.toLowerCase()
  const pricing = scope.extractedPricing

  switch (objective) {
    case 'collect_pricing':
      if (pricing?.amount) {
        return `Thanks ${creatorFirst} — noted your rate of ${pricing.currency || 'INR'} ${pricing.amount}. Can you confirm deliverables and usage rights match our brief?`
      }
      if (body.includes('price') || body.includes('rate') || body.includes('inr') || body.includes('₹')) {
        return `Thanks for sharing your rates, ${creatorFirst}. Could you also confirm reel count, usage window, and exclusivity?`
      }
      return `Hi ${creatorFirst} — could you share your package pricing for this collab (deliverables + usage)?`

    case 'negotiate':
      if (scope.intent === 'negotiation' || body.includes('counter') || body.includes('budget')) {
        return `Appreciate the counter, ${creatorFirst}. Let me check with the brand and come back with our best offer on deliverables.`
      }
      return `Thanks ${creatorFirst}. We're flexible on scope — what would work best within your rate card?`

    case 'confirm_booking':
      if (scope.intent === 'accepted' || body.includes('confirm') || body.includes('book')) {
        return `Great — I'll send the formal brief and contract link shortly, ${creatorFirst}. What shoot/post dates work for you?`
      }
      return `Sounds good, ${creatorFirst}! Once you confirm dates and deliverables, we'll lock the booking and share payment terms.`

    case 'gauge_interest':
    default:
      if (body.includes('interested') || body.includes('love') || body.includes('keen')) {
        return `Great to hear you're interested, ${creatorFirst}! I'll send the brief and next steps shortly.`
      }
      if (body.includes('not interested') || body.includes('pass')) {
        return `No worries, ${creatorFirst} — thanks for letting us know. Happy to reconnect on future campaigns.`
      }
      return `Thanks ${creatorFirst} — would you be open to this collab? Happy to share more on timeline and deliverables.`
  }
}

/** Campaign-scoped AI suggest-reply — never auto-sends. Hidden when ai_mode is off. */
export function AiSuggestReply({ scope, messages, creatorName, onInsert }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
    if (!scope.aiFeaturesEnabled) {
      setSuggestion(null)
      return
    }
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
    if (!lastInbound) {
      setSuggestion(null)
      return
    }
    const first = creatorName.split(' ')[0] || 'there'
    const text = suggestForObjective(
      scope.aiObjective,
      first,
      inboundText(lastInbound),
      scope,
    )
    setSuggestion(text)
  }, [messages, creatorName, scope])

  if (!scope.aiFeaturesEnabled || !suggestion || dismissed) return null

  return (
    <div className="rx-ai-suggest" data-testid="ai-suggest-reply">
      <div className="rx-ai-suggest-head">
        <Sparkles size={14} />
        <span>
          Suggested reply · {AI_OBJECTIVE_LABELS[scope.aiObjective]}
          {scope.aiMode === 'auto' ? ' · auto classify on' : ''}
        </span>
        <button
          type="button"
          className="rx-btn ghost sm"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss suggestion"
        >
          <X size={12} />
        </button>
      </div>
      {scope.participant?.aiSummary ? (
        <p className="rx-text-xs rx-muted" style={{ margin: '0 0 6px' }}>
          AI read: {scope.participant.aiSummary}
        </p>
      ) : null}
      <p className="rx-ai-suggest-body">{suggestion}</p>
      <button
        type="button"
        className="rx-btn secondary sm"
        onClick={() => onInsert(suggestion)}
        data-testid="ai-suggest-insert"
      >
        Use suggestion
      </button>
      <span className="rx-text-xs rx-muted" style={{ display: 'block', marginTop: 6 }}>
        {AI_MODE_LABELS[scope.aiMode]} — review before sending
      </span>
    </div>
  )
}
