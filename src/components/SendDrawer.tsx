import { CheckCircle2, Clock, Loader2, MessageCircle, Mail, Users, Zap } from 'lucide-react'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { resolveOrgId } from '../lib/api'
import { firstChannel } from '../lib/cascade'
import { mergeBindings, renderWithBindings } from '../lib/variables'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import type { CascadeOptions, CollectionList, Template } from '../types'
import { collectionCreatorCount, isEmailTemplateSendable, isWhatsAppTemplateSendable } from '../types'
import { Drawer } from './Drawer'

type SendState = {
  step: 0 | 1 | 2 | 3
  audience: string[] // influencer ids
  audienceLabel: string
  selectedCollectionId: string | null
  channels: { wa: boolean; email: boolean }
  waTemplateId: string | null
  emailTemplateId: string | null
  strategy: 'single' | 'cascade'
  cascade: CascadeOptions
  campaignId: string | null
  campaignName: string
}

/** Hand-picked or existing-campaign influencer ids; collections resolve on the server. */
function resolveSendAudienceIds(s: SendState): string[] {
  return s.audience
}

/** Display + review count: SQL collection count, or explicit selection length. */
function resolveSendRecipientCount(
  s: SendState,
  collections: CollectionList[],
  campaigns: { id: string; influencerIds: string[]; recipientCount?: number }[],
): number {
  if (s.audience.length > 0) return s.audience.length
  if (s.selectedCollectionId) {
    const col = collections.find((c) => c.id === s.selectedCollectionId)
    return col ? collectionCreatorCount(col) : 0
  }
  if (s.campaignId) {
    const camp = campaigns.find((c) => c.id === s.campaignId)
    if (!camp) return 0
    return camp.recipientCount ?? camp.influencerIds.length
  }
  return 0
}

function isStep0AudienceReady(
  s: SendState,
  collections: CollectionList[],
  campaigns: { id: string; influencerIds: string[]; recipientCount?: number }[],
): boolean {
  if (!s.campaignName.trim()) return false
  if (s.selectedCollectionId) {
    const col = collections.find((c) => c.id === s.selectedCollectionId)
    return Boolean(col && collectionCreatorCount(col) > 0)
  }
  if (s.audience.length > 0) return true
  if (s.campaignId) {
    const camp = campaigns.find((c) => c.id === s.campaignId)
    return Boolean(
      camp &&
        ((camp.recipientCount ?? 0) > 0 || camp.influencerIds.length > 0),
    )
  }
  return false
}

const defaultState = (campaignId: string | null, campaignName: string): SendState => ({
  step: 0,
  audience: [],
  audienceLabel: '',
  selectedCollectionId: null,
  channels: { wa: true, email: false },
  waTemplateId: null,
  emailTemplateId: null,
  strategy: 'single',
  cascade: { order: 'whatsapp_first', waitHours: 48, stopOnReply: true, firstAt: null },
  campaignId,
  campaignName,
})

interface Props {
  open: boolean
  onClose: () => void
  presetCampaignId?: string | null
  presetName?: string
}

