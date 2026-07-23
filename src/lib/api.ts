const DEFAULT_BASE = 'https://api.dev.getreelax.com'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE
).replace(/\/$/, '')

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
  is_template: boolean
  wamid: string | null
  status: string
  created_at: string
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
}) {
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
