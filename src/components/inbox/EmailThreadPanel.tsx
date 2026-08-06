import { AlertTriangle, Check, CheckCheck } from 'lucide-react'
import { formatEmailForDisplay } from '../../lib/format-email-for-display'
import type { Message } from '../../types'

function plainBody(msg: Message): string {
  const parsed = formatEmailForDisplay(msg.rawBody || msg.htmlBody || msg.body)
  const text = parsed.primary
  if (text && text !== '(No message content)') return text
  return (msg.body || '').trim() || '(empty)'
}

function resolveThreadSubject(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const s = messages[i].subject?.trim()
    if (s) return s.replace(/^Re:\s*/i, '').trim() || s
  }
  return 'No subject'
}

type Props = {
  messages: Message[]
}

/** Email thread — subject once at top, each message is body + time only. */
export function EmailThreadPanel({ messages }: Props) {
  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (sorted.length === 0) {
    return (
      <div className="rx-email-thread-empty">
        No outreach email yet. Messages appear here after you send from a campaign or reply
        below.
      </div>
    )
  }

  const subject = resolveThreadSubject(sorted)

  return (
    <div className="rx-email-thread">
      <header className="rx-email-thread-head">
        <span className="rx-email-thread-kicker">Subject</span>
        <h3 className="rx-email-thread-subject">{subject}</h3>
      </header>
      <div className="rx-email-thread-msgs">
        {sorted.map((m) => (
          <article
            key={m.id}
            className={`rx-email-body-msg ${m.direction === 'outbound' ? 'out' : 'in'}`}
          >
            <p className="rx-email-body-text">{plainBody(m)}</p>
            <footer className="rx-email-body-meta">
              <time dateTime={m.createdAt}>
                {new Date(m.createdAt).toLocaleString('en', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
              {m.direction === 'outbound' ? (
                <span className="rx-email-body-status">
                  {m.status}
                  {m.status === 'read' ? (
                    <CheckCheck size={11} aria-hidden />
                  ) : m.status === 'delivered' ? (
                    <Check size={11} aria-hidden />
                  ) : m.status === 'failed' ? (
                    <AlertTriangle size={11} aria-hidden />
                  ) : null}
                </span>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}
