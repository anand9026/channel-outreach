import { CheckSquare, Mail, MessageCircle, Square } from 'lucide-react'
import { IgIcon } from '../BrandIcons'
import type { Conversation, Influencer, OutreachChannel } from '../../types'
import {
  channelLabelShort,
  channelListForConversation,
  contactLineForConversation,
  displayNameForConversation,
  formatConversationTime,
  initialsForName,
  sanitizePreview,
} from './inbox-conversation-utils'

function ChannelIcon({ ch }: { ch: OutreachChannel }) {
  if (ch === 'whatsapp') return <MessageCircle size={10} />
  if (ch === 'instagram') return <IgIcon size={10} />
  return <Mail size={10} />
}

type Props = {
  conversation: Conversation
  influencer?: Influencer
  selected: boolean
  selectMode: boolean
  checked: boolean
  onSelect: () => void
  onToggleCheck: () => void
}

export function ConversationListRow({
  conversation: c,
  influencer: inf,
  selected,
  selectMode,
  checked,
  onSelect,
  onToggleCheck,
}: Props) {
  const name = displayNameForConversation(c, inf)
  const initials = initialsForName(name)
  const channels = channelListForConversation(c)
  const contact = contactLineForConversation(c, inf)
  const preview = sanitizePreview(c.lastPreview) || 'No messages yet'
  const multiChannel = channels.length > 1

  return (
    <div
      className={`rx-conv${selected ? ' is-selected' : ''}${multiChannel ? ' is-unified' : ''}`}
      data-testid={`conv-${c.id}`}
      data-unified={multiChannel ? 'true' : undefined}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {selectMode ? (
        <button
          type="button"
          className="rx-check"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCheck()
          }}
          aria-label={checked ? 'Deselect' : 'Select'}
        >
          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      ) : (
        <div className={`rx-conv-avatar${multiChannel ? ' is-multi' : ''}`} aria-hidden>
          {initials}
        </div>
      )}

      <div className="rx-conv-body">
        <div className="rx-conv-row">
          <div className="rx-conv-name">{name}</div>
          <div className="rx-conv-time">{formatConversationTime(c.lastMessageAt)}</div>
        </div>

        <div className="rx-conv-meta">
          <div className="rx-conv-channels">
            {channels.map((ch) => (
              <span key={ch} className={`rx-channel-pill ${ch}`} title={channelLabelShort(ch)}>
                <ChannelIcon ch={ch} />
                {channelLabelShort(ch)}
              </span>
            ))}
          </div>
          {c.unreadCount > 0 ? (
            <span className="rx-unread-pill">{c.unreadCount}</span>
          ) : null}
        </div>

        {contact ? <div className="rx-conv-contact mono">{contact}</div> : null}

        <div className="rx-conv-preview">{preview}</div>
      </div>
    </div>
  )
}
