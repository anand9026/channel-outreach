export type OutreachChannel = 'whatsapp' | 'email' | 'instagram'
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED' | 'ACTIVE'
export type ConversationStatus = 'open' | 'pending' | 'resolved'
export type MessageDirection = 'outbound' | 'inbound'
export type DeliveryStatus =
  | 'queued'
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled'

/** Dual-channel waterfall: send A first, B only if no reply (after wait). */
export type ChannelOrder = 'whatsapp_first' | 'email_first'

export interface CascadeOptions {
  order: ChannelOrder
  /** ISO time for first channel; null/undefined = send immediately */
  firstAt?: string | null
  /** Product wait before follow-up channel (prototype compresses this in the UI timer) */
  waitHours: 24 | 48 | 72
  /** Cancel scheduled follow-up if influencer replies on the first channel */
  stopOnReply: boolean
}
export type PhoneQuality = 'GREEN' | 'YELLOW' | 'RED'
export type EmailProvider = 'gmail' | 'sendgrid' | 'ses' | 'smtp'
export type TabId = 'home' | 'floor' | 'connect' | 'templates' | 'campaigns' | 'inbox' | 'analytics' | 'quicksend'

/** Resolved at send-time from org / brand / campaign / influencer — not free-typed per send. */
export type DataFieldKey =
  | 'influencer.first_name'
  | 'influencer.full_name'
  | 'influencer.handle'
  | 'influencer.niche'
  | 'influencer.followers'
  | 'influencer.phone'
  | 'influencer.email'
  | 'brand.name'
  | 'brand.short_name'
  | 'org.name'
  | 'campaign.name'
  | 'literal'

export interface VariableBinding {
  slot: string
  field: DataFieldKey
  /** Only when field === 'literal' */
  literal?: string
}

export interface Organization {
  id: string
  name: string
}

/** Optional. Orgs may run outreach with zero brands (brandId null on campaigns). */
export interface Brand {
  id: string
  organizationId: string
  name: string
  shortName: string
}

export interface WhatsAppNumber {
  id: string
  organizationId: string
  displayName: string
  phoneDisplay: string
  phoneNumberId: string
  wabaId: string
  businessId: string
  qualityRating: PhoneQuality
  messagingTier: string
  connectedAt: string
}

export interface EmailAccount {
  id: string
  organizationId: string
  fromName: string
  fromEmail: string
  provider: EmailProvider
  domain: string
  verified: boolean
  connectedAt: string
  /** Gmail OAuth user id — required to call the Gmail API */
  userId?: string
}

export interface InstagramAccount {
  id: string
  organizationId: string
  /** Instagram handle without the @ */
  handle: string
  /** Business account display name */
  displayName: string
  /** Meta business asset id (mocked) */
  igUserId: string
  connectedAt: string
}

export interface Influencer {
  id: string
  name: string
  handle: string
  phone: string
  email: string
  followers: string
  niche: string
}

/** Reelax MySQL `collection` + `collection_influencer` — org shortlist for sends. */
export interface CollectionList {
  id: string
  organizationId: string
  brandId: string | null
  name: string
  /** Optional link to a marketing/outreach campaign */
  campaignId: string | null
  influencerIds: string[]
  /** Populated from API before influencer ids are loaded */
  influencerCount?: number
  createdAt: string
}

export function collectionCreatorCount(c: CollectionList): number {
  return c.influencerCount ?? c.influencerIds.length
}

/**
 * Audience for an outreach send.
 * - campaign_roster: influencers already on a marketing campaign
 * - collection: Reelax collection list (collection_id)
 * - my_creators: org CRM list (Mongo my-creators)
 */
export type AudienceSource = 'campaign_roster' | 'collection' | 'my_creators'
export type CampaignKind = 'marketing' | 'outreach'

