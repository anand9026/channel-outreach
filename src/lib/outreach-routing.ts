import type { ConversationIntent, ConversationStatus, OutreachChannel, TabId } from '../types'
import { normalizeTab } from '../types'

export type InboxRouteFilters = {
  campaign?: string
  view?: string
  intent?: ConversationIntent[]
  channel?: OutreachChannel[]
  status?: ConversationStatus[]
  search?: string
}

export type OutreachRoute = {
  tab: TabId
  campaignId?: string | null
  detailCampaignId?: string | null
  inbox: InboxRouteFilters
}

const DEFAULT_TAB: TabId = 'campaigns'

/** Parse `#/inbox?campaign=x&intent=pricing,interested` (GitHub Pages safe). */
export function parseOutreachHash(hash: string): OutreachRoute {
  const raw = hash.replace(/^#/, '').replace(/^\//, '')
  const [pathPart, queryPart] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const tabRaw = (segments[0] || DEFAULT_TAB) as TabId
  const tab = normalizeTab(tabRaw)

  const params = new URLSearchParams(queryPart || '')
  const inbox: InboxRouteFilters = {
    campaign: params.get('campaign') || undefined,
    view: params.get('view') || undefined,
    search: params.get('q') || undefined,
  }

  const intent = params.get('intent')
  if (intent) {
    inbox.intent = intent.split(',').filter(Boolean) as ConversationIntent[]
  }
  const channel = params.get('channel')
  if (channel) {
    inbox.channel = channel.split(',').filter(Boolean) as OutreachChannel[]
  }
  const status = params.get('status')
  if (status) {
    inbox.status = status.split(',').filter(Boolean) as ConversationStatus[]
  }

  const detailCampaignId = segments[1] === 'campaign' ? segments[2] || params.get('id') || undefined : undefined

  return {
    tab,
    campaignId: params.get('campaign') || undefined,
    detailCampaignId,
    inbox,
  }
}

export function buildOutreachHash(route: Partial<OutreachRoute>): string {
  const tab = normalizeTab(route.tab || DEFAULT_TAB)
  let path = `/${tab}`

  if (route.detailCampaignId && tab === 'campaigns') {
    path = `/campaigns/campaign/${route.detailCampaignId}`
  }

  const params = new URLSearchParams()
  const inbox = route.inbox || {}

  if (route.campaignId && route.campaignId !== 'all') {
    params.set('campaign', route.campaignId)
  } else if (inbox.campaign && inbox.campaign !== 'all') {
    params.set('campaign', inbox.campaign)
  }
  if (inbox.view) params.set('view', inbox.view)
  if (inbox.search) params.set('q', inbox.search)
  if (inbox.intent?.length) params.set('intent', inbox.intent.join(','))
  if (inbox.channel?.length) params.set('channel', inbox.channel.join(','))
  if (inbox.status?.length) params.set('status', inbox.status.join(','))

  const qs = params.toString()
  return qs ? `#${path}?${qs}` : `#${path}`
}

export function hashEquals(a: string, b: string): boolean {
  return a.replace(/^#/, '') === b.replace(/^#/, '')
}
