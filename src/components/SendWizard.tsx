import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Phone, Users } from 'lucide-react'
import {
  ApiError,
  listWhatsAppTemplates,
  sendWhatsAppTemplate,
  type MetaTemplate,
} from '../lib/api'
import {
  findPhoneColumn,
  normalizePhone,
  parseCsv,
  parsePhoneList,
  type CsvTable,
} from '../lib/csv'
import { extractMetaSlots, fillMetaBody } from '../lib/templateSlots'
import { resolveField, type ResolveContext } from '../lib/variables'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { DataFieldKey } from '../types'

export type SendAudienceKind = 'csv' | 'phones' | 'influencers'

const INFLUENCER_FIELDS: { key: DataFieldKey; label: string }[] = [
  { key: 'influencer.first_name', label: 'First name' },
  { key: 'influencer.full_name', label: 'Full name' },
  { key: 'influencer.handle', label: 'Handle' },
  { key: 'influencer.niche', label: 'Niche' },
  { key: 'brand.name', label: 'Brand name' },
  { key: 'org.name', label: 'Org name' },
  { key: 'campaign.name', label: 'Campaign name' },
  { key: 'literal', label: 'Fixed text…' },
]

type SlotMap = Record<string, string>

type Props = {
  /** Optional: preselect template name */
  initialTemplateName?: string
}

