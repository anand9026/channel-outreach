/** Minimal CSV parser (header row + rows). Handles quoted commas. */

export type CsvTable = {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(text: string): CsvTable {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

/** Normalize phone: digits only, keep country code if present. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

export function findPhoneColumn(headers: string[]): string | null {
  const keys = ['phone', 'mobile', 'wa_number', 'whatsapp', 'phone_number', 'number']
  const lower = headers.map((h) => h.toLowerCase())
  for (const k of keys) {
    const idx = lower.indexOf(k)
    if (idx >= 0) return headers[idx]
  }
  return headers[0] ?? null
}

export function csvEscape(value: string): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function parsePhoneList(text: string): string[] {
  const parts = text
    .split(/[\n,;]+/)
    .map((p) => normalizePhone(p))
    .filter((p) => p.length >= 10)
  return [...new Set(parts)]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

export function normalizeEmail(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(normalizeEmail(raw))
}

export function findEmailColumn(headers: string[]): string | null {
  const keys = ['email', 'e-mail', 'mail', 'email_address', 'emailaddress']
  const lower = headers.map((h) => h.toLowerCase())
  for (const k of keys) {
    const idx = lower.indexOf(k)
    if (idx >= 0) return headers[idx]
  }
  // Prefer a column that looks like emails in the name
  const fuzzy = headers.find((h) => /email|mail/i.test(h))
  return fuzzy ?? headers[0] ?? null
}

export function parseEmailList(text: string): string[] {
  const parts = text
    .split(/[\n,;]+/)
    .map((p) => normalizeEmail(p))
    .filter((p) => isValidEmail(p))
  return [...new Set(parts)]
}
