import { CheckSquare, Mail, MessageCircle, Square } from 'lucide-react'
import { IgIcon } from '../BrandIcons'
import type { Campaign, Conversation, Influencer, InboxCampaignRow, OutreachChannel } from '../../types'
import { AD_HOC_CAMPAIGN_ID } from '../../types'
import {
  channelLabelShort,
  contactLineForConversation,
  displayNameForConversation,
  formatConversationTime,
  initialsForName,
  sanitizePreview,
} from './inbox-conversation-utils'

function ChannelDot({ ch }: { ch: OutreachChannel }) {
  if (ch === 'whatsapp') return <MessageCircle size={9} />
  if (ch === 'instagram') return <IgIcon size={9} />
  return <Mail size={9} />
}

type Props = {
  row: InboxCampaignRow
  conversation: Conversation
  campaign?: Campaign
  influencer?: Influencer
  selected: boolean
  selectMode: boolean
  checked: boolean
  onSelect: () => void
  onToggleCheck: () => void
}

export function CampaignInboxRow({
  row,
  conversation: c,
  campaign,
  influencer: inf,
  selected,
  selectMode,
  checked,
  onSelect,
  onToggleCheck,
}: Props) {
  const name = displayNameForConversation(c, inf)
  const initials = initialsForName(name)
  const contact = contactLineForConversation(c, inf)
  const preview = sanitizePreview(row.lastPreview) || 'No messages yet'
  const multiChannel = row.channels.length > 1
  const campaignLabel =
    row.campaignId === AD_HOC_CAMPAIGN_ID
      ? 'Ad-hoc'
      : campaign?.name || 'Campaign'

  return (
    <div
      className={`rx-conv rx-inbox-campaign-row${selected ? ' is-selected' : ''}${multiChannel ? ' is-unified' : ''}`}
      data-testid={`inbox-row-${row.rowId}`}
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
          <div className="rx-inbox-channel-dots">
            {row.channels.slice(0, 3).map((ch) => (
              <span key={ch} className={`rx-inbox-channel-dot ${ch}`} title={channelLabelShort(ch)}>
                <ChannelDot ch={ch} />
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rx-conv-body">
        <div className="rx-conv-row">
          <div className="rx-conv-name">{name}</div>
          <div className="rx-conv-time">{formatConversationTime(row.lastMessageAt)}</div>
        </div>

        <div className="rx-inbox-campaign-line">
          <span className="rx-inbox-campaign-name">{campaignLabel}</span>
          {row.intent ? (
            <span className={`rx-intent-chip intent-${row.intent}`}>{row.intent.replace('_', ' ')}</span>
          ) : null}
        </div>

        {contact ? <div className="rx-conv-contact mono">{contact}</div> : null}

        <div className="rx-conv-preview">{preview}</div>

        <div className="rx-conv-meta">
          <div className="rx-conv-channels">
            {row.channels.map((ch) => (
              <span key={ch} className={`rx-channel-pill ${ch}`}>
                {channelLabelShort(ch)}
              </span>
            ))}
          </div>
          {row.unreadCount > 0 ? (
            <span className="rx-unread-pill">{row.unreadCount}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
