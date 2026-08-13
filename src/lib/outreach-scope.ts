import type { CampaignParticipantIndex } from '../components/inbox/inbox-campaign-rows'
import { participantIndexKey } from '../components/inbox/inbox-campaign-rows'
import type {
  Campaign,
  CampaignAiMode,
  CampaignAiObjective,
  Conversation,
  ConversationIntent,
} from '../types'
import { AD_HOC_CAMPAIGN_ID } from '../types'

export const AI_OBJECTIVE_LABELS: Record<CampaignAiObjective, string> = {
  gauge_interest: 'Gauge interest',
  collect_pricing: 'Collect pricing',
  negotiate: 'Negotiate terms',
  confirm_booking: 'Confirm booking',
}

export const AI_MODE_LABELS: Record<CampaignAiMode, string> = {
  assist: 'Assist — suggest replies',
  auto: 'Auto — classify on receive',
  off: 'Off — manual only',
}

export type ParticipantScopeData = {
  conversationIntent?: ConversationIntent | null
  tags?: string[]
  extractedPricing?: { amount?: number; currency?: string; notes?: string | null } | null
  outcome?: string
  intentSource?: 'ai' | 'manual'
  intentConfidence?: number | null
  aiSummary?: string | null
}

/** Creator × campaign scope — single unit for AI intent, tags, and reply assist. */
export type OutreachAiScope = {
  scopeKey: string
  campaignId: string
  influencerId: string
  conversationId: string
  campaignName: string
  aiObjective: CampaignAiObjective
  aiMode: CampaignAiMode
  /** True when assist/auto features should surface in the UI */
  aiFeaturesEnabled: boolean
  /** Backend auto-classify on inbound (campaign.ai_mode === 'auto') */
  aiAutoClassify: boolean
  participant: ParticipantScopeData | null
  intent: ConversationIntent | undefined
  labels: string[]
  extractedPricing: ParticipantScopeData['extractedPricing']
  isAdHoc: boolean
  isDbCampaign: boolean
}

export function outreachScopeKey(campaignId: string, influencerId: string): string {
  return participantIndexKey(campaignId, influencerId)
}

function participantFromIndex(
  participantIndex: CampaignParticipantIndex,
  campaignId: string,
  influencerId: string,
): ParticipantScopeData | null {
  const raw = participantIndex[outreachScopeKey(campaignId, influencerId)]
  if (!raw) return null
  return {
    conversationIntent: raw.conversation_intent ?? null,
    tags: raw.tags,
    extractedPricing: raw.extracted_pricing ?? null,
    outcome: raw.outcome,
    intentSource: raw.intent_source,
    intentConfidence: raw.intent_confidence ?? null,
    aiSummary: raw.ai_summary ?? null,
  }
}

export function buildOutreachAiScope(input: {
  campaignId: string
  conversationId: string
  influencerId: string
  campaign?: Campaign | null
  conversation?: Conversation | null
  participantIndex: CampaignParticipantIndex
}): OutreachAiScope {
  const { campaignId, conversationId, influencerId, campaign, conversation, participantIndex } =
    input
  const isAdHoc = campaignId === AD_HOC_CAMPAIGN_ID
  const isDbCampaign = Boolean(campaign?.source === 'db' && !isAdHoc)
  const aiObjective = campaign?.aiObjective || 'gauge_interest'
  const aiMode = campaign?.aiMode || 'assist'
  const participant =
    isAdHoc ? null : participantFromIndex(participantIndex, campaignId, influencerId)
  const intent =
    participant?.conversationIntent ?? conversation?.intent ?? undefined
  const labels =
    participant?.tags && participant.tags.length > 0
      ? participant.tags
      : conversation?.labels || []

  return {
    scopeKey: outreachScopeKey(campaignId, influencerId),
    campaignId,
    influencerId,
    conversationId,
    campaignName: isAdHoc ? 'Ad-hoc' : campaign?.name || 'Campaign',
    aiObjective,
    aiMode,
    aiFeaturesEnabled: !isAdHoc && aiMode !== 'off',
    aiAutoClassify: !isAdHoc && aiMode === 'auto',
    participant,
    intent,
    labels,
    extractedPricing: participant?.extractedPricing ?? null,
    isAdHoc,
    isDbCampaign,
  }
}

export function resolveSelectedInboxScope(
  state: {
    selectedConversationId: string | null
    selectedInboxCampaignId: string | null
    conversations: Conversation[]
    campaigns: Campaign[]
    campaignParticipantIndex: CampaignParticipantIndex
  },
  campaignIdOverride?: string | null,
): OutreachAiScope | null {
  const conversationId = state.selectedConversationId
  if (!conversationId) return null
  const conversation = state.conversations.find((c) => c.id === conversationId)
  if (!conversation) return null
  const campaignId =
    campaignIdOverride ??
    state.selectedInboxCampaignId ??
    conversation.lastCampaignId ??
    AD_HOC_CAMPAIGN_ID
  const campaign = state.campaigns.find((c) => c.id === campaignId)
  return buildOutreachAiScope({
    campaignId,
    conversationId,
    influencerId: conversation.influencerId,
    campaign,
    conversation,
    participantIndex: state.campaignParticipantIndex,
  })
}
