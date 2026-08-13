import type { WhatsAppNumber } from '../types'

/** One selectable row per WABA (or per phone when WABA id is missing). */
export function whatsAppAccountOptions(numbers: WhatsAppNumber[]): WhatsAppNumber[] {
  const seen = new Set<string>()
  const options: WhatsAppNumber[] = []
  for (const n of numbers) {
    const key = (n.wabaId && n.wabaId.trim()) || n.phoneNumberId
    if (!key || seen.has(key)) continue
    seen.add(key)
    options.push(n)
  }
  return options
}

export function labelWhatsAppAccount(n: WhatsAppNumber): string {
  const name = n.displayName?.trim() || 'WhatsApp Business'
  const phone = n.phoneDisplay?.trim()
  const waba = n.wabaId?.trim()
  if (phone && waba) return `${name} · ${phone} · WABA ${waba.slice(0, 8)}…`
  if (phone) return `${name} · ${phone}`
  if (waba) return `${name} · WABA ${waba.slice(0, 8)}…`
  return `${name} · ${n.phoneNumberId.slice(0, 10)}…`
}
