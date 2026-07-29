import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import {
  ORG_ID,
  conversationKey,
  emptyMetrics,
  seedAnalytics,
  seedBrands,
  seedCampaigns,
  seedChannels,
  seedCollections,
  seedConversations,
  seedEmailAccounts,
  seedInfluencers,
  seedInstagramAccounts,
  seedMessages,
  seedMyCreatorIds,
  seedOrganization,
  seedTeam,
  seedTemplates,
  seedWhatsAppNumbers,
} from '../data/seed'
import { demoWaitMs, firstChannel, secondChannel } from '../lib/cascade'
import { extractSlots, mergeBindings, renderWithBindings } from '../lib/variables'
import {
  ApiError,
  getGmailConnection,
  getWhatsAppConnection,
  getWhatsAppInboxMessages,
  listGmailThreads,
  listWhatsAppInbox,
  sendWhatsAppText,
  type ConnectionInfo,
  type GmailConnectionInfo,
  type GmailThreadMeta,
  type InboxMessage as ApiInboxMessage,
  type InboxThread as ApiInboxThread,
} from '../lib/api'
import type {
  AudienceSource,
  Brand,
  Campaign,
  CampaignAnalytics,
  CampaignChannel,
  CascadeOptions,
  CollectionList,
  ConnectionMode,
  Conversation,
  DeliveryStatus,
  EmailAccount,
  EmailProvider,
  Influencer,
  InstagramAccount,
  Message,
  OutreachChannel,
  TabId,
  Template,
  TemplateCategory,
  VariableBinding,
  WhatsAppNumber,
} from '../types'

export interface ToastItem {
  id: string
  message: string
  variant: 'success' | 'info' | 'error'
}

export interface AppState {
  organization: typeof seedOrganization
  brands: Brand[]
  influencers: Influencer[]
  collections: CollectionList[]
  myCreatorIds: string[]
  campaigns: typeof seedCampaigns
  templates: Template[]
  whatsAppNumbers: WhatsAppNumber[]
  emailAccounts: EmailAccount[]
  instagramAccounts: InstagramAccount[]
  channels: CampaignChannel[]
  conversations: Conversation[]
  messages: Message[]
  analytics: CampaignAnalytics[]
  team: typeof seedTeam
  activeTab: TabId
  selectedCampaignId: string | null
  /** 'all' | 'none' (org-level) | brand id */
  brandFilter: string
  selectedConversationId: string | null
  toasts: ToastItem[]
  connectModalOpen: boolean
  connectStep: number
  connectKind: OutreachChannel
  emailModalOpen: boolean
  instagramModalOpen: boolean
  liveInbox: {
    /** Whether the 15s polling loop is active */
    polling: boolean
    /** ISO of last successful (or attempted-with-error) sync */
    lastSyncedAt: string | null
    /** Last error message from the WhatsApp proxy, if any */
    lastError: string | null
    /** Cached connection info from GET /whatsapp-outreach/connection */
    connection: ConnectionInfo | null
  }
  prefs: {
    /** Theme preference — 'system' uses prefers-color-scheme */
    theme: 'light' | 'dark' | 'system'
    /** Desktop notification opt-in state — mirrors Notification.permission */
    notifyEnabled: boolean
    /** Sidebar collapsed to icon-only mode */
    sidebarCollapsed: boolean
  }
  cannedReplies: Array<{ id: string; title: string; body: string }>
  autoLabelRules: Array<{
    id: string
    name: string
    /** case-insensitive substrings; message matches if ANY keyword is found */
    keywords: string[]
    /** labels to apply when the rule matches */
    labels: string[]
    enabled: boolean
  }>
}

type Action =
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SELECT_CAMPAIGN'; campaignId: string | null }
  | { type: 'SET_BRAND_FILTER'; brandFilter: string }
  | { type: 'SELECT_CONVERSATION'; conversationId: string | null }
  | { type: 'ADD_TOAST'; toast: Omit<ToastItem, 'id'> }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'OPEN_CONNECT'; open: boolean; kind?: OutreachChannel }
  | { type: 'SET_CONNECT_STEP'; step: number }
  | { type: 'OPEN_EMAIL_CONNECT'; open: boolean }
  | { type: 'OPEN_INSTAGRAM_CONNECT'; open: boolean }
  | {
      type: 'CONNECT_WHATSAPP'
      payload: {
        displayName: string
        phoneDisplay: string
        phoneNumberId: string
        wabaId: string
        businessId: string
      }
    }
  | {
      type: 'CONNECT_EMAIL'
      payload: {
        fromName: string
        fromEmail: string
        provider: EmailProvider
        domain: string
      }
    }
  | {
      type: 'SYNC_GMAIL'
      payload: {
        connected: boolean
        emailAddress?: string | null
        channelId?: string | null
        userId?: string
      }
    }
  | {
      type: 'CONNECT_INSTAGRAM'
      payload: {
        handle: string
        displayName: string
        igUserId: string
      }
    }
  | {
      type: 'REACT_TO_MESSAGE'
      payload: { messageId: string; emoji: string; by: 'me' | 'them' }
    }
  | { type: 'REMOVE_REACTION'; messageId: string; by: 'me' | 'them' }
  | {
      type: 'SUBMIT_TEMPLATE'
      payload: {
        id: string
        channel: OutreachChannel
        name: string
        category: TemplateCategory
        subject?: string
        body: string
        variables: string[]
        bindings: VariableBinding[]
        brandId: string | null
      }
    }
  | { type: 'APPROVE_TEMPLATE'; templateId: string }
  | { type: 'REJECT_TEMPLATE'; templateId: string; reason: string }
  | {
      type: 'UPSERT_CHANNEL'
      payload: {
        campaignId: string
        channel: OutreachChannel
        phoneNumberId?: string
        emailAccountId?: string
        templateId: string
        selectedInfluencerIds?: string[]
      }
    }
  | { type: 'UPDATE_CHANNEL'; channelId: string; patch: Partial<CampaignChannel> }
  | {
      type: 'SET_SHARED_INFLUENCERS'
      payload: { campaignId: string; influencerIds: string[] }
    }
  | { type: 'SEND_CHANNELS'; channelIds: string[] }
  | {
      type: 'PREPARE_AND_SEND'
      payload: {
        campaignId: string
        influencerIds: string[]
        whatsapp?: { phoneNumberId: string; templateId: string; variableMapping: Record<string, string> }
        email?: { emailAccountId: string; templateId: string; variableMapping: Record<string, string> }
        /** Dual-channel waterfall + schedule. Ignored for single-channel sends. */
        cascade?: CascadeOptions
      }
    }
  | { type: 'RELEASE_SCHEDULED'; messageId: string }
  | { type: 'ADVANCE_MESSAGE_STATUS'; messageId: string; status: DeliveryStatus }
  | { type: 'SIMULATE_INBOUND'; conversationId: string; body: string }
  | { type: 'SEND_REPLY'; conversationId: string; body: string; msgId?: string }
  | { type: 'ASSIGN_CONVERSATION'; conversationId: string; memberId: string | undefined }
  | { type: 'RESOLVE_CONVERSATION'; conversationId: string }
  | { type: 'REOPEN_CONVERSATION'; conversationId: string }
  | {
      type: 'CREATE_OUTREACH_CAMPAIGN'
      payload: {
        name: string
        brandId: string | null
        audienceSource: AudienceSource
        collectionId: string | null
        influencerIds: string[]
      }
    }
  | {
      type: 'CREATE_COLLECTION'
      payload: { name: string; brandId: string | null; influencerIds: string[] }
    }
  | {
      type: 'LOG_WHATSAPP_SENDS'
      payload: {
        sends: Array<{ to: string; body: string; name?: string; wamid?: string }>
        phoneNumberId?: string
        campaignId?: string | null
      }
    }
  | { type: 'SET_LIVE_POLLING'; polling: boolean }
  | { type: 'SET_LIVE_SYNCED'; ts: string; error?: string | null }
  | { type: 'SET_LIVE_CONNECTION'; connection: ConnectionInfo | null }
  | { type: 'MERGE_INBOX_THREADS'; threads: ApiInboxThread[] }
  | { type: 'MERGE_GMAIL_THREADS'; threads: GmailThreadMeta[]; emailAccountId: string }
  | {
      type: 'MERGE_INBOX_MESSAGES'
      payload: { phone: string; messages: ApiInboxMessage[]; phoneNumberId?: string }
    }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' | 'system' }
  | { type: 'SET_NOTIFY_ENABLED'; enabled: boolean }
  | { type: 'SET_SIDEBAR_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_CONV_LABELS'; conversationId: string; labels: string[] }
  | { type: 'BULK_RESOLVE'; conversationIds: string[] }
  | { type: 'BULK_ASSIGN'; conversationIds: string[]; memberId: string | undefined }
  | {
      type: 'UPSERT_CANNED'
      payload: { id?: string; title: string; body: string }
    }
  | { type: 'DELETE_CANNED'; id: string }
  | {
      type: 'UPSERT_RULE'
      payload: {
        id?: string
        name: string
        keywords: string[]
        labels: string[]
        enabled: boolean
      }
    }
  | { type: 'DELETE_RULE'; id: string }
  | { type: 'TOGGLE_RULE'; id: string; enabled: boolean }

