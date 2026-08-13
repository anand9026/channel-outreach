import type { Conversation, InboxCampaignRow, InboxFilters } from '../../types'

export function conversationPassesInboxFilters(
  conv: Conversation,
  row: InboxCampaignRow,
  filters: InboxFilters,
): boolean {
  if (filters.campaignIds.length > 0 && !filters.campaignIds.includes(row.campaignId)) {
    return false
  }
  if (filters.channels.length > 0) {
    if (!row.channels.some((ch) => filters.channels.includes(ch))) return false
  }
  if (filters.statuses.length > 0 && !filters.statuses.includes(conv.status)) {
    return false
  }
  if (filters.intents.length > 0) {
    const intent = conv.intent || row.intent
    if (!intent || !filters.intents.includes(intent)) return false
  }
  if (filters.assigneeId === '__unassigned__' && conv.assignedTo) return false
  if (filters.assigneeId && filters.assigneeId !== '__unassigned__' && conv.assignedTo !== filters.assigneeId) {
    return false
  }
  if (filters.tags.length > 0) {
    const labels = row.labels?.length ? row.labels : conv.labels || []
    if (!filters.tags.some((t) => labels.includes(t))) return false
  }
  return true
}

export function activeInboxFilterCount(filters: InboxFilters): number {
  let n = 0
  if (filters.campaignIds.length) n += 1
  if (filters.channels.length) n += 1
  if (filters.statuses.length) n += 1
  if (filters.intents.length) n += 1
  if (filters.assigneeId) n += 1
  if (filters.tags.length) n += 1
  return n
}
