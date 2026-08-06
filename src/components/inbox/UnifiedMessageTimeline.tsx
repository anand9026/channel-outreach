import { Fragment, type ReactNode } from 'react'
import type { Message, OutreachChannel } from '../../types'

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA')
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const key = dayKey(iso)
  if (key === dayKey(today.toISOString())) return 'Today'
  if (key === dayKey(yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}

type Props = {
  messages: Message[]
  renderMessage: (msg: Message, channel: OutreachChannel) => ReactNode
}

/** Chronological timeline with day dividers — no channel stripe headers. */
export function UnifiedMessageTimeline({ messages, renderMessage }: Props) {
  let lastDay = ''

  return (
    <div className="rx-unified-timeline">
      {messages.map((m) => {
        const day = dayKey(m.createdAt)
        const showDay = day !== lastDay
        lastDay = day
        return (
          <Fragment key={m.id}>
            {showDay ? (
              <div className="rx-timeline-day" role="separator">
                {formatDayLabel(m.createdAt)}
              </div>
            ) : null}
            {renderMessage(m, m.channel)}
          </Fragment>
        )
      })}
    </div>
  )
}
