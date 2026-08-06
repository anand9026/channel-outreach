import { Mail, MessageCircle } from 'lucide-react'
import { IgIcon } from '../BrandIcons'
import { channelLabelShort } from './inbox-conversation-utils'
import type { OutreachChannel } from '../../types'

type Props = {
  channels: OutreachChannel[]
  active: OutreachChannel
  onChange: (ch: OutreachChannel) => void
  unreadByChannel?: Partial<Record<OutreachChannel, number>>
  whatsappWindowOpen?: boolean
}

function ChannelIcon({ channel }: { channel: OutreachChannel }) {
  if (channel === 'whatsapp') return <MessageCircle size={15} />
  if (channel === 'instagram') return <IgIcon size={15} />
  return <Mail size={15} />
}

/** One tab per channel — each conversation channel is managed separately. */
export function ConversationChannelTabs({
  channels,
  active,
  onChange,
  unreadByChannel,
  whatsappWindowOpen = true,
}: Props) {
  if (channels.length <= 1) return null

  return (
    <div className="rx-conv-channel-tabs" role="tablist" aria-label="Conversation channels">
      {channels.map((ch) => {
        const unread = unreadByChannel?.[ch] || 0
        const waMuted = ch === 'whatsapp' && !whatsappWindowOpen
        return (
          <button
            key={ch}
            type="button"
            role="tab"
            aria-selected={active === ch}
            className={`rx-conv-channel-tab ${ch}${active === ch ? ' is-active' : ''}${waMuted ? ' is-muted' : ''}`}
            onClick={() => onChange(ch)}
            data-testid={`conv-channel-tab-${ch}`}
            title={
              waMuted ? 'WhatsApp 24h window closed — switch to Gmail or use a template' : undefined
            }
          >
            <ChannelIcon channel={ch} />
            <span>{channelLabelShort(ch)}</span>
            {unread > 0 ? <span className="rx-conv-channel-tab-badge">{unread}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
