import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
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
import { extractMetaSlots, fillMetaBody } from '../lib/templateSlots'
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

export function QuickSendPage() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const waNumbers = state.whatsAppNumbers
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('')

  // Templates from real API
  const [templates, setTemplates] = useState<MetaTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string>('')
  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Recipients
  const [pasteInput, setPasteInput] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [phoneColumn, setPhoneColumn] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Variables
  const bodyComponent = useMemo(
    () => selectedTemplate?.components?.find((c) => c.type === 'BODY'),
    [selectedTemplate],
  )
  const bodyText = bodyComponent?.text ?? ''
  const slots = useMemo(() => extractMetaSlots(bodyText), [bodyText])
  const [samples, setSamples] = useState<Record<string, string>>({})

  useEffect(() => {
    // Prime sample values from the template's own example
    const ex = bodyComponent?.example?.body_text?.[0] ?? []
    const next: Record<string, string> = {}
    slots.forEach((s, i) => {
      next[s] = ex[i] ?? ''
    })
    setSamples(next)
  }, [templateId, bodyText])

  // Send state
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    if (mode !== 'none' && waNumbers[0] && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(waNumbers[0].phoneNumberId)
    }
  }, [mode, waNumbers, selectedPhoneNumberId])

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const list = await listWhatsAppTemplates({ status: 'APPROVED', limit: 100 })
      setTemplates(list)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load templates'
      setTemplatesError(msg)
    } finally {
      setTemplatesLoading(false)
    }
  }

  useEffect(() => {
    if (mode !== 'none') void loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const addPastedRecipients = () => {
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
    setRecipients([
      ...recipients,
      ...added.map<Recipient>((p) => ({ phone: p, status: 'idle' })),
    ])
    setPasteInput('')
    actions.toast(`Added ${added.length} number${added.length > 1 ? 's' : ''}`, 'success')
  }

  const handleCsvFile = (file: File) => {
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

      const added: Recipient[] = []
      const existing = new Set(recipients.map((r) => r.phone))
      for (const row of table.rows) {
        const raw = col ? row[col] : ''
        const phone = normalizePhone(raw || '')
        if (phone.length < 10 || existing.has(phone)) continue
        existing.add(phone)
        const nameCol = table.headers.find((h) => /name/i.test(h))
        added.push({
          phone,
          name: nameCol ? row[nameCol] : undefined,
          row,
          status: 'idle',
        })
      }
      setRecipients([...recipients, ...added])
      actions.toast(`Imported ${added.length} from CSV`, 'success')
    }
    reader.readAsText(file)
  }

  const removeRecipient = (phone: string) => {
    setRecipients(recipients.filter((r) => r.phone !== phone))
  }

  const clearRecipients = () => setRecipients([])

  const canSend =
    mode !== 'none' &&
    selectedPhoneNumberId &&
    templateId &&
    recipients.length > 0 &&
    !sending

  const runSend = async () => {
    if (!canSend || !selectedTemplate) return
    setSending(true)
    setProgress({ done: 0, total: recipients.length })
    // Reset any previous statuses
    const initial = recipients.map((r) => ({ ...r, status: 'queued' as SendStatus, error: undefined }))
    setRecipients(initial)

    const successful: Array<{ to: string; body: string; name?: string; wamid?: string }> = []
    let doneCount = 0

    for (let i = 0; i < initial.length; i++) {
      const r = initial[i]
      // Mark as sending
      setRecipients((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: 'sending' } : x)),
      )

      // Build variable values — per-recipient if CSV columns match {{n}} names, else sample values
      const params: string[] = slots.map((s) => samples[s] ?? '')
      const preview = fillMetaBody(bodyText, samples)

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
        setRecipients((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: 'sent', wamid } : x,
          ),
        )
        successful.push({ to: r.phone, body: preview, name: r.name, wamid })
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Send failed'
        setRecipients((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: 'failed', error: msg } : x)),
        )
      }
      doneCount += 1
      setProgress({ done: doneCount, total: initial.length })
    }

    // Log successful sends into the Inbox
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

  const previewText = useMemo(() => fillMetaBody(bodyText, samples), [bodyText, samples])

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
        subtitle="Send any Meta-approved WhatsApp template to any phone number. Paste a list or upload a CSV. Uses live api.dev.getreelax.com."
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

      {/* From number */}
      <div className="rx-card compact rx-mb-4">
        <div className="rx-row" style={{ justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="rx-label" style={{ marginBottom: 4 }}>
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
                <span className="mono rx-text-sm rx-muted">
                  {waNumbers[0]?.phoneDisplay}
                </span>
                <span className="rx-badge success">{waNumbers[0]?.qualityRating}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="rx-split" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Recipients */}
        <div className="rx-card">
          <div className="rx-section-title">
            <span>Recipients</span>
            {recipients.length > 0 && (
              <button type="button" className="rx-btn ghost sm" onClick={clearRecipients}>
                Clear all
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
                onClick={addPastedRecipients}
                disabled={!pasteInput.trim()}
                data-testid="quicksend-add-pasted"
              >
                Add
              </button>
            </div>
          </div>

          <div className="rx-field rx-mb-4">
            <label className="rx-label">Or upload CSV</label>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCsvFile(f)
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
                Detected columns: <span className="mono">{csvHeaders.join(', ')}</span>
                <br />
                Using <span className="mono">{phoneColumn || '—'}</span> as phone column.
              </div>
            ) : (
              <div className="rx-help">
                Any CSV with a column named phone / mobile / whatsapp / number.
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

        {/* Template + preview */}
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
                <span className="rx-caption">These fill in {slots.map((s) => `{{${s}}}`).join(', ')}</span>
              </div>
              <div className="rx-col rx-gap">
                {slots.map((s) => (
                  <div key={s} className="rx-field">
                    <label className="rx-label mono">{`{{${s}}}`}</label>
                    <input
                      className="rx-input"
                      value={samples[s] ?? ''}
                      onChange={(e) => setSamples({ ...samples, [s]: e.target.value })}
                      placeholder={`Value for {{${s}}}`}
                      data-testid={`quicksend-var-${s}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <>
              <div className="rx-section-title">
                <span>Preview</span>
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

function RecipientRow({ r, onRemove }: { r: Recipient; onRemove: () => void }) {
  return (
    <div
      className="rx-row"
      style={{
        padding: '8px 12px',
        background: 'var(--surface-2)',
        borderRadius: 8,
        gap: 10,
      }}
    >
      <StatusIcon status={r.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          +{r.phone}
        </div>
        {r.name ? <div className="rx-text-xs rx-muted">{r.name}</div> : null}
        {r.error ? (
          <div className="rx-text-xs" style={{ color: 'var(--danger)' }}>
            {r.error}
          </div>
        ) : null}
      </div>
      {r.status === 'idle' ? (
        <button
          type="button"
          className="rx-icon-btn"
          onClick={onRemove}
          aria-label="Remove"
        >
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
