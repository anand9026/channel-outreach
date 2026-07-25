import type {
  Brand,
  Campaign,
  CampaignAnalytics,
  CampaignChannel,
  ChannelMetrics,
  CollectionList,
  Conversation,
  EmailAccount,
  Influencer,
  InstagramAccount,
  Message,
  Organization,
  TeamMember,
  Template,
  WhatsAppNumber,
} from '../types'

export const ORG_ID = 'org_nova_beauty'

export const emptyMetrics = (): ChannelMetrics => ({
  sent: 0,
  delivered: 0,
  read: 0,
  replied: 0,
  failed: 0,
})

export const seedOrganization: Organization = {
  id: ORG_ID,
  name: 'Nova Beauty Co.',
}

/** Multi-brand org. An org with zero brands is also valid — campaigns use brandId: null. */
export const seedBrands: Brand[] = [
  {
    id: 'brand_glow',
    organizationId: ORG_ID,
    name: 'Glow Lab',
    shortName: 'Glow',
  },
  {
    id: 'brand_hair',
    organizationId: ORG_ID,
    name: 'Nova Hair',
    shortName: 'Hair',
  },
]

export const seedInfluencers: Influencer[] = [
  {
    id: 'inf_1',
    name: 'Priya Sharma',
    handle: '@priyabeauty',
    phone: '+91 98765 43210',
    email: 'priya.sharma@example.com',
    followers: '842K',
    niche: 'Skincare',
  },
  {
    id: 'inf_2',
    name: 'Ananya Reddy',
    handle: '@ananyaglow',
    phone: '+91 91234 56789',
    email: 'ananya.reddy@example.com',
    followers: '1.2M',
    niche: 'Makeup',
  },
  {
    id: 'inf_3',
    name: 'Meera Kapoor',
    handle: '@meerastyle',
    phone: '+91 99887 76655',
    email: 'meera.kapoor@example.com',
    followers: '560K',
    niche: 'Fashion',
  },
  {
    id: 'inf_4',
    name: 'Sneha Iyer',
    handle: '@snehalooks',
    phone: '+91 87654 32109',
    email: 'sneha.iyer@example.com',
    followers: '320K',
    niche: 'Lifestyle',
  },
  {
    id: 'inf_5',
    name: 'Riya Malhotra',
    handle: '@riyabeautyhub',
    phone: '+91 90123 45678',
    email: 'riya.malhotra@example.com',
    followers: '2.1M',
    niche: 'Beauty',
  },
  {
    id: 'inf_6',
    name: 'Kavya Nair',
    handle: '@kavyacreates',
    phone: '+91 88990 11223',
    email: 'kavya.nair@example.com',
    followers: '410K',
    niche: 'UGC',
  },
  {
    id: 'inf_7',
    name: 'Ishaan Verma',
    handle: '@ishaanfits',
    phone: '+91 90011 22334',
    email: 'ishaan.verma@example.com',
    followers: '190K',
    niche: 'Fitness',
  },
  {
    id: 'inf_8',
    name: 'Nisha Patel',
    handle: '@nishaeats',
    phone: '+91 98877 66554',
    email: 'nisha.patel@example.com',
    followers: '275K',
    niche: 'Food',
  },
]

/** Reelax collection lists (MySQL collection + collection_influencer). */
export const seedCollections: CollectionList[] = [
  {
    id: 'col_beauty_tier_a',
    organizationId: ORG_ID,
    brandId: 'brand_glow',
    name: 'Beauty Tier A',
    campaignId: null,
    influencerIds: ['inf_1', 'inf_2', 'inf_5'],
    createdAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'col_ugc_sprint',
    organizationId: ORG_ID,
    brandId: null,
    name: 'UGC Sprint List',
    campaignId: null,
    influencerIds: ['inf_4', 'inf_6', 'inf_8'],
    createdAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'col_hair_launch',
    organizationId: ORG_ID,
    brandId: 'brand_hair',
    name: 'Hair Launch Shortlist',
    campaignId: 'camp_festive_lookbook',
    influencerIds: ['inf_1', 'inf_3', 'inf_5'],
    createdAt: '2026-07-01T10:00:00Z',
  },
]

/** Org CRM — Reelax Mongo `my-creators-{env}` (subset of catalog saved to org). */
export const seedMyCreatorIds: string[] = [
  'inf_1',
  'inf_3',
  'inf_4',
  'inf_6',
  'inf_7',
  'inf_8',
]