const initialState: AppState = {
  organization: seedOrganization,
  brands: seedBrands,
  influencers: seedInfluencers,
  collections: seedCollections,
  myCreatorIds: seedMyCreatorIds,
  campaigns: seedCampaigns,
  templates: seedTemplates,
  whatsAppNumbers: seedWhatsAppNumbers,
  emailAccounts: seedEmailAccounts,
  instagramAccounts: seedInstagramAccounts,
  channels: seedChannels,
  conversations: seedConversations,
  messages: seedMessages,
  analytics: seedAnalytics,
  team: seedTeam,
  activeTab: 'home',
  selectedCampaignId: seedCampaigns[0]?.id ?? null,
  brandFilter: 'all',
  selectedConversationId: null,
  toasts: [],
  connectModalOpen: false,
  connectStep: 0,
  connectKind: 'whatsapp',
  emailModalOpen: false,
  instagramModalOpen: false,
  liveInbox: {
    polling: true,
    lastSyncedAt: null,
    lastError: null,
    connection: null,
  },
  prefs: {
    theme: 'system',
    notifyEnabled: false,
    sidebarCollapsed: false,
  },
  cannedReplies: [
    {
      id: 'cn_thanks',
      title: 'Thanks',
      body: 'Thanks so much for the reply! I\u2019ll be back with details shortly.',
    },
    {
      id: 'cn_share_brief',
      title: 'Share brief',
      body: 'Great, here\u2019s the campaign brief with deliverables + timeline. Let me know your thoughts.',
    },
    {
      id: 'cn_confirm_slot',
      title: 'Confirm slot',
      body: 'Perfect \u2014 we\u2019re confirming your slot. You\u2019ll receive contract + payment terms within 24 hours.',
    },
  ],
  autoLabelRules: [
    {
      id: 'rule_hot',
      name: 'Hot lead signals',
      keywords: ['rates', 'pricing', 'brief', 'interested', 'send more', 'let\u2019s do'],
      labels: ['hot lead'],
      enabled: true,
    },
    {
      id: 'rule_paid',
      name: 'Payment received',
      keywords: ['invoice', 'paid', 'payment', 'received the amount'],
      labels: ['paid'],
      enabled: true,
    },
    {
      id: 'rule_pass',
      name: 'Soft pass',
      keywords: ['not now', 'busy', 'maybe later', 'not a fit', 'pass'],
      labels: ['not interested'],
      enabled: false,
    },
  ],
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function normPhone(s: string): string {
  return (s || '').replace(/\D/g, '')
}

function findInfluencerByPhone(
  influencers: Influencer[],
  phoneDigits: string,
): Influencer | undefined {
  if (!phoneDigits) return undefined
  return influencers.find(
    (i) => normPhone(i.phone) === phoneDigits || i.id === `ext_${phoneDigits}`,
  )
}

function mapLiveStatus(
  raw: string | undefined,
  direction: 'inbound' | 'outbound',
): DeliveryStatus {
  const v = (raw || '').toLowerCase()
  if (v === 'sent') return 'sent'
  if (v === 'delivered' || v === 'received') return 'delivered'
  if (v === 'read') return 'read'
  if (v === 'failed' || v === 'undelivered') return 'failed'
  return direction === 'inbound' ? 'delivered' : 'sent'
}

function mapMediaKind(
  messageType: string | undefined,
  mime: string | null | undefined,
): Message['mediaKind'] {
  const t = (messageType || '').toLowerCase()
  if (t === 'image' || (mime || '').startsWith('image/')) return 'image'
  if (t === 'video' || (mime || '').startsWith('video/')) return 'video'
  if (t === 'audio' || t === 'voice' || (mime || '').startsWith('audio/')) return 'audio'
  if (t === 'document' || (mime || '').startsWith('application/')) return 'document'
  if (t === 'sticker') return 'sticker'
  return null
}

export function connectionMode(state: Pick<AppState, 'whatsAppNumbers' | 'emailAccounts' | 'instagramAccounts'>): ConnectionMode {
  const wa = state.whatsAppNumbers.length > 0
  const em = state.emailAccounts.length > 0
  const ig = state.instagramAccounts.length > 0
  if ((wa && em) || (wa && ig) || (em && ig)) return 'both'
  if (wa) return 'whatsapp'
  if (em) return 'email'
  if (ig) return 'instagram'
  return 'none'
}

export function extractVariables(text: string): string[] {
  return extractSlots(text)
}

function findChannel(
  channels: CampaignChannel[],
  campaignId: string,
  channel: OutreachChannel,
): CampaignChannel | undefined {
  return channels.find((ch) => ch.campaignId === campaignId && ch.channel === channel)
}

function touchConversation(
  conversations: Conversation[],
  opts: {
    convId: string
    channel: OutreachChannel
    phoneNumberId?: string
    emailAccountId?: string
    influencerId: string
    campaignId: string
    ts: string
    preview: string
  },
): Conversation[] {
  const existing = conversations.find((c) => c.id === opts.convId)
  if (!existing) {
    return [
      ...conversations,
      {
        id: opts.convId,
        organizationId: ORG_ID,
        channel: opts.channel,
        phoneNumberId: opts.phoneNumberId,
        emailAccountId: opts.emailAccountId,
        influencerId: opts.influencerId,
        campaignIds: [opts.campaignId],
        lastCampaignId: opts.campaignId,
        status: 'open',
        lastMessageAt: opts.ts,
        unreadCount: 0,
        lastPreview: opts.preview.slice(0, 80),
      },
    ]
  }
  const campaignIds = existing.campaignIds.includes(opts.campaignId)
    ? existing.campaignIds
    : [...existing.campaignIds, opts.campaignId]
  return conversations.map((c) =>
    c.id === opts.convId
      ? {
          ...c,
          campaignIds,
          lastCampaignId: opts.campaignId,
          status: 'open' as const,
          lastMessageAt: opts.ts,
          lastPreview: opts.preview.slice(0, 80),
        }
      : c,
  )
}

function bumpAnalytics(
  analytics: CampaignAnalytics[],
  campaignId: string,
  channel: OutreachChannel,
  patch: (m: ReturnType<typeof emptyMetrics>) => void,
): CampaignAnalytics[] {
  return analytics.map((a) => {
    if (a.campaignId !== campaignId) return a
    const next = {
      ...a,
      whatsapp: { ...a.whatsapp },
      email: { ...a.email },
      instagram: { ...a.instagram },
    }
    patch(next[channel])
    return next
  })
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'SELECT_CAMPAIGN':
      return { ...state, selectedCampaignId: action.campaignId }
    case 'SET_BRAND_FILTER':
      return { ...state, brandFilter: action.brandFilter }
    case 'SELECT_CONVERSATION':
      return {
        ...state,
        selectedConversationId: action.conversationId,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      }
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, { ...action.toast, id: uid('toast') }].slice(-4),
      }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'OPEN_CONNECT':
      return {
        ...state,
        connectModalOpen: action.open,
        connectStep: 0,
        connectKind: action.kind ?? 'whatsapp',
      }
    case 'SET_CONNECT_STEP':
      return { ...state, connectStep: action.step }
    case 'OPEN_EMAIL_CONNECT':
      return { ...state, emailModalOpen: action.open }
    case 'OPEN_INSTAGRAM_CONNECT':
      return { ...state, instagramModalOpen: action.open }
    case 'CONNECT_WHATSAPP': {
      const number: WhatsAppNumber = {
        id: uid('wa'),
        organizationId: ORG_ID,
        displayName: action.payload.displayName,
        phoneDisplay: action.payload.phoneDisplay,
        phoneNumberId: action.payload.phoneNumberId,
        wabaId: action.payload.wabaId,
        businessId: action.payload.businessId,
        qualityRating: 'GREEN',
        messagingTier: 'TIER_10K',
        connectedAt: nowIso(),
      }
      return {
        ...state,
        whatsAppNumbers: [...state.whatsAppNumbers, number],
        connectModalOpen: false,
        connectStep: 0,
        activeTab: 'floor',
      }
    }
    case 'CONNECT_EMAIL': {
      const account: EmailAccount = {
        id: uid('em'),
        organizationId: ORG_ID,
        fromName: action.payload.fromName,
        fromEmail: action.payload.fromEmail,
        provider: action.payload.provider,
        domain: action.payload.domain,
        verified: true,
        connectedAt: nowIso(),
      }
      // Gmail is a single connected mailbox — replace any previous Gmail entry.
      const nextAccounts =
        account.provider === 'gmail'
          ? [...state.emailAccounts.filter((a) => a.provider !== 'gmail'), account]
          : [...state.emailAccounts, account]
      return {
        ...state,
        emailAccounts: nextAccounts,
        emailModalOpen: false,
        activeTab: 'floor',
      }
    }
    case 'SYNC_GMAIL': {
      const others = state.emailAccounts.filter((a) => a.provider !== 'gmail')
      if (!action.payload.connected || !action.payload.emailAddress) {
        return { ...state, emailAccounts: others }
      }
      const email = action.payload.emailAddress
      const existing = state.emailAccounts.find((a) => a.provider === 'gmail')
      const account: EmailAccount = {
        id: existing?.id || uid('em'),
        organizationId: ORG_ID,
        fromName: existing?.fromName || email.split('@')[0] || 'Gmail',
        fromEmail: email,
        provider: 'gmail',
        domain: email.split('@')[1] || 'gmail.com',
        verified: true,
        connectedAt: existing?.connectedAt || nowIso(),
        userId: action.payload.userId,
      }
      return {
        ...state,
        emailAccounts: [...others, account],
      }
    }
    case 'CONNECT_INSTAGRAM': {
      const account: InstagramAccount = {
        id: uid('ig'),
        organizationId: ORG_ID,
        handle: action.payload.handle.replace(/^@/, ''),
        displayName: action.payload.displayName,
        igUserId: action.payload.igUserId,
        connectedAt: nowIso(),
      }
      return {
        ...state,
        instagramAccounts: [...state.instagramAccounts, account],
        instagramModalOpen: false,
        activeTab: 'floor',
      }
    }
    case 'REACT_TO_MESSAGE': {
      const { messageId, emoji, by } = action.payload
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== messageId) return m
          const others = (m.reactions || []).filter((r) => r.by !== by)
          return {
            ...m,
            reactions: [...others, { by, emoji, at: nowIso() }],
          }
        }),
      }
    }
    case 'REMOVE_REACTION':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? { ...m, reactions: (m.reactions || []).filter((r) => r.by !== action.by) }
            : m,
        ),
      }
    case 'SUBMIT_TEMPLATE': {
      const isEmail = action.payload.channel === 'email'
      const template: Template = {
        id: action.payload.id,
        organizationId: ORG_ID,
        brandId: action.payload.brandId,
        channel: action.payload.channel,
        name: action.payload.name,
        category: action.payload.category,
        language: 'en',
        subject: action.payload.subject,
        body: action.payload.body,
        variables: action.payload.variables,
        bindings: action.payload.bindings,
        status: isEmail ? 'ACTIVE' : 'PENDING',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      return { ...state, templates: [template, ...state.templates] }
    }
    case 'APPROVE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId
            ? { ...t, status: 'APPROVED' as const, updatedAt: nowIso() }
            : t,
        ),
      }
    case 'REJECT_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId
            ? {
                ...t,
                status: 'REJECTED' as const,
                rejectionReason: action.reason,
                updatedAt: nowIso(),
              }
            : t,
        ),
      }
    case 'UPSERT_CHANNEL': {
      const existing = findChannel(state.channels, action.payload.campaignId, action.payload.channel)
      if (existing) {
        return {
          ...state,
          channels: state.channels.map((ch) =>
            ch.id === existing.id
              ? {
                  ...ch,
                  templateId: action.payload.templateId,
                  phoneNumberId: action.payload.phoneNumberId ?? ch.phoneNumberId,
                  emailAccountId: action.payload.emailAccountId ?? ch.emailAccountId,
                  selectedInfluencerIds:
                    action.payload.selectedInfluencerIds ?? ch.selectedInfluencerIds,
                }
              : ch,
          ),
        }
      }
      const channel: CampaignChannel = {
        id: uid('ch'),
        campaignId: action.payload.campaignId,
        organizationId: ORG_ID,
        channel: action.payload.channel,
        phoneNumberId: action.payload.phoneNumberId,
        emailAccountId: action.payload.emailAccountId,
        templateId: action.payload.templateId,
        variableMapping: {},
        selectedInfluencerIds: action.payload.selectedInfluencerIds ?? [],
        status: 'draft',
      }
      return { ...state, channels: [...state.channels, channel] }
    }
    case 'SET_SHARED_INFLUENCERS': {
      const { campaignId, influencerIds } = action.payload
      const channels = state.channels.map((ch) =>
        ch.campaignId === campaignId ? { ...ch, selectedInfluencerIds: influencerIds } : ch,
      )
      return { ...state, channels }
    }
    case 'UPDATE_CHANNEL':
      return {
        ...state,
        channels: state.channels.map((ch) =>
          ch.id === action.channelId ? { ...ch, ...action.patch } : ch,
        ),
      }
    case 'PREPARE_AND_SEND': {
      const { campaignId, influencerIds, whatsapp, email, cascade } = action.payload
      if (influencerIds.length === 0) return state

      let channels = [...state.channels]
      const upsert = (
        channel: OutreachChannel,
        extra: Partial<CampaignChannel> & { templateId: string },
        status: CampaignChannel['status'] = 'draft',
      ) => {
        const existing = findChannel(channels, campaignId, channel)
        if (existing) {
          channels = channels.map((ch) =>
            ch.id === existing.id
              ? {
                  ...ch,
                  ...extra,
                  selectedInfluencerIds: influencerIds,
                  status,
                }
              : ch,
          )
          return existing.id
        }
        const id = uid('ch')
        channels.push({
          id,
          campaignId,
          organizationId: ORG_ID,
          channel,
          variableMapping: {},
          selectedInfluencerIds: influencerIds,
          status,
          ...extra,
        })
        return id
      }

      const channelIds: string[] = []
      if (whatsapp) {
        channelIds.push(
          upsert('whatsapp', {
            phoneNumberId: whatsapp.phoneNumberId,
            templateId: whatsapp.templateId,
            variableMapping: whatsapp.variableMapping,
          }),
        )
      }
      if (email) {
        channelIds.push(
          upsert('email', {
            emailAccountId: email.emailAccountId,
            templateId: email.templateId,
            variableMapping: email.variableMapping,
          }),
        )
      }

      const both = Boolean(whatsapp && email)
      const useCascade = both && Boolean(cascade?.stopOnReply)

      if (!useCascade || !cascade) {
        return reducer({ ...state, channels }, { type: 'SEND_CHANNELS', channelIds })
      }

      // Cascade: send first channel, schedule second; cancel second on reply.
      const order = cascade.order
      const step1 = firstChannel(order)
      const step2 = secondChannel(order)
      const cascadeId = uid('casc')
      const now = Date.now()
      const firstAtMs = cascade.firstAt ? new Date(cascade.firstAt).getTime() : now
      const firstImmediate = !cascade.firstAt || firstAtMs <= now
      const waitMs = demoWaitMs(cascade.waitHours)
      const firstBaseMs = firstImmediate ? now : firstAtMs
      const secondReleaseMs = firstBaseMs + waitMs
      const secondProductFor = new Date(
        firstBaseMs + cascade.waitHours * 60 * 60 * 1000,
      ).toISOString()

      let conversations = [...state.conversations]
      let messages = [...state.messages]
      let analytics = [...state.analytics]
      const ts = nowIso()

      const channelConfigs: Record<
        OutreachChannel,
        | {
            accountId: string
            phoneNumberId?: string
            emailAccountId?: string
            templateId: string
            variableMapping: Record<string, string>
            channelRowId: string
          }
        | undefined
      > = {
        whatsapp: whatsapp
          ? {
              accountId: whatsapp.phoneNumberId,
              phoneNumberId: whatsapp.phoneNumberId,
              templateId: whatsapp.templateId,
              variableMapping: whatsapp.variableMapping,
              channelRowId: channelIds.find(
                (id) => channels.find((c) => c.id === id)?.channel === 'whatsapp',
              )!,
            }
          : undefined,
        email: email
          ? {
              accountId: email.emailAccountId,
              emailAccountId: email.emailAccountId,
              templateId: email.templateId,
              variableMapping: email.variableMapping,
              channelRowId: channelIds.find(
                (id) => channels.find((c) => c.id === id)?.channel === 'email',
              )!,
            }
          : undefined,
        instagram: undefined,
      }

      const campaign = state.campaigns.find((c) => c.id === campaignId)
      const brand = campaign?.brandId
        ? state.brands.find((b) => b.id === campaign.brandId) ?? null
        : null

      const emitForChannel = (
        channel: OutreachChannel,
        cascadeStep: 1 | 2,
        opts: { status: DeliveryStatus; scheduledFor?: string; demoReleaseAt?: number },
      ) => {
        const cfg = channelConfigs[channel]
        if (!cfg) return
        const template = state.templates.find((t) => t.id === cfg.templateId)
        if (!template) return
        if (channel === 'whatsapp' && template.status !== 'APPROVED') return
        if (
          channel === 'email' &&
          template.status !== 'ACTIVE' &&
          template.status !== 'APPROVED'
        )
          return

        for (const influencerId of influencerIds) {
          const influencer = state.influencers.find((i) => i.id === influencerId)
          if (!influencer) continue
          const convId = conversationKey(ORG_ID, channel, cfg.accountId, influencerId)
          const bindings = mergeBindings(template.bindings, cfg.variableMapping)
          const resolveCtx = {
            org: state.organization,
            brand,
            campaign: campaign ?? null,
            influencer,
          }
          const body = renderWithBindings(template.body, bindings, resolveCtx)
          const subject = template.subject
            ? renderWithBindings(template.subject, bindings, resolveCtx)
            : undefined

          conversations = touchConversation(conversations, {
            convId,
            channel,
            phoneNumberId: cfg.phoneNumberId,
            emailAccountId: cfg.emailAccountId,
            influencerId,
            campaignId,
            ts,
            preview:
              opts.status === 'scheduled'
                ? `Scheduled follow-up · ${body.slice(0, 60)}`
                : body,
          })

          messages.push({
            id: uid('msg'),
            conversationId: convId,
            organizationId: ORG_ID,
            channel,
            campaignId,
            direction: 'outbound',
            subject,
            body,
            status: opts.status,
            isTemplate: true,
            createdAt: ts,
            metaMessageId:
              channel === 'whatsapp' ? `wamid.${uid('meta')}` : `email.${uid('sg')}`,
            cascadeId,
            cascadeStep,
            scheduledFor: opts.scheduledFor,
            demoReleaseAt: opts.demoReleaseAt,
          })
        }

        if (opts.status === 'queued') {
          analytics = bumpAnalytics(analytics, campaignId, channel, (m) => {
            m.sent += influencerIds.length
          })
          channels = channels.map((ch) =>
            ch.id === cfg.channelRowId
              ? { ...ch, status: 'sent' as const, sentAt: ts }
              : ch,
          )
        } else {
          channels = channels.map((ch) =>
            ch.id === cfg.channelRowId
              ? {
                  ...ch,
                  status: 'scheduled' as const,
                  scheduledAt: opts.scheduledFor,
                }
              : ch,
          )
        }
      }

      emitForChannel(
        step1,
        1,
        firstImmediate
          ? { status: 'queued' }
          : {
              status: 'scheduled',
              scheduledFor: new Date(firstAtMs).toISOString(),
              demoReleaseAt: firstAtMs,
            },
      )
      emitForChannel(step2, 2, {
        status: 'scheduled',
        scheduledFor: secondProductFor,
        demoReleaseAt: secondReleaseMs,
      })

      return {
        ...state,
        channels,
        conversations,
        messages,
        analytics,
      }
    }
    case 'RELEASE_SCHEDULED': {
      const msg = state.messages.find((m) => m.id === action.messageId)
      if (!msg || msg.status !== 'scheduled') return state

      let analytics = state.analytics
      if (msg.campaignId) {
        analytics = bumpAnalytics(analytics, msg.campaignId, msg.channel, (m) => {
          m.sent += 1
        })
      }

      const channels = state.channels.map((ch) => {
        if (!msg.campaignId || ch.campaignId !== msg.campaignId || ch.channel !== msg.channel) {
          return ch
        }
        return { ...ch, status: 'sent' as const, sentAt: nowIso() }
      })

      const conversations = state.conversations.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastPreview: msg.body.slice(0, 80), lastMessageAt: nowIso() }
          : c,
      )

      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? { ...m, status: 'queued' as const, demoReleaseAt: undefined }
            : m,
        ),
        analytics,
        channels,
        conversations,
        toasts: [
          ...state.toasts,
          {
            id: uid('toast'),
            message: `Follow-up ${msg.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} released`,
            variant: 'info' as const,
          },
        ].slice(-4),
      }
    }
    case 'SEND_CHANNELS': {
      let conversations = [...state.conversations]
      let messages = [...state.messages]
      let analytics = [...state.analytics]
      let channels = [...state.channels]
      let anySent = false

      for (const channelId of action.channelIds) {
        const channel = channels.find((c) => c.id === channelId)
        if (!channel || channel.selectedInfluencerIds.length === 0) continue
        const template = state.templates.find((t) => t.id === channel.templateId)
        if (!template) continue
        if (channel.channel === 'whatsapp' && template.status !== 'APPROVED') continue
        if (
          channel.channel === 'email' &&
          template.status !== 'ACTIVE' &&
          template.status !== 'APPROVED'
        )
          continue

        const accountId =
          channel.channel === 'whatsapp' ? channel.phoneNumberId : channel.emailAccountId
        if (!accountId) continue

        const campaign = state.campaigns.find((c) => c.id === channel.campaignId)
        anySent = true

        for (const influencerId of channel.selectedInfluencerIds) {
          const influencer = state.influencers.find((i) => i.id === influencerId)
          if (!influencer) continue

          const convId = conversationKey(ORG_ID, channel.channel, accountId, influencerId)
          const ts = nowIso()
          const existingConv = conversations.find((c) => c.id === convId)

          if (!existingConv) {
            conversations.push({
              id: convId,
              organizationId: ORG_ID,
              channel: channel.channel,
              phoneNumberId: channel.phoneNumberId,
              emailAccountId: channel.emailAccountId,
              influencerId,
              campaignIds: [channel.campaignId],
              lastCampaignId: channel.campaignId,
              status: 'open',
              lastMessageAt: ts,
              unreadCount: 0,
              lastPreview: '',
            })
          } else {
            const campaignIds = existingConv.campaignIds.includes(channel.campaignId)
              ? existingConv.campaignIds
              : [...existingConv.campaignIds, channel.campaignId]
            conversations = conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    campaignIds,
                    lastCampaignId: channel.campaignId,
                    status: 'open' as const,
                    lastMessageAt: ts,
                  }
                : c,
            )
          }

          const brand = campaign?.brandId
            ? state.brands.find((b) => b.id === campaign.brandId) ?? null
            : null
          const bindings = mergeBindings(template.bindings, channel.variableMapping)
          const resolveCtx = {
            org: state.organization,
            brand,
            campaign: campaign ?? null,
            influencer,
          }
          const body = renderWithBindings(template.body, bindings, resolveCtx)
          const subject = template.subject
            ? renderWithBindings(template.subject, bindings, resolveCtx)
            : undefined

          messages.push({
            id: uid('msg'),
            conversationId: convId,
            organizationId: ORG_ID,
            channel: channel.channel,
            campaignId: channel.campaignId,
            direction: 'outbound',
            subject,
            body,
            status: 'queued',
            isTemplate: true,
            createdAt: ts,
            metaMessageId:
              channel.channel === 'whatsapp'
                ? `wamid.${uid('meta')}`
                : `email.${uid('sg')}`,
          })

          conversations = conversations.map((c) =>
            c.id === convId ? { ...c, lastPreview: body.slice(0, 80) } : c,
          )
        }

        analytics = bumpAnalytics(analytics, channel.campaignId, channel.channel, (m) => {
          m.sent += channel.selectedInfluencerIds.length
        })

        channels = channels.map((ch) =>
          ch.id === channelId ? { ...ch, status: 'sent' as const, sentAt: nowIso() } : ch,
        )
      }

      if (!anySent) return state

      return {
        ...state,
        conversations,
        messages,
        analytics,
        channels,
      }
    }
    case 'ADVANCE_MESSAGE_STATUS': {
      const msg = state.messages.find((m) => m.id === action.messageId)
      if (!msg) return state
      if (msg.status === 'cancelled' || msg.status === 'scheduled') return state
      let analytics = state.analytics
      const campaignId = msg.campaignId
      if (campaignId) {
        analytics = bumpAnalytics(analytics, campaignId, msg.channel, (patch) => {
          const prev = msg.status
          if (action.status === 'delivered' && prev !== 'delivered' && prev !== 'read') {
            patch.delivered += 1
          }
          if (action.status === 'read' && prev !== 'read') {
            patch.read += 1
          }
          if (action.status === 'failed') patch.failed += 1
        })
      }
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId ? { ...m, status: action.status } : m,
        ),
        analytics,
      }
    }
    case 'SIMULATE_INBOUND': {
      const conv = state.conversations.find((c) => c.id === action.conversationId)
      if (!conv) return state
      const ts = nowIso()
      const msg: Message = {
        id: uid('msg'),
        conversationId: conv.id,
        organizationId: ORG_ID,
        channel: conv.channel,
        campaignId: conv.lastCampaignId,
        direction: 'inbound',
        body: action.body,
        status: 'delivered',
        isTemplate: false,
        createdAt: ts,
        metaMessageId:
          conv.channel === 'whatsapp' ? `wamid.${uid('meta')}` : `email.${uid('in')}`,
      }
      let analytics = state.analytics
      if (conv.lastCampaignId) {
        analytics = bumpAnalytics(analytics, conv.lastCampaignId, conv.channel, (m) => {
          m.replied += 1
        })
      }

      // Cancel scheduled cascade follow-ups for this influencer (any cascade they are in).
      const cascadeIds = new Set(
        state.messages
          .filter((m) => {
            if (!m.cascadeId || m.cascadeStep !== 1) return false
            const mc = state.conversations.find((c) => c.id === m.conversationId)
            return mc?.influencerId === conv.influencerId
          })
          .map((m) => m.cascadeId!),
      )

      let cancelledCount = 0
      const messages = [...state.messages, msg].map((m) => {
        if (
          m.status === 'scheduled' &&
          m.cascadeStep === 2 &&
          m.cascadeId &&
          cascadeIds.has(m.cascadeId)
        ) {
          cancelledCount += 1
          return { ...m, status: 'cancelled' as const, demoReleaseAt: undefined }
        }
        return m
      })

      const toasts =
        cancelledCount > 0
          ? [
              ...state.toasts,
              {
                id: uid('toast'),
                message: `Follow-up cancelled — creator replied on ${conv.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}`,
                variant: 'success' as const,
              },
            ].slice(-4)
          : state.toasts

      return {
        ...state,
        messages,
        conversations: state.conversations.map((c) =>
          c.id === conv.id
            ? {
                ...c,
                status: c.status === 'resolved' ? 'open' : c.status,
                lastInboundAt: ts,
                lastMessageAt: ts,
                lastPreview: action.body.slice(0, 80),
                unreadCount:
                  state.selectedConversationId === c.id ? 0 : c.unreadCount + 1,
              }
            : c,
        ),
        analytics,
        toasts,
      }
    }
    case 'SEND_REPLY': {
      const conv = state.conversations.find((c) => c.id === action.conversationId)
      if (!conv) return state
      if (conv.channel === 'whatsapp' || conv.channel === 'instagram') {
        if (!conv.lastInboundAt) return state
        if (Date.now() - new Date(conv.lastInboundAt).getTime() >= 24 * 60 * 60 * 1000) {
          return state
        }
      }
      const ts = nowIso()
      const msg: Message = {
        id: action.msgId ?? uid('msg'),
        conversationId: conv.id,
        organizationId: ORG_ID,
        channel: conv.channel,
        direction: 'outbound',
        body: action.body,
        status: 'sent',
        isTemplate: false,
        createdAt: ts,
        metaMessageId:
          conv.channel === 'whatsapp'
            ? `wamid.${uid('meta')}`
            : conv.channel === 'instagram'
              ? `ig.${uid('meta')}`
              : `email.${uid('out')}`,
      }
      return {
        ...state,
        messages: [...state.messages, msg],
        conversations: state.conversations.map((c) =>
          c.id === conv.id
            ? { ...c, lastMessageAt: ts, lastPreview: action.body.slice(0, 80) }
            : c,
        ),
      }
    }
    case 'ASSIGN_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? { ...c, assignedTo: action.memberId, status: 'pending' }
            : c,
        ),
      }
    case 'RESOLVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, status: 'resolved' } : c,
        ),
      }
    case 'REOPEN_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, status: 'open' } : c,
        ),
      }
    case 'CREATE_OUTREACH_CAMPAIGN': {
      const id = uid('camp')
      const campaign: Campaign = {
        id,
        organizationId: ORG_ID,
        brandId: action.payload.brandId,
        name: action.payload.name,
        kind: 'outreach',
        audienceSource: action.payload.audienceSource,
        collectionId: action.payload.collectionId,
        status: 'draft',
        influencerIds: action.payload.influencerIds,
        createdAt: nowIso(),
      }
      let collections = state.collections
      if (
        action.payload.audienceSource === 'collection' &&
        action.payload.collectionId
      ) {
        collections = state.collections.map((c) =>
          c.id === action.payload.collectionId ? { ...c, campaignId: id } : c,
        )
      }
      return {
        ...state,
        campaigns: [campaign, ...state.campaigns],
        collections,
        analytics: [
          {
            campaignId: id,
            whatsapp: emptyMetrics(),
            email: emptyMetrics(),
            instagram: emptyMetrics(),
          },
          ...state.analytics,
        ],
        selectedCampaignId: id,
      }
    }
    case 'LOG_WHATSAPP_SENDS': {
      const ts = nowIso()
      let influencers = [...state.influencers]
      let conversations = [...state.conversations]
      let messages = [...state.messages]
      const phoneNumberId =
        action.payload.phoneNumberId || state.whatsAppNumbers[0]?.phoneNumberId
      const campaignId = action.payload.campaignId ?? undefined
      let selectedConversationId = state.selectedConversationId

      for (const send of action.payload.sends) {
        const phone = send.to.replace(/\D/g, '')
        if (!phone) continue
        let inf = influencers.find(
          (i) => i.phone.replace(/\D/g, '') === phone || i.id === `ext_${phone}`,
        )
        if (!inf) {
          inf = {
            id: `ext_${phone}`,
            name: send.name?.trim() || phone,
            handle: '',
            phone,
            email: '',
            followers: '—',
            niche: 'External',
          }
          influencers.push(inf)
        }
        const convId = conversationKey(
          ORG_ID,
          'whatsapp',
          phoneNumberId || 'wa_default',
          inf.id,
        )
        const existing = conversations.find((c) => c.id === convId)
        if (!existing) {
          conversations.unshift({
            id: convId,
            organizationId: ORG_ID,
            channel: 'whatsapp',
            phoneNumberId,
            influencerId: inf.id,
            campaignIds: campaignId ? [campaignId] : [],
            lastCampaignId: campaignId,
            status: 'open',
            lastMessageAt: ts,
            unreadCount: 0,
            lastPreview: send.body.slice(0, 80),
          })
        } else {
          conversations = conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessageAt: ts,
                  lastPreview: send.body.slice(0, 80),
                  campaignIds:
                    campaignId && !c.campaignIds.includes(campaignId)
                      ? [...c.campaignIds, campaignId]
                      : c.campaignIds,
                  lastCampaignId: campaignId || c.lastCampaignId,
                  status: 'open' as const,
                }
              : c,
          )
        }
        const msgId = uid('msg')
        messages.push({
          id: msgId,
          conversationId: convId,
          organizationId: ORG_ID,
          channel: 'whatsapp',
          campaignId,
          direction: 'outbound',
          body: send.body,
          status: 'sent',
          isTemplate: true,
          createdAt: ts,
          metaMessageId: send.wamid || msgId,
        })
        selectedConversationId = convId
      }

      return {
        ...state,
        influencers,
        conversations: conversations.sort((a, b) =>
          b.lastMessageAt.localeCompare(a.lastMessageAt),
        ),
        messages,
        selectedConversationId,
      }
    }
    case 'CREATE_COLLECTION': {
      const id = uid('col')
      const collection: CollectionList = {
        id,
        organizationId: ORG_ID,
        brandId: action.payload.brandId,
        name: action.payload.name,
        campaignId: null,
        influencerIds: action.payload.influencerIds,
        createdAt: nowIso(),
      }
      return { ...state, collections: [collection, ...state.collections] }
    }
    case 'SET_LIVE_POLLING':
      return {
        ...state,
        liveInbox: { ...state.liveInbox, polling: action.polling },
      }
    case 'SET_LIVE_SYNCED':
      return {
        ...state,
        liveInbox: {
          ...state.liveInbox,
          lastSyncedAt: action.ts,
          lastError: action.error ?? null,
        },
      }
    case 'SET_LIVE_CONNECTION': {
      const conn = action.connection
      let whatsAppNumbers = state.whatsAppNumbers
      if (conn?.phone_number_id) {
        const exists = whatsAppNumbers.some(
          (n) => n.phoneNumberId === conn.phone_number_id,
        )
        if (!exists) {
          whatsAppNumbers = [
            ...whatsAppNumbers,
            {
              id: uid('wa'),
              organizationId: ORG_ID,
              displayName: 'Reelax Live WhatsApp',
              phoneDisplay: '',
              phoneNumberId: conn.phone_number_id,
              wabaId: conn.waba_id ?? '',
              businessId: '',
              qualityRating: 'GREEN',
              messagingTier: 'TIER_10K',
              connectedAt: nowIso(),
            },
          ]
        }
      }
      return {
        ...state,
        whatsAppNumbers,
        liveInbox: { ...state.liveInbox, connection: conn },
      }
    }
    case 'MERGE_INBOX_THREADS': {
      const threads = action.threads || []
      if (threads.length === 0) return state
      const defaultPnid = state.liveInbox.connection?.phone_number_id ?? undefined
      let influencers = [...state.influencers]
      let conversations = [...state.conversations]

      for (const t of threads) {
        const phone = normPhone(t.phone)
        if (!phone) continue
        let inf = findInfluencerByPhone(influencers, phone)
        if (!inf) {
          inf = {
            id: `ext_${phone}`,
            name: (t.display_name && t.display_name.trim()) || phone,
            handle: '',
            phone,
            email: '',
            followers: '—',
            niche: 'External',
          }
          influencers = [...influencers, inf]
        }
        const phoneNumberId = t.phone_number_id || defaultPnid || 'wa_live'
        const convId = conversationKey(ORG_ID, 'whatsapp', phoneNumberId, inf.id)
        const existing = conversations.find((c) => c.id === convId)
        if (!existing) {
          conversations = [
            ...conversations,
            {
              id: convId,
              organizationId: ORG_ID,
              channel: 'whatsapp',
              phoneNumberId,
              influencerId: inf.id,
              campaignIds: [],
              status: 'open',
              lastMessageAt: t.last_message_at,
              unreadCount: t.unread_count || 0,
              lastPreview: (t.last_preview || '').slice(0, 80),
              lastInboundAt: t.last_inbound_at ?? undefined,
              isLive: true,
            },
          ]
        } else {
          conversations = conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessageAt:
                    t.last_message_at > c.lastMessageAt
                      ? t.last_message_at
                      : c.lastMessageAt,
                  lastPreview: t.last_preview
                    ? t.last_preview.slice(0, 80)
                    : c.lastPreview,
                  lastInboundAt: t.last_inbound_at ?? c.lastInboundAt,
                  unreadCount:
                    state.selectedConversationId === c.id
                      ? 0
                      : Math.max(c.unreadCount, t.unread_count || 0),
                  isLive: true,
                }
              : c,
          )
        }
      }
      return { ...state, influencers, conversations }
    }
    case 'MERGE_GMAIL_THREADS': {
      const threads = action.threads || []
      if (threads.length === 0) return state
      let influencers = [...state.influencers]
      let conversations = [...state.conversations]

      for (const t of threads) {
        const email = (t.to || '').trim().toLowerCase()
        if (!email) continue
        // Find influencer by email; create synthetic if none
        let inf = influencers.find(
          (i) => (i.email || '').toLowerCase() === email,
        )
        if (!inf) {
          inf = {
            id: `ext_em_${email.replace(/[^a-z0-9]/g, '_')}`,
            name: email.split('@')[0] || email,
            handle: '',
            phone: '',
            email,
            followers: '—',
            niche: 'External',
          }
          influencers = [...influencers, inf]
        }
        const convId = conversationKey(
          ORG_ID,
          'email',
          action.emailAccountId,
          inf.id,
        )
        const existing = conversations.find((c) => c.id === convId)
        const preview = (t.snippet || t.subject || '').slice(0, 80)
        if (!existing) {
          conversations = [
            ...conversations,
            {
              id: convId,
              organizationId: ORG_ID,
              channel: 'email',
              emailAccountId: action.emailAccountId,
              influencerId: inf.id,
              campaignIds: [],
              status: 'open',
              lastMessageAt: t.last_message_at,
              unreadCount: 0,
              lastPreview: preview,
              lastInboundAt: t.last_message_at,
              isLive: true,
            },
          ]
        } else {
          conversations = conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessageAt:
                    t.last_message_at > c.lastMessageAt
                      ? t.last_message_at
                      : c.lastMessageAt,
                  lastPreview: preview || c.lastPreview,
                  lastInboundAt:
                    t.last_message_at > (c.lastInboundAt || '')
                      ? t.last_message_at
                      : c.lastInboundAt,
                  isLive: true,
                }
              : c,
          )
        }
      }
      return { ...state, influencers, conversations }
    }
    case 'MERGE_INBOX_MESSAGES': {
      const { phone, messages: apiMsgs, phoneNumberId: hint } = action.payload
      if (!apiMsgs || apiMsgs.length === 0) return state
      const p = normPhone(phone)
      const inf = findInfluencerByPhone(state.influencers, p)
      if (!inf) return state
      const pnid =
        hint ||
        state.liveInbox.connection?.phone_number_id ||
        state.conversations.find(
          (c) => c.influencerId === inf.id && c.channel === 'whatsapp' && c.isLive,
        )?.phoneNumberId ||
        'wa_live'
      const convId = conversationKey(ORG_ID, 'whatsapp', pnid, inf.id)
      const conv = state.conversations.find((c) => c.id === convId)
      if (!conv) return state

      const existingIds = new Set(
        state.messages
          .filter((m) => m.conversationId === convId)
          .map((m) => m.metaMessageId)
          .filter(Boolean),
      )
      const existingLocalIds = new Set(
        state.messages
          .filter((m) => m.conversationId === convId)
          .map((m) => m.id),
      )

      const newMsgs: Message[] = []
      for (const m of apiMsgs) {
        const wamid = m.wamid || m.id
        if (wamid && existingIds.has(wamid)) continue
        if (m.id && existingLocalIds.has(m.id)) continue
        const kind = mapMediaKind(m.message_type, m.mime_type)
        const body =
          m.body ||
          m.caption ||
          m.emoji ||
          (kind ? `[${kind}]` : `[${m.message_type || 'message'}]`)
        newMsgs.push({
          id: m.id || uid('msg'),
          conversationId: convId,
          organizationId: ORG_ID,
          channel: 'whatsapp',
          direction: m.direction,
          body,
          status: mapLiveStatus(m.status, m.direction),
          isTemplate: Boolean(m.is_template),
          createdAt: m.created_at,
          metaMessageId: wamid || m.id || uid('meta'),
          mediaId: m.media_id ?? null,
          mediaMime: m.mime_type ?? null,
          mediaKind: kind,
          caption: m.caption ?? null,
        })
      }
      if (newMsgs.length === 0) return state

      const sorted = [...newMsgs].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      )
      const lastMsg = sorted[sorted.length - 1]
      const lastInbound = [...sorted]
        .reverse()
        .find((m) => m.direction === 'inbound')

      const isSelected = state.selectedConversationId === convId
      const newInboundCount = sorted.filter((m) => m.direction === 'inbound').length

      return {
        ...state,
        messages: [...state.messages, ...newMsgs],
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                lastMessageAt:
                  lastMsg.createdAt > c.lastMessageAt
                    ? lastMsg.createdAt
                    : c.lastMessageAt,
                lastPreview: lastMsg.body.slice(0, 80),
                lastInboundAt:
                  lastInbound &&
                  (!c.lastInboundAt || lastInbound.createdAt > c.lastInboundAt)
                    ? lastInbound.createdAt
                    : c.lastInboundAt,
                unreadCount: isSelected
                  ? 0
                  : c.unreadCount + newInboundCount,
              }
            : c,
        ),
      }
    }
    case 'SET_THEME':
      return { ...state, prefs: { ...state.prefs, theme: action.theme } }
    case 'SET_NOTIFY_ENABLED':
      return { ...state, prefs: { ...state.prefs, notifyEnabled: action.enabled } }
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, prefs: { ...state.prefs, sidebarCollapsed: action.collapsed } }
    case 'SET_CONV_LABELS':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, labels: action.labels } : c,
        ),
      }
    case 'BULK_RESOLVE': {
      const ids = new Set(action.conversationIds)
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          ids.has(c.id) ? { ...c, status: 'resolved' as const } : c,
        ),
      }
    }
    case 'BULK_ASSIGN': {
      const ids = new Set(action.conversationIds)
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          ids.has(c.id)
            ? { ...c, assignedTo: action.memberId, status: 'pending' as const }
            : c,
        ),
      }
    }
    case 'UPSERT_CANNED': {
      const { id, title, body } = action.payload
      if (id) {
        const exists = state.cannedReplies.some((c) => c.id === id)
        if (exists) {
          return {
            ...state,
            cannedReplies: state.cannedReplies.map((c) =>
              c.id === id ? { ...c, title, body } : c,
            ),
          }
        }
      }
      return {
        ...state,
        cannedReplies: [
          ...state.cannedReplies,
          { id: id || uid('cn'), title, body },
        ],
      }
    }
    case 'DELETE_CANNED':
      return {
        ...state,
        cannedReplies: state.cannedReplies.filter((c) => c.id !== action.id),
      }
    case 'UPSERT_RULE': {
      const p = action.payload
      if (p.id) {
        const exists = state.autoLabelRules.some((r) => r.id === p.id)
        if (exists) {
          return {
            ...state,
            autoLabelRules: state.autoLabelRules.map((r) =>
              r.id === p.id
                ? { ...r, name: p.name, keywords: p.keywords, labels: p.labels, enabled: p.enabled }
                : r,
            ),
          }
        }
      }
      return {
        ...state,
        autoLabelRules: [
          ...state.autoLabelRules,
          {
            id: p.id || uid('rule'),
            name: p.name,
            keywords: p.keywords,
            labels: p.labels,
            enabled: p.enabled,
          },
        ],
      }
    }
    case 'DELETE_RULE':
      return {
        ...state,
        autoLabelRules: state.autoLabelRules.filter((r) => r.id !== action.id),
      }
    case 'TOGGLE_RULE':
      return {
        ...state,
        autoLabelRules: state.autoLabelRules.map((r) =>
          r.id === action.id ? { ...r, enabled: action.enabled } : r,
        ),
      }
    default:
      return state
  }
}

