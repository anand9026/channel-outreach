const DEFAULT_BASE = 'https://api.dev.getreelax.com'
const DEFAULT_GMAIL_USER_ID = 'demo_user'
const DEFAULT_GMAIL_CHANNEL_ID = 'default'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE
).replace(/\/$/, '')

/** Env fallback when org_id is not passed on the request or in the URL. */
export const OUTREACH_ORG_ID = (
  import.meta.env.VITE_OUTREACH_ORG_ID || 'mq3cl6'
).slice(0, 6)

/**
 * Resolve org_id for API calls (CHAR(6)).
 * Priority: explicit argument → ?org_id= URL param → VITE_OUTREACH_ORG_ID env.
 * Auth-token org resolution can replace this later.
 */
export function resolveOrgId(explicit?: string | null): string {
  if (explicit != null && String(explicit).trim()) {
    return String(explicit).trim().slice(0, 6)
  }
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('org_id')
    if (fromUrl && fromUrl.trim()) {
      return fromUrl.trim().slice(0, 6)
    }
  }
  return OUTREACH_ORG_ID
}

export const GMAIL_USER_ID =
  import.meta.env.VITE_GMAIL_USER_ID || DEFAULT_GMAIL_USER_ID

export const GMAIL_CHANNEL_ID =
  import.meta.env.VITE_GMAIL_CHANNEL_ID || DEFAULT_GMAIL_CHANNEL_ID

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function extractErrorMessage(json: unknown, fallback: string): string {
  if (typeof json !== 'object' || !json) return fallback

  const body = json as {
    success?: boolean
    err_l?: Array<{ m?: string; c?: string }>
    error?: { message?: string }
    message?: string
  }

  if (Array.isArray(body.err_l) && body.err_l[0]?.m) {
    return body.err_l[0].m
  }
  if (body.error?.message) return body.error.message
  if (typeof body.message === 'string') return body.message
  return fallback
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  let json: unknown = null
  const text = await res.text()
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
  }

  const apiFailed =
    typeof json === 'object' &&
    json !== null &&
    'success' in json &&
    (json as { success?: boolean }).success === false

  if (!res.ok || apiFailed) {
    throw new ApiError(
      extractErrorMessage(json, `Request failed (${res.status})`),
      res.status,
      json,
    )
  }

  return json as T
}

