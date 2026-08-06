import type { Conversation, Influencer, OutreachChannel } from '../../types'

/** Strip invisible Gmail / unicode junk from previews. */
export function sanitizePreview(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u034F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Human-readable name — never raw marketing email as the headline when avoidable. */
export function displayNameForConversation(
  c: Conversation,
  inf?: Influencer,
): string {
  const contact = (c.contactName || '').trim()
  if (contact && !contact.includes('@')) return contact
  if (inf?.name && !inf.name.includes('@') && inf.name !== inf.email) return inf.name
  const email = (inf?.email || contact || '').toLowerCase()
  if (email.includes('@')) {
    const local = email.split('@')[0] || ''
    const pretty = titleCaseWords(local.replace(/[._+-]+/g, ' '))
    if (pretty.length >= 2) return pretty
  }
  const phone = inf?.phone?.replace(/\D/g, '') || c.providerThreadId || ''
  if (phone.length >= 10) return `+${phone.replace(/^\+/, '')}`
  return 'Unknown contact'
}

export function contactLineForConversation(c: Conversation, inf?: Influencer): string {
  const bits: string[] = []
  const phone = inf?.phone?.replace(/\D/g, '') || ''
  const email = (inf?.email || '').trim().toLowerCase()
  if (phone.length >= 10) bits.push(`+${phone.replace(/^\+/, '')}`)
  if (email) bits.push(email)
  if (bits.length) return bits.join(' · ')
  if (c.channels?.includes('whatsapp') && c.providerThreadId) {
    return `+${c.providerThreadId.replace(/^\+/, '')}`
  }
  return ''
}

export function channelLabelShort(ch: OutreachChannel): string {
  if (ch === 'whatsapp') return 'WhatsApp'
  if (ch === 'instagram') return 'Instagram'
  return 'Gmail'
}

export function channelListForConversation(c: Conversation): OutreachChannel[] {
  if (c.channels?.length) return c.channels
  return [c.channel]
}

/** Outreach creators vs cold Gmail inbox noise. */
export function isCreatorConversation(c: Conversation, inf?: Influencer): boolean {
  if (c.isCreator) return true
  if (c.campaignIds.length > 0) return true
  if (c.channels?.includes('whatsapp')) return true
  if (inf?.id && !inf.id.startsWith('ext_em_')) return true
  if (inf?.niche && inf.niche !== 'External') return true
  return false
}

export function formatConversationTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (sameDay) {
    return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) {
    return d.toLocaleDateString('en', { weekday: 'short' })
  }
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export function initialsForName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}
