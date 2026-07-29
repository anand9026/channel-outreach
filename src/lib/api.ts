const DEFAULT_BASE = 'https://api.dev.getreelax.com'
const DEFAULT_GMAIL_USER_ID = 'demo_user'
const DEFAULT_GMAIL_CHANNEL_ID = 'default'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE
).replace(/\/$/, '')

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
}) {
  const q = new URLSearchParams()
  q.set('user_id', input?.user_id || GMAIL_USER_ID)
  q.set('channel_id', input?.channel_id || GMAIL_CHANNEL_ID)
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
  last_message_at: string
  last_preview: string
  last_inbound_at: string | null
  unread_count: number
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
}) {
  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/whatsapp-outreach/messages/text',
    {
      method: 'POST',
      body: JSON.stringify({
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
        to: input.to.replace(/^\+/, ''),
        template_name: input.template_name,
        language_code: input.language_code || 'en_US',
        components,
        phone_number_id: input.phone_number_id,
        preview_body: input.preview_body,
      }),
    },
  )
  return res.data
}

export async function listWhatsAppInbox() {
  const res = await request<ApiSuccess<{ threads?: InboxThread[] }>>(
    '/whatsapp-outreach/inbox',
  )
  return res.data?.threads ?? []
}

export async function getWhatsAppInboxMessages(phone: string) {
  const q = new URLSearchParams({ phone: phone.replace(/\D/g, '') })
  const res = await request<
    ApiSuccess<{ phone?: string; messages?: InboxMessage[] }>
  >(`/whatsapp-outreach/inbox/messages?${q}`)
  return res.data?.messages ?? []
}

export async function getGmailConnectUrl(input?: {
  user_id?: string
  channel_id?: string
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
}) {
  const res = await request<ApiSuccess<Record<string, unknown>>>(
    '/gmail-outreach/messages/template',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: input.user_id || GMAIL_USER_ID,
        channel_id: input.channel_id || GMAIL_CHANNEL_ID,
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