export function SendDrawer({ open, onClose, presetCampaignId, presetName }: Props) {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const [s, setS] = useState<SendState>(() =>
    defaultState(presetCampaignId ?? null, presetName ?? ''),
  )

  useEffect(() => {
    if (open) {
      setS(defaultState(presetCampaignId ?? null, presetName ?? ''))
    }
  }, [open, presetCampaignId, presetName])

  const audienceIds = resolveSendAudienceIds(s)
  const recipientCount = resolveSendRecipientCount(
    s,
    state.collections,
    state.campaigns,
  )

  const totalSteps = 4
  const canNext =
    s.step === 0
      ? isStep0AudienceReady(s, state.collections, state.campaigns)
      : s.step === 1
        ? (s.channels.wa ? Boolean(s.waTemplateId) : true) &&
          (s.channels.email ? Boolean(s.emailTemplateId) : true) &&
          (s.channels.wa || s.channels.email)
        : true

  const [sending, setSending] = useState(false)

  const close = () => {
    onClose()
    setTimeout(() => setS(defaultState(null, '')), 320)
  }

  const isCascadePreview =
    s.strategy === 'cascade' && s.channels.wa && s.channels.email

  const canLiveWhatsApp =
    s.channels.wa &&
    s.strategy === 'single' &&
    Boolean(s.waTemplateId) &&
    state.whatsAppNumbers.length > 0

  const canLiveEmail =
    s.channels.email &&
    s.strategy === 'single' &&
    Boolean(s.emailTemplateId) &&
    state.emailAccounts.some((a) => a.provider === 'gmail')

  const canLiveBoth =
    canLiveWhatsApp &&
    canLiveEmail &&
    s.channels.wa &&
    s.channels.email

  const canLiveApi =
    (canLiveWhatsApp || canLiveEmail) && s.strategy === 'single' && !isCascadePreview

  const send = async () => {
    if (sending) return
    setSending(true)
    try {
      let campId = s.campaignId
      if (!campId) {
        campId = await actions.createOutreachCampaign({
          name: s.campaignName || 'Untitled outreach',
          brandId: null,
          audienceSource: s.selectedCollectionId ? 'collection' : 'my_creators',
          collectionId: s.selectedCollectionId,
          influencerIds: audienceIds,
        })
      }
      const id = campId || state.selectedCampaignId
      if (!id) {
        actions.toast('Could not create campaign — try again', 'error')
        return
      }

      const waNumber = state.whatsAppNumbers[0]
      const emailAccount = state.emailAccounts.find((a) => a.provider === 'gmail')

      if (canLiveApi) {
        const whatsapp =
          s.channels.wa && waNumber && s.waTemplateId
            ? {
                phoneNumberId: waNumber.phoneNumberId,
                templateId: s.waTemplateId,
                variableMapping: {},
              }
            : undefined
        const email =
          s.channels.email && emailAccount && s.emailTemplateId
            ? {
                emailAccountId: emailAccount.id,
                templateId: s.emailTemplateId,
                variableMapping: {},
              }
            : undefined

        if (whatsapp || email) {
          const { sent, failed } = await actions.sendOutreachCampaignLive({
            campaignId: id,
            whatsapp,
            email,
          })
          const channels: string[] = []
          if (whatsapp) channels.push('WhatsApp')
          if (email) channels.push('Email')
          if (sent > 0) {
            actions.toast(
              `Sent ${sent} message${sent === 1 ? '' : 's'} via ${channels.join(' + ')} · org ${resolveOrgId()}`,
              failed > 0 ? 'info' : 'success',
            )
          } else {
            actions.toast('No messages sent — check templates and connected channels', 'error')
          }
          close()
          return
        }
      }

      const useCascade = isCascadePreview
      let demoAudienceIds = audienceIds
      if (
        !demoAudienceIds.length &&
        s.selectedCollectionId &&
        recipientCount > 0
      ) {
        try {
          demoAudienceIds = await actions.loadCollectionInfluencers(
            s.selectedCollectionId,
          )
        } catch {
          actions.toast(
            'Could not load collection roster for demo send',
            'error',
          )
          return
        }
      }
      if (!demoAudienceIds.length) {
        actions.toast('Select at least one creator to send', 'error')
        return
      }

      actions.prepareAndSend({
        campaignId: id,
        influencerIds: demoAudienceIds,
        whatsapp:
          s.channels.wa && waNumber && s.waTemplateId
            ? {
                phoneNumberId: waNumber.phoneNumberId,
                templateId: s.waTemplateId,
                variableMapping: {},
              }
            : undefined,
        email:
          s.channels.email && emailAccount && s.emailTemplateId
            ? {
                emailAccountId: emailAccount.id,
                templateId: s.emailTemplateId,
                variableMapping: {},
              }
            : undefined,
        cascade: useCascade ? s.cascade : undefined,
      })
      actions.toast(
        useCascade
          ? `Demo sequence queued (${demoAudienceIds.length} creators) — cascade simulates locally`
          : s.channels.email
            ? `Demo delivery queued (${demoAudienceIds.length} creators) — connect Gmail for live sends`
            : `Outreach queued to ${demoAudienceIds.length} creator${demoAudienceIds.length > 1 ? 's' : ''}`,
        'info',
      )
      close()
    } finally {
      setSending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={s.step < 3 ? 'New outreach' : 'Ready to send'}
      subtitle={
        s.step === 0
          ? 'Name it & choose creators'
          : s.step === 1
            ? 'Craft your message'
            : s.step === 2
              ? 'How should we send it?'
              : 'Review before you send'
      }
      size="lg"
      footer={
        <>
          <button
            type="button"
            className="rx-btn ghost"
            onClick={s.step === 0 ? close : () => setS({ ...s, step: (s.step - 1) as 0 | 1 | 2 | 3 })}
          >
            {s.step === 0 ? 'Cancel' : 'Back'}
          </button>
          {s.step < totalSteps - 1 ? (
            <button
              type="button"
              className="rx-btn primary"
              disabled={!canNext}
              onClick={() => setS({ ...s, step: (s.step + 1) as 0 | 1 | 2 | 3 })}
              data-testid="send-next"
            >
              Continue &rarr;
            </button>
          ) : (
            <button
              type="button"
              className="rx-btn accent"
              onClick={() => void send()}
              disabled={sending}
              data-testid="send-confirm"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="rx-spin" /> Sending…
                </>
              ) : canLiveBoth ? (
                'Send via WhatsApp + Email'
              ) : canLiveWhatsApp ? (
                'Send via WhatsApp API'
              ) : canLiveEmail ? (
                'Send via Gmail API'
              ) : (
                'Send outreach'
              )}
            </button>
          )}
        </>
      }
    >
      <div className="rx-steps">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rx-step-bar${i === s.step ? ' is-active' : ''}${i < s.step ? ' is-done' : ''}`}
          />
        ))}
      </div>

      {s.step === 0 && <StepAudience s={s} setS={setS} />}
      {s.step === 1 && <StepMessage s={s} setS={setS} mode={mode} />}
      {s.step === 2 && <StepStrategy s={s} setS={setS} />}
      {s.step === 3 && (
        <StepReview s={s} recipientCount={recipientCount} />
      )}
    </Drawer>
  )
}

/* ---------------------- Step 0 : Audience ---------------------- */
function StepAudience({
  s,
  setS,
}: {
  s: SendState
  setS: Dispatch<SetStateAction<SendState>>
}) {
  const { state } = useWhatsAppStore()
  const [tab, setTab] = useState<'collections' | 'creators' | 'campaign'>('collections')

  const toggle = (id: string) => {
    setS({
      ...s,
      selectedCollectionId: null,
      audience: s.audience.includes(id)
        ? s.audience.filter((x) => x !== id)
        : [...s.audience, id],
    })
  }

  const selectCollection = (colId: string) => {
    const col = state.collections.find((c) => c.id === colId)
    if (!col) return
    setS({
      ...s,
      selectedCollectionId: col.id,
      audience: [],
      audienceLabel: col.name,
      campaignId: null,
    })
  }

  const recipientCount = resolveSendRecipientCount(
    s,
    state.collections,
    state.campaigns,
  )

  return (
    <>
      <div className="rx-step-label">Step 1 of 4</div>
      <h3 className="rx-step-title">Name it & choose who to reach</h3>
      <p className="rx-step-desc">
        Give this outreach a name so you can find it later. Then pick a saved list or hand-pick creators.
      </p>

      <div className="rx-field rx-mb-4">
        <label className="rx-label">Outreach name</label>
        <input
          className="rx-input"
          value={s.campaignName}
          placeholder="e.g. Summer Glow Launch – Wave 1"
          onChange={(e) => setS({ ...s, campaignName: e.target.value })}
          data-testid="send-name"
        />
      </div>

      <div className="rx-seg rx-mb-4">
        <button
          className={`rx-seg-btn${tab === 'collections' ? ' is-active' : ''}`}
          onClick={() => setTab('collections')}
        >
          Collections
        </button>
        <button
          className={`rx-seg-btn${tab === 'creators' ? ' is-active' : ''}`}
          onClick={() => setTab('creators')}
        >
          My creators
        </button>
        <button
          className={`rx-seg-btn${tab === 'campaign' ? ' is-active' : ''}`}
          onClick={() => setTab('campaign')}
        >
          Existing campaign
        </button>
      </div>

      {tab === 'collections' && (
        <div className="rx-list">
          {state.collections.length === 0 ? (
            <p className="rx-step-desc">No collections found for this org.</p>
          ) : null}
          {state.collections.map((c) => {
            const sel = s.selectedCollectionId === c.id
            return (
              <button
                key={c.id}
                type="button"
                className={`rx-list-item${sel ? ' is-selected' : ''}`}
                onClick={() => selectCollection(c.id)}
                data-testid={`audience-collection-${c.id}`}
              >
                <div className={`rx-check${sel ? ' is-checked' : ''}`}>
                  {sel ? <CheckCircle2 size={12} /> : null}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="rx-list-name">{c.name}</div>
                  <div className="rx-list-sub">
                    {collectionCreatorCount(c)} creator
                    {collectionCreatorCount(c) === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'creators' && (
        <div className="rx-list">
          {state.influencers.map((inf) => {
            const sel = s.audience.includes(inf.id)
            return (
              <button
                key={inf.id}
                type="button"
                className={`rx-list-item${sel ? ' is-selected' : ''}`}
                onClick={() => toggle(inf.id)}
              >
                <div className={`rx-check${sel ? ' is-checked' : ''}`}>
                  {sel ? <CheckCircle2 size={12} /> : null}
                </div>
                <div className="rx-avatar">{inf.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
                <div style={{ flex: 1 }}>
                  <div className="rx-list-name">{inf.name}</div>
                  <div className="rx-list-sub">
                    {inf.handle} · {inf.followers} · {inf.niche}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'campaign' && (
        <div className="rx-list">
          {state.campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`rx-list-item${s.campaignId === c.id ? ' is-selected' : ''}`}
              onClick={() =>
                setS({
                  ...s,
                  campaignId: c.id,
                  audience: c.influencerIds,
                  audienceLabel: c.name,
                  campaignName: c.name,
                })
              }
            >
              <div className={`rx-check${s.campaignId === c.id ? ' is-checked' : ''}`}>
                {s.campaignId === c.id ? <CheckCircle2 size={12} /> : null}
              </div>
              <div style={{ flex: 1 }}>
                <div className="rx-list-name">{c.name}</div>
                <div className="rx-list-sub">{c.influencerIds.length} creators · {c.status}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="rx-mt-6 rx-text-2 rx-text-sm">
        <Users size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
        <strong>{recipientCount}</strong> creator
        {recipientCount === 1 ? '' : 's'} selected
        {s.selectedCollectionId ? (
          <span className="rx-caption"> · roster resolved at send</span>
        ) : null}
      </div>
    </>
  )
}

/* ---------------------- Step 1 : Message ---------------------- */
function StepMessage({
  s,
  setS,
  mode,
}: {
  s: SendState
  setS: (s: SendState) => void
  mode: ReturnType<typeof connectionMode>
}) {
  const { state } = useWhatsAppStore()

  const waTemplates = state.templates.filter(isWhatsAppTemplateSendable)
  const emailTemplates = state.templates.filter(isEmailTemplateSendable)

  const preview = (tpl: Template | null | undefined) => {
    if (!tpl) return { body: '', subject: '' }
    const inf = state.influencers.find((i) => s.audience.includes(i.id)) ?? state.influencers[0]
    const ctx = {
      org: state.organization,
      brand: null,
      campaign: null,
      influencer: inf,
    }
    const bindings = mergeBindings(tpl.bindings, {})
    return {
      body: renderWithBindings(tpl.body, bindings, ctx),
      subject: tpl.subject ? renderWithBindings(tpl.subject, bindings, ctx) : '',
    }
  }

  const wa = state.templates.find((t) => t.id === s.waTemplateId)
  const email = state.templates.find((t) => t.id === s.emailTemplateId)

  return (
    <>
      <div className="rx-step-label">Step 2 of 4</div>
      <h3 className="rx-step-title">Craft your message</h3>
      <p className="rx-step-desc">
        Pick which channel(s) to send on and choose an approved template. Preview updates live.
      </p>

      <div className="rx-row rx-mb-4" style={{ gap: 10 }}>
        <ChannelToggle
          icon={<MessageCircle size={16} />}
          label="WhatsApp"
          on={s.channels.wa}
          disabled={mode === 'email'}
          onChange={(v) => setS({ ...s, channels: { ...s.channels, wa: v } })}
        />
        <ChannelToggle
          icon={<Mail size={16} />}
          label="Email"
          on={s.channels.email}
          disabled={mode === 'whatsapp'}
          onChange={(v) => setS({ ...s, channels: { ...s.channels, email: v } })}
        />
      </div>

      {s.channels.wa && (
        <div className="rx-mb-4">
          <div className="rx-section-title">
            <span className="rx-ch-inline">
              <span className="rx-ch-dot wa" /> WhatsApp template
            </span>
            <span className="rx-caption">Meta-approved only</span>
          </div>
          <select
            className="rx-select"
            value={s.waTemplateId || ''}
            onChange={(e) => setS({ ...s, waTemplateId: e.target.value || null })}
            data-testid="send-wa-template"
          >
            <option value="">Select a template…</option>
            {waTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {wa ? (
            <div className="rx-preview wa rx-mt-2">{preview(wa).body}</div>
          ) : null}
        </div>
      )}

      {s.channels.email && (
        <div>
          <div className="rx-section-title">
            <span className="rx-ch-inline">
              <span className="rx-ch-dot email" /> Email template
            </span>
          </div>
          <select
            className="rx-select"
            value={s.emailTemplateId || ''}
            onChange={(e) => setS({ ...s, emailTemplateId: e.target.value || null })}
            data-testid="send-email-template"
          >
            <option value="">Select a template…</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {email ? (
            <div className="rx-preview email rx-mt-2">
              {email.subject ? (
                <div className="rx-subject">
                  <strong>Subject:</strong> {preview(email).subject}
                </div>
              ) : null}
              {preview(email).body}
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

function ChannelToggle({
  icon,
  label,
  on,
  disabled,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  on: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`rx-list-item${on ? ' is-selected' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <div className={`rx-check${on ? ' is-checked' : ''}`}>
        {on ? <CheckCircle2 size={12} /> : null}
      </div>
      {icon}
      <span className="rx-list-name">{label}</span>
      {disabled ? <span className="rx-badge rx-list-right">Not connected</span> : null}
    </button>
  )
}

