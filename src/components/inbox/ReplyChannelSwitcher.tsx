import { Mail, MessageCircle } from 'lucide-react'
import { IgIcon } from '../BrandIcons'
import { channelLabelShort } from './inbox-conversation-utils'
import type { OutreachChannel } from '../../types'

type Props = {
  channels: OutreachChannel[]
  value: OutreachChannel
  onChange: (channel: OutreachChannel) => void
  disabled?: boolean
  whatsappWindowOpen?: boolean
}

function ChannelIcon({ channel }: { channel: OutreachChannel }) {
  if (channel === 'whatsapp') return <MessageCircle size={14} />
  if (channel === 'instagram') return <IgIcon size={14} />
  return <Mail size={14} />
}

/** Composer channel picker — icon tabs, one active reply medium. */
export function ReplyChannelSwitcher({
  channels,
  value,
  onChange,
  disabled,
  whatsappWindowOpen = true,
}: Props) {
  if (channels.length < 2) return null

  return (
    <div className="rx-reply-channel" data-testid="reply-channel-picker">
      <span className="rx-reply-channel-label">Reply on</span>
      <div className="rx-reply-channel-tabs" role="tablist" aria-label="Reply channel">
        {channels.map((ch) => {
          const active = value === ch
          const waClosed = ch === 'whatsapp' && !whatsappWindowOpen
          return (
            <button
              key={ch}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              className={`rx-reply-channel-tab ${ch}${active ? ' is-active' : ''}${waClosed ? ' is-muted' : ''}`}
              onClick={() => onChange(ch)}
              data-testid={`reply-channel-${ch}`}
              title={waClosed ? '24h window closed — use Gmail or a template' : undefined}
            >
              <ChannelIcon channel={ch} />
              <span>{channelLabelShort(ch)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
