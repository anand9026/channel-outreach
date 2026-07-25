import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import {
  ApiError,
  listWhatsAppTemplates,
  sendWhatsAppTemplate,
  type MetaTemplate,
} from '../lib/api'
import { findPhoneColumn, normalizePhone, parseCsv, parsePhoneList } from '../lib/csv'
import { extractMetaSlots } from '../lib/templateSlots'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'

type SendStatus = 'idle' | 'queued' | 'sending' | 'sent' | 'failed'

type Recipient = {
  phone: string
  name?: string
  row?: Record<string, string>
  status: SendStatus
  error?: string
  wamid?: string
}

/**
 * A variable binding is either a fixed literal or "pull from CSV column".
 */
type VarBinding = { source: 'literal'; value: string } | { source: 'column'; column: string }

const STORAGE_KEY = 'rx-quicksend-v2'

type PersistedState = {
  templateId: string
  bindings: Record<string, VarBinding>
  csvHeaders: string[]
  phoneColumn: string | null
  recipients: Array<Omit<Recipient, 'status' | 'error' | 'wamid'>>
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

function savePersisted(s: PersistedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Auto-map CSV columns to template slots (fuzzy). */
function autoMapColumns(
  slots: string[],
  headers: string[],
  templateExample: string[],
): Record<string, VarBinding> {
  const nonPhone = headers.filter((h) => !/phone|mobile|whatsapp|number/i.test(h))
  const bindings: Record<string, VarBinding> = {}

  slots.forEach((slot, i) => {
    // Heuristic 1: slot label matches column ("name" → {{1}}, "first_name" → {{2}}, etc.)
    const guess =
      slot === '1'
        ? nonPhone.find((h) => /^(first[_ -]?name|name)$/i.test(h))
        : slot === '2'
          ? nonPhone.find((h) => /^(last[_ -]?name|surname|company|brand)$/i.test(h))
          : nonPhone.find((h) => h.toLowerCase() === `var${slot}` || h.toLowerCase() === `v${slot}`)
    if (guess) {
      bindings[slot] = { source: 'column', column: guess }
      return
    }
    // Fallback: use template's example value if present
    const ex = templateExample[i]
    bindings[slot] = { source: 'literal', value: ex ?? '' }
  })
  return bindings
}

function renderBody(
  body: string,
  bindings: Record<string, VarBinding>,
  row?: Record<string, string>,
): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const b = bindings[n]
    if (!b) return `{{${n}}}`
    if (b.source === 'literal') return b.value || `{{${n}}}`
    if (row && row[b.column] != null) return row[b.column]
    return `{{${n}}}`
  })
}

function paramsFor(
  slots: string[],
  bindings: Record<string, VarBinding>,
  row?: Record<string, string>,
): string[] {
  return slots.map((s) => {
    const b = bindings[s]
    if (!b) return ''
    if (b.source === 'literal') return b.value
    return row?.[b.column] ?? ''
  })
}