export function SendWizard({ initialTemplateName }: Props) {
  const { state, actions } = useWhatsAppStore()

  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templateName, setTemplateName] = useState(initialTemplateName || '')
  const [audience, setAudience] = useState<SendAudienceKind>('phones')
  const [slotMap, setSlotMap] = useState<SlotMap>({})
  const [literalBySlot, setLiteralBySlot] = useState<SlotMap>({})
  const [sending, setSending] = useState(false)

  // phones
  const [phoneText, setPhoneText] = useState('917706947747')

  // csv
  const [csv, setCsv] = useState<CsvTable | null>(null)
  const [phoneCol, setPhoneCol] = useState('')

  // influencers
  const [selectedInfIds, setSelectedInfIds] = useState<string[]>(
    state.influencers.slice(0, 2).map((i) => i.id),
  )
  const [campaignId, setCampaignId] = useState(state.campaigns[0]?.id ?? '')

  useEffect(() => {
    let cancelled = false
    setLoadingTemplates(true)
    void listWhatsAppTemplates({ limit: 50 })
      .then((list) => {
        if (cancelled) return
        const approvedOnly = list.filter((t) => t.status === 'APPROVED')
        setMetaTemplates(approvedOnly)
        if (initialTemplateName) {
          const match = approvedOnly.find((t) => t.name === initialTemplateName)
          setTemplateName(match?.name || approvedOnly[0]?.name || '')
        } else {
          setTemplateName((prev) =>
            prev && approvedOnly.some((t) => t.name === prev)
              ? prev
              : approvedOnly[0]?.name || '',
          )
        }
      })
      .catch((err) => {
        if (!cancelled) {
          actions.toast(
            err instanceof ApiError ? err.message : 'Failed to load templates',
            'error',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [actions, initialTemplateName])

  const selectedMeta = metaTemplates.find((t) => t.name === templateName)
  const bodyText =
    selectedMeta?.components?.find((c) => c.type === 'BODY')?.text ?? ''

  const slots = useMemo(() => extractMetaSlots(bodyText), [bodyText])

  useEffect(() => {
    setSlotMap((prev) => {
      const next: SlotMap = {}
      for (const s of slots) {
        next[s] =
          prev[s] ||
          (audience === 'influencers'
            ? 'influencer.first_name'
            : audience === 'csv'
              ? ''
              : 'literal')
      }
      return next
    })
  }, [slots.join(','), audience])

  const campaign = state.campaigns.find((c) => c.id === campaignId) ?? null
  const brand = campaign?.brandId
    ? state.brands.find((b) => b.id === campaign.brandId) ?? null
    : null

  const onCsvFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const table = parseCsv(text)
    setCsv(table)
    const col = findPhoneColumn(table.headers)
    setPhoneCol(col ?? '')
    if (table.headers.length) {
      setSlotMap((prev) => {
        const next = { ...prev }
        for (const s of slots) {
          if (!next[s] || next[s] === 'literal') {
            next[s] =
              table.headers.find((h) =>
                /name|first/i.test(h),
              ) ?? table.headers[0]
          }
        }
        return next
      })
    }
    actions.toast(`Loaded ${table.rows.length} CSV row(s)`, 'success')
  }

  const resolveSlotValue = (
    slot: string,
    row: Record<string, string> | null,
    ctx: ResolveContext,
  ): string => {
    const mapped = slotMap[slot]
    if (!mapped || mapped === 'literal') {
      return literalBySlot[slot] ?? ''
    }
    if (audience === 'csv' && row) {
      return row[mapped] ?? ''
    }
    if (audience === 'influencers') {
      return resolveField(mapped as DataFieldKey, ctx, literalBySlot[slot])
    }
    return literalBySlot[slot] ?? ''
  }

  type Outbound = { to: string; params: string[]; preview: string }

  const buildOutbound = (): Outbound[] => {
    if (audience === 'phones') {
      const phones = parsePhoneList(phoneText)
      return phones.map((to) => {
        const values: Record<string, string> = {}
        for (const s of slots) {
          values[s] = literalBySlot[s] ?? ''
        }
        return {
          to,
          params: slots.map((s) => values[s]),
          preview: fillMetaBody(bodyText, values),
        }
      })
    }

    if (audience === 'csv') {
      if (!csv || !phoneCol) return []
      return csv.rows
        .map((row) => {
          const to = normalizePhone(row[phoneCol] ?? '')
          if (to.length < 10) return null
          const values: Record<string, string> = {}
          for (const s of slots) {
            values[s] = resolveSlotValue(s, row, {
              org: state.organization,
              brand,
              campaign,
              influencer: null,
            })
          }
          return {
            to,
            params: slots.map((s) => values[s]),
            preview: fillMetaBody(bodyText, values),
          }
        })
        .filter(Boolean) as Outbound[]
    }

    // influencers
    return selectedInfIds
      .map((id) => {
        const inf = state.influencers.find((i) => i.id === id)
        if (!inf) return null
        const to = normalizePhone(inf.phone)
        if (to.length < 10) return null
        const ctx: ResolveContext = {
          org: state.organization,
          brand,
          campaign,
          influencer: inf,
        }
        const values: Record<string, string> = {}
        for (const s of slots) {
          values[s] = resolveSlotValue(s, null, ctx)
        }
        return {
          to,
          params: slots.map((s) => values[s]),
          preview: fillMetaBody(bodyText, values),
        }
      })
      .filter(Boolean) as Outbound[]
  }

  const outbound = buildOutbound()
  const preview = outbound[0]

  const handleSend = async () => {
    if (!templateName.trim()) {
      actions.toast('Pick a template', 'error')
      return
    }
    if (outbound.length === 0) {
      actions.toast('No valid recipients', 'error')
      return
    }
    if (slots.length > 0) {
      const missing = outbound.some((o) =>
        o.params.some((p) => !String(p).trim()),
      )
      if (missing) {
        actions.toast('Fill all template variables for every recipient', 'error')
        return
      }
    }

    setSending(true)
    let ok = 0
    let fail = 0
    try {
      const logged: Array<{ to: string; body: string; wamid?: string }> = []
      for (const item of outbound) {
        try {
          const data = await sendWhatsAppTemplate({
            to: item.to,
            template_name: templateName.trim(),
            language_code: selectedMeta?.language || 'en_US',
            bodyParams: item.params.length ? item.params : undefined,
            phone_number_id: state.whatsAppNumbers[0]?.phoneNumberId,
          })
          const wamid =
            typeof data === 'object' &&
            data &&
            'messages' in data &&
            Array.isArray((data as { messages?: { id?: string }[] }).messages)
              ? (data as { messages: { id?: string }[] }).messages[0]?.id
              : undefined
          logged.push({ to: item.to, body: item.preview, wamid })
          ok++
        } catch {
          fail++
        }
      }
      if (logged.length) {
        actions.logWhatsAppSends({
          sends: logged,
          phoneNumberId: state.whatsAppNumbers[0]?.phoneNumberId,
          campaignId,
        })
      }
      if (ok) {
        actions.toast(
          `Sent ${ok} message(s)${fail ? ` · ${fail} failed` : ''} · check Inbox`,
          fail ? 'info' : 'success',
        )
        actions.setTab('inbox')
      } else {
        actions.toast('All sends failed (allowlist / token / template?)', 'error')
      }
    } finally {
      setSending(false)
    }
  }

  const toggleInf = (id: string) => {
    setSelectedInfIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Send WhatsApp</h2>
          <p className="card-lead">
            Pick an approved template, choose audience, map variables, then send.
          </p>
        </div>
      </div>

      <div className="stack gap-4" style={{ marginTop: 12 }}>
        <div className="form-grid-2">
          <label className="field">
            <span>Approved template</span>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={loadingTemplates || metaTemplates.length === 0}
            >
              {metaTemplates.length === 0 ? (
                <option value="">No APPROVED templates yet</option>
              ) : (
                metaTemplates.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name} · {t.language} · {t.category}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="field">
            <span>Meta status</span>
            <input
              readOnly
              value={
                selectedMeta
                  ? `${selectedMeta.status} · ${selectedMeta.language} · ${selectedMeta.category}`
                  : loadingTemplates
                    ? 'Loading…'
                    : 'Create & approve a template first'
              }
            />
          </label>
        </div>
        {selectedMeta ? (
          <div className="preview-box">
            <p className="muted-xs">Template preview (with mapped values below)</p>
            <p>{bodyText || '—'}</p>
          </div>
        ) : null}

        {bodyText ? (
          <p className="muted-xs">
            Body: <code>{bodyText}</code>
          </p>
        ) : null}

        <div>
          <p className="field-label">Audience</p>
          <div className="segmented full">
            <button
              type="button"
              className={audience === 'phones' ? 'active' : ''}
              onClick={() => setAudience('phones')}
            >
              <Phone size={14} /> Phones only
            </button>
            <button
              type="button"
              className={audience === 'csv' ? 'active' : ''}
              onClick={() => setAudience('csv')}
            >
              <FileSpreadsheet size={14} /> CSV
            </button>
            <button
              type="button"
              className={audience === 'influencers' ? 'active' : ''}
              onClick={() => setAudience('influencers')}
            >
              <Users size={14} /> Reelax influencers
            </button>
          </div>
        </div>

        {audience === 'phones' ? (
          <label className="field">
            <span>Phone numbers (one per line or comma-separated)</span>
            <textarea
              rows={4}
              value={phoneText}
              onChange={(e) => setPhoneText(e.target.value)}
              placeholder="917706947747"
            />
            <span className="muted-xs">
              {parsePhoneList(phoneText).length} number(s) · must be Meta allowlisted
              in test mode
            </span>
          </label>
        ) : null}

        {audience === 'csv' ? (
          <div className="stack gap-3">
            <label className="field">
              <span>Upload CSV (header row required)</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onCsvFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {csv ? (
              <>
                <label className="field">
                  <span>Phone column</span>
                  <select
                    value={phoneCol}
                    onChange={(e) => setPhoneCol(e.target.value)}
                  >
                    {csv.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted-xs">
                  {csv.rows.length} rows · columns: {csv.headers.join(', ')}
                </p>
              </>
            ) : (
              <p className="muted-xs">
                Example headers: <code>phone,name,city</code>
              </p>
            )}
          </div>
        ) : null}

        {audience === 'influencers' ? (
          <div className="stack gap-3">
            <label className="field">
              <span>Campaign context (for brand/campaign fields)</span>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                {state.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="audience-checklist">
              {state.influencers.map((inf) => (
                <label key={inf.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={selectedInfIds.includes(inf.id)}
                    onChange={() => toggleInf(inf.id)}
                  />
                  <span>
                    {inf.name} · {inf.phone}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {slots.length > 0 ? (
          <div className="stack gap-2">
            <p className="field-label">Variable map</p>
            {slots.map((slot) => (
              <div key={slot} className="form-grid-2">
                <label className="field">
                  <span>{`{{${slot}}}`}</span>
                  {audience === 'csv' ? (
                    <select
                      value={slotMap[slot] ?? ''}
                      onChange={(e) =>
                        setSlotMap((m) => ({ ...m, [slot]: e.target.value }))
                      }
                    >
                      <option value="">Select CSV column</option>
                      {(csv?.headers ?? []).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                      <option value="literal">Fixed text…</option>
                    </select>
                  ) : audience === 'influencers' ? (
                    <select
                      value={slotMap[slot] ?? 'influencer.first_name'}
                      onChange={(e) =>
                        setSlotMap((m) => ({ ...m, [slot]: e.target.value }))
                      }
                    >
                      {INFLUENCER_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted-xs">Fixed value for all phones</span>
                  )}
                </label>
                {(audience === 'phones' ||
                  slotMap[slot] === 'literal' ||
                  !slotMap[slot]) &&
                audience !== 'csv' ? (
                  <label className="field">
                    <span>Value</span>
                    <input
                      value={literalBySlot[slot] ?? ''}
                      onChange={(e) =>
                        setLiteralBySlot((m) => ({
                          ...m,
                          [slot]: e.target.value,
                        }))
                      }
                      placeholder={`Value for {{${slot}}}`}
                    />
                  </label>
                ) : audience === 'csv' && slotMap[slot] === 'literal' ? (
                  <label className="field">
                    <span>Fixed value</span>
                    <input
                      value={literalBySlot[slot] ?? ''}
                      onChange={(e) =>
                        setLiteralBySlot((m) => ({
                          ...m,
                          [slot]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-xs">This template has no body variables.</p>
        )}

        {preview ? (
          <div className="preview-box">
            <p className="muted-xs">
              Preview · {outbound.length} recipient(s) · first: {preview.to}
            </p>
            <p>{preview.preview || '(empty body)'}</p>
          </div>
        ) : null}

        <button
          type="button"
          className="btn primary wa"
          disabled={sending || outbound.length === 0}
          onClick={() => void handleSend()}
        >
          {sending
            ? 'Sending…'
            : `Send to ${outbound.length} recipient(s)`}
        </button>
      </div>
    </section>
  )
}