/* ---------------------- Step 2 : Strategy ---------------------- */
function StepStrategy({ s, setS }: { s: SendState; setS: (s: SendState) => void }) {
  const bothChannels = s.channels.wa && s.channels.email
  const [advanced, setAdvanced] = useState(false)

  useEffect(() => {
    if (!bothChannels && s.strategy === 'cascade') {
      setS({ ...s, strategy: 'single' })
    }
  }, [bothChannels])

  return (
    <>
      <div className="rx-step-label">Step 3 of 4</div>
      <h3 className="rx-step-title">How should we send it?</h3>
      <p className="rx-step-desc">
        Send everything now, or run a smart sequence that only follows up if the creator doesn&rsquo;t reply.
      </p>

      <div className="rx-list rx-mb-4">
        <button
          type="button"
          className={`rx-list-item${s.strategy === 'single' ? ' is-selected' : ''}`}
          onClick={() => setS({ ...s, strategy: 'single' })}
        >
          <div className={`rx-check${s.strategy === 'single' ? ' is-checked' : ''}`}>
            {s.strategy === 'single' ? <CheckCircle2 size={12} /> : null}
          </div>
          <Zap size={18} className="rx-muted" />
          <div style={{ flex: 1 }}>
            <div className="rx-list-name">Send now</div>
            <div className="rx-list-sub">
              {bothChannels ? 'Send both channels at once' : 'Simple one-shot send'}
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`rx-list-item${s.strategy === 'cascade' ? ' is-selected' : ''}`}
          onClick={() => bothChannels && setS({ ...s, strategy: 'cascade' })}
          disabled={!bothChannels}
          style={{ opacity: bothChannels ? 1 : 0.5, cursor: bothChannels ? 'pointer' : 'not-allowed' }}
        >
          <div className={`rx-check${s.strategy === 'cascade' ? ' is-checked' : ''}`}>
            {s.strategy === 'cascade' ? <CheckCircle2 size={12} /> : null}
          </div>
          <Clock size={18} className="rx-muted" />
          <div style={{ flex: 1 }}>
            <div className="rx-list-name">Smart sequence</div>
            <div className="rx-list-sub">
              {bothChannels
                ? `${s.cascade.order === 'whatsapp_first' ? 'WhatsApp' : 'Email'} first · follow up on the other after ${s.cascade.waitHours}h if no reply`
                : 'Requires both WhatsApp and Email selected'}
            </div>
          </div>
        </button>
      </div>

      {s.strategy === 'cascade' && bothChannels && (
        <div className="rx-card compact">
          <div className="rx-row" style={{ justifyContent: 'space-between' }}>
            <div className="rx-card-title">Sequence settings</div>
            <button type="button" className="rx-btn ghost sm" onClick={() => setAdvanced(!advanced)}>
              {advanced ? 'Hide advanced' : 'Customize'}
            </button>
          </div>

          {advanced && (
            <div className="rx-col rx-gap rx-mt-4">
              <div className="rx-field">
                <label className="rx-label">Send order</label>
                <div className="rx-seg">
                  <button
                    className={`rx-seg-btn${s.cascade.order === 'whatsapp_first' ? ' is-active' : ''}`}
                    onClick={() =>
                      setS({ ...s, cascade: { ...s.cascade, order: 'whatsapp_first' } })
                    }
                  >
                    WhatsApp first
                  </button>
                  <button
                    className={`rx-seg-btn${s.cascade.order === 'email_first' ? ' is-active' : ''}`}
                    onClick={() =>
                      setS({ ...s, cascade: { ...s.cascade, order: 'email_first' } })
                    }
                  >
                    Email first
                  </button>
                </div>
              </div>

              <div className="rx-field">
                <label className="rx-label">Wait before follow-up</label>
                <div className="rx-seg">
                  {[24, 48, 72].map((h) => (
                    <button
                      key={h}
                      className={`rx-seg-btn${s.cascade.waitHours === h ? ' is-active' : ''}`}
                      onClick={() =>
                        setS({
                          ...s,
                          cascade: { ...s.cascade, waitHours: h as 24 | 48 | 72 },
                        })
                      }
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <label className="rx-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={s.cascade.stopOnReply}
                  onChange={(e) =>
                    setS({ ...s, cascade: { ...s.cascade, stopOnReply: e.target.checked } })
                  }
                />
                <span>Cancel follow-up if creator replies (recommended)</span>
              </label>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ---------------------- Step 3 : Review ---------------------- */
function StepReview({
  s,
  recipientCount,
}: {
  s: SendState
  recipientCount: number
}) {
  const { state } = useWhatsAppStore()
  const wa = state.templates.find((t) => t.id === s.waTemplateId)
  const email = state.templates.find((t) => t.id === s.emailTemplateId)
  const cascadeDesc =
    s.strategy === 'cascade'
      ? `${firstChannel(s.cascade.order) === 'whatsapp' ? 'WhatsApp' : 'Email'} first, follow up on ${firstChannel(s.cascade.order) === 'whatsapp' ? 'Email' : 'WhatsApp'} after ${s.cascade.waitHours}h if no reply.`
      : 'Send everything now on selected channels.'

  const liveWaOnly =
    s.channels.wa &&
    !s.channels.email &&
    s.strategy === 'single' &&
    state.whatsAppNumbers.length > 0

  const liveEmailOnly =
    s.channels.email &&
    !s.channels.wa &&
    s.strategy === 'single' &&
    state.emailAccounts.some((a) => a.provider === 'gmail')

  const liveBoth =
    s.channels.wa &&
    s.channels.email &&
    s.strategy === 'single' &&
    state.whatsAppNumbers.length > 0 &&
    state.emailAccounts.some((a) => a.provider === 'gmail')

  const summary = useMemo(() => {
    const delivery = liveBoth
      ? `Live API · WhatsApp + Email · org ${resolveOrgId()}`
      : liveWaOnly
        ? `Live API · WhatsApp · org ${resolveOrgId()}`
        : liveEmailOnly
          ? `Live API · Gmail · org ${resolveOrgId()}`
          : s.strategy === 'cascade'
            ? 'Demo sequence (cascade simulates locally)'
            : 'Local demo (connect channels for live sends)'

    const rows: { label: string; value: string }[] = [
      { label: 'Outreach', value: s.campaignName || '—' },
      { label: 'Recipients', value: `${recipientCount} creator${recipientCount === 1 ? '' : 's'}` },
      { label: 'Delivery', value: delivery },
      {
        label: 'Channels',
        value: [
          s.channels.wa ? 'WhatsApp' : null,
          s.channels.email ? 'Email' : null,
        ]
          .filter(Boolean)
          .join(' + '),
      },
      { label: 'Strategy', value: s.strategy === 'cascade' ? 'Smart sequence' : 'Send now' },
    ]
    return rows
  }, [s, recipientCount, liveWaOnly, liveEmailOnly, liveBoth])

  return (
    <>
      <div className="rx-step-label">Step 4 of 4</div>
      <h3 className="rx-step-title">Ready to send</h3>
      <p className="rx-step-desc">
        Everything looks good. Here&rsquo;s what will happen when you hit send.
      </p>

      <div className="rx-card compact rx-mb-4">
        {summary.map((row, i) => (
          <div key={row.label}>
            <div
              className="rx-row"
              style={{ justifyContent: 'space-between', padding: '10px 0' }}
            >
              <span className="rx-text-2 rx-text-sm">{row.label}</span>
              <strong>{row.value}</strong>
            </div>
            {i < summary.length - 1 ? <div className="rx-divider" style={{ margin: 0 }} /> : null}
          </div>
        ))}
      </div>

      <div className="rx-card compact rx-mb-4">
        <div className="rx-card-title" style={{ marginBottom: 8 }}>What happens next</div>
        <p className="rx-text-sm rx-text-2" style={{ lineHeight: 1.6 }}>
          {cascadeDesc} Reelax will track delivery, reads, and replies. Any replies land in your
          Inbox with campaign context.
        </p>
      </div>

      {wa && (
        <>
          <div className="rx-section-title">
            <span className="rx-ch-inline">
              <span className="rx-ch-dot wa" /> WhatsApp preview
            </span>
          </div>
          <div className="rx-preview wa rx-mb-4">{wa.body}</div>
        </>
      )}
      {email && (
        <>
          <div className="rx-section-title">
            <span className="rx-ch-inline">
              <span className="rx-ch-dot email" /> Email preview
            </span>
          </div>
          <div className="rx-preview email">
            {email.subject ? (
              <div className="rx-subject">
                <strong>Subject:</strong> {email.subject}
              </div>
            ) : null}
            {email.body}
          </div>
        </>
      )}
    </>
  )
}
