import {
  AlertTriangle,
  Check,
  CheckCheck,
  ExternalLink,
  FileText,
  Heart,
  Paperclip,
  Play,
  Send,
  Smile,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmojiPicker } from '../EmojiPicker'
import { AiSuggestReply } from './AiSuggestReply'
import { ConversationChannelTabs } from './ConversationChannelTabs'
import { EmailThreadPanel } from './EmailThreadPanel'
import { ThreadHeaderMenu } from './ThreadHeaderMenu'
import {
  channelLabelShort,
  contactLineForConversation,
  displayNameForConversation,
  initialsForName,
  outreachChannelsForConversation,
} from './inbox-conversation-utils'
import { whatsappMediaUrl } from '../../lib/api'
import { defaultEmailReplySubject } from '../../lib/email-reply-subject'
import { useWhatsAppStore } from '../../store/WhatsAppStore'
import type { Conversation, Message, OutreachChannel } from '../../types'
import { AD_HOC_CAMPAIGN_ID } from '../../types'

const REACTION_QUICKPICK = ['\u2764\uFE0F', '\u{1F44D}', '\u{1F44E}', '\u{1F602}', '\u{1F62E}', '\u{1F525}']
const SUGGESTED_LABELS = [
  'hot lead',
  'follow-up',
  'contract sent',
  'paid',
  'ghosted',
  'not interested',
]
const CHANNEL_TAB_STORAGE = 'outreach-channel-tab'

function readStoredChannel(convId: string, channels: OutreachChannel[]): OutreachChannel {
  try {
    const raw = localStorage.getItem(`${CHANNEL_TAB_STORAGE}:${convId}`)
    if (raw && channels.includes(raw as OutreachChannel)) return raw as OutreachChannel
  } catch {
    /* ignore */
  }
  return channels.includes('whatsapp') ? 'whatsapp' : channels[0]
}

function storeChannel(convId: string, ch: OutreachChannel) {
  try {
    localStorage.setItem(`${CHANNEL_TAB_STORAGE}:${convId}`, ch)
  } catch {
    /* ignore */
  }
}

function filterMessagesForScope(
  messages: Message[],
  convId: string,
  scopedCampaignId: string,
  lastCampaignId?: string,
): Message[] {
  return messages
    .filter((m) => {
      if (m.conversationId !== convId) return false
      if (scopedCampaignId === AD_HOC_CAMPAIGN_ID) return !m.campaignId
      return (
        m.campaignId === scopedCampaignId ||
        (!m.campaignId && scopedCampaignId === lastCampaignId)
      )
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function InboundMedia({ msg }: { msg: Message }) {
  if (!msg.mediaId || !msg.mediaKind) return null
  const url = whatsappMediaUrl(msg.mediaId)
  if (msg.mediaKind === 'image' || msg.mediaKind === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="rx-msg-media">
        <img src={url} alt={msg.caption || 'image'} loading="lazy" />
      </a>
    )
  }
  if (msg.mediaKind === 'video') {
    return <video src={url} controls className="rx-msg-media video" preload="metadata" />
  }
  if (msg.mediaKind === 'audio') {
    return <audio src={url} controls className="rx-msg-audio" preload="metadata" />
  }
  if (msg.mediaKind === 'document') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="rx-msg-doc">
        <FileText size={14} /> Document ({msg.mediaMime || 'file'})
        <ExternalLink size={12} />
      </a>
    )
  }
  return null
}

