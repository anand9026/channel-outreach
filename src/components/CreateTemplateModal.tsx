import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ApiError, createWhatsAppTemplate } from '../lib/api'
import { extractMetaSlots } from '../lib/templateSlots'
import { toMetaBody, toMetaTemplateName } from '../lib/metaTemplate'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel, TemplateCategory } from '../types'

const categories: TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

/**
 * Create a template (Meta WhatsApp or local email script).
 * Kept the underlying submit logic intact — just modernized the UI.
 */
export function CreateTemplateModal({ open, onClose, onCreated }: Props) {
  const { actions } = useWhatsAppStore()
  const [channel, setChannel] = useState<OutreachChannel>('whatsapp')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('UTILITY')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hello {{1}}, thanks for connecting with us.')
  const [samples, setSamples] = useState<Record<string, string>>({ '1': 'Priya' })
  const [submitting, setSubmitting] = useState(false)

  const slots = useMemo(() => extractMetaSlots(body), [body])
  const previewBody = useMemo(
    () => body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => samples[n] || `{{${n}}}`),
    [body, samples],
  )

  if (!open) return null

  const reset = () => {
    setName('')
    setBody('Hello {{1}}, thanks for connecting with us.')
    setSubject('')
    setSamples({ '1': 'Priya' })
    setChannel('whatsapp')
    setCategory('UTILITY')
  }

  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    if (!name.trim() || !body.trim()) {
      actions.toast('Name and body are required', 'error')
      return
    }

    if (channel === 'whatsapp') {
      const metaName = toMetaTemplateName(name)
      if (!metaName) {
        actions.toast('Invalid template name', 'error')
        return
      }
      const { text, examples } = toMetaBody(body.trim())
      const exampleValues = examples.map((ex, i) => {
        const slot = String(i + 1)
        return samples[slot]?.trim() || ex
      })

      setSubmitting(true)
      try {
        await createWhatsAppTemplate({
          name: metaName,
          category,
          language: 'en_US',
          body: text,
          exampleValues: exampleValues.length ? exampleValues : undefined,
        })
        actions.submitTemplate({
          channel: 'whatsapp',
          name: metaName,
          category,
          body: text,
          bindings: [],
          brandId: null,
        })
        actions.toast(`Submitted ${metaName} to Meta`, 'success')
        reset()
        onCreated?.()
        onClose()
      } catch (err) {
        actions.toast(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Create failed',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!subject.trim()) {
      actions.toast('Email subject is required', 'error')
      return
    }
    actions.submitTemplate({
      channel: 'email',
      name: name.trim(),
      category,
      subject: subject.trim(),
      body: body.trim(),
      bindings: [],
      brandId: null,
    })
    reset()
    onCreated?.()
    onClose()
  }

  return (
    <div className="rx-modal-scrim" role="dialog" aria-modal="true" onClick={close}>
      <div className="rx-modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <div className="rx-modal-head">
          <div className="rx-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="rx-modal-title">Create template</div>
              <div className="rx-text-xs rx-muted" style={{ marginTop: 4 }}>
                Script for Meta approval or local email use — map to creators at send time.
              </div>
            </div>
            <button className="rx-icon-btn" onClick={close} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="rx-modal-body">
          <div className="rx-seg">
            <button
              className={`rx-seg-btn${channel === 'whatsapp' ? ' is-active' : ''}`}
              onClick={() => setChannel('whatsapp')}
            >
              WhatsApp
            </button>
            <button
              className={`rx-seg-btn${channel === 'email' ? ' is-active' : ''}`}
              onClick={() => setChannel('email')}
            >
              Email
            </button>
          </div>

          <div className="rx-field">
            <label className="rx-label">Template name</label>
            <input
              className="rx-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="welcome_outreach_v1"
              data-testid="tpl-name"
            />
          </div>

          <div className="rx-field">
            <label className="rx-label">Category</label>
            <select
              className="rx-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {channel === 'email' && (
            <div className="rx-field">
              <label className="rx-label">Subject</label>
              <input
                className="rx-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Would love to collaborate"
              />
            </div>
          )}

          <div className="rx-field">
            <label className="rx-label">
              Body{channel === 'whatsapp' ? ' — use {{1}}, {{2}} … for variables' : ''}
            </label>
            <textarea
              className="rx-textarea"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {channel === 'whatsapp' && slots.length > 0 && (
            <div className="rx-col rx-gap">
              <div className="rx-label">Sample values (required by Meta review)</div>
              {slots.map((s) => (
                <div key={s} className="rx-field">
                  <label className="rx-label mono">{`{{${s}}}`}</label>
                  <input
                    className="rx-input"
                    value={samples[s] ?? ''}
                    onChange={(e) => setSamples((prev) => ({ ...prev, [s]: e.target.value }))}
                    placeholder={`Sample for {{${s}}}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className={`rx-preview ${channel}`}>
            {channel === 'email' && subject ? (
              <div className="rx-subject">
                <strong>{subject}</strong>
              </div>
            ) : null}
            {previewBody}
          </div>
        </div>

        <div className="rx-modal-foot">
          <button type="button" className="rx-btn ghost" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="rx-btn primary"
            disabled={submitting}
            onClick={() => void submit()}
            data-testid="tpl-submit"
          >
            {submitting
              ? 'Submitting…'
              : channel === 'whatsapp'
                ? 'Submit to Meta'
                : 'Save email script'}
          </button>
        </div>
      </div>
    </div>
  )
}