interface StoreContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  actions: {
    setTab: (tab: TabId) => void
    selectCampaign: (id: string | null) => void
    setBrandFilter: (brandFilter: string) => void
    selectConversation: (id: string | null) => void
    toast: (message: string, variant?: ToastItem['variant']) => void
    dismissToast: (id: string) => void
    openConnect: (open: boolean, kind?: OutreachChannel) => void
    setConnectStep: (step: number) => void
    openEmailConnect: (open: boolean) => void
    openInstagramConnect: (open: boolean) => void
    connectWhatsApp: (data: {
      displayName: string
      phoneDisplay: string
      phoneNumberId: string
      wabaId: string
      businessId: string
    }) => void
    connectEmail: (data: {
      fromName: string
      fromEmail: string
      provider: EmailProvider
      domain: string
    }) => void
    syncGmail: (info: GmailConnectionInfo | null) => void
    connectInstagram: (data: {
      handle: string
      displayName: string
      igUserId: string
    }) => void
    reactToMessage: (messageId: string, emoji: string, by?: 'me' | 'them') => void
    removeReaction: (messageId: string, by?: 'me' | 'them') => void
    submitTemplate: (data: {
      channel: OutreachChannel
      name: string
      category: TemplateCategory
      subject?: string
      body: string
      bindings: VariableBinding[]
      brandId: string | null
    }) => void
    upsertChannel: (payload: {
      campaignId: string
      channel: OutreachChannel
      phoneNumberId?: string
      emailAccountId?: string
      templateId: string
      selectedInfluencerIds?: string[]
    }) => void
    updateChannel: (channelId: string, patch: Partial<CampaignChannel>) => void
    setSharedInfluencers: (campaignId: string, influencerIds: string[]) => void
    sendChannels: (channelIds: string[]) => void
    prepareAndSend: (payload: {
      campaignId: string
      influencerIds: string[]
      whatsapp?: { phoneNumberId: string; templateId: string; variableMapping: Record<string, string> }
      email?: { emailAccountId: string; templateId: string; variableMapping: Record<string, string> }
      cascade?: CascadeOptions
    }) => void
    releaseScheduled: (messageId: string) => void
    simulateInbound: (conversationId: string, body: string) => void
    sendReply: (conversationId: string, body: string) => boolean
    assignConversation: (conversationId: string, memberId: string | undefined) => void
    resolveConversation: (conversationId: string) => void
    reopenConversation: (conversationId: string) => void
    scheduleTemplateWebhook: (templateId: string, approve?: boolean) => void
    scheduleMessagePipeline: (messageId: string) => void
    isWithin24hWindow: (conversationId: string) => boolean
    canFreeformReply: (conversationId: string) => boolean
    getConversationInfluencer: (conv: Conversation) => Influencer | undefined
    renderPreview: (
      templateId: string,
      mapping: Record<string, string>,
      influencerId?: string,
      campaignId?: string,
    ) => { subject?: string; body: string }
    // backwards-compatible aliases
    attachChannel: (campaignId: string, phoneNumberId: string, templateId: string) => void
    toggleCampaignInfluencer: (
      campaignId: string,
      phoneNumberId: string,
      templateId: string,
      influencerId: string,
    ) => void
    sendCampaign: (channelId: string) => void
    createOutreachCampaign: (payload: {
      name: string
      brandId: string | null
      audienceSource: AudienceSource
      collectionId: string | null
      influencerIds: string[]
    }) => void
    createCollection: (payload: {
      name: string
      brandId: string | null
      influencerIds: string[]
    }) => void
    logWhatsAppSends: (payload: {
      sends: Array<{ to: string; body: string; name?: string; wamid?: string }>
      phoneNumberId?: string
      campaignId?: string | null
    }) => void
    setLivePolling: (polling: boolean) => void
    syncLiveInboxNow: () => Promise<void>
    sendWhatsAppReplyLive: (conversationId: string, body: string) => Promise<boolean>
    setTheme: (theme: 'light' | 'dark' | 'system') => void
    enableNotifications: () => Promise<boolean>
    disableNotifications: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    setConversationLabels: (conversationId: string, labels: string[]) => void
    bulkResolve: (conversationIds: string[]) => void
    bulkAssign: (conversationIds: string[], memberId: string | undefined) => void
    upsertCanned: (data: { id?: string; title: string; body: string }) => void
    deleteCanned: (id: string) => void
    upsertRule: (data: {
      id?: string
      name: string
      keywords: string[]
      labels: string[]
      enabled: boolean
    }) => void
    deleteRule: (id: string) => void
    toggleRule: (id: string, enabled: boolean) => void
  }
}

