/** Parse outreach API timestamps (unix sec/ms, ISO, or MySQL datetime strings). */
export function parseOutreachTimestamp(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  if (/^\d+$/.test(raw)) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return null
    const ms = raw.length >= 13 ? n : n * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatOutreachTimestamp(value: unknown, fallback = ''): string {
  const d = parseOutreachTimestamp(value)
  return d ? d.toISOString() : fallback
}
