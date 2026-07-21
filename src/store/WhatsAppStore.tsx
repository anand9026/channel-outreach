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
  seedMessages,
  seedMyCreatorIds,
  seedOrganization,
  seedTeam,
  seedTemplates,
  seedWhatsAppNumbers,
} from '../data/seed'
import { extractSlots, mergeBindings, renderWithBindings } from '../lib/variables'
import type {
  AudienceSource,
  Brand,
  Campaign,
  CampaignAnalytics,
  CampaignChannel,
  CollectionList,
  ConnectionMode,
  Conversation,
  DeliveryStatus,
  EmailAccount,
  EmailProvider,
  Influencer,
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
      }
    }
  | { type: 'ADVANCE_MESSAGE_STATUS'; messageId: string; status: DeliveryStatus }
  | { type: 'SIMULATE_INBOUND'; conversationId: string; body: string }
  | { type: 'SEND_REPLY'; conversationId: string; body: string }
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
  channels: seedChannels,
  conversations: seedConversations,
  messages: seedMessages,
  analytics: seedAnalytics,
  team: seedTeam,
  activeTab: 'floor',
  selectedCampaignId: seedCampaigns[0]?.id ?? null,
  brandFilter: 'all',
  selectedConversationId: null,
  toasts: [],
  connectModalOpen: false,
  connectStep: 0,
  connectKind: 'whatsapp',
  emailModalOpen: false,
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export function connectionMode(state: Pick<AppState, 'whatsAppNumbers' | 'emailAccounts'>): ConnectionMode {
  const wa = state.whatsAppNumbers.length > 0
  const em = state.emailAccounts.length > 0
  if (wa && em) return 'both'
  if (wa) return 'whatsapp'
  if (em) return 'email'
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
      return {
        ...state,
        emailAccounts: [...state.emailAccounts, account],
        emailModalOpen: false,
        activeTab: 'floor',
      }
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
      const { campaignId, influencerIds, whatsapp, email } = action.payload
      if (influencerIds.length === 0) return state

      let channels = [...state.channels]
      const upsert = (
        channel: OutreachChannel,
        extra: Partial<CampaignChannel> & { templateId: string },
      ) => {
        const existing = findChannel(channels, campaignId, channel)
        if (existing) {
          channels = channels.map((ch) =>
            ch.id === existing.id
              ? {
                  ...ch,
                  ...extra,
                  selectedInfluencerIds: influencerIds,
                  status: 'draft' as const,
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
          status: 'draft',
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

      return reducer(
        { ...state, channels },
        { type: 'SEND_CHANNELS', channelIds },
      )
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
      return {
        ...state,
        messages: [...state.messages, msg],
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
      }
    }
    case 'SEND_REPLY': {
      const conv = state.conversations.find((c) => c.id === action.conversationId)
      if (!conv) return state
      if (conv.channel === 'whatsapp') {
        if (!conv.lastInboundAt) return state
        if (Date.now() - new Date(conv.lastInboundAt).getTime() >= 24 * 60 * 60 * 1000) {
          return state
        }
      }
      const ts = nowIso()
      const msg: Message = {
        id: uid('msg'),
        conversationId: conv.id,
        organizationId: ORG_ID,
        channel: conv.channel,
        direction: 'outbound',
        body: action.body,
        status: 'sent',
        isTemplate: false,
        createdAt: ts,
        metaMessageId:
          conv.channel === 'whatsapp' ? `wamid.${uid('meta')}` : `email.${uid('out')}`,
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
          },
          ...state.analytics,
        ],
        selectedCampaignId: id,
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
    }) => void
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
  }
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function WhatsAppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

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
      connectWhatsApp: (data) => {
        dispatch({ type: 'CONNECT_WHATSAPP', payload: data })
        toast('WhatsApp Business number connected', 'success')
      },
      connectEmail: (data) => {
        dispatch({ type: 'CONNECT_EMAIL', payload: data })
        toast('Email sending domain connected', 'success')
      },
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
    ],
  )

  const prevMessageCount = useRef(state.messages.length)
  const pipelined = useRef(new Set<string>())

  useEffect(() => {
    if (state.messages.length <= prevMessageCount.current) {
      prevMessageCount.current = state.messages.length
      return
    }
    const newMessages = state.messages.slice(prevMessageCount.current)
    prevMessageCount.current = state.messages.length
    for (const msg of newMessages) {
      if (msg.status === 'queued' && msg.direction === 'outbound' && !pipelined.current.has(msg.id)) {
        pipelined.current.add(msg.id)
        scheduleMessagePipeline(msg.id)
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
