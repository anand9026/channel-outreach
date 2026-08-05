import type {
  Brand,
  Campaign,
  DataFieldKey,
  Influencer,
  Organization,
  VariableBinding,
} from '../types'

export interface FieldOption {
  key: DataFieldKey
  label: string
  group: 'Influencer' | 'Brand' | 'Organization' | 'Campaign' | 'Custom'
  hint: string
  /** Hidden when org has no brands and field needs a brand */
  needsBrand?: boolean
}

export const FIELD_CATALOG: FieldOption[] = [
  {
    key: 'influencer.first_name',
    label: 'First name',
    group: 'Influencer',
    hint: 'Priya from Priya Sharma',
  },
  {
    key: 'influencer.full_name',
    label: 'Full name',
    group: 'Influencer',
    hint: 'Priya Sharma',
  },
  {
    key: 'influencer.handle',
    label: 'Handle',
    group: 'Influencer',
    hint: '@priyabeauty',
  },
  {
    key: 'influencer.niche',
    label: 'Niche',
    group: 'Influencer',
    hint: 'Skincare',
  },
  {
    key: 'influencer.followers',
    label: 'Followers',
    group: 'Influencer',
    hint: '842K',
  },
  {
    key: 'influencer.phone',
    label: 'Phone',
    group: 'Influencer',
    hint: 'E.164 phone',
  },
  {
    key: 'influencer.email',
    label: 'Email',
    group: 'Influencer',
    hint: 'creator@…',
  },
  {
    key: 'brand.name',
    label: 'Brand name',
    group: 'Brand',
    hint: 'Glow Lab',
    needsBrand: true,
  },
  {
    key: 'brand.short_name',
    label: 'Brand short',
    group: 'Brand',
    hint: 'Glow',
    needsBrand: true,
  },
  {
    key: 'org.name',
    label: 'Organization',
    group: 'Organization',
    hint: 'Parent company name',
  },
  {
    key: 'campaign.name',
    label: 'Campaign name',
    group: 'Campaign',
    hint: 'Summer Glow Launch',
  },
  {
    key: 'literal',
    label: 'Fixed text',
    group: 'Custom',
    hint: 'Same for every recipient',
  },
]

export function availableFields(hasBrands: boolean): FieldOption[] {
  return FIELD_CATALOG.filter((f) => (f.needsBrand ? hasBrands : true))
}

export function extractSlots(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\{|\}/g, '')))].sort(
    (a, b) => Number(a) - Number(b),
  )
}

export function nextSlot(body: string, subject = ''): string {
  const used = extractSlots(`${subject} ${body}`).map(Number)
  let n = 1
  while (used.includes(n)) n += 1
  return String(n)
}

export interface ResolveContext {
  org: Organization
  brand: Brand | null
  campaign: Campaign | null
  influencer: Influencer | null
}

export function resolveField(field: DataFieldKey, ctx: ResolveContext, literal?: string): string {
  const inf = ctx.influencer
  switch (field) {
    case 'influencer.first_name':
      return inf?.name.split(' ')[0] ?? 'Creator'
    case 'influencer.full_name':
      return inf?.name ?? 'Creator'
    case 'influencer.handle':
      return inf?.handle ?? '@creator'
    case 'influencer.niche':
      return inf?.niche ?? 'content'
    case 'influencer.followers':
      return inf?.followers ?? '—'
    case 'influencer.phone':
      return inf?.phone ?? '—'
    case 'influencer.email':
      return inf?.email ?? '—'
    case 'brand.name':
      return ctx.brand?.name ?? ctx.org.name
    case 'brand.short_name':
      return ctx.brand?.shortName ?? ctx.org.name.split(' ')[0] ?? ctx.org.name
    case 'org.name':
      return ctx.org.name
    case 'campaign.name':
      return ctx.campaign?.name ?? 'campaign'
    case 'literal':
      return literal?.trim() || '…'
    default:
      return '…'
  }
}

/** Merge template bindings with send-time overrides (slot → field key or "literal:text"). */
export function mergeBindings(
  templateBindings: VariableBinding[],
  overrides: Record<string, string>,
): VariableBinding[] {
  const bySlot = new Map(templateBindings.map((b) => [b.slot, { ...b }]))
  for (const [slot, raw] of Object.entries(overrides)) {
    if (!raw) continue
    if (raw.startsWith('literal:')) {
      bySlot.set(slot, { slot, field: 'literal', literal: raw.slice('literal:'.length) })
    } else {
      bySlot.set(slot, { slot, field: raw as DataFieldKey })
    }
  }
  return [...bySlot.values()].sort((a, b) => Number(a.slot) - Number(b.slot))
}

export function renderWithBindings(
  text: string,
  bindings: VariableBinding[],
  ctx: ResolveContext,
): string {
  let out = text
  for (const b of bindings) {
    const value = resolveField(b.field, ctx, b.literal)
    out = out.replaceAll(`{{${b.slot}}}`, value)
  }
  // leftover unmapped slots stay visible
  return out
}

/** Ordered Meta body parameters from slot bindings ({{1}}, {{2}}, …). */
export function bodyParamsForBindings(
  bindings: VariableBinding[],
  ctx: ResolveContext,
): string[] {
  return [...bindings]
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map((b) => resolveField(b.field, ctx, b.literal))
}

export function bindingToOverrideValue(b: VariableBinding): string {
  if (b.field === 'literal') return `literal:${b.literal ?? ''}`
  return b.field
}

export function overrideToBinding(slot: string, raw: string): VariableBinding {
  if (raw.startsWith('literal:')) {
    return { slot, field: 'literal', literal: raw.slice('literal:'.length) }
  }
  return { slot, field: (raw as DataFieldKey) || 'literal', literal: raw ? undefined : '' }
}

export function suggestBinding(slot: string, hasBrand: boolean): VariableBinding {
  const defaults: DataFieldKey[] = hasBrand
    ? ['influencer.first_name', 'influencer.niche', 'campaign.name', 'brand.name', 'org.name']
    : ['influencer.first_name', 'influencer.niche', 'campaign.name', 'org.name', 'influencer.handle']
  const idx = Math.max(0, Number(slot) - 1)
  return { slot, field: defaults[idx] ?? 'literal', literal: '' }
}

export function syncBindingsToSlots(
  slots: string[],
  existing: VariableBinding[],
  hasBrand: boolean,
): VariableBinding[] {
  return slots.map((slot) => {
    const found = existing.find((b) => b.slot === slot)
    return found ?? suggestBinding(slot, hasBrand)
  })
}
