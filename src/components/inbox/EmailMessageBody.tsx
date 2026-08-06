import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatEmailForDisplay } from '../../lib/format-email-for-display'

type Props = {
  subject?: string
  from?: string
  to?: string
  body: string
  htmlBody?: string
  rawBody?: string
  /** Chat-style bubble — hides headers, lighter chrome */
  compact?: boolean
}

function formatAddress(raw?: string): string | null {
  if (!raw?.trim()) return null
  return raw.replace(/<([^>]+)>/g, (_, email: string) => email.trim()).trim()
}

export function EmailMessageBody({
  subject,
  from,
  to,
  body,
  htmlBody,
  rawBody,
  compact = false,
}: Props) {
  const [showQuoted, setShowQuoted] = useState(false)

  const parsed = useMemo(
    () => formatEmailForDisplay(rawBody || htmlBody || body),
    [rawBody, htmlBody, body],
  )

  const fromLine = formatAddress(from)
  const toLine = formatAddress(to)
  const primary =
    parsed.primary && parsed.primary !== '(No message content)'
      ? parsed.primary
      : parsed.quoted?.slice(0, 280) || parsed.primary

  return (
    <div className={`rx-email-msg${compact ? ' is-compact' : ''}`}>
      {compact ? (
        subject ? <div className="rx-email-msg-subject-compact">{subject}</div> : null
      ) : (subject || fromLine || toLine) ? (
        <div className="rx-email-msg-head">
          {subject ? <div className="rx-email-msg-subject">{subject}</div> : null}
          {fromLine ? (
            <div className="rx-email-msg-meta-line">
              <span className="rx-email-msg-meta-label">From</span>
              <span className="rx-email-msg-meta-value">{fromLine}</span>
            </div>
          ) : null}
          {toLine ? (
            <div className="rx-email-msg-meta-line">
              <span className="rx-email-msg-meta-label">To</span>
              <span className="rx-email-msg-meta-value">{toLine}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rx-email-msg-primary">{primary}</div>

      {parsed.quoted ? (
        <div className="rx-email-msg-quoted-wrap">
          <button
            type="button"
            className="rx-email-msg-quoted-toggle"
            onClick={() => setShowQuoted((v) => !v)}
            aria-expanded={showQuoted}
          >
            {showQuoted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showQuoted
              ? compact
                ? 'Hide quote'
                : 'Hide earlier messages'
              : compact
                ? 'Show quote'
                : 'Show earlier messages'}
          </button>
          {showQuoted ? (
            <div className="rx-email-msg-quoted">{parsed.quoted}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