const StoreContext = createContext<StoreContextValue | null>(null)

const STORAGE_KEY = 'reelax-outreach-v2'

/**
 * Persist a subset of state to localStorage so the demo survives reloads.
 * Volatile UI-only fields (toasts, modal open flags) are stripped.
 */
function loadPersisted(): AppState {
  if (typeof window === 'undefined') return initialState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...initialState,
      ...parsed,
      // Never persist these
      toasts: [],
      connectModalOpen: false,
      connectStep: 0,
      emailModalOpen: false,
    }
  } catch {
    return initialState
  }
}

function persistState(state: AppState) {
  if (typeof window === 'undefined') return
  try {
    const { toasts: _t, connectModalOpen: _cm, emailModalOpen: _em, connectStep: _cs, ...rest } = state
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function WhatsAppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppState, loadPersisted)

  // Persist on any change (debounced via requestIdleCallback if available)
  useEffect(() => {
    const idle =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (idle) {
      const id = idle(() => persistState(state))
      return () => {
        const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void })
          .cancelIdleCallback
        cancel?.(id)
      }
    }
    const t = window.setTimeout(() => persistState(state), 100)
    return () => window.clearTimeout(t)
  }, [state])

  const toast = useCallback((message: string, variant: ToastItem['variant'] = 'info') => {
    dispatch({ type: 'ADD_TOAST', toast: { message, variant } })
  }, [])

  const scheduleTemplateWebhook = useCallback((templateId: string, approve = true) => {
    window.setTimeout(() => {
      if (approve) {
        dispatch({ type: 'APPROVE_TEMPLATE', templateId })
        dispatch({
          type: 'ADD_TOAST',
          toast: { message: 'Meta webhook: template approved', variant: 'success' },
        })
      } else {
        dispatch({
          type: 'REJECT_TEMPLATE',
          templateId,
          reason: 'Policy: promotional language needs opt-out footer',
        })
        dispatch({
          type: 'ADD_TOAST',
          toast: { message: 'Meta webhook: template rejected', variant: 'error' },
        })
      }
    }, 2800)
  }, [])

  const scheduleMessagePipeline = useCallback((messageId: string) => {
    const steps: DeliveryStatus[] = ['sent', 'delivered', 'read']
    steps.forEach((status, i) => {
      window.setTimeout(() => {
        dispatch({ type: 'ADVANCE_MESSAGE_STATUS', messageId, status })
      }, 800 + i * 1200)
    })
  }, [])

  const isWithin24hWindow = useCallback(
    (conversationId: string) => {
      const conv = state.conversations.find((c) => c.id === conversationId)
      if (!conv?.lastInboundAt) return false
      return Date.now() - new Date(conv.lastInboundAt).getTime() < 24 * 60 * 60 * 1000
    },
    [state.conversations],
  )

  const canFreeformReply = useCallback(
    (conversationId: string) => {
      const conv = state.conversations.find((c) => c.id === conversationId)
      if (!conv) return false
      if (conv.channel === 'email') return true
      return isWithin24hWindow(conversationId)
    },
    [state.conversations, isWithin24hWindow],
  )

  const getConversationInfluencer = useCallback(
    (conv: Conversation) => state.influencers.find((i) => i.id === conv.influencerId),
    [state.influencers],
  )

  const renderPreview = useCallback(
    (
      templateId: string,
      mapping: Record<string, string>,
      influencerId?: string,
      campaignId?: string,
    ) => {
      const template = state.templates.find((t) => t.id === templateId)
      if (!template) return { body: '' }
      const influencer = influencerId
        ? state.influencers.find((i) => i.id === influencerId)
        : state.influencers[0]
      const campaign = campaignId
        ? state.campaigns.find((c) => c.id === campaignId)
        : state.campaigns.find((c) => c.id === state.selectedCampaignId)
      const brand = campaign?.brandId
        ? state.brands.find((b) => b.id === campaign.brandId) ?? null
        : null
      const bindings = mergeBindings(template.bindings, mapping)
      const ctx = {
        org: state.organization,
        brand,
        campaign: campaign ?? null,
        influencer: influencer ?? null,
      }
      return {
        subject: template.subject
          ? renderWithBindings(template.subject, bindings, ctx)
          : undefined,
        body: renderWithBindings(template.body, bindings, ctx),
      }
    },
    [
      state.templates,
      state.influencers,
      state.campaigns,
      state.brands,
      state.organization,
      state.selectedCampaignId,
    ],
  )

  const sendReply = useCallback(
    (conversationId: string, body: string) => {
      if (!canFreeformReply(conversationId)) return false
      dispatch({ type: 'SEND_REPLY', conversationId, body })
      return true
    },
    [canFreeformReply],
  )

  // Latest-state ref so polling closure can read fresh conversations/influencers
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const doLiveSync = useCallback(async () => {
    try {
      const threads = await listWhatsAppInbox()
      dispatch({ type: 'MERGE_INBOX_THREADS', threads })

      const cur = stateRef.current
      const sel = cur.conversations.find(
        (c) => c.id === cur.selectedConversationId,
      )
      if (sel && sel.channel === 'whatsapp' && sel.isLive) {
        const inf = cur.influencers.find((i) => i.id === sel.influencerId)
        const phoneDigits = normPhone(inf?.phone || '')
        if (phoneDigits) {
          try {
            const msgs = await getWhatsAppInboxMessages(phoneDigits)
            dispatch({
              type: 'MERGE_INBOX_MESSAGES',
              payload: {
                phone: phoneDigits,
                messages: msgs,
                phoneNumberId: sel.phoneNumberId,
              },
            })
          } catch {
            /* per-thread errors are non-fatal */
          }
        }
      }
      dispatch({ type: 'SET_LIVE_SYNCED', ts: nowIso(), error: null })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message
      dispatch({ type: 'SET_LIVE_SYNCED', ts: nowIso(), error: msg })
    }

    // Gmail polling — only runs if a Gmail account is connected with a userId.
    const cur = stateRef.current
    const em = cur.emailAccounts.find(
      (a) => a.provider === 'gmail' && a.userId,
    )
    if (em && em.userId) {
      try {
        const res = await listGmailThreads({ user_id: em.userId, limit: 40 })
        if (res && res.length > 0) {
          dispatch({
            type: 'MERGE_GMAIL_THREADS',
            threads: res,
            emailAccountId: em.id,
          })
        }
      } catch {
        /* Gmail sync errors are non-fatal for the WA live indicator */
      }
    }
  }, [])

  const sendWhatsAppReplyLive = useCallback(
    async (conversationId: string, body: string) => {
      const conv = stateRef.current.conversations.find(
        (c) => c.id === conversationId,
      )
      if (!conv) return false
      const inf = stateRef.current.influencers.find(
        (i) => i.id === conv.influencerId,
      )
      const phoneDigits = normPhone(inf?.phone || '')
      if (!phoneDigits) return false
      if (!canFreeformReply(conversationId)) return false
      const msgId = uid('msg')
      // Optimistic local send
      dispatch({ type: 'SEND_REPLY', conversationId, body, msgId })
      try {
        await sendWhatsAppText({
          to: phoneDigits,
          text: body,
          phone_number_id: conv.phoneNumberId,
        })
        // Trigger a fresh pull so we get delivery/read receipts sooner
        void doLiveSync()
        return true
      } catch (e) {
        dispatch({
          type: 'ADVANCE_MESSAGE_STATUS',
          messageId: msgId,
          status: 'failed',
        })
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            message:
              e instanceof ApiError
                ? `WhatsApp: ${e.message}`
                : 'WhatsApp send failed',
            variant: 'error',
          },
        })
        return false
      }
    },
    [canFreeformReply, doLiveSync],
  )

  // Fetch connection info once on mount so the WA status pill lights up.
  useEffect(() => {
    if (state.liveInbox.connection) return
    let cancelled = false
    getWhatsAppConnection()
      .then((conn) => {
        if (!cancelled)
          dispatch({ type: 'SET_LIVE_CONNECTION', connection: conn ?? null })
      })
      .catch(() => {
        /* proxy unreachable — silently ignore, polling loop will surface error */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep Gmail OAuth state in sync with emailAccounts so connectionMode,
  // onboarding, and send gating all see the same source of truth.
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(window.location.search)
    const gmailStatus = params.get('gmail')
    const tabHint = params.get('tab')

    const clearGmailParams = () => {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('gmail')
      nextUrl.searchParams.delete('email')
      nextUrl.searchParams.delete('message')
      nextUrl.searchParams.delete('tab')
      window.history.replaceState({}, '', nextUrl)
    }

    const load = async () => {
      try {
        const info = await getGmailConnection()
        if (cancelled) return
        dispatch({
          type: 'SYNC_GMAIL',
          payload: {
            connected: Boolean(info?.connected && info.email_address),
            emailAddress: info?.email_address,
            channelId: info?.channel_id,
            userId: info?.user_id,
          },
        })
        if (gmailStatus === 'connected') {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              message: info?.email_address
                ? `Gmail connected · ${info.email_address}`
                : 'Gmail connected',
              variant: 'success',
            },
          })
          if (tabHint === 'connect') {
            dispatch({ type: 'SET_TAB', tab: 'connect' })
          }
        } else if (gmailStatus === 'error') {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              message: params.get('message') || 'Gmail connection failed',
              variant: 'error',
            },
          })
          dispatch({ type: 'SET_TAB', tab: 'connect' })
        }
      } catch {
        /* API unreachable — leave emailAccounts as-is */
      } finally {
        if (gmailStatus) clearGmailParams()
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 15-second live polling loop for the WhatsApp inbox.
  useEffect(() => {
    if (!state.liveInbox.polling) return
    // Fire immediately, then every 15s.
    void doLiveSync()
    const id = window.setInterval(() => {
      void doLiveSync()
    }, 15000)
    return () => window.clearInterval(id)
  }, [state.liveInbox.polling, state.selectedConversationId, doLiveSync])

  // Apply theme preference to the document root.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const pref = state.prefs.theme
    let applied: 'light' | 'dark' = 'light'
    if (pref === 'system') {
      const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
      applied = mq?.matches ? 'dark' : 'light'
      const onChange = () => {
        html.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
      }
      mq?.addEventListener?.('change', onChange)
      html.setAttribute('data-theme', applied)
      return () => mq?.removeEventListener?.('change', onChange)
    }
    applied = pref
    html.setAttribute('data-theme', applied)
  }, [state.prefs.theme])

  // Desktop notifications: fire when a new inbound WhatsApp message lands
  // in a conversation the user isn\u2019t currently looking at.
  const seenInboundIdsRef = useRef<Set<string>>(new Set())
  const inboundBootstrapDoneRef = useRef(false)
  useEffect(() => {
    // First pass: mark existing inbound as \u201cseen\u201d without notifying,
    // so notifications only fire for genuinely new messages.
    if (!inboundBootstrapDoneRef.current) {
      inboundBootstrapDoneRef.current = true
      for (const m of state.messages) {
        if (m.direction === 'inbound') seenInboundIdsRef.current.add(m.id)
      }
      return
    }

    if (!state.prefs.notifyEnabled) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const focused =
      typeof document !== 'undefined' ? document.hasFocus() : true

    for (const m of state.messages) {
      if (m.direction !== 'inbound') continue
      if (seenInboundIdsRef.current.has(m.id)) continue
      seenInboundIdsRef.current.add(m.id)

      // Don\u2019t notify for the conversation the user is actively viewing.
      if (
        focused &&
        state.selectedConversationId === m.conversationId
      ) {
        continue
      }
      const conv = state.conversations.find((c) => c.id === m.conversationId)
      const inf = conv
        ? state.influencers.find((i) => i.id === conv.influencerId)
        : undefined
      const title = `New reply \u2014 ${inf?.name || conv?.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}`
      try {
        const n = new Notification(title, {
          body: (m.body || '').slice(0, 120),
          tag: `reelax-${m.conversationId}`,
          icon: '/favicon.ico',
        })
        n.onclick = () => {
          window.focus()
          dispatch({
            type: 'SELECT_CONVERSATION',
            conversationId: m.conversationId,
          })
          dispatch({ type: 'SET_TAB', tab: 'inbox' })
          n.close()
        }
      } catch {
        /* browser may throw for tab in background — ignore */
      }
    }
  }, [
    state.messages,
    state.prefs.notifyEnabled,
    state.selectedConversationId,
    state.conversations,
    state.influencers,
  ])

  // Reflect current OS permission back into prefs so the UI stays honest.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const perm = Notification.permission
    const shouldBe = perm === 'granted'
    if (state.prefs.notifyEnabled !== shouldBe) {
      dispatch({ type: 'SET_NOTIFY_ENABLED', enabled: shouldBe })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-label rules: watch new inbound messages and apply matching labels
  // to their conversation. Only new inbounds trigger — no back-fill on load.
  const autoLabeledInboundRef = useRef<Set<string>>(new Set())
  const autoLabelBootstrapRef = useRef(false)
  useEffect(() => {
    if (!autoLabelBootstrapRef.current) {
      autoLabelBootstrapRef.current = true
      for (const m of state.messages) {
        if (m.direction === 'inbound') autoLabeledInboundRef.current.add(m.id)
      }
      return
    }
    const enabledRules = state.autoLabelRules.filter((r) => r.enabled)
    if (enabledRules.length === 0) return

    for (const m of state.messages) {
      if (m.direction !== 'inbound') continue
      if (autoLabeledInboundRef.current.has(m.id)) continue
      autoLabeledInboundRef.current.add(m.id)

      const body = (m.body || '').toLowerCase()
      if (!body) continue

      const toApply = new Set<string>()
      for (const rule of enabledRules) {
        const hit = rule.keywords.some(
          (kw) => kw && body.includes(kw.toLowerCase()),
        )
        if (hit) for (const l of rule.labels) toApply.add(l.toLowerCase())
      }
      if (toApply.size === 0) continue

      const conv = state.conversations.find((c) => c.id === m.conversationId)
      if (!conv) continue
      const existing = new Set((conv.labels || []).map((l) => l.toLowerCase()))
      const added = [...toApply].filter((l) => !existing.has(l))
      if (added.length === 0) continue

      dispatch({
        type: 'SET_CONV_LABELS',
        conversationId: conv.id,
        labels: [...(conv.labels || []), ...added],
      })
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          message: `Auto-labeled \u201c${added.join(', ')}\u201d from keyword match`,
          variant: 'info',
        },
      })
    }
  }, [state.messages, state.autoLabelRules, state.conversations])

  const actions = useMemo(
    (): StoreContextValue['actions'] => ({
      setTab: (tab) => dispatch({ type: 'SET_TAB', tab }),
      selectCampaign: (id) => dispatch({ type: 'SELECT_CAMPAIGN', campaignId: id }),
      setBrandFilter: (brandFilter) => dispatch({ type: 'SET_BRAND_FILTER', brandFilter }),
      selectConversation: (id) =>
        dispatch({ type: 'SELECT_CONVERSATION', conversationId: id }),
      toast,
      dismissToast: (id) => dispatch({ type: 'DISMISS_TOAST', id }),
      openConnect: (open, kind) => dispatch({ type: 'OPEN_CONNECT', open, kind }),
      setConnectStep: (step) => dispatch({ type: 'SET_CONNECT_STEP', step }),
      openEmailConnect: (open) => dispatch({ type: 'OPEN_EMAIL_CONNECT', open }),
      openInstagramConnect: (open) => dispatch({ type: 'OPEN_INSTAGRAM_CONNECT', open }),
      connectWhatsApp: (data) => {
        dispatch({ type: 'CONNECT_WHATSAPP', payload: data })
        toast('WhatsApp Business number connected', 'success')
      },
      connectEmail: (data) => {
        dispatch({ type: 'CONNECT_EMAIL', payload: data })
        toast(
          data.provider === 'gmail'
            ? `Gmail connected · ${data.fromEmail}`
            : 'Email sending domain connected',
          'success',
        )
      },
      syncGmail: (info) => {
        dispatch({
          type: 'SYNC_GMAIL',
          payload: {
            connected: Boolean(info?.connected && info.email_address),
            emailAddress: info?.email_address,
            channelId: info?.channel_id,
            userId: info?.user_id,
          },
        })
      },
      connectInstagram: (data) => {
        dispatch({ type: 'CONNECT_INSTAGRAM', payload: data })
        toast('Instagram Business account connected', 'success')
      },
      reactToMessage: (messageId, emoji, by = 'me') =>
        dispatch({ type: 'REACT_TO_MESSAGE', payload: { messageId, emoji, by } }),
      removeReaction: (messageId, by = 'me') =>
        dispatch({ type: 'REMOVE_REACTION', messageId, by }),
      submitTemplate: (data) => {
        const id = uid('tpl')
        const vars = extractVariables(`${data.subject ?? ''} ${data.body}`)
        dispatch({
          type: 'SUBMIT_TEMPLATE',
          payload: { id, ...data, variables: vars },
        })
        if (data.channel === 'whatsapp') {
          scheduleTemplateWebhook(id, true)
        } else {
          toast('Email template saved and active', 'success')
        }
      },
      upsertChannel: (payload) => dispatch({ type: 'UPSERT_CHANNEL', payload }),
      updateChannel: (channelId, patch) =>
        dispatch({ type: 'UPDATE_CHANNEL', channelId, patch }),
      setSharedInfluencers: (campaignId, influencerIds) =>
        dispatch({ type: 'SET_SHARED_INFLUENCERS', payload: { campaignId, influencerIds } }),
      sendChannels: (channelIds) => dispatch({ type: 'SEND_CHANNELS', channelIds }),
      prepareAndSend: (payload) => dispatch({ type: 'PREPARE_AND_SEND', payload }),
      releaseScheduled: (messageId) => dispatch({ type: 'RELEASE_SCHEDULED', messageId }),
      simulateInbound: (conversationId, body) =>
        dispatch({ type: 'SIMULATE_INBOUND', conversationId, body }),
      sendReply,
      assignConversation: (conversationId, memberId) =>
        dispatch({ type: 'ASSIGN_CONVERSATION', conversationId, memberId }),
      resolveConversation: (conversationId) =>
        dispatch({ type: 'RESOLVE_CONVERSATION', conversationId }),
      reopenConversation: (conversationId) =>
        dispatch({ type: 'REOPEN_CONVERSATION', conversationId }),
      scheduleTemplateWebhook,
      scheduleMessagePipeline,
      isWithin24hWindow,
      canFreeformReply,
      getConversationInfluencer,
      renderPreview,
      attachChannel: (campaignId, phoneNumberId, templateId) =>
        dispatch({
          type: 'UPSERT_CHANNEL',
          payload: { campaignId, channel: 'whatsapp', phoneNumberId, templateId },
        }),
      toggleCampaignInfluencer: (campaignId, phoneNumberId, templateId, influencerId) => {
        const existing = findChannel(state.channels, campaignId, 'whatsapp')
        const ids = existing?.selectedInfluencerIds ?? []
        const next = ids.includes(influencerId)
          ? ids.filter((id) => id !== influencerId)
          : [...ids, influencerId]
        dispatch({
          type: 'UPSERT_CHANNEL',
          payload: {
            campaignId,
            channel: 'whatsapp',
            phoneNumberId,
            templateId,
            selectedInfluencerIds: next,
          },
        })
        dispatch({
          type: 'SET_SHARED_INFLUENCERS',
          payload: { campaignId, influencerIds: next },
        })
      },
      sendCampaign: (channelId) => dispatch({ type: 'SEND_CHANNELS', channelIds: [channelId] }),
      createOutreachCampaign: (payload) => {
        dispatch({ type: 'CREATE_OUTREACH_CAMPAIGN', payload })
        toast('Outreach campaign created', 'success')
      },
      createCollection: (payload) => {
        dispatch({ type: 'CREATE_COLLECTION', payload })
        toast('Collection list created', 'success')
      },
      logWhatsAppSends: (payload) => {
        dispatch({ type: 'LOG_WHATSAPP_SENDS', payload })
      },
      setLivePolling: (polling) => dispatch({ type: 'SET_LIVE_POLLING', polling }),
      syncLiveInboxNow: () => doLiveSync(),
      sendWhatsAppReplyLive,
      setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
      enableNotifications: async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          toast('Desktop notifications are not supported in this browser', 'error')
          return false
        }
        try {
          const perm = await Notification.requestPermission()
          const ok = perm === 'granted'
          dispatch({ type: 'SET_NOTIFY_ENABLED', enabled: ok })
          if (ok) {
            toast('Desktop notifications on — you\u2019ll be pinged for new replies', 'success')
          } else {
            toast('Notifications blocked in the browser', 'error')
          }
          return ok
        } catch {
          return false
        }
      },
      disableNotifications: () =>
        dispatch({ type: 'SET_NOTIFY_ENABLED', enabled: false }),
      setSidebarCollapsed: (collapsed) =>
        dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed }),
      setConversationLabels: (conversationId, labels) =>
        dispatch({ type: 'SET_CONV_LABELS', conversationId, labels }),
      bulkResolve: (conversationIds) =>
        dispatch({ type: 'BULK_RESOLVE', conversationIds }),
      bulkAssign: (conversationIds, memberId) =>
        dispatch({ type: 'BULK_ASSIGN', conversationIds, memberId }),
      upsertCanned: (data) => dispatch({ type: 'UPSERT_CANNED', payload: data }),
      deleteCanned: (id) => dispatch({ type: 'DELETE_CANNED', id }),
      upsertRule: (data) => dispatch({ type: 'UPSERT_RULE', payload: data }),
      deleteRule: (id) => dispatch({ type: 'DELETE_RULE', id }),
      toggleRule: (id, enabled) => dispatch({ type: 'TOGGLE_RULE', id, enabled }),
    }),
    [
      toast,
      sendReply,
      scheduleTemplateWebhook,
      scheduleMessagePipeline,
      isWithin24hWindow,
      canFreeformReply,
      getConversationInfluencer,
      renderPreview,
      state.channels,
      doLiveSync,
      sendWhatsAppReplyLive,
    ],
  )

  const prevMessageCount = useRef(state.messages.length)
  const pipelined = useRef(new Set<string>())
  const scheduledTimers = useRef(new Map<string, number>())

  useEffect(() => {
    // Pipeline any newly queued outbound messages (including released schedules).
    for (const msg of state.messages) {
      if (
        msg.status === 'queued' &&
        msg.direction === 'outbound' &&
        !pipelined.current.has(msg.id)
      ) {
        pipelined.current.add(msg.id)
        scheduleMessagePipeline(msg.id)
      }
    }
    prevMessageCount.current = state.messages.length

    // Arm demo timers for scheduled cascade / delayed first sends.
    for (const msg of state.messages) {
      if (msg.status !== 'scheduled' || msg.demoReleaseAt == null) continue
      if (scheduledTimers.current.has(msg.id)) continue
      const delay = Math.max(0, msg.demoReleaseAt - Date.now())
      const handle = window.setTimeout(() => {
        scheduledTimers.current.delete(msg.id)
        dispatch({ type: 'RELEASE_SCHEDULED', messageId: msg.id })
      }, delay)
      scheduledTimers.current.set(msg.id, handle)
    }

    // Clear timers for cancelled / already-released messages.
    for (const [id, handle] of scheduledTimers.current) {
      const msg = state.messages.find((m) => m.id === id)
      if (!msg || msg.status !== 'scheduled') {
        window.clearTimeout(handle)
        scheduledTimers.current.delete(id)
      }
    }
  }, [state.messages, scheduleMessagePipeline])

  const value = useMemo(() => ({ state, dispatch, actions }), [state, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useWhatsAppStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useWhatsAppStore must be used within WhatsAppStoreProvider')
  return ctx
}

export { conversationKey }