export interface Campaign {
  id: string
  organizationId: string
  /** null = org-level campaign (no brand) */
  brandId: string | null
  name: string
  kind: CampaignKind
  status: 'draft' | 'active' | 'completed'
  /** How recipients were chosen for outreach */
  audienceSource: AudienceSource
  /** Set when audienceSource === 'collection' */
  collectionId: string | null
  /** Resolved influencer ids for send (from roster, collection, or my creators) */
  influencerIds: string[]
  createdAt: string
  /** Populated when synced from `/outreach/campaigns` */
  sentCount?: number
  failedCount?: number
  recipientCount?: number
  description?: string | null
  source?: 'db' | 'local'
}

export interface Template {
  id: string
  organizationId: string
  /** Optional scope — null means usable across brands / org-level */
  brandId: string | null
  channel: OutreachChannel
  name: string
  category: TemplateCategory
  language: string
  subject?: string
  body: string
  variables: string[]
  /** Default slot → data-field wiring saved with the template */
  bindings: VariableBinding[]
  status: TemplateStatus
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

export interface CampaignChannel {
  id: string
  campaignId: string
  organizationId: string
  channel: OutreachChannel
  phoneNumberId?: string
  emailAccountId?: string
  templateId: string
  /** Overrides template bindings for this send (slot → DataFieldKey or literal:value) */
  variableMapping: Record<string, string>
  selectedInfluencerIds: string[]
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
  scheduledAt?: string
  sentAt?: string
}

export type CampaignWhatsAppChannel = CampaignChannel

export interface Message {
  id: string
  conversationId: string
  organizationId: string
  channel: OutreachChannel
  /** Which campaign triggered this outbound (null for free-form replies) */
  campaignId?: string
  direction: MessageDirection
  subject?: string
  body: string
  status: DeliveryStatus
  isTemplate: boolean
  createdAt: string
  metaMessageId: string
  /** Shared id for a dual-channel cascade batch */
  cascadeId?: string
  /** 1 = first channel, 2 = follow-up */
  cascadeStep?: 1 | 2
  /** Product-facing scheduled time (ISO) */
  scheduledFor?: string
  /** Prototype timer: epoch ms when scheduled → queued */
  demoReleaseAt?: number
  /** WhatsApp media rendering (only set for messages coming from the Cloud API) */
  mediaId?: string | null
  mediaMime?: string | null
  mediaKind?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null
  caption?: string | null
  /** Emoji reactions from either side (mocked for non-live channels) */
  reactions?: Array<{ by: 'me' | 'them'; emoji: string; at: string }>
}

export interface Conversation {
  id: string
  organizationId: string
  channel: OutreachChannel
  phoneNumberId?: string
  emailAccountId?: string
  instagramAccountId?: string
  influencerId: string
  /**
   * Unified thread is org+channel+account+influencer (WhatsApp reality).
   * Multiple campaigns can contribute messages into the same thread.
   */
  campaignIds: string[]
  lastCampaignId?: string
  status: ConversationStatus
  assignedTo?: string
  lastInboundAt?: string
  lastMessageAt: string
  unreadCount: number
  lastPreview?: string
  /** True when this thread is sourced from a live channel API */
  isLive?: boolean
  /** Gmail thread id for live email conversations */
  gmailThreadId?: string
  /** Unified SQL thread id from outreach_threads */
  outreachThreadId?: string
  /** Provider-side thread key (phone digits, Gmail thread id, etc.) */
  providerThreadId?: string
  /** Free-form user labels for triage (hot lead / follow-up / vendor / …) */
  labels?: string[]
}

export interface TeamMember {
  id: string
  name: string
  initials: string
}

export interface ChannelMetrics {
  sent: number
  delivered: number
  read: number
  replied: number
  failed: number
}

export interface CampaignAnalytics {
  campaignId: string
  whatsapp: ChannelMetrics
  email: ChannelMetrics
  instagram: ChannelMetrics
}

export type ConnectionMode = 'none' | 'whatsapp' | 'email' | 'instagram' | 'both'
