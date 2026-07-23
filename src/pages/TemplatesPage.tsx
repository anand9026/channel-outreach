import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChannelBadge, TemplateStatusBadge } from '../components/StatusBadge'
import { VariableMapper } from '../components/VariableMapper'
import {
  API_BASE_URL,
  ApiError,
  createWhatsAppTemplate,
  listWhatsAppTemplates,
  sendWhatsAppTemplate,
  type MetaTemplate,
} from '../lib/api'
import { toMetaBody, toMetaTemplateName } from '../lib/metaTemplate'
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
  const [category, setCategory] = useState<TemplateCategory>('UTILITY')
  const [brandId, setBrandId] = useState<string>('any')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('Hi ')
  const [bindings, setBindings] = useState<VariableBinding[]>([])
  const [filter, setFilter] = useState<'all' | OutreachChannel>('all')
  const [previewCampaignId, setPreviewCampaignId] = useState(state.campaigns[0]?.id ?? '')
  const [previewInfId, setPreviewInfId] = useState(state.influencers[0]?.id ?? '')

  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaSubmitting, setMetaSubmitting] = useState(false)

  const [sendTo, setSendTo] = useState('917706947747')
  const [sendTemplateName, setSendTemplateName] = useState('hello_world')
  const [sendBodyParam, setSendBodyParam] = useState('Anand')
  const [sending, setSending] = useState(false)

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

  const syncMetaTemplates = useCallback(async () => {
    setMetaLoading(true)
    try {
      const list = await listWhatsAppTemplates({ limit: 50 })
      setMetaTemplates(list)
      actions.toast(`Synced ${list.length} Meta template(s)`, 'success')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to sync templates'
      actions.toast(message, 'error')
    } finally {
      setMetaLoading(false)
    }
  }, [actions])

  useEffect(() => {
    void syncMetaTemplates()
  }, [syncMetaTemplates])

  const handleSubmit = async () => {
    if (!name.trim() || !body.trim()) {
      actions.toast('Name and body are required', 'error')
      return
    }
    if (channel === 'email' && !subject.trim()) {
      actions.toast('Email subject is required', 'error')
      return
    }

    if (channel === 'whatsapp') {
      const metaName = toMetaTemplateName(name)
      if (!metaName) {
        actions.toast('Invalid template name', 'error')
        return
      }
      const { text, examples } = toMetaBody(body.trim())
      setMetaSubmitting(true)
      try {
        await createWhatsAppTemplate({
          name: metaName,
          category,
          language: 'en_US',
          body: text,
          exampleValues: examples,
        })
        actions.submitTemplate({
          channel,
          name: metaName,
          category,
          body: text,
          bindings,
          brandId: brandId === 'any' ? null : brandId,
        })
        actions.toast(`Submitted ${metaName} to Meta — check status below`, 'success')
        setName('')
        setBody('Hi ')
        setBindings([])
        await syncMetaTemplates()
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Create template failed'
        actions.toast(message, 'error')
      } finally {
        setMetaSubmitting(false)
      }
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
      subject: subject.trim(),
      body: body.trim(),
      bindings,
      brandId: brandId === 'any' ? null : brandId,
    })
    setName('')
    setBody('Hi ')
    setSubject('')
    setBindings([])
  }

  const handleSendTest = async () => {
    if (!sendTo.trim() || !sendTemplateName.trim()) {
      actions.toast('Recipient and template name are required', 'error')
      return
    }
    setSending(true)
    try {
      const needsBodyParam =
        sendTemplateName !== 'hello_world' && sendBodyParam.trim().length > 0
      const data = await sendWhatsAppTemplate({
        to: sendTo.trim(),
        template_name: sendTemplateName.trim(),
        language_code: 'en_US',
        bodyParams: needsBodyParam ? [sendBodyParam.trim()] : undefined,
        phone_number_id: state.whatsAppNumbers[0]?.phoneNumberId,
      })
      const wamid =
        typeof data === 'object' &&
        data &&
        'messages' in data &&
        Array.isArray((data as { messages?: { id?: string }[] }).messages)
          ? (data as { messages: { id?: string }[] }).messages[0]?.id
          : undefined
      actions.toast(wamid ? `Sent · ${wamid}` : 'Template sent', 'success')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Send failed'
      actions.toast(message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-grid">
      <section className="card">
        <div className="row-between">
          <div>
            <h2>Live Meta templates</h2>
            <p className="card-lead">
              From <code>{API_BASE_URL}</code> · Cloud API WABA
            </p>
          </div>
          <button
            type="button"
            className="btn secondary"
            disabled={metaLoading}
            onClick={() => void syncMetaTemplates()}
          >
            {metaLoading ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Language</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {metaTemplates.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="muted">
                      No templates yet (or API not deployed / token missing).
                    </p>
                  </td>
                </tr>
              ) : (
                metaTemplates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <p className="muted-xs truncate">
                        {t.components?.find((c) => c.type === 'BODY')?.text ?? '—'}
                      </p>
                    </td>
                    <td>{t.language}</td>
                    <td>{t.category}</td>
                    <td>
                      <TemplateStatusBadge
                        status={
                          t.status === 'APPROVED'
                            ? 'APPROVED'
                            : t.status === 'REJECTED'
                              ? 'REJECTED'
                              : t.status === 'PENDING'
                                ? 'PENDING'
                                : 'DRAFT'
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Send test template</h3>
        <p className="card-lead muted">
          Recipient must be on Meta allowlist while app is unpublished.
        </p>
        <div className="form-grid-2">
          <label className="field">
            <span>To (country code, no +)</span>
            <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
          </label>
          <label className="field">
            <span>Template name</span>
            <input
              value={sendTemplateName}
              onChange={(e) => setSendTemplateName(e.target.value)}
              list="meta-template-names"
            />
            <datalist id="meta-template-names">
              <option value="hello_world" />
              {metaTemplates.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Body param {'{{1}}'} (optional)</span>
            <input
              value={sendBodyParam}
              onChange={(e) => setSendBodyParam(e.target.value)}
              placeholder="Anand"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn primary wa"
          style={{ marginTop: 12 }}
          disabled={sending}
          onClick={() => void handleSendTest()}
        >
          {sending ? 'Sending…' : 'Send via API'}
        </button>
      </section>

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Local scripts</h2>
            <p className="card-lead">
              Prototype store templates (email + local WhatsApp drafts).
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
              WhatsApp (Meta API)
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

          {channel === 'whatsapp' ? (
            <p className="muted-xs">
              WhatsApp submit calls Meta via API. Placeholders are converted to {'{{1}}'},{' '}
              {'{{2}}'}, …
            </p>
          ) : null}

          <button
            type="button"
            className={`btn primary ${channel === 'email' ? 'email' : ''}`}
            disabled={metaSubmitting}
            onClick={() => void handleSubmit()}
          >
            {channel === 'whatsapp'
              ? metaSubmitting
                ? 'Submitting to Meta…'
                : 'Submit to Meta'
              : 'Save email script'}
          </button>
        </div>
      </section>
    </div>
  )
}
