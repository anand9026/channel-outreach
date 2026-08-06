import type { ReactNode } from 'react'
import type { Message, OutreachChannel } from '../../types'
import { channelLabelShort } from './inbox-conversation-utils'

type StripeGroup = {
  channel: OutreachChannel
  startedAt: string
  messages: Message[]
}

function groupMessagesByChannelStripes(messages: Message[]): StripeGroup[] {
  const groups: StripeGroup[] = []
  for (const msg of messages) {
    const last = groups[groups.length - 1]
    if (last && last.channel === msg.channel) {
      last.messages.push(msg)
    } else {
      groups.push({ channel: msg.channel, startedAt: msg.createdAt, messages: [msg] })
    }
  }
  return groups
}

function formatStripeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type Props = {
  messages: Message[]
  renderMessage: (msg: Message, channel: OutreachChannel) => ReactNode
  showStripes: boolean
}

/** Channel-striped timeline — section headers when channel changes (blueprint §8). */
export function ChannelStripeTimeline({ messages, renderMessage, showStripes }: Props) {
  if (!showStripes || messages.length === 0) {
    return <>{messages.map((m) => renderMessage(m, m.channel))}</>
  }

  const groups = groupMessagesByChannelStripes(messages)

  return (
    <>
      {groups.map((group) => (
        <div key={`${group.channel}-${group.startedAt}`} className="rx-channel-stripe-group">
          <div className={`rx-channel-stripe-header ${group.channel}`}>
            <span className="rx-channel-stripe-rail" aria-hidden />
            <span className="rx-channel-stripe-label">
              {channelLabelShort(group.channel)} · {formatStripeTime(group.startedAt)}
            </span>
            <span className="rx-channel-stripe-line" aria-hidden />
          </div>
          <div className="rx-channel-stripe-messages">
            {group.messages.map((m) => renderMessage(m, group.channel))}
          </div>
        </div>
      ))}
    </>
  )
}
