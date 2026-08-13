import { useMemo } from 'react'
import {
  buildOutreachAiScope,
  resolveSelectedInboxScope,
  type OutreachAiScope,
} from '../lib/outreach-scope'
import { useWhatsAppStore } from '../store/WhatsAppStore'

/** Resolve creator × campaign AI scope for the active inbox thread. */
export function useOutreachScope(campaignId?: string | null): OutreachAiScope | null {
  const { state } = useWhatsAppStore()
  return useMemo(() => {
    if (campaignId) {
      const conversationId = state.selectedConversationId
      if (!conversationId) return null
      const conversation = state.conversations.find((c) => c.id === conversationId)
      if (!conversation) return null
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
    return resolveSelectedInboxScope(state)
  }, [
    campaignId,
    state.selectedConversationId,
    state.selectedInboxCampaignId,
    state.conversations,
    state.campaigns,
    state.campaignParticipantIndex,
  ])
}
