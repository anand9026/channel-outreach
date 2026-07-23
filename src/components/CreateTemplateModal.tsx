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
  onCreated: () => void
}

/**
 * Template create = Meta script only (name, category, body, sample values).
 * No brand / influencer / audience mapping here — that belongs at send time.
 */
export function CreateTemplateModal({ open, onClose, onCreated }: Props) {
  const { actions } = useWhatsAppStore()
  const [channel, setChannel] = useState<OutreachChannel>('whatsapp')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('UTILITY')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hello {{1}}, thanks for connecting with us.')
  const [samples, setSamples] = useState<Record<string, string>>({ '1': 'Anand' })
  const [submitting, setSubmitting] = useState(false)

  const slots = useMemo(() => extractMetaSlots(body), [body])
  const previewBody = useMemo(() => {
    return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => samples[n] || `{{${n}}}`)
  }, [body, samples])

  if (!open) return null

  const reset = () => {
    setName('')
    setBody('Hello {{1}}, thanks for connecting with us.')
    setSubject('')
    setSamples({ '1': 'Anand' })
    setChannel('whatsapp')
    setCategory('UTILITY')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
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
        onCreated()
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
    onCreated()
    onClose()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-wide">
        <h3>Create template</h3>
        <p className="muted">
          Script for Meta approval only — name, category, body, samples. Map CSV / phones /
          influencers later when you send.
        </p>

        <div className="stack gap-3" style={{ marginTop: 12 }}>
          <div className="segmented full">
            <button
              type="button"
              className={channel === 'whatsapp' ? 'active wa' : ''}
              onClick={() => setChannel('whatsapp')}
            >
              WhatsApp → Meta
            </button>
            <button
              type="button"
              className={channel === 'email' ? 'active email' : ''}
              onClick={() => setChannel('email')}
            >
              Email (local)
            </button>
          </div>

          <div className="form-grid-2">
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="welcome_outreach_v1"
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {channel === 'email' ? (
            <label className="field">
              <span>Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
          ) : null}

          <label className="field">
            <span>
              Body{channel === 'whatsapp' ? ' (use {{1}}, {{2}} …)' : ''}
            </span>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          {channel === 'whatsapp' && slots.length > 0 ? (
            <div className="stack gap-2">
              <p className="field-label">Sample values (required by Meta review)</p>
              {slots.map((s) => (
                <label key={s} className="field">
                  <span>{`{{${s}}}`}</span>
                  <input
                    value={samples[s] ?? ''}
                    onChange={(e) =>
                      setSamples((prev) => ({ ...prev, [s]: e.target.value }))
                    }
                    placeholder={`Sample for {{${s}}}`}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="preview-box">
            <p className="muted-xs">Preview with samples</p>
            {channel === 'email' && subject ? (
              <p>
                <strong>{subject}</strong>
              </p>
            ) : null}
            <p>{previewBody}</p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn primary ${channel === 'email' ? 'email' : 'wa'}`}
            disabled={submitting}
            onClick={() => void handleSubmit()}
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
