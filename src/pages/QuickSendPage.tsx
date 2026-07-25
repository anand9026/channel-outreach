import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  History,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Send,
  Square,
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
import {
  csvEscape,
  findPhoneColumn,
  normalizePhone,
  parseCsv,
  parsePhoneList,
} from '../lib/csv'
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

/** Historical / scheduled send batch. */
type SendBatch = {
  id: string
  createdAt: string
  templateId: string
  templateName: string
  templateLanguage?: string
  phoneDisplay: string
  phoneNumberId: string
  totalCount: number
  sentCount: number
  failedCount: number
  /** ISO timestamp — present when batch was scheduled */
  scheduledFor?: string
  /** completed | scheduled | cancelled | missed */
  status?: 'completed' | 'scheduled' | 'cancelled' | 'missed'
  /** Full body text + variable bindings — needed to actually send when the schedule fires */
  bodyText?: string
  bindings?: Record<string, VarBinding>
  slots?: string[]
  recipients: Array<
    Omit<Recipient, 'status'> & { status: 'sent' | 'failed' | 'queued'; body: string }
  >
}

const STORAGE_KEY = 'rx-quicksend-v2'
const BATCHES_KEY = 'rx-quicksend-batches-v1'
const MAX_BATCHES = 20
const RATE_LIMIT_MS = 250
const RATE_LIMIT_THRESHOLD = 50

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

/* ---------------- Batch history storage ---------------- */
function loadBatches(): SendBatch[] {
  try {
    const raw = window.localStorage.getItem(BATCHES_KEY)
    return raw ? (JSON.parse(raw) as SendBatch[]) : []
  } catch {
    return []
  }
}

function saveBatches(batches: SendBatch[]) {
  try {
    window.localStorage.setItem(BATCHES_KEY, JSON.stringify(batches.slice(0, MAX_BATCHES)))
  } catch {
    /* ignore */
  }
}

/* ---------------- Helpers ---------------- */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Returns a `yyyy-MM-ddTHH:mm` local string 15 min in the future (shape `<input type="datetime-local">` expects). */
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 15 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatSchedule(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}


