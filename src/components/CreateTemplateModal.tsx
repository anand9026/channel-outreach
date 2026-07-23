import { useMemo, useState } from 'react'
import { VariableMapper } from './VariableMapper'
import { ApiError, createWhatsAppTemplate } from '../lib/api'
import { toMetaBody, toMetaTemplateName } from '../lib/metaTemplate'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel, TemplateCategory, VariableBinding } from '../types'

const categories: TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateTemplateModal({ open, onClose, onCreated }: Props) {
  const { state, actions } = useWhatsAppStore()
  const hasBrands = state.brands.length > 0

  const [channel, setChannel] = useState<OutreachChannel>('whatsapp')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('UTILITY')
  const [brandId, setBrandId] = useState('any')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hello {{1}}, thanks for connecting with us.')
  const [bindings, setBindings] = useState<VariableBinding[]>([])
  const [sample1, setSample1] = useState('Anand')
  const [submitting, setSubmitting] = useState(false)

  const previewCampaign = state.campaigns[0] ?? null
  const previewBrand = previewCampaign?.brandId
    ? state.brands.find((b) => b.id === previewCampaign.brandId) ?? null
    : null
  const previewInf = state.influencers[0] ?? null

  const ctx = useMemo(
    () => ({
      org: state.organization,
      brand: previewBrand,
      campaign: previewCampaign,
      influencer: previewInf,
    }),
    [state.organization, previewBrand, previewCampaign, previewInf],
  )

  if (!open) return null

  const reset = () => {
    setName('')
    setBody('Hello {{1}}, thanks for connecting with us.')
    setSubject('')
    setBindings([])
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
      const exampleValues =
        examples.length > 0
          ? examples.map((ex, i) => (i === 0 && sample1.trim() ? sample1.trim() : ex))
          : sample1.trim()
            ? [sample1.trim()]
            : undefined

      setSubmitting(true)
      try {
        await createWhatsAppTemplate({
          name: metaName,
          category,
          language: 'en_US',
          body: text,
          exampleValues,
        })
        actions.submitTemplate({
          channel: 'whatsapp',
          name: metaName,
          category,
          body: text,
          bindings,
          brandId: brandId === 'any' ? null : brandId,
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
      bindings,
      brandId: brandId === 'any' ? null : brandId,
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
          Meta templates only need body + samples. Map CSV / influencer fields later at send time.
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
            <label className="field">
              <span>Brand scope</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="any">Any / org-level</option>
                {state.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {channel === 'whatsapp' ? (
              <label className="field">
                <span>Sample for {'{{1}}'} (Meta review)</span>
                <input
                  value={sample1}
                  onChange={(e) => setSample1(e.target.value)}
                  placeholder="Anand"
                />
              </label>
            ) : null}
          </div>

          {channel === 'whatsapp' ? (
            <label className="field">
              <span>Body (use {'{{1}}'}, {'{{2}}'} … for variables)</span>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
          ) : (
            <VariableMapper
              body={body}
              subject={subject}
              showSubject
              bindings={bindings}
              ctx={ctx}
              hasBrands={hasBrands}
              onBodyChange={setBody}
              onSubjectChange={setSubject}
              onBindingsChange={setBindings}
              compact
            />
          )}
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
