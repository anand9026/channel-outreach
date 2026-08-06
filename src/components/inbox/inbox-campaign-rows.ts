import type { Conversation, InboxCampaignRow, Message, OutreachChannel } from '../../types'
import { AD_HOC_CAMPAIGN_ID } from '../../types'
import { sanitizePreview } from './inbox-conversation-utils'

function uniqueChannels(channels: OutreachChannel[]): OutreachChannel[] {
  return channels.filter((c, i, arr) => arr.indexOf(c) === i)
}

function campaignIdsForConversation(c: Conversation, messages: Message[]): string[] {
  const ids = new Set<string>()
  for (const id of c.campaignIds) {
    if (id) ids.add(id)
  }
  for (const m of messages) {
    if (m.conversationId === c.id && m.campaignId) ids.add(m.campaignId)
  }
  if (ids.size === 0 && c.lastCampaignId) ids.add(c.lastCampaignId)
  if (ids.size === 0) ids.add(AD_HOC_CAMPAIGN_ID)
  return [...ids]
}

function messagesForCampaignScope(
  conversationId: string,
  campaignId: string,
  messages: Message[],
): Message[] {
  return messages.filter((m) => {
    if (m.conversationId !== conversationId) return false
    if (campaignId === AD_HOC_CAMPAIGN_ID) return !m.campaignId
    return m.campaignId === campaignId
  })
}

/** Expand unified conversations into one inbox row per (creator × campaign). */
export function expandToInboxCampaignRows(
  conversations: Conversation[],
  messages: Message[],
): InboxCampaignRow[] {
  const rows: InboxCampaignRow[] = []

  for (const c of conversations) {
    const campaignIds = campaignIdsForConversation(c, messages)

    for (const campaignId of campaignIds) {
      const scoped = messagesForCampaignScope(c.id, campaignId, messages)
      const sorted = [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const lastMsg = sorted[0]
      const lastAt = lastMsg?.createdAt || c.lastMessageAt
      const previewSource = lastMsg?.body || lastMsg?.caption || c.lastPreview || ''
      const preview = sanitizePreview(previewSource)
      const msgChannels = scoped.map((m) => m.channel)
      const channels = uniqueChannels([
        ...(c.channels || []),
        c.channel,
        ...msgChannels,
      ] as OutreachChannel[])

      const isPrimaryRow =
        campaignId === c.lastCampaignId ||
        campaignId === campaignIds[campaignIds.length - 1] ||
        campaignIds.length === 1

      rows.push({
        rowId: `${c.id}::${campaignId}`,
        conversationId: c.id,
        campaignId,
        influencerId: c.influencerId,
        channel: channels[0] || c.channel,
        channels,
        status: c.status,
        lastMessageAt: lastAt,
        lastPreview: preview,
        unreadCount: isPrimaryRow ? c.unreadCount : 0,
        labels: c.labels,
        intent: c.intent,
        isCreator: c.isCreator,
        contactName: c.contactName,
        outreachConversationId: c.outreachConversationId,
        channelThreads: c.channelThreads,
        phoneNumberId: c.phoneNumberId,
        emailAccountId: c.emailAccountId,
        gmailThreadId: c.gmailThreadId,
        outreachThreadId: c.outreachThreadId,
        isLive: c.isLive,
        assignedTo: c.assignedTo,
        lastInboundAt: c.lastInboundAt,
        campaignIds: c.campaignIds,
      })
    }
  }

  return rows.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

export function inboxRowMatchesCampaignFilter(
  row: InboxCampaignRow,
  filter: 'all' | string,
): boolean {
  if (filter === 'all') return true
  return row.campaignId === filter
}