function withGmailScopeParams(input?: {
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const q = new URLSearchParams()
  q.set('user_id', input?.user_id || GMAIL_USER_ID)
  q.set('channel_id', input?.channel_id || GMAIL_CHANNEL_ID)
  q.set('org_id', resolveOrgId(input?.org_id))
  return q
}

function withOrgParams(input?: { org_id?: string }) {
  const q = new URLSearchParams()
  q.set('org_id', resolveOrgId(input?.org_id))
  return q
}

export type ConnectionInfo = {
  phone_number_id: string | null
  waba_id: string | null
  graph_api_version: string
  has_access_token: boolean
  webhook_verify_token_configured?: boolean
}

export type InboxThread = {
  phone: string
  display_name: string
  phone_number_id: string | null
  outreach_thread_id?: string
  outreach_conversation_id?: string
  last_message_at: string
  last_preview: string
  last_inbound_at: string | null
  unread_count: number
  status?: string
  medium?: string
}

export type InboxMessage = {
  id: string
  phone: string
  direction: 'inbound' | 'outbound'
  body: string
  message_type?: string
  media_id?: string | null
  mime_type?: string | null
  caption?: string | null
  emoji?: string | null
  is_template: boolean
  wamid: string | null
  status: string
  created_at: string
}

export type GmailConnectionInfo = {
  user_id: string
  channel_id: string
  connected: boolean
  email_address: string | null
  token_expiry: string | null
  has_refresh_token: boolean
  scopes: string[]
}

export type GmailTemplate = {
  template_name: string
  subject_template: string
  html_template: string
  text_template?: string
  variables_schema?: unknown
  updated_at: string
}

export type GmailThreadMeta = {
  thread_id: string
  to: string | null
  from?: string | null
  subject: string | null
  snippet: string | null
  last_message_at: string
  message_count: number
  message_id?: string | null
  updated_at?: string
  history_id?: string | null
}

export type GmailThreadMessage = {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound' | 'unknown'
  from: string
  to: string
  subject: string
  snippet: string
  date: string | null
  internal_date: string
}

export function whatsappMediaUrl(mediaId: string) {
  return `${API_BASE_URL}/whatsapp-outreach/media/${encodeURIComponent(mediaId)}`
}

export type MetaTemplate = {
  id: string
  name: string
  status: string
  category: string
  language: string
  components?: Array<{
    type: string
    text?: string
    example?: { body_text?: string[][] }
  }>
}

type ApiSuccess<T> = {
  success?: boolean
  data?: T
}

export async function getWhatsAppConnection() {
  const res = await request<ApiSuccess<ConnectionInfo>>(
    '/whatsapp-outreach/connection',
  )
  return res.data
}

export async function listWhatsAppTemplates(params?: {
  name?: string
  status?: string
  limit?: number
}) {
  const q = new URLSearchParams()
  if (params?.name) q.set('name', params.name)
  if (params?.status) q.set('status', params.status)
  if (params?.limit) q.set('limit', String(params.limit))
  const qs = q.toString()
  const res = await request<ApiSuccess<{ data?: MetaTemplate[] }>>(
    `/whatsapp-outreach/templates${qs ? `?${qs}` : ''}`,
  )
  return res.data?.data ?? []
}

export async function createWhatsAppTemplate(input: {
  name: string
  language?: string
  category?: string
  body: string
  exampleValues?: string[]
  /**
   * Optional richer components. When supplied, `components` fully replaces
   * the auto-generated BODY block. Use this to send HEADER / FOOTER / BUTTONS
   * to Meta together with the body.
   */
  components?: Array<Record<string, unknown>>
}) {
  if (input.components && input.components.length > 0) {
    const res = await request<ApiSuccess<Record<string, unknown>>>(
      '/whatsapp-outreach/templates',
      {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          language: input.language || 'en_US',
          category: input.category || 'UTILITY',
          components: input.components,
        }),
      },
    )
    return res.data
  }

  const slots = [...input.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])
  const uniqueSlots = [...new Set(slots)].sort(
    (a, b) => Number(a) - Number(b),
  )

  const exampleRow =
    input.exampleValues && input.exampleValues.length
      ? input.exampleValues
      : uniqueSlots.map((s) => `example_${s}`)

  const bodyComponent: Record<string, unknown> = {
    type: 'BODY',
    text: input.body,
  }
  if (uniqueSlots.length > 0) {
    bodyComponent.example = { body_text: [exampleRow] }
  }

  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/whatsapp-outreach/templates',
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        language: input.language || 'en_US',
        category: input.category || 'UTILITY',
        components: [bodyComponent],
      }),
    },
  )
  return res.data
}

export async function sendWhatsAppText(input: {
  to: string
  text: string
  phone_number_id?: string
  org_id?: string
}) {
  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/whatsapp-outreach/messages/text',
    {
      method: 'POST',
      body: JSON.stringify({
        org_id: resolveOrgId(input.org_id),
        to: input.to.replace(/^\+/, ''),
        text: input.text,
        phone_number_id: input.phone_number_id,
      }),
    },
  )
  return res.data
}

export async function sendWhatsAppTemplate(input: {
  to: string
  template_name: string
  language_code?: string
  bodyParams?: string[]
  phone_number_id?: string
  preview_body?: string
  org_id?: string
  outreach_campaign_id?: string
}) {
  const components =
    input.bodyParams && input.bodyParams.length
      ? [
          {
            type: 'body',
            parameters: input.bodyParams.map((text) => ({
              type: 'text',
              text,
            })),
          },
        ]
      : undefined

  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/whatsapp-outreach/messages/template',
    {
      method: 'POST',
      body: JSON.stringify({
        org_id: resolveOrgId(input.org_id),
        to: input.to.replace(/^\+/, ''),
        template_name: input.template_name,
        language_code: input.language_code || 'en_US',
        components,
        phone_number_id: input.phone_number_id,
        preview_body: input.preview_body,
        outreach_campaign_id: input.outreach_campaign_id,
      }),
    },
  )
  return res.data
}