export function QuickSendPage() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const waNumbers = state.whatsAppNumbers
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('')

  // Templates
  const [templates, setTemplates] = useState<MetaTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string>('')
  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Recipients + CSV
  const [pasteInput, setPasteInput] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [phoneColumn, setPhoneColumn] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Variable bindings
  const bodyComponent = useMemo(
    () => selectedTemplate?.components?.find((c) => c.type === 'BODY'),
    [selectedTemplate],
  )
  const bodyText = bodyComponent?.text ?? ''
  const slots = useMemo(() => extractMetaSlots(bodyText), [bodyText])
  const [bindings, setBindings] = useState<Record<string, VarBinding>>({})

  // Send state
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [restored, setRestored] = useState(false)

  // -------- Restore from localStorage on mount --------
  useEffect(() => {
    const p = loadPersisted()
    if (p) {
      setTemplateId(p.templateId || '')
      setBindings(p.bindings || {})
      setCsvHeaders(p.csvHeaders || [])
      setPhoneColumn(p.phoneColumn || null)
      setRecipients(
        (p.recipients || []).map((r) => ({ ...r, status: 'idle' as SendStatus })),
      )
    }
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------- Persist on any relevant change --------
  useEffect(() => {
    if (!restored) return
    savePersisted({
      templateId,
      bindings,
      csvHeaders,
      phoneColumn,
      recipients: recipients.map(({ phone, name, row }) => ({ phone, name, row })),
    })
  }, [restored, templateId, bindings, csvHeaders, phoneColumn, recipients])

  // -------- Default phone number id --------
  useEffect(() => {
    if (mode !== 'none' && waNumbers[0] && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(waNumbers[0].phoneNumberId)
    }
  }, [mode, waNumbers, selectedPhoneNumberId])

  // -------- When template changes, re-init bindings for slots not yet bound --------
  useEffect(() => {
    if (!selectedTemplate) return
    const example = bodyComponent?.example?.body_text?.[0] ?? []
    setBindings((prev) => {
      const next: Record<string, VarBinding> = {}
      slots.forEach((s, i) => {
        // If already bound to something valid, keep it. Otherwise prefer example value.
        const existing = prev[s]
        if (existing) {
          if (existing.source === 'column' && !csvHeaders.includes(existing.column)) {
            next[s] = { source: 'literal', value: example[i] ?? '' }
          } else {
            next[s] = existing
          }
        } else {
          next[s] = { source: 'literal', value: example[i] ?? '' }
        }
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, bodyText])

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const list = await listWhatsAppTemplates({ status: 'APPROVED', limit: 100 })
      setTemplates(list)
    } catch (err) {
      setTemplatesError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not load templates',
      )
    } finally {
      setTemplatesLoading(false)
    }
  }

  useEffect(() => {
    if (mode !== 'none') void loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const addPasted = () => {
    const phones = parsePhoneList(pasteInput)
    if (phones.length === 0) {
      actions.toast('No valid phone numbers found (need 10+ digits)', 'error')
      return
    }
    const existing = new Set(recipients.map((r) => r.phone))
    const added = phones.filter((p) => !existing.has(p))
    if (added.length === 0) {
      actions.toast('All numbers already in the list', 'info')
      return
    }
    setRecipients([...recipients, ...added.map<Recipient>((p) => ({ phone: p, status: 'idle' }))])
    setPasteInput('')
    actions.toast(`Added ${added.length} number${added.length > 1 ? 's' : ''}`, 'success')
  }

  const handleCsv = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '')
      const table = parseCsv(text)
      if (table.rows.length === 0) {
        actions.toast('CSV is empty', 'error')
        return
      }
      const col = findPhoneColumn(table.headers)
      setCsvHeaders(table.headers)
      setPhoneColumn(col)

      const existing = new Set(recipients.map((r) => r.phone))
      const added: Recipient[] = []
      for (const row of table.rows) {
        const raw = col ? row[col] : ''
        const phone = normalizePhone(raw || '')
        if (phone.length < 10 || existing.has(phone)) continue
        existing.add(phone)
        const nameCol = table.headers.find((h) => /^name|first[_ -]?name/i.test(h))
        added.push({ phone, name: nameCol ? row[nameCol] : undefined, row, status: 'idle' })
      }

      // Auto-map CSV columns to slots (overwrite any prior defaults)
      if (slots.length > 0) {
        const ex = bodyComponent?.example?.body_text?.[0] ?? []
        setBindings(autoMapColumns(slots, table.headers, ex))
      }

      setRecipients([...recipients, ...added])
      actions.toast(`Imported ${added.length} from CSV`, 'success')
    }
    reader.readAsText(file)
  }

  const clearRecipients = () => {
    setRecipients([])
    setCsvHeaders([])
    setPhoneColumn(null)
  }

  const removeRecipient = (phone: string) => {
    setRecipients(recipients.filter((r) => r.phone !== phone))
  }

  const setBinding = (slot: string, b: VarBinding) => {
    setBindings({ ...bindings, [slot]: b })
  }

  const canSend =
    mode !== 'none' && selectedPhoneNumberId && templateId && recipients.length > 0 && !sending

  const runSend = async () => {
    if (!canSend || !selectedTemplate) return
    setSending(true)
    setProgress({ done: 0, total: recipients.length })
    const initial = recipients.map((r) => ({ ...r, status: 'queued' as SendStatus, error: undefined }))
    setRecipients(initial)

    const successful: Array<{ to: string; body: string; name?: string; wamid?: string }> = []
    let doneCount = 0

    for (let i = 0; i < initial.length; i++) {
      const r = initial[i]
      setRecipients((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: 'sending' } : x)))

      // Per-recipient params + preview
      const params = paramsFor(slots, bindings, r.row)
      const preview = renderBody(bodyText, bindings, r.row)

      try {
        const res = (await sendWhatsAppTemplate({
          to: r.phone,
          template_name: selectedTemplate.name,
          language_code: selectedTemplate.language || 'en_US',
          bodyParams: params.length ? params : undefined,
          phone_number_id: selectedPhoneNumberId,
          preview_body: preview,
        })) as { messages?: Array<{ id?: string }> } | undefined

        const wamid = res?.messages?.[0]?.id
        setRecipients((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: 'sent', wamid } : x)))
        successful.push({ to: r.phone, body: preview, name: r.name, wamid })
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Send failed'
        setRecipients((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: 'failed', error: msg } : x)))
      }
      doneCount += 1
      setProgress({ done: doneCount, total: initial.length })
    }

    if (successful.length > 0) {
      actions.logWhatsAppSends({
        sends: successful,
        phoneNumberId: selectedPhoneNumberId,
        campaignId: null,
      })
    }

    setSending(false)
    const failed = initial.length - successful.length
    actions.toast(
      failed === 0
        ? `All ${successful.length} messages sent`
        : `Sent ${successful.length}, failed ${failed}`,
      failed === 0 ? 'success' : 'info',
    )
  }

  const totalSent = recipients.filter((r) => r.status === 'sent').length
  const totalFailed = recipients.filter((r) => r.status === 'failed').length

  const previewRecipient = recipients.find((r) => r.row) ?? recipients[0]
  const previewText = renderBody(bodyText, bindings, previewRecipient?.row)

  if (mode === 'none') {
    return (
      <div className="rx-page">
        <PageHeader
          title="Quick Send"
          subtitle="Send a WhatsApp template to any phone number — no campaign required."
        />
        <EmptyState
          icon={<Zap size={20} />}
          title="Connect WhatsApp to use Quick Send"
          body="This sandbox uses the real WhatsApp Cloud API. Connect a WABA number first."
        />
      </div>
    )
  }

  return (
    <div className="rx-page">
      <PageHeader
        title="Quick Send"
        subtitle="Send any Meta-approved WhatsApp template to any phone number. Paste a list or upload a CSV — variables can auto-fill per row."
        actions={
          <button
            type="button"
            className="rx-btn accent"
            onClick={() => void runSend()}
            disabled={!canSend}
            data-testid="quicksend-send"
          >
            {sending ? (
              <>
                <Loader2 size={14} className="rx-spin" /> Sending {progress.done}/{progress.total}
              </>
            ) : (
              <>
                <Send size={14} /> Send to {recipients.length || 0} number
                {recipients.length === 1 ? '' : 's'}
              </>
            )}
          </button>
        }
      />

      <div className="rx-card compact rx-mb-4">
        <div className="rx-label" style={{ marginBottom: 6 }}>
          Sending from
        </div>
        {waNumbers.length > 1 ? (
          <select
            className="rx-select"
            value={selectedPhoneNumberId}
            onChange={(e) => setSelectedPhoneNumberId(e.target.value)}
          >
            {waNumbers.map((n) => (
              <option key={n.id} value={n.phoneNumberId}>
                {n.displayName} · {n.phoneDisplay}
              </option>
            ))}
          </select>
        ) : (
          <div className="rx-row">
            <span className="rx-ch-dot wa" />
            <strong>{waNumbers[0]?.displayName}</strong>
            <span className="mono rx-text-sm rx-muted">{waNumbers[0]?.phoneDisplay}</span>
            <span className="rx-badge success">{waNumbers[0]?.qualityRating}</span>
          </div>
        )}
      </div>

      <div className="rx-split" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* -------- Recipients -------- */}
        <div className="rx-card">
          <div className="rx-section-title">
            <span>Recipients</span>
            {recipients.length > 0 && (
              <button type="button" className="rx-btn ghost sm" onClick={clearRecipients}>
                <Trash2 size={12} /> Clear all
              </button>
            )}
          </div>

          <div className="rx-field rx-mb-4">
            <label className="rx-label">Paste phone numbers</label>
            <textarea
              className="rx-textarea"
              placeholder="+91 98765 43210&#10;+91 91234 56789&#10;… one per line or comma-separated"
              rows={4}
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              data-testid="quicksend-paste"
            />
            <div className="rx-row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <div className="rx-help">10+ digits per number. Country code recommended.</div>
              <button
                type="button"
                className="rx-btn secondary sm"
                onClick={addPasted}
                disabled={!pasteInput.trim()}
                data-testid="quicksend-add-pasted"
              >
                Add
              </button>
            </div>
          </div>

          <div className="rx-field rx-mb-4">
            <label className="rx-label">Or upload CSV (with columns for variables)</label>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCsv(f)
                if (fileInput.current) fileInput.current.value = ''
              }}
              hidden
              data-testid="quicksend-csv"
            />
            <button
              type="button"
              className="rx-btn secondary"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={14} /> Choose CSV file
            </button>
            {csvHeaders.length > 0 ? (
              <div className="rx-help">
                Columns detected: <span className="mono">{csvHeaders.join(', ')}</span>
                <br />
                Phone column: <span className="mono">{phoneColumn || '—'}</span>. Map columns to
                template variables on the right &rarr;
              </div>
            ) : (
              <div className="rx-help">
                Any CSV with a phone / mobile / whatsapp / number column. Extra columns can be
                mapped to template variables.
              </div>
            )}
          </div>

          {recipients.length > 0 && (
            <>
              <div className="rx-section-title">
                <span>
                  {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
                </span>
                {totalSent + totalFailed > 0 && (
                  <span className="rx-caption">
                    <span style={{ color: 'var(--success)' }}>{totalSent} sent</span>
                    {totalFailed ? (
                      <>
                        {' · '}
                        <span style={{ color: 'var(--danger)' }}>{totalFailed} failed</span>
                      </>
                    ) : null}
                  </span>
                )}
              </div>
              <div
                className="rx-col"
                style={{ maxHeight: 300, overflowY: 'auto', gap: 4 }}
                data-testid="quicksend-list"
              >
                {recipients.map((r) => (
                  <RecipientRow key={r.phone} r={r} onRemove={() => removeRecipient(r.phone)} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* -------- Template + variables + preview -------- */}
        <div className="rx-card">
          <div className="rx-section-title">
            <span>Template</span>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => void loadTemplates()}
              disabled={templatesLoading}
              data-testid="quicksend-refresh-templates"
            >
              <RefreshCw size={12} className={templatesLoading ? 'rx-spin' : ''} /> Refresh
            </button>
          </div>

          {templatesError ? (
            <div className="rx-window-note closed rx-mb-2">
              <AlertCircle size={14} /> {templatesError}
            </div>
          ) : null}

          <div className="rx-field rx-mb-4">
            <label className="rx-label">Meta-approved WhatsApp template</label>
            <select
              className="rx-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={templatesLoading || templates.length === 0}
              data-testid="quicksend-template"
            >
              <option value="">
                {templatesLoading
                  ? 'Loading…'
                  : templates.length === 0
                    ? 'No approved templates on your WABA yet'
                    : 'Select a template…'}
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.language} · {t.category}
                </option>
              ))}
            </select>
          </div>

          {slots.length > 0 && (
            <div className="rx-mb-4">
              <div className="rx-section-title">
                <span>Variables</span>
                <span className="rx-caption">
                  {csvHeaders.length > 0
                    ? 'Map to CSV column or set a fixed value'
                    : 'Fixed values — upload CSV for per-row personalization'}
                </span>
              </div>
              <div className="rx-col rx-gap">
                {slots.map((s) => (
                  <VariableEditor
                    key={s}
                    slot={s}
                    binding={bindings[s] ?? { source: 'literal', value: '' }}
                    columns={csvHeaders.filter((h) => h !== phoneColumn)}
                    onChange={(b) => setBinding(s, b)}
                  />
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <>
              <div className="rx-section-title">
                <span>Preview</span>
                {previewRecipient?.row ? (
                  <span className="rx-caption">
                    Showing render for <strong>+{previewRecipient.phone}</strong>
                  </span>
                ) : null}
              </div>
              <div className="rx-preview wa">{previewText || 'Select a template to preview.'}</div>
              <div className="rx-help rx-mt-2">
                Sent as <strong>{selectedTemplate.name}</strong> ({selectedTemplate.category}).
                Successful sends appear in your Inbox.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** (deprecated helper — kept for future use) */
function _unused_maybePreserveLiterals(
  prev: Record<string, VarBinding>,
  _headers: string[],
): Record<string, VarBinding> {
  const out: Record<string, VarBinding> = {}
  for (const [k, v] of Object.entries(prev)) {
    if (v.source === 'literal') out[k] = v
  }
  return out
}

function VariableEditor({
  slot,
  binding,
  columns,
  onChange,
}: {
  slot: string
  binding: VarBinding
  columns: string[]
  onChange: (b: VarBinding) => void
}) {
  const isColumn = binding.source === 'column'
  const hasCsv = columns.length > 0
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 12,
        background: 'var(--surface-2)',
      }}
    >
      <div className="rx-row rx-mb-2" style={{ justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{`{{${slot}}}`}</span>
        {hasCsv && (
          <div className="rx-seg" style={{ padding: 2 }}>
            <button
              className={`rx-seg-btn${!isColumn ? ' is-active' : ''}`}
              onClick={() =>
                onChange({
                  source: 'literal',
                  value: binding.source === 'literal' ? binding.value : '',
                })
              }
              data-testid={`quicksend-var-${slot}-fixed`}
              style={{ padding: '4px 10px', fontSize: 11.5 }}
            >
              Fixed
            </button>
            <button
              className={`rx-seg-btn${isColumn ? ' is-active' : ''}`}
              onClick={() =>
                onChange({
                  source: 'column',
                  column: binding.source === 'column' ? binding.column : columns[0],
                })
              }
              data-testid={`quicksend-var-${slot}-csv`}
              style={{ padding: '4px 10px', fontSize: 11.5 }}
            >
              From CSV
            </button>
          </div>
        )}
      </div>
      {binding.source === 'literal' ? (
        <input
          className="rx-input"
          value={binding.value}
          onChange={(e) => onChange({ source: 'literal', value: e.target.value })}
          placeholder={`Value for {{${slot}}}`}
          data-testid={`quicksend-var-${slot}`}
        />
      ) : (
        <select
          className="rx-select"
          value={binding.column}
          onChange={(e) => onChange({ source: 'column', column: e.target.value })}
          data-testid={`quicksend-var-${slot}-column`}
        >
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function RecipientRow({ r, onRemove }: { r: Recipient; onRemove: () => void }) {
  return (
    <div
      className="rx-row"
      style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, gap: 10 }}
    >
      <StatusIcon status={r.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>+{r.phone}</div>
        {r.name ? <div className="rx-text-xs rx-muted">{r.name}</div> : null}
        {r.error ? (
          <div className="rx-text-xs" style={{ color: 'var(--danger)' }}>
            {r.error}
          </div>
        ) : null}
      </div>
      {r.status === 'idle' ? (
        <button type="button" className="rx-icon-btn" onClick={onRemove} aria-label="Remove">
          <X size={14} />
        </button>
      ) : null}
    </div>
  )
}

function StatusIcon({ status }: { status: SendStatus }) {
  if (status === 'sending' || status === 'queued')
    return <Loader2 size={14} className="rx-spin" style={{ color: 'var(--text-3)' }} />
  if (status === 'sent') return <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
  if (status === 'failed') return <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: '1.5px solid var(--border-strong)',
        display: 'inline-block',
      }}
    />
  )
}
