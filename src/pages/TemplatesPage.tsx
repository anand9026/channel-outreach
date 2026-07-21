import { useMemo, useState } from 'react'
import { ChannelBadge, TemplateStatusBadge } from '../components/StatusBadge'
import { VariableMapper } from '../components/VariableMapper'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel, TemplateCategory, VariableBinding } from '../types'

const categories: TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

export function TemplatesPage() {
  const { state, actions } = useWhatsAppStore()
  const hasBrands = state.brands.length > 0
  const [channel, setChannel] = useState<OutreachChannel>(
    state.whatsAppNumbers.length ? 'whatsapp' : 'email',
  )
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('MARKETING')
  const [brandId, setBrandId] = useState<string>('any')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hi ')
  const [bindings, setBindings] = useState<VariableBinding[]>([])
  const [filter, setFilter] = useState<'all' | OutreachChannel>('all')
  const [previewCampaignId, setPreviewCampaignId] = useState(state.campaigns[0]?.id ?? '')
  const [previewInfId, setPreviewInfId] = useState(state.influencers[0]?.id ?? '')

  const sorted = useMemo(() => {
    const list =
      filter === 'all' ? state.templates : state.templates.filter((t) => t.channel === filter)
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.templates, filter])

  const previewCampaign = state.campaigns.find((c) => c.id === previewCampaignId) ?? null
  const previewBrand =
    brandId !== 'any'
      ? state.brands.find((b) => b.id === brandId) ?? null
      : previewCampaign?.brandId
        ? state.brands.find((b) => b.id === previewCampaign.brandId) ?? null
        : null
  const previewInf = state.influencers.find((i) => i.id === previewInfId) ?? null

  const ctx = {
    org: state.organization,
    brand: previewBrand,
    campaign: previewCampaign,
    influencer: previewInf,
  }

  const handleSubmit = () => {
    if (!name.trim() || !body.trim()) {
      actions.toast('Name and body are required', 'error')
      return
    }
    if (channel === 'email' && !subject.trim()) {
      actions.toast('Email subject is required', 'error')
      return
    }
    if (bindings.length === 0) {
      actions.toast('Insert at least one data field so slots are wired', 'error')
      return
    }
    actions.submitTemplate({
      channel,
      name: name.trim(),
      category,
      subject: channel === 'email' ? subject.trim() : undefined,
      body: body.trim(),
      bindings,
      brandId: brandId === 'any' ? null : brandId,
    })
    if (channel === 'whatsapp') {
      actions.toast('Template submitted — PENDING Meta review (~3s)', 'info')
    }
    setName('')
    setBody('Hi ')
    setSubject('')
    setBindings([])
  }

  return (
    <div className="page-grid">
      <section className="card">
        <div className="row-between">
          <div>
            <h2>Templates</h2>
            <p className="card-lead">
              Build copy by inserting real fields (influencer, brand, campaign, org). Slots are
              wired to data — not filled as free text at send time.
            </p>
          </div>
          <div className="segmented">
            {(['all', 'whatsapp', 'email'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>Wiring</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                    <p className="muted-xs truncate">{t.body}</p>
                  </td>
                  <td>
                    <ChannelBadge channel={t.channel} />
                  </td>
                  <td>
                    <div className="binding-pills">
                      {t.bindings.map((b) => (
                        <span key={b.slot} className="binding-pill">
                          {'{{' + b.slot + '}}'}→{b.field.split('.').pop()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <TemplateStatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>New template</h3>
        <div className="stack gap-3">
          <div className="segmented full">
            <button
              type="button"
              className={channel === 'whatsapp' ? 'active wa' : ''}
              onClick={() => setChannel('whatsapp')}
            >
              WhatsApp
            </button>
            <button
              type="button"
              className={channel === 'email' ? 'active email' : ''}
              onClick={() => setChannel('email')}
            >
              Email
            </button>
          </div>

          <div className="form-grid-2">
            <label className="field">
              <span>Script name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="summer_invite_v1"
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
                <option value="any">Any brand / org-level</option>
                {state.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} only
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Preview campaign</span>
              <select
                value={previewCampaignId}
                onChange={(e) => setPreviewCampaignId(e.target.value)}
              >
                {state.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.brandId
                      ? ` · ${state.brands.find((b) => b.id === c.brandId)?.shortName}`
                      : ' · org'}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Preview creator</span>
              <select value={previewInfId} onChange={(e) => setPreviewInfId(e.target.value)}>
                {state.influencers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <VariableMapper
            body={body}
            subject={subject}
            showSubject={channel === 'email'}
            bindings={bindings}
            ctx={ctx}
            hasBrands={hasBrands}
            onBodyChange={setBody}
            onSubjectChange={setSubject}
            onBindingsChange={setBindings}
          />

          <button
            type="button"
            className={`btn primary ${channel === 'email' ? 'email' : ''}`}
            onClick={handleSubmit}
          >
            {channel === 'whatsapp' ? 'Submit for Meta review' : 'Save email script'}
          </button>
        </div>
      </section>
    </div>
  )
}