export async function listWhatsAppInbox(org_id?: string) {
  const q = withOrgParams({ org_id })
  const res = await request<ApiSuccess<{ threads?: InboxThread[] }>>(
    `/whatsapp-outreach/inbox?${q.toString()}`,
  )
  return res.data?.threads ?? []
}

export async function getWhatsAppInboxMessages(phone: string, org_id?: string) {
  const q = new URLSearchParams({
    phone: phone.replace(/\D/g, ''),
    org_id: resolveOrgId(org_id),
  })
  const res = await request<
    ApiSuccess<{ phone?: string; messages?: InboxMessage[] }>
  >(`/whatsapp-outreach/inbox/messages?${q}`)
  return res.data?.messages ?? []
}

export async function getGmailConnectUrl(input?: {
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const q = withGmailScopeParams(input)
  const res = await request<
    ApiSuccess<{ user_id: string; channel_id: string; oauth_url: string }>
  >(`/gmail-outreach/connect?${q.toString()}`)
  return res.data
}

export async function getGmailConnection(input?: {
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const q = withGmailScopeParams(input)
  const res = await request<ApiSuccess<GmailConnectionInfo>>(
    `/gmail-outreach/connection?${q.toString()}`,
  )
  return res.data
}

export async function createGmailTemplate(input: {
  user_id?: string
  channel_id?: string
  org_id?: string
  template_name: string
  subject_template: string
  html_template: string
  text_template?: string
  variables_schema?: unknown
}) {
  const res = await request<ApiSuccess<GmailTemplate>>('/gmail-outreach/templates', {
    method: 'POST',
    body: JSON.stringify({
      user_id: input.user_id || GMAIL_USER_ID,
      channel_id: input.channel_id || GMAIL_CHANNEL_ID,
      org_id: resolveOrgId(input.org_id),
      template_name: input.template_name,
      subject_template: input.subject_template,
      html_template: input.html_template,
      text_template: input.text_template,
      variables_schema: input.variables_schema,
    }),
  })
  return res.data
}

export async function listGmailTemplates(input?: {
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const q = withGmailScopeParams(input)
  const res = await request<ApiSuccess<{ templates?: GmailTemplate[] }>>(
    `/gmail-outreach/templates?${q.toString()}`,
  )
  return res.data?.templates ?? []
}

export async function getGmailTemplate(input: {
  template_name: string
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const q = withGmailScopeParams(input)
  q.set('template_name', input.template_name)
  const res = await request<ApiSuccess<GmailTemplate>>(
    `/gmail-outreach/template?${q.toString()}`,
  )
  return res.data
}

export async function sendGmailTemplate(input: {
  to: string
  template_name: string
  variables?: Record<string, string>
  reply_to?: string
  thread_id?: string
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/gmail-outreach/messages/template',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: input.user_id || GMAIL_USER_ID,
        channel_id: input.channel_id || GMAIL_CHANNEL_ID,
        org_id: resolveOrgId(input.org_id),
        to: input.to,
        template_name: input.template_name,
        variables: input.variables,
        reply_to: input.reply_to,
        thread_id: input.thread_id,
      }),
    },
  )
  return res.data
}

/** Freeform send — email anyone from the connected Gmail account. */
export async function sendGmailMessage(input: {
  to: string
  subject: string
  body: string
  html_body?: string
  text_body?: string
  reply_to?: string
  thread_id?: string
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const res = await request<
    ApiSuccess<{
      id?: string
      threadId?: string
      to?: string
      subject?: string
    }>
  >('/gmail-outreach/messages/send', {
    method: 'POST',
    body: JSON.stringify({
      user_id: input.user_id || GMAIL_USER_ID,
      channel_id: input.channel_id || GMAIL_CHANNEL_ID,
      org_id: resolveOrgId(input.org_id),
      to: input.to,
      subject: input.subject,
      body: input.body,
      html_body: input.html_body,
      text_body: input.text_body ?? input.body,
      reply_to: input.reply_to,
      thread_id: input.thread_id,
    }),
  })
  return res.data
}

export async function listGmailThreads(input?: {
  user_id?: string
  channel_id?: string
  org_id?: string
  limit?: number
}) {
  const q = withGmailScopeParams(input)
  if (input?.limit) q.set('limit', String(input.limit))
  const res = await request<ApiSuccess<{ threads?: GmailThreadMeta[] }>>(
    `/gmail-outreach/threads?${q.toString()}`,
  )
  return res.data?.threads ?? []
}

export async function getGmailThread(input: {
  thread_id: string
  user_id?: string
  channel_id?: string
  org_id?: string
}) {
  const q = withGmailScopeParams(input)
  q.set('thread_id', input.thread_id)
  const res = await request<
    ApiSuccess<{
      thread_id: string
      history_id?: string
      messages: GmailThreadMessage[]
    }>
  >(`/gmail-outreach/thread?${q.toString()}`)
  return res.data
}

export type OutreachChannelRow = {
  outreach_channel_id: string
  org_id: string
  user_id?: string | null
  brand_id?: string | null
  medium: 'whatsapp' | 'gmail' | 'instagram'
  account_label?: string | null
  account_address?: string | null
  display_name?: string | null
  display_phone_number?: string | null
  email_address?: string | null
  phone_number_id?: string | null
  waba_id?: string | null
  status?: string
  date_added: number
  date_modified: number
}

export type OutreachTemplateRow = {
  outreach_template_id: string
  org_id: string
  brand_id?: string | null
  medium: string
  name: string
  external_name?: string | null
  language?: string | null
  category?: string | null
  subject_template?: string | null
  body_template?: string | null
  html_template?: string | null
  variables_schema?: unknown
  status?: string
  date_added: number
  date_modified: number
}

export type OutreachMessageAttachment = {
  type?: string
  provider_media_id?: string | null
  mime_type?: string | null
  caption?: string | null
  filename?: string | null
}

export type OutreachMessageRow = {
  outreach_message_id: string
  org_id: string
  outreach_thread_id: string
  direction: 'inbound' | 'outbound'
  message_type?: string
  text_body?: string | null
  html_body?: string | null
  message_status?: string
  subject?: string | null
  provider_message_id?: string | null
  parent_provider_message_id?: string | null
  reply_to_message_id?: string | null
  attachments?: OutreachMessageAttachment[] | string | null
  has_attachment?: number | boolean
  attachment_count?: number
  error_message?: string | null
  ai_generated?: number | boolean
  ai_model?: string | null
  metadata?: Record<string, unknown> | string | null
  provider_created_at?: string | null
  provider_updated_at?: string | null
  delivered_at?: string | null
  read_at?: string | null
  failed_at?: string | null
  date_added: number
  date_modified: number
}

export type OutreachCollectionInfluencerRow = {
  influencer_id: string
  name: string
  handle: string
  phone: string
  email: string
  followers: string
  followers_raw?: number
  niche: string
  platform_id?: string | null
}

export type OutreachCollectionRow = {
  collection_id: string
  collection_name: string
  collection_type?: string | null
  org_id: string
  brand_id?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
  campaign_status?: string | null
  platform_id?: string | null
  description?: string | null
  influencer_count: number
  date_added?: string | null
  date_modified?: string | null
}

export type OutreachCampaignRow = {
  outreach_campaign_id: string
  org_id: string
  brand_id?: string | null
  platform_campaign_id?: string | null
  name: string
  description?: string | null
  kind: 'outreach' | 'marketing'
  status: string
  audience_type: string
  audience_ref_id?: string | null
  recipient_count?: number
  sent_count?: number
  failed_count?: number
  created_by_user_id: string
  date_added: number
  date_modified: number
}

export type OutreachThreadRow = {
  outreach_thread_id: string
  outreach_conversation_id: string
  medium: 'whatsapp' | 'gmail' | 'instagram'
  provider_thread_id: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  subject?: string | null
  last_preview?: string | null
  status: string
  unread_count: number
  last_message_at?: string | null
  last_inbound_at?: string | null
}

export async function listOutreachChannels(input?: {
  org_id?: string
  medium?: string
}) {
  const q = withOrgParams({ org_id: input?.org_id })
  if (input?.medium) q.set('medium', input.medium)
  const res = await request<ApiSuccess<{ channels?: OutreachChannelRow[] }>>(
    `/outreach/channels?${q.toString()}`,
  )
  return res.data?.channels ?? []
}

export async function listOutreachTemplates(input?: {
  org_id?: string
  medium?: string
}) {
  const q = withOrgParams({ org_id: input?.org_id })
  if (input?.medium) q.set('medium', input.medium)
  const res = await request<ApiSuccess<{ templates?: OutreachTemplateRow[] }>>(
    `/outreach/templates?${q.toString()}`,
  )
  return res.data?.templates ?? []
}

export type WhatsAppTemplateSyncSummary = {
  org_id: string
  status_filter: string
  meta_total: number
  created: number
  updated: number
  skipped: number
  errors?: Array<{ name: string; message: string }>
}

export async function syncOutreachWhatsAppTemplates(input?: {
  org_id?: string
  status?: string
  waba_id?: string
  limit?: number
}) {
  const res = await request<ApiSuccess<WhatsAppTemplateSyncSummary>>(
    '/outreach/templates/sync-whatsapp',
    {
      method: 'POST',
      body: JSON.stringify({
        org_id: resolveOrgId(input?.org_id),
        status: input?.status || 'APPROVED',
        waba_id: input?.waba_id,
        limit: input?.limit,
      }),
    },
  )
  return res.data
}

export async function createOutreachTemplate(input: {
  org_id?: string
  brand_id?: string
  medium: string
  name: string
  external_name?: string
  language?: string
  category?: string
  subject_template?: string
  body_template?: string
  html_template?: string
  bindings?: unknown
  variables_schema?: unknown
  status?: string
  created_by_user_id?: string
}) {
  const res = await request<ApiSuccess<OutreachTemplateRow>>('/outreach/templates', {
    method: 'POST',
    body: JSON.stringify({
      org_id: resolveOrgId(input.org_id),
      brand_id: input.brand_id,
      medium: input.medium,
      name: input.name,
      external_name: input.external_name,
      language: input.language,
      category: input.category,
      subject_template: input.subject_template,
      body_template: input.body_template,
      html_template: input.html_template,
      bindings: input.bindings,
      variables_schema: input.variables_schema,
      status: input.status,
      created_by_user_id: input.created_by_user_id || 'system',
    }),
  })
  return res.data
}

export async function listOutreachThreadMessages(input: {
  outreach_thread_id: string
  limit?: number
}) {
  const q = new URLSearchParams()
  q.set('outreach_thread_id', input.outreach_thread_id)
  if (input.limit) q.set('limit', String(input.limit))
  const res = await request<ApiSuccess<{ messages?: OutreachMessageRow[] }>>(
    `/outreach/threads/messages?${q.toString()}`,
  )
  return res.data?.messages ?? []
}

export async function getOutreachCampaign(
  outreach_campaign_id: string,
  org_id?: string,
) {
  const q = withOrgParams({ org_id })
  q.set('outreach_campaign_id', outreach_campaign_id)
  const res = await request<
    ApiSuccess<{
      campaign?: OutreachCampaignRow
      channels?: unknown[]
    }>
  >(`/outreach/campaign?${q.toString()}`)
  return res.data
}

export async function updateOutreachCampaign(input: {
  outreach_campaign_id: string
  org_id?: string
  status?: string
  sent_count?: number
  failed_count?: number
  delivered_count?: number
  read_count?: number
  replied_count?: number
  recipient_count?: number
}) {
  const res = await request<ApiSuccess<OutreachCampaignRow>>(
    '/outreach/campaigns/update',
    {
      method: 'POST',
      body: JSON.stringify({
        org_id: resolveOrgId(input.org_id),
        outreach_campaign_id: input.outreach_campaign_id,
        status: input.status,
        sent_count: input.sent_count,
        failed_count: input.failed_count,
        delivered_count: input.delivered_count,
        read_count: input.read_count,
        replied_count: input.replied_count,
        recipient_count: input.recipient_count,
      }),
    },
  )
  return res.data
}

export async function listOutreachCollections(org_id?: string, limit?: number) {
  const q = withOrgParams({ org_id })
  if (limit) q.set('limit', String(limit))
  const res = await request<ApiSuccess<{ collections?: OutreachCollectionRow[] }>>(
    `/outreach/collections?${q.toString()}`,
  )
  return res.data?.collections ?? []
}

export async function listOutreachCollectionInfluencers(input: {
  collection_id: string
  org_id?: string
  platform_id?: string
  limit?: number
}) {
  const q = withOrgParams({ org_id: input.org_id })
  q.set('collection_id', input.collection_id)
  if (input.platform_id) q.set('platform_id', input.platform_id)
  if (input.limit) q.set('limit', String(input.limit))
  const res = await request<
    ApiSuccess<{
      collection_id?: string
      org_id?: string
      influencers?: OutreachCollectionInfluencerRow[]
    }>
  >(`/outreach/collection-influencers?${q.toString()}`)
  return res.data?.influencers ?? []
}

export async function listOutreachCampaigns(org_id?: string) {
  const q = withOrgParams({ org_id })
  const res = await request<ApiSuccess<{ campaigns?: OutreachCampaignRow[] }>>(
    `/outreach/campaigns?${q.toString()}`,
  )
  return res.data?.campaigns ?? []
}

export async function createOutreachCampaign(input: {
  name: string
  audience_type: string
  audience_ref_id?: string
  kind?: 'outreach' | 'marketing'
  status?: string
  brand_id?: string
  platform_campaign_id?: string
  description?: string
  created_by_user_id?: string
  org_id?: string
}) {
  const res = await request<ApiSuccess<OutreachCampaignRow>>('/outreach/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      org_id: resolveOrgId(input.org_id),
      name: input.name,
      audience_type: input.audience_type,
      audience_ref_id: input.audience_ref_id,
      kind: input.kind || 'outreach',
      status: input.status || 'draft',
      brand_id: input.brand_id,
      platform_campaign_id: input.platform_campaign_id,
      description: input.description,
      created_by_user_id: input.created_by_user_id || 'system',
    }),
  })
  return res.data
}

export async function listOutreachThreads(input?: {
  org_id?: string
  medium?: string
  entity_type?: string
  entity_id?: string
  limit?: number
}) {
  const q = withOrgParams({ org_id: input?.org_id })
  if (input?.medium) q.set('medium', input.medium)
  if (input?.entity_type) q.set('entity_type', input.entity_type)
  if (input?.entity_id) q.set('entity_id', input.entity_id)
  if (input?.limit) q.set('limit', String(input.limit))
  const res = await request<ApiSuccess<{ threads?: OutreachThreadRow[] }>>(
    `/outreach/threads?${q.toString()}`,
  )
  return res.data?.threads ?? []
}

export async function createOutreachThreadLink(input: {
  outreach_thread_id: string
  entity_type: string
  entity_id: string
  link_source?: 'auto' | 'manual'
  org_id?: string
}) {
  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/outreach/thread-links',
    {
      method: 'POST',
      body: JSON.stringify({
        org_id: resolveOrgId(input.org_id),
        outreach_thread_id: input.outreach_thread_id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        link_source: input.link_source || 'manual',
      }),
    },
  )
  return res.data
}
