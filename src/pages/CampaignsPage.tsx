import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Mail, MessageCircle, Plus, Send, Users } from 'lucide-react'
import { CascadeControls } from '../components/CascadeControls'
import { SendWizard } from '../components/SendWizard'
import { VariableMapper } from '../components/VariableMapper'
import { listWhatsAppTemplates, type MetaTemplate } from '../lib/api'
import { defaultCascadeOptions } from '../lib/cascade'
import { extractMetaSlots, fillMetaBody } from '../lib/templateSlots'
import {
  bindingToOverrideValue,
  mergeBindings,
  resolveField,
} from '../lib/variables'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import type { AudienceSource, CascadeOptions, DataFieldKey, VariableBinding } from '../types'
import { collectionCreatorCount } from '../types'

export function CampaignsPage() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const campaignId = state.selectedCampaignId ?? state.campaigns[0]?.id
  const campaign = state.campaigns.find((c) => c.id === campaignId)
  const brand = campaign?.brandId
    ? state.brands.find((b) => b.id === campaign.brandId) ?? null
    : null

  const waTemplates = state.templates.filter((t) => t.channel === 'whatsapp' && t.status === 'APPROVED')
  const emailTemplates = state.templates.filter(
    (t) => t.channel === 'email' && (t.status === 'ACTIVE' || t.status === 'APPROVED'),
  )

  const [useWhatsApp, setUseWhatsApp] = useState(mode === 'whatsapp' || mode === 'both' || mode === 'none')
  const [useEmail, setUseEmail] = useState(mode === 'email' || mode === 'both')
  const [phoneId, setPhoneId] = useState('')
  const [emailAccountId, setEmailAccountId] = useState('')
  const [waTemplateId, setWaTemplateId] = useState(waTemplates[0]?.id ?? '')
  const [emailTemplateId, setEmailTemplateId] = useState(emailTemplates[0]?.id ?? '')
  const [previewInfluencerId, setPreviewInfluencerId] = useState('')
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'email'>(
    mode === 'email' ? 'email' : 'whatsapp',
  )
  const [brandLens, setBrandLens] = useState(state.brandFilter)
  const [cascadeEnabled, setCascadeEnabled] = useState(true)
  const [cascade, setCascade] = useState<CascadeOptions>(defaultCascadeOptions)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBrandId, setNewBrandId] = useState<string>('none')
  const [audienceSource, setAudienceSource] = useState<AudienceSource>('collection')
  const [collectionId, setCollectionId] = useState(state.collections[0]?.id ?? '')
  const [pickedAudience, setPickedAudience] = useState<string[]>([])
  const [createMetaTemplates, setCreateMetaTemplates] = useState<MetaTemplate[]>([])
  const [createTemplateName, setCreateTemplateName] = useState('')

  useEffect(() => {
    void listWhatsAppTemplates({ limit: 50 })
      .then((list) => {
        const approved = list.filter((t) => t.status === 'APPROVED')
        setCreateMetaTemplates(approved)
        setCreateTemplateName((prev) => prev || approved[0]?.name || '')
      })
      .catch(() => {
        setCreateMetaTemplates([])
      })
  }, [])

  useEffect(() => {
    if (!collectionId && state.collections[0]?.id) {
      setCollectionId(state.collections[0].id)
    }
  }, [state.collections, collectionId])

  useEffect(() => {
    if (audienceSource !== 'collection' || !collectionId) return
    const col = state.collections.find((c) => c.id === collectionId)
    if (col && col.influencerIds.length > 0) return
    void actions.loadCollectionInfluencers(collectionId).catch(() => {
      /* API unavailable */
    })
  }, [audienceSource, collectionId, state.collections, actions])

  const waChannel = useMemo(
    () => state.channels.find((ch) => ch.campaignId === campaignId && ch.channel === 'whatsapp'),
    [state.channels, campaignId],
  )
  const emailChannel = useMemo(
    () => state.channels.find((ch) => ch.campaignId === campaignId && ch.channel === 'email'),
    [state.channels, campaignId],
  )

  const filteredCampaigns = useMemo(() => {
    if (brandLens === 'all') return state.campaigns
    if (brandLens === 'none') return state.campaigns.filter((c) => c.brandId === null)
    return state.campaigns.filter((c) => c.brandId === brandLens)
  }, [state.campaigns, brandLens])

  const audiencePoolIds = useMemo(() => {
    if (audienceSource === 'collection') {
      return state.collections.find((c) => c.id === collectionId)?.influencerIds ?? []
    }
    if (audienceSource === 'my_creators') return state.myCreatorIds
    return []
  }, [audienceSource, collectionId, state.collections, state.myCreatorIds])

  const audiencePool = useMemo(
    () =>
      audiencePoolIds
        .map((id) => state.influencers.find((i) => i.id === id))
        .filter(Boolean) as typeof state.influencers,
    [audiencePoolIds, state.influencers],
  )

  const createTemplate = createMetaTemplates.find((t) => t.name === createTemplateName)
  const createTemplateBody =
    createTemplate?.components?.find((c) => c.type === 'BODY')?.text ?? ''
  const createPreviewInfluencerId =
    (pickedAudience[0] || audiencePoolIds[0]) ?? state.influencers[0]?.id
  const createPreviewInfluencer = state.influencers.find(
    (i) => i.id === createPreviewInfluencerId,
  )
  const createCampaignPreview = useMemo(() => {
    if (!createTemplateBody) return ''
    const slots = extractMetaSlots(createTemplateBody)
    const brandForPreview =
      newBrandId === 'none'
        ? null
        : state.brands.find((b) => b.id === newBrandId) ?? null
    const ctx = {
      org: state.organization,
      brand: brandForPreview,
      campaign: {
        id: 'preview',
        organizationId: state.organization.id,
        brandId: brandForPreview?.id ?? null,
        name: newName.trim() || 'New outreach',
        kind: 'outreach' as const,
        status: 'draft' as const,
        audienceSource,
        collectionId: audienceSource === 'collection' ? collectionId : null,
        influencerIds: [] as string[],
        createdAt: '',
      },
      influencer: createPreviewInfluencer ?? null,
    }
    const values: Record<string, string> = {}
    const defaults: DataFieldKey[] = [
      'influencer.first_name',
      'influencer.niche',
      'brand.name',
      'campaign.name',
    ]
    slots.forEach((s, i) => {
      values[s] = resolveField(defaults[i] || 'literal', ctx, `value_${s}`)
    })
    return fillMetaBody(createTemplateBody, values)
  }, [
    createTemplateBody,
    createPreviewInfluencer,
    newBrandId,
    newName,
    audienceSource,
    collectionId,
    state.organization,
    state.brands,
  ])

  const campaignInfluencers = useMemo(() => {
    if (!campaign) return []
    return campaign.influencerIds
      .map((id) => state.influencers.find((i) => i.id === id))
      .filter(Boolean) as typeof state.influencers
  }, [campaign, state.influencers])

  const selectedIds =
    waChannel?.selectedInfluencerIds ??
    emailChannel?.selectedInfluencerIds ??
    []

  const activeTemplateId =
    previewChannel === 'whatsapp'
      ? waChannel?.templateId || waTemplateId
      : emailChannel?.templateId || emailTemplateId

  const activeTemplate = state.templates.find((t) => t.id === activeTemplateId)
  const activeMapping =
    previewChannel === 'whatsapp'
      ? (waChannel?.variableMapping ?? {})
      : (emailChannel?.variableMapping ?? {})

  const wireBindings: VariableBinding[] = useMemo(() => {
    if (!activeTemplate) return []
    return mergeBindings(activeTemplate.bindings, activeMapping)
  }, [activeTemplate, activeMapping])

  const previewInf = previewInfluencerId || campaignInfluencers[0]?.id
  const preview = activeTemplateId
    ? actions.renderPreview(activeTemplateId, activeMapping, previewInf, campaignId)
    : { body: '' }

  const resolveCtx = {
    org: state.organization,
    brand,
    campaign: campaign ?? null,
    influencer: state.influencers.find((i) => i.id === previewInf) ?? null,
  }

  const linkedCollection = campaign?.collectionId
    ? state.collections.find((c) => c.id === campaign.collectionId)
    : null

  const onWireChange = (next: VariableBinding[]) => {
    const ch = previewChannel === 'whatsapp' ? waChannel : emailChannel
    if (!ch) return
    const mapping: Record<string, string> = {}
    for (const b of next) mapping[b.slot] = bindingToOverrideValue(b)
    actions.updateChannel(ch.id, { variableMapping: mapping })
  }

  const syncInfluencers = (ids: string[]) => {
    if (!campaignId) return
    if (useWhatsApp && (phoneId || state.whatsAppNumbers[0]) && (waTemplateId || waTemplates[0])) {
      const pid = phoneId || state.whatsAppNumbers[0].phoneNumberId
      const tpl = waTemplateId || waTemplates[0].id
      actions.upsertChannel({
        campaignId,
        channel: 'whatsapp',
        phoneNumberId: pid,
        templateId: tpl,
        selectedInfluencerIds: ids,
      })
    }
    if (
      useEmail &&
      (emailAccountId || state.emailAccounts[0]) &&
      (emailTemplateId || emailTemplates[0])
    ) {
      const aid = emailAccountId || state.emailAccounts[0].id
      const tpl = emailTemplateId || emailTemplates[0].id
      actions.upsertChannel({
        campaignId,
        channel: 'email',
        emailAccountId: aid,
        templateId: tpl,
        selectedInfluencerIds: ids,
      })
    }
    actions.setSharedInfluencers(campaignId, ids)
  }

  const toggleInfluencer = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    syncInfluencers(next)
  }

  const toggleAudiencePick = (id: string) => {
    setPickedAudience((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const createOutreach = () => {
    if (!newName.trim()) {
      actions.toast('Name is required', 'error')
      return
    }
    const ids = pickedAudience.length > 0 ? pickedAudience : audiencePoolIds
    if (ids.length === 0) {
      actions.toast('Select at least one creator from the audience', 'error')
      return
    }
    if (audienceSource === 'collection' && !collectionId) {
      actions.toast('Pick a collection list', 'error')
      return
    }
    actions.createOutreachCampaign({
      name: newName.trim(),
      brandId: newBrandId === 'none' ? null : newBrandId,
      audienceSource,
      collectionId: audienceSource === 'collection' ? collectionId : null,
      influencerIds: ids,
    })
    setShowCreate(false)
    setNewName('')
    setPickedAudience([])
  }

  const handleAttach = () => {
    if (!campaignId) return
    if (!useWhatsApp && !useEmail) {
      actions.toast('Enable at least one channel', 'error')
      return
    }
    const defaultIds = selectedIds.length ? selectedIds : campaign?.influencerIds ?? []
    if (useWhatsApp) {
      if (!state.whatsAppNumbers.length) {
        actions.toast('Connect a WhatsApp number first', 'error')
        actions.setTab('connect')
        return
      }
      const pid = phoneId || state.whatsAppNumbers[0].phoneNumberId
      setPhoneId(pid)
      const tpl = waTemplateId || waTemplates[0]?.id
      if (!tpl) {
        actions.toast('Need an approved WhatsApp template', 'error')
        return
      }
      setWaTemplateId(tpl)
      actions.upsertChannel({
        campaignId,
        channel: 'whatsapp',
        phoneNumberId: pid,
        templateId: tpl,
        selectedInfluencerIds: defaultIds,
      })
    }
    if (useEmail) {
      if (!state.emailAccounts.length) {
        actions.toast('Connect an email sender first', 'error')
        actions.setTab('connect')
        return
      }
      const aid = emailAccountId || state.emailAccounts[0].id
      setEmailAccountId(aid)
      const tpl = emailTemplateId || emailTemplates[0]?.id
      if (!tpl) {
        actions.toast('Need an active email template', 'error')
        return
      }
      setEmailTemplateId(tpl)
      actions.upsertChannel({
        campaignId,
        channel: 'email',
        emailAccountId: aid,
        templateId: tpl,
        selectedInfluencerIds: defaultIds,
      })
    }
    actions.toast('Channels attached', 'success')
  }

  const handleSend = () => {
    if (!campaignId) return
    if (!useWhatsApp && !useEmail) {
      actions.toast('Enable at least one channel', 'error')
      return
    }
    const ids = selectedIds.length ? selectedIds : campaign?.influencerIds ?? []
    if (ids.length === 0) {
      actions.toast('Select at least one influencer', 'error')
      return
    }

    const payload: Parameters<typeof actions.prepareAndSend>[0] = {
      campaignId,
      influencerIds: ids,
    }

    if (useWhatsApp) {
      if (!state.whatsAppNumbers.length) {
        actions.toast('Connect a WhatsApp number first', 'error')
        actions.setTab('connect')
        return
      }
      const pid = phoneId || state.whatsAppNumbers[0].phoneNumberId
      const tpl = waTemplateId || waTemplates[0]?.id
      if (!tpl) {
        actions.toast('Need an approved WhatsApp template', 'error')
        return
      }
      payload.whatsapp = {
        phoneNumberId: pid,
        templateId: tpl,
        variableMapping: waChannel?.variableMapping ?? {},
      }
    }

    if (useEmail) {
      if (!state.emailAccounts.length) {
        actions.toast('Connect an email sender first', 'error')
        actions.setTab('connect')
        return
      }
      const aid = emailAccountId || state.emailAccounts[0].id
      const tpl = emailTemplateId || emailTemplates[0]?.id
      if (!tpl) {
        actions.toast('Need an active email template', 'error')
        return
      }
      payload.email = {
        emailAccountId: aid,
        templateId: tpl,
        variableMapping: emailChannel?.variableMapping ?? {},
      }
    }

    if (useWhatsApp && useEmail && cascadeEnabled) {
      payload.cascade = cascade
    }

    actions.prepareAndSend(payload)
    const parts = []
    if (useWhatsApp && useEmail && cascadeEnabled) {
      parts.push(
        cascade.order === 'whatsapp_first'
          ? 'WhatsApp first → Email held'
          : 'Email first → WhatsApp held',
      )
    } else {
      if (useWhatsApp) parts.push('WhatsApp')
      if (useEmail) parts.push('Email')
    }
    actions.toast(`Sending ${parts.join(' + ')} to ${ids.length} influencer(s)`, 'success')
    actions.setTab('inbox')
  }

  if (!campaign) {
    return <p className="muted">No campaigns available.</p>
  }

  const audienceLabel =
    campaign.audienceSource === 'collection'
      ? `Collection: ${linkedCollection?.name ?? '—'}`
      : campaign.audienceSource === 'my_creators'
        ? 'My Creators'
        : 'Campaign roster'

  return (
    <div className="page-grid">
      <SendWizard />

      <section className="card create-outreach-card">
        <div className="row-between">
          <div>
            <h2>Create outreach campaign</h2>
            <p className="card-lead">
              Pick audience + optional WhatsApp template preview before you attach channels
              and send.
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus size={16} /> {showCreate ? 'Close' : 'New outreach'}
          </button>
        </div>

        {showCreate ? (
          <div className="create-outreach-form">
            <div className="form-grid-2">
              <label className="field">
                <span>Name</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="WA outreach · Beauty Tier A"
                />
              </label>
              <label className="field">
                <span>Brand (optional)</span>
                <select value={newBrandId} onChange={(e) => setNewBrandId(e.target.value)}>
                  <option value="none">Org-level (no brand)</option>
                  {state.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>WhatsApp template (approved)</span>
                <select
                  value={createTemplateName}
                  onChange={(e) => setCreateTemplateName(e.target.value)}
                >
                  {createMetaTemplates.length === 0 ? (
                    <option value="">No approved templates</option>
                  ) : (
                    createMetaTemplates.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            {createTemplateBody ? (
              <div className="preview-box">
                <p className="muted-xs">
                  Message preview
                  {createPreviewInfluencer
                    ? ` · sample: ${createPreviewInfluencer.name}`
                    : ''}
                </p>
                <p className="muted-xs">Template: {createTemplateName}</p>
                <p>{createCampaignPreview || createTemplateBody}</p>
              </div>
            ) : (
              <p className="muted-xs">
                Approve a WhatsApp template first to see campaign message preview.
              </p>
            )}

            <div className="audience-source">
              <p className="var-palette-title">Audience source</p>
              <div className="segmented full">
                <button
                  type="button"
                  className={audienceSource === 'collection' ? 'active' : ''}
                  onClick={() => {
                    setAudienceSource('collection')
                    setPickedAudience([])
                  }}
                >
                  <FolderOpen size={14} /> Collection list
                </button>
                <button
                  type="button"
                  className={audienceSource === 'my_creators' ? 'active' : ''}
                  onClick={() => {
                    setAudienceSource('my_creators')
                    setPickedAudience([])
                  }}
                >
                  <Users size={14} /> My Creators
                </button>
              </div>
              <p className="muted-xs" style={{ marginTop: 8 }}>
                {audienceSource === 'collection'
                  ? 'Reelax MySQL collection + collection_influencer (campaign shortlists).'
                  : 'Org CRM Mongo my-creators — saved creators for this organization.'}
              </p>
            </div>

            {audienceSource === 'collection' ? (
              <label className="field">
                <span>Collection</span>
                <select
                  value={collectionId}
                  onChange={(e) => {
                    setCollectionId(e.target.value)
                    setPickedAudience([])
                  }}
                >
                  {state.collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({collectionCreatorCount(c)} creators)
                      {c.brandId
                        ? ` · ${state.brands.find((b) => b.id === c.brandId)?.shortName}`
                        : ' · org'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="audience-pick">
              <div className="row-between">
                <p className="muted-xs">
                  {audiencePool.length} available ·{' '}
                  {pickedAudience.length || audiencePool.length} will be included (empty = all)
                </p>
                <div className="row-gap">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setPickedAudience(audiencePoolIds)}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setPickedAudience([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="influencer-list">
                {audiencePool.map((inf) => {
                  const checked =
                    pickedAudience.length === 0 || pickedAudience.includes(inf.id)
                  return (
                    <li key={inf.id}>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (pickedAudience.length === 0) {
                              setPickedAudience(
                                audiencePoolIds.filter((id) => id !== inf.id),
                              )
                            } else {
                              toggleAudiencePick(inf.id)
                            }
                          }}
                        />
                        <span>
                          <strong>{inf.name}</strong>
                          <span className="muted-xs">
                            {inf.handle} · {inf.phone} · {inf.email}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <button type="button" className="btn primary" onClick={createOutreach}>
              Create & open for send
            </button>
          </div>
        ) : (
          <div className="collection-strip">
            {state.collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className="collection-chip"
                onClick={() => {
                  setShowCreate(true)
                  setAudienceSource('collection')
                  setCollectionId(c.id)
                  setNewName(`Outreach · ${c.name}`)
                  setNewBrandId(c.brandId ?? 'none')
                }}
              >
                <FolderOpen size={14} />
                {c.name}
                <span>{collectionCreatorCount(c)}</span>
              </button>
            ))}
            <button
              type="button"
              className="collection-chip"
              onClick={() => {
                setShowCreate(true)
                setAudienceSource('my_creators')
                setNewName('Outreach · My Creators')
              }}
            >
              <Users size={14} />
              My Creators
              <span>{state.myCreatorIds.length}</span>
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <div>
            <h2>Send to campaign</h2>
            <p className="card-lead">
              Attach WhatsApp / Email and send. Chats stay unified per influencer + channel.
            </p>
          </div>
          <div className="row-gap">
            <label className="field inline">
              <span>Brand</span>
              <select
                value={brandLens}
                onChange={(e) => {
                  setBrandLens(e.target.value)
                  actions.setBrandFilter(e.target.value)
                }}
              >
                <option value="all">All</option>
                <option value="none">Org-level</option>
                {state.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field inline">
              <span>Campaign</span>
              <select
                value={campaignId}
                onChange={(e) => actions.selectCampaign(e.target.value)}
              >
                {filteredCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.kind === 'outreach' ? 'Outreach · ' : ''}
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="campaign-meta-bar">
          <span className={`kind-pill ${campaign.kind}`}>{campaign.kind}</span>
          <span className="muted-xs">{audienceLabel}</span>
          <span className="muted-xs">{campaign.influencerIds.length} creators</span>
        </div>

        <div className="channel-toggles">
          <label className={`toggle-chip${useWhatsApp ? ' on wa' : ''}`}>
            <input
              type="checkbox"
              checked={useWhatsApp}
              onChange={(e) => setUseWhatsApp(e.target.checked)}
            />
            <MessageCircle size={16} />
            WhatsApp
          </label>
          <label className={`toggle-chip${useEmail ? ' on email' : ''}`}>
            <input
              type="checkbox"
              checked={useEmail}
              onChange={(e) => setUseEmail(e.target.checked)}
            />
            <Mail size={16} />
            Email
          </label>
        </div>

        <CascadeControls
          enabled={useWhatsApp && useEmail}
          value={cascade}
          onChange={setCascade}
          cascadeEnabled={cascadeEnabled}
          onCascadeEnabledChange={setCascadeEnabled}
        />

        <div className="campaign-steps">
          <div className="step-card">
            <h3>1 · Channel setup</h3>
            <div className="stack gap-3">
              {useWhatsApp ? (
                <div className="nested-panel wa">
                  <p className="nested-title">
                    <MessageCircle size={14} /> WhatsApp
                  </p>
                  <label className="field">
                    <span>Business number</span>
                    <select value={phoneId} onChange={(e) => setPhoneId(e.target.value)}>
                      <option value="">Select number…</option>
                      {state.whatsAppNumbers.map((n) => (
                        <option key={n.id} value={n.phoneNumberId}>
                          {n.displayName} · {n.phoneDisplay}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Approved WA template</span>
                    <select
                      value={waTemplateId}
                      onChange={(e) => setWaTemplateId(e.target.value)}
                    >
                      <option value="">Select template…</option>
                      {waTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {useEmail ? (
                <div className="nested-panel email">
                  <p className="nested-title">
                    <Mail size={14} /> Email
                  </p>
                  <label className="field">
                    <span>From account</span>
                    <select
                      value={emailAccountId}
                      onChange={(e) => setEmailAccountId(e.target.value)}
                    >
                      <option value="">Select sender…</option>
                      {state.emailAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.fromName} · {a.fromEmail}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Email template</span>
                    <select
                      value={emailTemplateId}
                      onChange={(e) => setEmailTemplateId(e.target.value)}
                    >
                      <option value="">Select template…</option>
                      {emailTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <button type="button" className="btn secondary" onClick={handleAttach}>
                Attach selected channels
              </button>
            </div>
          </div>

          <div className="step-card">
            <h3>
              <Users size={16} /> 2 · Recipients ({audienceLabel})
            </h3>
            <p className="muted-xs">
              {campaign.kind === 'outreach'
                ? 'Loaded from collection / My Creators — not CSV import.'
                : 'From existing campaign roster.'}
            </p>
            <ul className="influencer-list">
              {campaignInfluencers.map((inf) => {
                const checked = selectedIds.length ? selectedIds.includes(inf.id) : true
                return (
                  <li key={inf.id}>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (selectedIds.length === 0) {
                            syncInfluencers(
                              campaign.influencerIds.filter((id) => id !== inf.id),
                            )
                          } else {
                            toggleInfluencer(inf.id)
                          }
                        }}
                      />
                      <span>
                        <strong>{inf.name}</strong>
                        <span className="muted-xs">
                          {inf.handle} · {inf.phone} · {inf.email}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="row-gap">
              <button
                type="button"
                className="btn ghost"
                onClick={() => syncInfluencers(campaign.influencerIds)}
              >
                Select all
              </button>
              <button type="button" className="btn ghost" onClick={() => syncInfluencers([])}>
                Clear
              </button>
            </div>
          </div>

          <div className="step-card">
            <h3>3 · Data wiring</h3>
            <div className="segmented">
              {useWhatsApp ? (
                <button
                  type="button"
                  className={previewChannel === 'whatsapp' ? 'active' : ''}
                  onClick={() => setPreviewChannel('whatsapp')}
                >
                  WA wiring
                </button>
              ) : null}
              {useEmail ? (
                <button
                  type="button"
                  className={previewChannel === 'email' ? 'active' : ''}
                  onClick={() => setPreviewChannel('email')}
                >
                  Email wiring
                </button>
              ) : null}
            </div>
            {activeTemplate ? (
              <VariableMapper
                compact
                body={activeTemplate.body}
                subject={activeTemplate.subject}
                showSubject={previewChannel === 'email'}
                bindings={wireBindings}
                ctx={resolveCtx}
                hasBrands={state.brands.length > 0}
                onBodyChange={() => undefined}
                onSubjectChange={() => undefined}
                onBindingsChange={onWireChange}
              />
            ) : (
              <p className="muted-xs">Attach a template first.</p>
            )}
          </div>

          <div className="step-card preview-card">
            <h3>4 · Preview & send</h3>
            <label className="field">
              <span>Preview as</span>
              <select
                value={previewInf}
                onChange={(e) => setPreviewInfluencerId(e.target.value)}
              >
                {campaignInfluencers.map((inf) => (
                  <option key={inf.id} value={inf.id}>
                    {inf.name}
                  </option>
                ))}
              </select>
            </label>
            {preview.subject ? (
              <p className="email-subject">
                <strong>Subject:</strong> {preview.subject}
              </p>
            ) : null}
            <div className={`preview-bubble ${previewChannel}`}>
              {preview.body || 'Select template to preview.'}
            </div>
            <button type="button" className="btn primary dual" onClick={handleSend}>
              <Send size={16} />
              Send now
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
