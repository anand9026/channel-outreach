import {
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import {
  ApiError,
  listGmailTemplates,
  sendGmailMessage,
  sendGmailTemplate,
  type GmailTemplate,
} from '../lib/api'
import {
  csvEscape,
  findEmailColumn,
  isValidEmail,
  normalizeEmail,
  parseCsv,
  parseEmailList,
} from '../lib/csv'
import { useWhatsAppStore } from '../store/WhatsAppStore'

type SendStatus = 'idle' | 'queued' | 'sending' | 'sent' | 'failed'

type Recipient = {
  email: string
  name?: string
  row?: Record<string, string>
  status: SendStatus
  error?: string
  messageId?: string
}

type ComposeMode = 'compose' | 'template'

const RATE_LIMIT_MS = 200
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function renderNamed(text: string, vars: Record<string, string>, row?: Record<string, string>) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (row && row[key] != null && row[key] !== '') return row[key]
    if (vars[key] != null) return vars[key]
    return `{{${key}}}`
  })
}

/**
 * Email Quick Send — send from connected Gmail to anyone.
 * Compose freeform OR pick a saved Gmail template. Paste emails / CSV.
 */
export function EmailQuickSend() {
  const { state, actions } = useWhatsAppStore()
  const gmailAccount = state.emailAccounts.find((a) => a.provider === 'gmail')
  const fileInput = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ComposeMode>('compose')
  const [subject, setSubject] = useState('Partnership opportunity with {{brand}}')
  const [body, setBody] = useState(
    'Hi {{name}},\n\nWe loved your recent work and would love to collaborate.\n\nWould you be open to a quick chat?\n\nThanks!',
  )
  const [pasteInput, setPasteInput] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [literalVars, setLiteralVars] = useState<Record<string, string>>({
    brand: state.organization.name,
    name: '',
  })

  const [templates, setTemplates] = useState<GmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const selectedTemplate = templates.find((t) => t.template_name === templateName)

  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const templateSlots = useMemo(() => {
    if (!selectedTemplate) return [] as string[]
    const text = `${selectedTemplate.subject_template || ''} ${selectedTemplate.html_template || ''}`
    const found = new Set<string>()
    const re = /\{\{\s*([\w.]+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) found.add(m[1])
    return Array.from(found)
  }, [selectedTemplate])

  const composeSlots = useMemo(() => {
    const text = `${subject}\n${body}`
    const found = new Set<string>()
    const re = /\{\{\s*([\w.]+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) found.add(m[1])
    return Array.from(found)
  }, [subject, body])

  const activeSlots: string[] = mode === 'template' ? templateSlots : composeSlots

  const gmailScope = useMemo(
    () => ({
      user_id: gmailAccount?.userId || undefined,
    }),
    [gmailAccount?.userId],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setTemplatesLoading(true)
      try {
        const list = await listGmailTemplates(gmailScope)
        if (!cancelled) setTemplates(list)
      } catch {
        /* templates optional for compose mode */
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [gmailScope])

  useEffect(() => {
    if (!selectedTemplate) return
    setSubject(selectedTemplate.subject_template || '')
    setBody(selectedTemplate.html_template || selectedTemplate.text_template || '')
  }, [selectedTemplate])

  if (!gmailAccount) {
    return (
      <div className="rx-page">
        <PageHeader
          title="Quick Send"
          subtitle="Email anyone from your connected Gmail account."
        />
        <EmptyState
          icon={<Mail size={20} />}
          title="Connect Gmail to send email"
          body="Authorize Google once on Channels. Then paste addresses or upload a CSV and hit send."
          primaryAction={
            <button
              type="button"
              className="rx-btn primary"
              onClick={() => actions.setTab('connect')}
            >
              Connect Gmail
            </button>
          }
        />
      </div>
    )
  }

  const addPasted = () => {
    const emails = parseEmailList(pasteInput)
    if (emails.length === 0) {
      actions.toast('No valid email addresses found', 'error')
      return
    }
    const existing = new Set(recipients.map((r) => r.email))
    const added = emails.filter((e) => !existing.has(e))
    if (added.length === 0) {
      actions.toast('All addresses already in the list', 'info')
      return
    }
    setRecipients([
      ...recipients,
      ...added.map<Recipient>((email) => ({ email, status: 'idle' })),
    ])
    setPasteInput('')
    actions.toast(`Added ${added.length} recipient${added.length > 1 ? 's' : ''}`, 'success')
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
      const col = findEmailColumn(table.headers)
      setCsvHeaders(table.headers)
      const existing = new Set(recipients.map((r) => r.email))
      const added: Recipient[] = []
      for (const row of table.rows) {
        const raw = col ? row[col] : ''
        const email = normalizeEmail(raw || '')
        if (!isValidEmail(email) || existing.has(email)) continue
        existing.add(email)
        const nameCol = table.headers.find((h) => /^name|first[_ -]?name/i.test(h))
        added.push({
          email,
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

  const canSend =
    recipients.length > 0 &&
    !sending &&
    (mode === 'compose'
      ? subject.trim().length > 0 && body.trim().length > 0
      : Boolean(templateName))

  const runSend = async () => {
    if (!canSend) return
    setSending(true)
    setProgress({ done: 0, total: recipients.length })
    const initial = recipients.map((r) => ({
      ...r,
      status: 'queued' as SendStatus,
      error: undefined,
    }))
    setRecipients(initial)

    let sent = 0
    let failed = 0

    for (let i = 0; i < initial.length; i++) {
      const r = initial[i]
      setRecipients((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: 'sending' } : x)),
      )

      const vars: Record<string, string> = { ...literalVars }
      if (r.name && !vars.name) vars.name = r.name
      if (r.row) {
        for (const [k, v] of Object.entries(r.row)) {
          if (v) vars[k] = v
        }
      }

      try {
        let messageId: string | undefined
        if (mode === 'template' && templateName) {
          const res = await sendGmailTemplate({
            to: r.email,
            template_name: templateName,
            variables: vars,
            user_id: gmailAccount.userId,
          })
          messageId = typeof res?.id === 'string' ? res.id : undefined
        } else {
          const renderedSubject = renderNamed(subject, vars, r.row)
          const renderedBody = renderNamed(body, vars, r.row)
          const res = await sendGmailMessage({
            to: r.email,
            subject: renderedSubject,
            body: renderedBody,
            text_body: renderedBody,
            user_id: gmailAccount.userId,
          })
          messageId = res?.id
        }

        setRecipients((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: 'sent', messageId } : x,
          ),
        )
        sent += 1
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Send failed'
        setRecipients((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: 'failed', error: msg } : x,
          ),
        )
        failed += 1
      }

      setProgress({ done: i + 1, total: initial.length })
      if (i < initial.length - 1) await sleep(RATE_LIMIT_MS)
    }

    setSending(false)
    actions.toast(
      failed === 0
        ? `All ${sent} emails sent`
        : `Sent ${sent}, failed ${failed}`,
      failed === 0 ? 'success' : 'info',
    )
  }

  const downloadResults = () => {
    const headers = ['email', 'name', 'status', 'message_id', 'error', ...csvHeaders]
    const lines = [headers.join(',')]
    for (const r of recipients) {
      lines.push(
        [
          r.email,
          r.name ?? '',
          r.status,
          r.messageId ?? '',
          r.error ?? '',
          ...csvHeaders.map((c) => r.row?.[c] ?? ''),
        ]
          .map(csvEscape)
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `email-send-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const previewVars = {
    ...literalVars,
    ...(recipients[0]?.name ? { name: recipients[0].name } : {}),
    ...(recipients[0]?.row || {}),
  }
  const previewSubject = renderNamed(subject, previewVars, recipients[0]?.row)
  const previewBody = renderNamed(body, previewVars, recipients[0]?.row)

  return (
    <div className="rx-page">
      <PageHeader
        title="Quick Send"
        subtitle={`From ${gmailAccount.fromEmail || 'your Google account'} — paste emails or upload a CSV and send.`}
        actions={
          <button
            type="button"
            className="rx-btn accent"
            disabled={!canSend}
            onClick={() => void runSend()}
            data-testid="email-quicksend-send"
          >
            {sending ? (
              <>
                <Loader2 size={14} className="rx-spin" /> Sending {progress.done}/
                {progress.total}
              </>
            ) : (
              <>
                <Send size={14} /> Send to {recipients.length || 0}{' '}
                {recipients.length === 1 ? 'person' : 'people'}
              </>
            )}
          </button>
        }
      />

      <div className="rx-card compact rx-mb-4">
        <div className="rx-row" style={{ justifyContent: 'space-between' }}>
          <div className="rx-row" style={{ gap: 10 }}>
            <span className="rx-ch-dot email" />
            <div>
              <strong>{gmailAccount.fromName}</strong>
              <div className="mono rx-text-xs rx-muted">
                {gmailAccount.fromEmail || 'Signed in with Google'}
              </div>
            </div>
          </div>
          <span className="rx-badge success">
            <CheckCircle2 size={11} /> Gmail
          </span>
        </div>
      </div>

      <div className="rx-qs-grid">
        <div className="rx-col rx-gap">
          <section className="rx-card">
            <div className="rx-section-title" style={{ marginBottom: 12 }}>
              Message
            </div>
            <div className="rx-seg rx-mb-3">
              <button
                type="button"
                className={`rx-seg-btn${mode === 'compose' ? ' is-active' : ''}`}
                onClick={() => setMode('compose')}
              >
                Compose
              </button>
              <button
                type="button"
                className={`rx-seg-btn${mode === 'template' ? ' is-active' : ''}`}
                onClick={() => setMode('template')}
              >
                Template
              </button>
            </div>

            {mode === 'template' ? (
              <div className="rx-field rx-mb-3">
                <label className="rx-label">Saved Gmail template</label>
                <select
                  className="rx-select"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={templatesLoading}
                >
                  <option value="">
                    {templatesLoading ? 'Loading…' : 'Select a template'}
                  </option>
                  {templates.map((t) => (
                    <option key={t.template_name} value={t.template_name}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
                {!templatesLoading && templates.length === 0 ? (
                  <div className="rx-help">
                    No templates yet — switch to Compose, or create one under Messages.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rx-field rx-mb-3">
              <label className="rx-label">Subject</label>
              <input
                className="rx-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={mode === 'template' && !templateName}
                placeholder="Subject line"
              />
            </div>
            <div className="rx-field">
              <label className="rx-label">Body</label>
              <textarea
                className="rx-textarea"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={mode === 'template' && !templateName}
                placeholder="Write your email… Use {{name}} or {{brand}} for per-row variables."
              />
              <div className="rx-help">
                Use {'{{name}}'}, {'{{brand}}'}, or any CSV column name as a variable.
              </div>
            </div>

            {activeSlots.length > 0 ? (
              <div className="rx-col rx-gap" style={{ marginTop: 14 }}>
                <div className="rx-label">Default variable values</div>
                {activeSlots.map((slot) => (
                  <div key={slot} className="rx-field">
                    <label className="rx-label mono">{`{{${slot}}}`}</label>
                    <input
                      className="rx-input"
                      value={literalVars[slot] ?? ''}
                      onChange={(e) =>
                        setLiteralVars({ ...literalVars, [slot]: e.target.value })
                      }
                      placeholder={
                        csvHeaders.includes(slot)
                          ? `Falls back to CSV column “${slot}”`
                          : 'Literal value'
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rx-card">
            <div className="rx-section-title" style={{ marginBottom: 12 }}>
              Preview
            </div>
            <div className="rx-email-preview">
              <div className="rx-email-preview-meta">
                <div>
                  <span className="rx-muted">From</span> {gmailAccount.fromEmail}
                </div>
                <div>
                  <span className="rx-muted">To</span>{' '}
                  {recipients[0]?.email || 'recipient@example.com'}
                </div>
                <div>
                  <span className="rx-muted">Subject</span> {previewSubject || '—'}
                </div>
              </div>
              <div className="rx-email-preview-body">
                {previewBody || 'Your message will appear here.'}
              </div>
            </div>
          </section>
        </div>

        <div className="rx-col rx-gap">
          <section className="rx-card">
            <div
              className="rx-row"
              style={{ justifyContent: 'space-between', marginBottom: 12 }}
            >
              <div className="rx-section-title" style={{ margin: 0 }}>
                Recipients
              </div>
              {recipients.length > 0 ? (
                <button
                  type="button"
                  className="rx-btn ghost sm"
                  onClick={() => {
                    setRecipients([])
                    setCsvHeaders([])
                  }}
                >
                  <Trash2 size={13} /> Clear
                </button>
              ) : null}
            </div>

            <div className="rx-field rx-mb-3">
              <label className="rx-label">Paste emails</label>
              <textarea
                className="rx-textarea"
                rows={3}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="one@creator.com, two@agency.com&#10;or one per line"
              />
              <button
                type="button"
                className="rx-btn secondary sm"
                style={{ marginTop: 8 }}
                onClick={addPasted}
              >
                Add emails
              </button>
            </div>

            <div className="rx-row" style={{ gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="rx-btn secondary sm"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={13} /> Upload CSV
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleCsv(f)
                  e.target.value = ''
                }}
              />
              {recipients.some((r) => r.status === 'sent' || r.status === 'failed') ? (
                <button
                  type="button"
                  className="rx-btn ghost sm"
                  onClick={downloadResults}
                >
                  Download results
                </button>
              ) : null}
            </div>

            {recipients.length === 0 ? (
              <div className="rx-help">No recipients yet.</div>
            ) : (
              <div className="rx-recipient-list">
                {recipients.map((r) => (
                  <div key={r.email} className="rx-recipient-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 13 }}>
                        {r.email}
                      </div>
                      {r.name ? (
                        <div className="rx-text-xs rx-muted">{r.name}</div>
                      ) : null}
                      {r.error ? (
                        <div className="rx-text-xs" style={{ color: 'var(--danger)' }}>
                          {r.error}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`rx-badge${
                        r.status === 'sent'
                          ? ' success'
                          : r.status === 'failed'
                            ? ' danger'
                            : r.status === 'sending'
                              ? ' warning'
                              : ''
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.status === 'idle' || r.status === 'queued' ? (
                      <button
                        type="button"
                        className="rx-icon-btn"
                        aria-label="Remove"
                        onClick={() =>
                          setRecipients(recipients.filter((x) => x.email !== r.email))
                        }
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
