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

  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json &&
      'error' in json &&
      typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : typeof json === 'object' &&
            json &&
            'message' in json &&
            typeof (json as { message?: string }).message === 'string'
          ? (json as { message: string }).message
          : `Request failed (${res.status})`
    throw new ApiError(msg, res.status, json)
  }

  return json as T
}

export type ConnectionInfo = {
  phone_number_id: string | null
  waba_id: string | null
  graph_api_version: string
  has_access_token: boolean
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

export async function sendWhatsAppTemplate(input: {
  to: string
  template_name: string
  language_code?: string
  bodyParams?: string[]
  phone_number_id?: string
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
      }),
    },
  )
  return res.data
}