function ChatMessageBubble({
  msg,
  channel,
  onReact,
  onRemoveReaction,
  canReact,
}: {
  msg: Message
  channel: OutreachChannel
  onReact: (msgId: string, emoji: string) => void
  onRemoveReaction: (msgId: string) => void
  canReact: boolean
}) {
  const [showReactMenu, setShowReactMenu] = useState(false)
  const myReaction = (msg.reactions || []).find((r) => r.by === 'me')

  return (
    <div className={`rx-msg-row ${msg.direction === 'outbound' ? 'out' : 'in'}`}>
      <div className="rx-msg-wrap">
        {msg.mediaId ? <InboundMedia msg={msg} /> : null}
        {msg.body ? (
          <div className="rx-msg" data-channel={channel}>
            {msg.body}
          </div>
        ) : null}
        <div className="rx-msg-meta">
          <span>
            {new Date(msg.createdAt).toLocaleTimeString('en', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {msg.direction === 'outbound' ? (
            <>
              <span>·</span>
              <span>{msg.status}</span>
              {msg.status === 'read' ? (
                <CheckCheck size={12} />
              ) : msg.status === 'delivered' ? (
                <Check size={12} />
              ) : msg.status === 'failed' ? (
                <AlertTriangle size={12} />
              ) : null}
            </>
          ) : null}
        </div>
        {msg.reactions && msg.reactions.length > 0 ? (
          <div className="rx-msg-reactions">
            {msg.reactions.map((r, i) => (
              <button
                key={i}
                type="button"
                className={`rx-msg-reaction${r.by === 'me' ? ' mine' : ''}`}
                onClick={() => r.by === 'me' && onRemoveReaction(msg.id)}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        ) : null}
        {canReact ? (
          <div className="rx-msg-actions">
            <button
              type="button"
              className="rx-msg-react-btn"
              onClick={() => setShowReactMenu((v) => !v)}
              title="React"
              aria-label="React to message"
            >
              <Heart size={12} />
            </button>
            {showReactMenu ? (
              <div className="rx-react-menu" onMouseLeave={() => setShowReactMenu(false)}>
                {REACTION_QUICKPICK.map((em) => (
                  <button
                    key={em}
                    type="button"
                    className={`rx-react-menu-btn${myReaction?.emoji === em ? ' is-mine' : ''}`}
                    onClick={() => {
                      onReact(msg.id, em)
                      setShowReactMenu(false)
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

type Props = {
  scopedCampaignId: string
}

export function ConversationThread({ scopedCampaignId }: Props) {
  const { state, actions } = useWhatsAppStore()
  const conv = state.conversations.find((c) => c.id === state.selectedConversationId)!
  const inf = state.influencers.find((i) => i.id === conv.influencerId)
  const scopedCampaign = state.campaigns.find((c) => c.id === scopedCampaignId)
  const campaignTitle =
    scopedCampaignId === AD_HOC_CAMPAIGN_ID
      ? 'Ad-hoc'
      : scopedCampaign?.name || 'Campaign'

  const scopedMessages = useMemo(
    () => filterMessagesForScope(state.messages, conv.id, scopedCampaignId, conv.lastCampaignId),
    [state.messages, conv.id, scopedCampaignId, conv.lastCampaignId],
  )

  const availableChannels = useMemo(
    () => outreachChannelsForConversation(conv, scopedMessages),
    [conv, scopedMessages],
  )

  const [activeChannel, setActiveChannel] = useState<OutreachChannel>(() =>
    readStoredChannel(conv.id, availableChannels),
  )

  useEffect(() => {
    setActiveChannel(readStoredChannel(conv.id, availableChannels))
  }, [conv.id, availableChannels.join(',')])

  const setChannel = (ch: OutreachChannel) => {
    setActiveChannel(ch)
    storeChannel(conv.id, ch)
  }

  const channelMessages = useMemo(
    () => scopedMessages.filter((m) => m.channel === activeChannel),
    [scopedMessages, activeChannel],
  )

  const waWindowOpen = actions.isWithin24hWindow(conv.id)
  const hasEmailChannel = availableChannels.includes('email')

  const activeConv: Conversation = useMemo(() => {
    const wa = conv.channelThreads?.whatsapp
    const em = conv.channelThreads?.email
    return {
      ...conv,
      channel: activeChannel,
      phoneNumberId: wa?.phoneNumberId || conv.phoneNumberId,
      emailAccountId: em?.emailAccountId || conv.emailAccountId,
      gmailThreadId: em?.gmailThreadId || conv.gmailThreadId,
      outreachThreadId:
        activeChannel === 'whatsapp'
          ? wa?.outreachThreadId || conv.outreachThreadId
          : em?.outreachThreadId || conv.outreachThreadId,
    }
  }, [conv, activeChannel])

  const [draft, setDraft] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [replying, setReplying] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const attachRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (activeChannel === 'email') {
      setEmailSubject(defaultEmailReplySubject(channelMessages))
    }
  }, [activeChannel, conv.id, channelMessages])

  const canReply =
    activeChannel === 'email'
      ? hasEmailChannel
      : activeChannel === 'whatsapp'
        ? waWindowOpen
        : actions.canFreeformReply(activeConv.id)

  const bodyRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [conv.id, activeChannel, channelMessages.length])

  const send = async () => {
    const text = draft.trim()
    if (!text || replying) return
    setDraft('')
    setReplying(true)
    try {
      if (activeChannel === 'whatsapp' && activeConv.isLive) {
        const ok = await actions.sendWhatsAppReplyLive(activeConv.id, text)
        if (!ok) setDraft(text)
      } else if (activeChannel === 'email' && activeConv.isLive) {
        const ok = await actions.sendGmailReplyLive(activeConv.id, text, {
          subject: emailSubject.trim(),
        })
        if (!ok) setDraft(text)
      } else {
        const ok = actions.sendReply(activeConv.id, text)
        if (!ok) setDraft(text)
      }
    } finally {
      setReplying(false)
    }
  }

  const insertAtCaret = (s: string) => {
    setDraft((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + s)
  }

  const addLabel = (l: string) => {
    const clean = l.trim().toLowerCase()
    if (!clean) return
    const cur = conv.labels || []
    if (cur.includes(clean)) return
    actions.setConversationLabels(conv.id, [...cur, clean])
  }
  const removeLabel = (l: string) => {
    actions.setConversationLabels(conv.id, (conv.labels || []).filter((x) => x !== l))
  }

  const displayName = displayNameForConversation(conv, inf)
  const initials = initialsForName(displayName)
  const contactLine = contactLineForConversation(conv, inf)
  const canReact = !activeConv.isLive || activeChannel !== 'whatsapp'

  const unreadByChannel = useMemo(() => {
    const out: Partial<Record<OutreachChannel, number>> = {}
    for (const ch of availableChannels) {
      const chMsgs = scopedMessages.filter((m) => m.channel === ch)
      const last = chMsgs[chMsgs.length - 1]
      if (last?.direction === 'inbound') out[ch] = 1
    }
    return out
  }, [availableChannels, scopedMessages])

  return (
    <div className="rx-thread" data-channel={activeChannel}>
      <div className="rx-thread-head">
        <div className="rx-thread-head-left">
          <div
            className={`rx-conv-avatar rx-thread-avatar${availableChannels.length > 1 ? ' is-multi' : ''}`}
          >
            {initials}
          </div>
          <div className="rx-thread-head-copy">
            <div className="rx-thread-title-row">
              <div className="rx-thread-title">{displayName}</div>
              <span className="rx-thread-campaign-pill">{campaignTitle}</span>
            </div>
            {contactLine ? (
              <div className="rx-thread-contact-inline mono">{contactLine}</div>
            ) : null}
          </div>
        </div>
        <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ThreadHeaderMenu
            conversationId={conv.id}
            intent={conv.intent}
            labels={conv.labels || []}
            suggestedLabels={SUGGESTED_LABELS}
            onIntentChange={(intent) => actions.setConversationIntent(conv.id, intent)}
            onAddLabel={addLabel}
            onRemoveLabel={removeLabel}
          />
          {conv.status === 'resolved' ? (
            <button className="rx-btn secondary sm" onClick={() => actions.reopenConversation(conv.id)}>
              Reopen
            </button>
          ) : (
            <button
              className="rx-btn secondary sm"
              onClick={() => actions.resolveConversation(conv.id)}
              data-testid="resolve-conversation"
            >
              <Check size={12} /> Resolve
            </button>
          )}
        </div>
      </div>

      <ConversationChannelTabs
        channels={availableChannels}
        active={activeChannel}
        onChange={setChannel}
        unreadByChannel={unreadByChannel}
        whatsappWindowOpen={waWindowOpen}
      />

      <div className="rx-thread-body" ref={bodyRef} data-channel={activeChannel}>
        {activeChannel === 'email' ? (
          <EmailThreadPanel messages={channelMessages} />
        ) : channelMessages.length === 0 ? (
          <div className="rx-thread-empty">
            {conv.isLive ? 'Waiting for messages to sync…' : 'No messages on this channel yet.'}
          </div>
        ) : (
          <div className="rx-chat-thread">
            {channelMessages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                msg={m}
                channel={activeChannel}
                canReact={canReact}
                onReact={(id, em) => {
                  if (!canReact) {
                    actions.toast(
                      'Reactions on live WhatsApp threads need proxy support — UI ready.',
                      'info',
                    )
                    return
                  }
                  actions.reactToMessage(id, em, 'me')
                }}
                onRemoveReaction={(id) => actions.removeReaction(id, 'me')}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rx-composer" data-channel={activeChannel}>
        <AiSuggestReply
          messages={channelMessages}
          creatorName={displayName}
          onInsert={insertAtCaret}
        />
        {activeChannel === 'whatsapp' ? (
          <div className={`rx-window-note ${waWindowOpen ? 'open' : 'closed'}`}>
            <span>
              {waWindowOpen
                ? '24-hour WhatsApp window open'
                : 'WhatsApp window closed — use a template or switch to Gmail'}
            </span>
          </div>
        ) : null}
        {activeChannel === 'email' ? (
          <>
            <div className="rx-window-note open">
              <span>Outreach email thread — replies send from your connected Gmail</span>
            </div>
            <div className="rx-composer-email-subject" data-testid="composer-email-subject">
              <label className="rx-composer-email-subject-label" htmlFor="email-subject-input">
                Subject
              </label>
              <input
                id="email-subject-input"
                className="rx-input"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                disabled={!canReply || replying}
                placeholder="Re: …"
              />
            </div>
          </>
        ) : null}
        {activeChannel === 'instagram' ? (
          <div className={`rx-window-note ig ${waWindowOpen ? 'open' : 'closed'}`}>
            <span>
              {waWindowOpen
                ? 'Instagram 24-hour DM window open'
                : 'DM window closed — send a story reply or template'}
            </span>
          </div>
        ) : null}
        <div className="rx-composer-row">
          <div className="rx-composer-tools">
            <button
              type="button"
              className="rx-icon-btn"
              onClick={() => setShowEmoji((v) => !v)}
              disabled={!canReply}
              title="Emoji"
              data-testid="composer-emoji"
            >
              <Smile size={15} />
            </button>
            <button
              type="button"
              className="rx-icon-btn"
              onClick={() => setShowCanned((v) => !v)}
              disabled={!canReply || state.cannedReplies.length === 0}
              title="Canned replies"
              data-testid="composer-canned"
            >
              <Zap size={15} />
            </button>
            <button
              type="button"
              className="rx-icon-btn"
              onClick={() => attachRef.current?.click()}
              disabled={!canReply}
              title="Attach a file"
              data-testid="composer-attach"
            >
              <Paperclip size={15} />
            </button>
            <input
              ref={attachRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                actions.toast(`Attached ${file.name} (preview)`, 'info')
                if (attachRef.current) attachRef.current.value = ''
              }}
            />
            {showEmoji ? (
              <EmojiPicker onPick={(em) => setDraft((d) => d + em)} onClose={() => setShowEmoji(false)} />
            ) : null}
            {showCanned ? (
              <div className="rx-canned-pop" data-testid="canned-pop">
                <div className="rx-canned-head">
                  <span className="rx-text-xs rx-muted">Quick replies</span>
                </div>
                <div className="rx-canned-list">
                  {state.cannedReplies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="rx-canned-item"
                      onClick={() => {
                        insertAtCaret(c.body)
                        setShowCanned(false)
                      }}
                    >
                      <div className="rx-canned-title">
                        <Play size={10} /> {c.title}
                      </div>
                      <div className="rx-canned-preview">{c.body}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <textarea
            className="rx-textarea"
            placeholder={
              canReply
                ? `${activeChannel === 'email' ? 'Write your email…' : `Message on ${channelLabelShort(activeChannel)}…`}`
                : activeChannel === 'whatsapp'
                  ? '24h window closed — use a template'
                  : 'Reply unavailable'
            }
            rows={activeChannel === 'email' ? 3 : 1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!canReply || replying}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && activeChannel !== 'email') {
                e.preventDefault()
                send()
              }
            }}
          />
          <button
            type="button"
            className="rx-btn primary"
            onClick={send}
            disabled={!canReply || !draft.trim() || replying}
            data-testid="composer-send"
          >
            <Send size={14} /> {replying ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