function downloadResultsCsv(
  batch: SendBatch | { templateName: string; recipients: SendBatch['recipients']; createdAt: string },
) {
  // Union of all extra CSV columns across recipients
  const extraCols = new Set<string>()
  for (const r of batch.recipients) {
    if (r.row) for (const k of Object.keys(r.row)) extraCols.add(k)
  }
  const extra = Array.from(extraCols)

  const headers = ['phone', 'name', 'status', 'wamid', 'error', 'body', 'sent_at', ...extra]
  const lines = [headers.join(',')]
  for (const r of batch.recipients) {
    const row = [
      r.phone,
      r.name ?? '',
      r.status,
      r.wamid ?? '',
      r.error ?? '',
      r.body ?? '',
      batch.createdAt,
      ...extra.map((c) => r.row?.[c] ?? ''),
    ]
    lines.push(row.map(csvEscape).join(','))
  }
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quicksend-${batch.templateName || 'batch'}-${batch.createdAt.slice(0, 19).replace(/[:.]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
  const [batches, setBatches] = useState<SendBatch[]>([])
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const controllerRef = useRef<{ paused: boolean; cancelled: boolean }>({
    paused: false,
    cancelled: false,
  })
  const scheduleTimers = useRef<Record<string, number>>({})

  // Schedule state
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledFor, setScheduledFor] = useState<string>(defaultScheduleValue())

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
    setBatches(loadBatches())
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

  const throttleMs = recipients.length > RATE_LIMIT_THRESHOLD ? RATE_LIMIT_MS : 0

  /** Wait while paused; return true if cancelled. */
  const gate = async (): Promise<boolean> => {
    while (controllerRef.current.paused && !controllerRef.current.cancelled) {
      await sleep(150)
    }
    return controllerRef.current.cancelled
  }

  const pauseRun = () => {
    controllerRef.current.paused = true
    setPaused(true)
  }
  const resumeRun = () => {
    controllerRef.current.paused = false
    setPaused(false)
  }
  const stopRun = () => {
    controllerRef.current.cancelled = true
    controllerRef.current.paused = false
    setPaused(false)
  }

  const runSend = async () => {
    if (!canSend || !selectedTemplate) return
    controllerRef.current = { paused: false, cancelled: false }
    setPaused(false)
    setSending(true)
    setProgress({ done: 0, total: recipients.length })
    const initial = recipients.map((r) => ({ ...r, status: 'queued' as SendStatus, error: undefined }))
    setRecipients(initial)

    const successful: Array<{ to: string; body: string; name?: string; wamid?: string }> = []
    // Per-recipient result rows for the batch snapshot
    const batchResults: SendBatch['recipients'] = []
    let doneCount = 0
    let stoppedEarly = false

    for (let i = 0; i < initial.length; i++) {
      // Honour pause/stop between recipients
      if (await gate()) {
        stoppedEarly = true
        // Mark remaining recipients as failed (cancelled)
        for (let j = i; j < initial.length; j++) {
          const rr = initial[j]
          setRecipients((prev) =>
            prev.map((x, idx) =>
              idx === j ? { ...x, status: 'failed', error: 'Cancelled' } : x,
            ),
          )
          const preview = renderBody(bodyText, bindings, rr.row)
          batchResults.push({
            phone: rr.phone,
            name: rr.name,
            row: rr.row,
            status: 'failed',
            error: 'Cancelled',
            body: preview,
          })
        }
        break
      }

      const r = initial[i]
      setRecipients((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: 'sending' } : x)))

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
        batchResults.push({
          phone: r.phone,
          name: r.name,
          row: r.row,
          status: 'sent',
          wamid,
          body: preview,
        })
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Send failed'
        setRecipients((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: 'failed', error: msg } : x)))
        batchResults.push({
          phone: r.phone,
          name: r.name,
          row: r.row,
          status: 'failed',
          error: msg,
          body: preview,
        })
      }
      doneCount += 1
      setProgress({ done: doneCount, total: initial.length })

      // Rate limit between sends (only for batches > threshold)
      if (throttleMs > 0 && i < initial.length - 1) {
        await sleep(throttleMs)
      }
    }

    if (successful.length > 0) {
      actions.logWhatsAppSends({
        sends: successful,
        phoneNumberId: selectedPhoneNumberId,
        campaignId: null,
      })
    }

    // Save the batch to history
    const failedCount = batchResults.filter((r) => r.status === 'failed').length
    const newBatch: SendBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language || 'en_US',
      phoneDisplay: waNumbers.find((n) => n.phoneNumberId === selectedPhoneNumberId)?.phoneDisplay || '',
      phoneNumberId: selectedPhoneNumberId,
      totalCount: batchResults.length,
      sentCount: successful.length,
      failedCount,
      status: stoppedEarly ? 'cancelled' : 'completed',
      recipients: batchResults,
    }
    const updated = [newBatch, ...batches.filter((b) => b.status !== 'scheduled' || b.id !== newBatch.id)]
      .slice(0, MAX_BATCHES)
    setBatches(updated)
    saveBatches(updated)
    setExpandedBatch(newBatch.id)

    setSending(false)
    controllerRef.current = { paused: false, cancelled: false }
    actions.toast(
      stoppedEarly
        ? `Stopped. ${successful.length} sent, ${failedCount - (initial.length - doneCount)} failed, ${initial.length - doneCount} cancelled.`
        : failedCount === 0
          ? `All ${successful.length} messages sent`
          : `Sent ${successful.length}, failed ${failedCount}`,
      stoppedEarly ? 'info' : failedCount === 0 ? 'success' : 'info',
    )
  }

  /* ---------------- Scheduling ---------------- */

  /** Save a scheduled batch and register a timer to fire it. */
  const scheduleBatch = () => {
    if (!selectedTemplate || recipients.length === 0) return
    const scheduledAt = new Date(scheduledFor)
    if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      actions.toast('Pick a time in the future', 'error')
      return
    }
    const iso = scheduledAt.toISOString()
    const batch: SendBatch = {
      id: `batch_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      scheduledFor: iso,
      status: 'scheduled',
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language || 'en_US',
      phoneDisplay: waNumbers.find((n) => n.phoneNumberId === selectedPhoneNumberId)?.phoneDisplay || '',
      phoneNumberId: selectedPhoneNumberId,
      totalCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      bodyText,
      bindings,
      slots,
      recipients: recipients.map((r) => ({
        phone: r.phone,
        name: r.name,
        row: r.row,
        status: 'queued',
        body: renderBody(bodyText, bindings, r.row),
      })),
    }
    const updated = [batch, ...batches].slice(0, MAX_BATCHES)
    setBatches(updated)
    saveBatches(updated)
    setExpandedBatch(batch.id)
    armTimer(batch)
    actions.toast(`Scheduled for ${formatSchedule(iso)}`, 'success')
    // Clear current recipients so user knows it's queued
    setRecipients([])
  }

  const cancelScheduled = (id: string) => {
    const t = scheduleTimers.current[id]
    if (t) {
      window.clearTimeout(t)
      delete scheduleTimers.current[id]
    }
    const updated = batches.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b))
    setBatches(updated)
    saveBatches(updated)
    actions.toast('Scheduled batch cancelled', 'info')
  }

  /** Send the current template (with sample values) to the user's own number. */
  const sendTest = async () => {
    if (!selectedTemplate || waNumbers.length === 0) return
    const self = waNumbers.find((n) => n.phoneNumberId === selectedPhoneNumberId) || waNumbers[0]
    const selfPhone = normalizePhone(self.phoneDisplay)
    if (selfPhone.length < 10) {
      actions.toast('Could not derive test phone from your WA number', 'error')
      return
    }
    const params = paramsFor(slots, bindings)
    const preview = renderBody(bodyText, bindings)
    try {
      await sendWhatsAppTemplate({
        to: selfPhone,
        template_name: selectedTemplate.name,
        language_code: selectedTemplate.language || 'en_US',
        bodyParams: params.length ? params : undefined,
        phone_number_id: self.phoneNumberId,
        preview_body: preview,
      })
      actions.toast(`Test sent to ${self.phoneDisplay}`, 'success')
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Test send failed'
      actions.toast(msg, 'error')
    }
  }

  /** Restore only the FAILED recipients from a batch into the current draft, so user can retry. */
  const retryFailed = (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId)
    if (!batch) return
    const failedOnly = batch.recipients
      .filter((r) => r.status === 'failed')
      .map<Recipient>((r) => ({ phone: r.phone, name: r.name, row: r.row, status: 'idle' }))
    if (failedOnly.length === 0) {
      actions.toast('No failed recipients to retry', 'info')
      return
    }
    setTemplateId(batch.templateId)
    if (batch.bindings) setBindings(batch.bindings)
    // Detect if any recipients had CSV rows and rebuild headers
    const headerSet = new Set<string>()
    for (const r of failedOnly) if (r.row) Object.keys(r.row).forEach((k) => headerSet.add(k))
    if (headerSet.size > 0) setCsvHeaders(Array.from(headerSet))
    setRecipients(failedOnly)
    setScheduleMode('now')
    setExpandedBatch(null)
    actions.toast(
      `Loaded ${failedOnly.length} failed recipient${failedOnly.length === 1 ? '' : 's'} — review and hit Send`,
      'success',
    )
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Execute a saved scheduled batch: run all recipients using its embedded config. */
  const executeScheduledBatch = async (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId)
    if (!batch || batch.status !== 'scheduled') return
    const template = templates.find((t) => t.id === batch.templateId)
    if (!template) {
      // Template no longer available — mark missed
      const updated = batches.map((b) =>
        b.id === batchId ? { ...b, status: 'missed' as const } : b,
      )
      setBatches(updated)
      saveBatches(updated)
      actions.toast(`Scheduled batch skipped — template unavailable`, 'error')
      return
    }
    // Load the recipients into the page & runSend
    const restored: Recipient[] = batch.recipients.map((r) => ({
      phone: r.phone,
      name: r.name,
      row: r.row,
      status: 'idle',
    }))
    setTemplateId(batch.templateId)
    setBindings(batch.bindings ?? {})
    setRecipients(restored)
    // Remove the scheduled batch entry — a completed one will be added by runSend
    const updated = batches.filter((b) => b.id !== batchId)
    setBatches(updated)
    saveBatches(updated)
    // Kick off the send on next tick so state settles
    setTimeout(() => void runSend(), 100)
  }

  const armTimer = (batch: SendBatch) => {
    if (!batch.scheduledFor) return
    const delay = new Date(batch.scheduledFor).getTime() - Date.now()
    if (delay <= 0) {
      // Fire immediately (missed)
      void executeScheduledBatch(batch.id)
      return
    }
    // Cap at ~2 hours per timer (browsers throttle long timers)
    const capped = Math.min(delay, 2 * 60 * 60 * 1000)
    scheduleTimers.current[batch.id] = window.setTimeout(() => {
      const b = loadBatches().find((x) => x.id === batch.id)
      if (b && b.status === 'scheduled') {
        if (new Date(b.scheduledFor!).getTime() <= Date.now() + 1000) {
          void executeScheduledBatch(b.id)
        } else {
          armTimer(b)
        }
      }
    }, capped)
  }

  // On mount & when batches change, arm timers for scheduled batches with no timer set
  useEffect(() => {
    if (!restored) return
    for (const b of batches) {
      if (b.status === 'scheduled' && !scheduleTimers.current[b.id]) {
        armTimer(b)
      }
    }
    return () => {
      for (const id in scheduleTimers.current) {
        window.clearTimeout(scheduleTimers.current[id])
      }
      scheduleTimers.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, batches.length])

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
          <>
          <button
            type="button"
            className="rx-btn accent"
            onClick={() => {
              if (scheduleMode === 'later') scheduleBatch()
              else void runSend()
            }}
            disabled={!canSend}
            data-testid="quicksend-send"
          >
            {sending ? (
              <>
                <Loader2 size={14} className="rx-spin" /> Sending {progress.done}/{progress.total}
              </>
            ) : scheduleMode === 'later' ? (
              <>
                <Calendar size={14} /> Schedule for {recipients.length || 0} number
                {recipients.length === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <Send size={14} /> Send to {recipients.length || 0} number
                {recipients.length === 1 ? '' : 's'}
              </>
            )}
          </button>
          <button
            type="button"
            className="rx-btn secondary"
            onClick={() => void sendTest()}
            disabled={!templateId || sending || waNumbers.length === 0}
            title="Send this template to your own connected WhatsApp number"
            data-testid="quicksend-test"
          >
            <Zap size={14} /> Send test to me
          </button>
          </>
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

      {/* Timing (Send now / Schedule) */}
      <div className="rx-card compact rx-mb-4" data-testid="quicksend-timing">
        <div className="rx-row" style={{ justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rx-label" style={{ marginBottom: 6 }}>
              Timing
            </div>
            <div className="rx-seg">
              <button
                className={`rx-seg-btn${scheduleMode === 'now' ? ' is-active' : ''}`}
                onClick={() => setScheduleMode('now')}
                data-testid="timing-now"
              >
                <Send size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
                Send now
              </button>
              <button
                className={`rx-seg-btn${scheduleMode === 'later' ? ' is-active' : ''}`}
                onClick={() => setScheduleMode('later')}
                data-testid="timing-later"
              >
                <Calendar
                  size={12}
                  style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }}
                />
                Schedule for later
              </button>
            </div>
          </div>
          {scheduleMode === 'later' && (
            <div style={{ flex: 1 }}>
              <div className="rx-label" style={{ marginBottom: 6 }}>
                When
              </div>
              <input
                type="datetime-local"
                className="rx-input"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                data-testid="quicksend-schedule-time"
              />
            </div>
          )}
        </div>
        {recipients.length > RATE_LIMIT_THRESHOLD && (
          <div className="rx-help rx-mt-2">
            <Clock size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
            Batches over {RATE_LIMIT_THRESHOLD} recipients auto-throttle to {RATE_LIMIT_MS}ms
            between sends to respect Meta&rsquo;s messaging tier limits.
          </div>
        )}
      </div>

      {/* Send controller (pause / resume / stop) */}
      {sending && (
        <div
          className="rx-card compact rx-mb-4"
          style={{
            borderColor: 'var(--accent)',
            background: 'var(--accent-soft)',
          }}
          data-testid="send-controller"
        >
          <div className="rx-row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {paused ? 'Paused' : 'Sending'} — {progress.done} of {progress.total}
              </div>
              <div className="rx-text-xs rx-muted" style={{ marginTop: 2 }}>
                {throttleMs > 0 ? `Throttled ${throttleMs}ms between sends` : 'No throttle'}
              </div>
            </div>
            <div className="rx-row" style={{ gap: 6 }}>
              {paused ? (
                <button
                  type="button"
                  className="rx-btn primary sm"
                  onClick={resumeRun}
                  data-testid="controller-resume"
                >
                  <Play size={12} /> Resume
                </button>
              ) : (
                <button
                  type="button"
                  className="rx-btn secondary sm"
                  onClick={pauseRun}
                  data-testid="controller-pause"
                >
                  <Pause size={12} /> Pause
                </button>
              )}
              <button
                type="button"
                className="rx-btn danger sm"
                onClick={stopRun}
                data-testid="controller-stop"
              >
                <Square size={12} /> Stop
              </button>
            </div>
          </div>
          <div className="rx-progress rx-mt-2" style={{ width: '100%' }}>
            <span
              style={{
                width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

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
                <span className="rx-row" style={{ gap: 8 }}>
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
                  {totalSent + totalFailed > 0 && (
                    <button
                      type="button"
                      className="rx-btn ghost sm"
                      onClick={() => {
                        // Build a synthetic batch from the current in-page recipients
                        const results = recipients
                          .filter((r) => r.status === 'sent' || r.status === 'failed')
                          .map((r) => ({
                            phone: r.phone,
                            name: r.name,
                            row: r.row,
                            status: r.status as 'sent' | 'failed',
                            wamid: r.wamid,
                            error: r.error,
                            body: renderBody(bodyText, bindings, r.row),
                          }))
                        downloadResultsCsv({
                          templateName: selectedTemplate?.name || 'quicksend',
                          createdAt: new Date().toISOString(),
                          recipients: results,
                        })
                      }}
                      data-testid="quicksend-export-current"
                    >
                      <Download size={12} /> Export CSV
                    </button>
                  )}
                </span>
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

      {/* -------- Recent batches -------- */}
      <RecentBatches
        batches={batches}
        expandedId={expandedBatch}
        onToggle={(id) => setExpandedBatch(expandedBatch === id ? null : id)}
        onClearAll={() => {
          // Clear any active schedule timers first
          for (const id in scheduleTimers.current) {
            window.clearTimeout(scheduleTimers.current[id])
          }
          scheduleTimers.current = {}
          setBatches([])
          saveBatches([])
          setExpandedBatch(null)
        }}
        onDelete={(id) => {
          if (scheduleTimers.current[id]) {
            window.clearTimeout(scheduleTimers.current[id])
            delete scheduleTimers.current[id]
          }
          const next = batches.filter((b) => b.id !== id)
          setBatches(next)
          saveBatches(next)
          if (expandedBatch === id) setExpandedBatch(null)
        }}
        onCancelSchedule={cancelScheduled}
        onRetryFailed={retryFailed}
      />
    </div>
  )
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

/* -------------------- Recent batches panel -------------------- */
function RecentBatches({
  batches,
  expandedId,
  onToggle,
  onClearAll,
  onDelete,
  onCancelSchedule,
  onRetryFailed,
}: {
  batches: SendBatch[]
  expandedId: string | null
  onToggle: (id: string) => void
  onClearAll: () => void
  onDelete: (id: string) => void
  onCancelSchedule: (id: string) => void
  onRetryFailed: (id: string) => void
}) {
  if (batches.length === 0) return null
  return (
    <section style={{ marginTop: 32 }}>
      <div className="rx-row rx-mb-4" style={{ justifyContent: 'space-between' }}>
        <div className="rx-row">
          <History size={16} style={{ color: 'var(--text-3)' }} />
          <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>
            Recent send batches
          </h2>
          <span className="rx-text-2 rx-text-sm">· last {batches.length}</span>
        </div>
        <button
          type="button"
          className="rx-btn ghost sm"
          onClick={onClearAll}
          data-testid="quicksend-clear-batches"
        >
          <Trash2 size={12} /> Clear history
        </button>
      </div>

      <div className="rx-col rx-gap">
        {batches.map((b) => (
          <BatchRow
            key={b.id}
            batch={b}
            expanded={expandedId === b.id}
            onToggle={() => onToggle(b.id)}
            onDelete={() => onDelete(b.id)}
            onCancelSchedule={() => onCancelSchedule(b.id)}
            onRetryFailed={() => onRetryFailed(b.id)}
          />
        ))}
      </div>
    </section>
  )
}

function BatchRow({
  batch,
  expanded,
  onToggle,
  onDelete,
  onCancelSchedule,
  onRetryFailed,
}: {
  batch: SendBatch
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onCancelSchedule: () => void
  onRetryFailed: () => void
}) {
  const when = new Date(batch.createdAt)
  const timeAgo = formatRelative(when)
  const isScheduled = batch.status === 'scheduled'
  const isCancelled = batch.status === 'cancelled'
  const isMissed = batch.status === 'missed'
  return (
    <div className="rx-card compact" style={{ padding: 0 }} data-testid={`batch-${batch.id}`}>
      <div
        className="rx-row"
        style={{
          padding: '14px 18px',
          justifyContent: 'space-between',
          gap: 16,
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <div className="rx-row" style={{ gap: 12, minWidth: 0, flex: 1 }}>
          <button
            type="button"
            className="rx-icon-btn"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rx-row" style={{ gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{batch.templateName}</strong>
              {isScheduled && (
                <span className="rx-badge info">
                  <Calendar size={11} /> Scheduled
                </span>
              )}
              {isCancelled && <span className="rx-badge">Cancelled</span>}
              {isMissed && <span className="rx-badge danger">Missed</span>}
              {!isScheduled && !isCancelled && !isMissed && (
                <>
                  <span className="rx-badge">{batch.sentCount} sent</span>
                  {batch.failedCount > 0 && (
                    <span className="rx-badge danger">{batch.failedCount} failed</span>
                  )}
                  {batch.sentCount > 0 && batch.failedCount === 0 && (
                    <span className="rx-badge success">All delivered</span>
                  )}
                </>
              )}
            </div>
            <div className="rx-text-xs rx-muted" style={{ marginTop: 3 }}>
              {isScheduled && batch.scheduledFor ? (
                <>
                  Fires <strong>{formatSchedule(batch.scheduledFor)}</strong> · from{' '}
                  <span className="mono">{batch.phoneDisplay}</span> · {batch.totalCount} queued
                </>
              ) : (
                <>
                  {timeAgo} · from <span className="mono">{batch.phoneDisplay}</span>
                  {' · '}
                  {batch.totalCount} total
                </>
              )}
            </div>
          </div>
        </div>
        <div className="rx-row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
          {isScheduled ? (
            <button
              type="button"
              className="rx-btn danger sm"
              onClick={onCancelSchedule}
              data-testid={`batch-cancel-${batch.id}`}
            >
              <X size={12} /> Cancel
            </button>
          ) : (
            <>
              {batch.failedCount > 0 && (
                <button
                  type="button"
                  className="rx-btn secondary sm"
                  onClick={onRetryFailed}
                  data-testid={`batch-retry-${batch.id}`}
                  title="Load failed recipients into a new draft"
                >
                  <RefreshCw size={12} /> Retry failed
                </button>
              )}
              <button
                type="button"
                className="rx-btn secondary sm"
                onClick={() => downloadResultsCsv(batch)}
                data-testid={`batch-export-${batch.id}`}
              >
                <Download size={12} /> Export CSV
              </button>
            </>
          )}
          <button
            type="button"
            className="rx-icon-btn"
            aria-label="Delete batch"
            onClick={onDelete}
            data-testid={`batch-delete-${batch.id}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}>
          <table className="rx-table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Name</th>
                <th>Status</th>
                <th>Message ID</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {batch.recipients.map((r, i) => (
                <tr key={`${r.phone}-${i}`}>
                  <td className="mono rx-text-sm">+{r.phone}</td>
                  <td>{r.name || <span className="rx-muted">—</span>}</td>
                  <td>
                    <span className={`rx-badge ${r.status === 'sent' ? 'success' : 'danger'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="mono rx-text-xs">
                    {r.wamid ? r.wamid.slice(0, 24) + '…' : <span className="rx-muted">—</span>}
                  </td>
                  <td className="rx-text-xs" style={{ color: r.error ? 'var(--danger)' : undefined }}>
                    {r.error || <span className="rx-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