export const seedCampaigns: Campaign[] = [
  {
    id: 'camp_summer_glow',
    organizationId: ORG_ID,
    brandId: 'brand_glow',
    name: 'Summer Glow Launch',
    kind: 'marketing',
    audienceSource: 'campaign_roster',
    collectionId: null,
    status: 'active',
    influencerIds: ['inf_1', 'inf_2', 'inf_5'],
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'camp_monsoon_hydration',
    organizationId: ORG_ID,
    brandId: 'brand_glow',
    name: 'Monsoon Hydration Push',
    kind: 'marketing',
    audienceSource: 'campaign_roster',
    collectionId: null,
    status: 'active',
    influencerIds: ['inf_3', 'inf_4', 'inf_6'],
    createdAt: '2026-06-15T10:00:00Z',
  },
  {
    id: 'camp_festive_lookbook',
    organizationId: ORG_ID,
    brandId: 'brand_hair',
    name: 'Festive Lookbook 2026',
    kind: 'marketing',
    audienceSource: 'campaign_roster',
    collectionId: null,
    status: 'draft',
    influencerIds: ['inf_1', 'inf_3', 'inf_5', 'inf_6'],
    createdAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'camp_org_recruit',
    organizationId: ORG_ID,
    brandId: null,
    name: 'Creator Network Recruit (org-wide)',
    kind: 'marketing',
    audienceSource: 'campaign_roster',
    collectionId: null,
    status: 'active',
    influencerIds: ['inf_2', 'inf_4', 'inf_6'],
    createdAt: '2026-07-10T10:00:00Z',
  },
  {
    id: 'camp_outreach_beauty',
    organizationId: ORG_ID,
    brandId: 'brand_glow',
    name: 'WA outreach · Beauty Tier A',
    kind: 'outreach',
    audienceSource: 'collection',
    collectionId: 'col_beauty_tier_a',
    status: 'draft',
    influencerIds: ['inf_1', 'inf_2', 'inf_5'],
    createdAt: '2026-07-15T10:00:00Z',
  },
]

export const seedTemplates: Template[] = [
  {
    id: 'tpl_collab_invite',
    organizationId: ORG_ID,
    brandId: null,
    channel: 'whatsapp',
    name: 'collab_invite_v2',
    category: 'MARKETING',
    language: 'en',
    body: 'Hi {{1}}, we love your {{2}} content! {{3}} would like to invite you to our {{4}} campaign. Reply YES to learn more.',
    variables: ['1', '2', '3', '4'],
    bindings: [
      { slot: '1', field: 'influencer.first_name' },
      { slot: '2', field: 'influencer.niche' },
      { slot: '3', field: 'brand.name' },
      { slot: '4', field: 'campaign.name' },
    ],
    status: 'APPROVED',
    createdAt: '2026-05-20T08:00:00Z',
    updatedAt: '2026-05-22T14:00:00Z',
  },
  {
    id: 'tpl_brief_reminder',
    organizationId: ORG_ID,
    brandId: null,
    channel: 'whatsapp',
    name: 'brief_reminder',
    category: 'UTILITY',
    language: 'en',
    body: 'Hello {{1}}, friendly reminder: your content brief for {{2}} is due soon. Need help? Reply here.',
    variables: ['1', '2'],
    bindings: [
      { slot: '1', field: 'influencer.first_name' },
      { slot: '2', field: 'campaign.name' },
    ],
    status: 'APPROVED',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-02T09:00:00Z',
  },
  {
    id: 'tpl_email_collab',
    organizationId: ORG_ID,
    brandId: null,
    channel: 'email',
    name: 'email_collab_invite',
    category: 'MARKETING',
    language: 'en',
    subject: 'Collaboration invite: {{1}} × {{2}}',
    body: 'Hi {{3}},\n\nWe love your {{4}} content and would like to invite you to {{1}}.\n\nReply if you are interested — we will share the brief and rates.\n\nBest,\n{{5}} Partnerships',
    variables: ['1', '2', '3', '4', '5'],
    bindings: [
      { slot: '1', field: 'campaign.name' },
      { slot: '2', field: 'brand.name' },
      { slot: '3', field: 'influencer.first_name' },
      { slot: '4', field: 'influencer.niche' },
      { slot: '5', field: 'org.name' },
    ],
    status: 'ACTIVE',
    createdAt: '2026-05-20T08:00:00Z',
    updatedAt: '2026-05-22T14:00:00Z',
  },
  {
    id: 'tpl_email_brief',
    organizationId: ORG_ID,
    brandId: null,
    channel: 'email',
    name: 'email_brief_followup',
    category: 'UTILITY',
    language: 'en',
    subject: 'Brief reminder for {{1}}',
    body: 'Hello {{2}},\n\nFriendly reminder that your content brief for {{1}} is coming up.\n\nReply if you need anything from our team.\n\nThanks,\n{{3}}',
    variables: ['1', '2', '3'],
    bindings: [
      { slot: '1', field: 'campaign.name' },
      { slot: '2', field: 'influencer.first_name' },
      { slot: '3', field: 'org.name' },
    ],
    status: 'ACTIVE',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-02T09:00:00Z',
  },
]

export const seedTeam: TeamMember[] = [
  { id: 'tm_1', name: 'Alex Morgan', initials: 'AM' },
  { id: 'tm_2', name: 'Jordan Lee', initials: 'JL' },
  { id: 'tm_3', name: 'Sam Patel', initials: 'SP' },
]

export function conversationKey(
  organizationId: string,
  channel: 'whatsapp' | 'email',
  accountId: string,
  influencerId: string,
): string {
  return `${organizationId}:${channel}:${accountId}:${influencerId}`
}

/** Start disconnected so Home shows the empty connect CTA by default. */
export const seedWhatsAppNumbers: WhatsAppNumber[] = []

export const seedEmailAccounts: EmailAccount[] = []
export const seedInstagramAccounts: InstagramAccount[] = []
export const seedChannels: CampaignChannel[] = []
export const seedConversations: Conversation[] = []
export const seedMessages: Message[] = []

export const seedAnalytics: CampaignAnalytics[] = seedCampaigns.map((c) => ({
  campaignId: c.id,
  whatsapp: emptyMetrics(),
  email: emptyMetrics(),
  instagram: emptyMetrics(),
}))
