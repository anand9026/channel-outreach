import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Layers,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { bindingToOverrideValue } from '../lib/variables'

type SendMode = 'whatsapp' | 'email' | 'both'

/**
 * Interactive Home — channel cards, campaign picker, live preview, send.
 */
export function FloorPage() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const wa = state.whatsAppNumbers[0]
  const email = state.emailAccounts[0]

  const defaultSendMode: SendMode =
    mode === 'both' ? 'both' : mode === 'email' ? 'email' : 'whatsapp'

  const [brandFilter, setBrandFilter] = useState(state.brandFilter)
  const [armedCampaignId, setArmedCampaignId] = useState(state.selectedCampaignId ?? '')
  const [picked, setPicked] = useState<string[]>([])
  const [sendMode, setSendMode] = useState<SendMode>(defaultSendMode)
  const [previewInfId, setPreviewInfId] = useState('')
  const [sending, setSending] = useState(false)
  const [sendPulse, setSendPulse] = useState(0)

  const filteredCampaigns = useMemo(() => {
    if (brandFilter === 'all') return state.campaigns
    if (brandFilter === 'none') return state.campaigns.filter((c) => c.brandId === null)
    return state.campaigns.filter((c) => c.brandId === brandFilter)
  }, [state.campaigns, brandFilter])

  const campaign =
    filteredCampaigns.find((c) => c.id === armedCampaignId) ?? filteredCampaigns[0]

  const brand = campaign?.brandId
    ? state.brands.find((b) => b.id === campaign.brandId)
    : null

  const roster = useMemo(() => {
    if (!campaign) return []
    return campaign.influencerIds
      .map((id) => state.influencers.find((i) => i.id === id))
      .filter(Boolean) as typeof state.influencers
  }, [campaign, state.influencers])

  const waTemplate = state.templates.find(
    (t) => t.channel === 'whatsapp' && t.status === 'APPROVED',
  )
  const emailTemplate = state.templates.find(
    (t) => t.channel === 'email' && (t.status === 'ACTIVE' || t.status === 'APPROVED'),
  )

  const openThreads = state.conversations.filter((c) => c.status !== 'resolved')
  const multiCampaignThreads = state.conversations.filter((c) => c.campaignIds.length > 1)

  const previewInf =
    roster.find((i) => i.id === (previewInfId || picked[0])) ?? roster[0]

  const waPreview = waTemplate
    ? actions.renderPreview(
        waTemplate.id,
        Object.fromEntries(
          waTemplate.bindings.map((b) => [b.slot, bindingToOverrideValue(b)]),
        ),
        previewInf?.id,
        campaign?.id,
      )
    : { body: '' }

  const emailPreview = emailTemplate
    ? actions.renderPreview(
        emailTemplate.id,
        Object.fromEntries(
          emailTemplate.bindings.map((b) => [b.slot, bindingToOverrideValue(b)]),
        ),
        previewInf?.id,
        campaign?.id,
      )
    : { body: '' }

  const campaignRows = filteredCampaigns.map((c) => {
    const a = state.analytics.find((x) => x.campaignId === c.id)
    const waSent = a?.whatsapp.sent ?? 0
    const emailSent = a?.email.sent ?? 0
    const replies = (a?.whatsapp.replied ?? 0) + (a?.email.replied ?? 0)
    const b = c.brandId ? state.brands.find((x) => x.id === c.brandId) : null
    return { campaign: c, brand: b, waSent, emailSent, replies }
  })

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (!previewInfId && next.length) setPreviewInfId(next[next.length - 1])
      return next
    })
  }

  const mappingFromTemplate = (tpl: typeof waTemplate) => {
    if (!tpl) return {}
    const out: Record<string, string> = {}
    for (const b of tpl.bindings) out[b.slot] = bindingToOverrideValue(b)
    return out
  }

  const buildPayload = (campaignId: string, influencerIds: string[], sm: SendMode) => {
    const payload: Parameters<typeof actions.prepareAndSend>[0] = {
      campaignId,
      influencerIds,
    }
    if ((sm === 'whatsapp' || sm === 'both') && wa && waTemplate) {
      payload.whatsapp = {
        phoneNumberId: wa.phoneNumberId,
        templateId: waTemplate.id,
        variableMapping: mappingFromTemplate(waTemplate),
      }
    }
    if ((sm === 'email' || sm === 'both') && email && emailTemplate) {
      payload.email = {
        emailAccountId: email.id,
        templateId: emailTemplate.id,
        variableMapping: mappingFromTemplate(emailTemplate),
      }
    }
    return payload
  }

  const send = () => {
    if (!campaign || picked.length === 0) {
      actions.toast('Select at least one influencer', 'error')
      return
    }
    if (sendMode === 'whatsapp' && (!wa || !waTemplate)) {
      actions.toast('Need WhatsApp + approved template', 'error')
      return
    }
    if (sendMode === 'email' && (!email || !emailTemplate)) {
      actions.toast('Need email + template', 'error')
      return
    }
    if (sendMode === 'both' && (!wa || !email || !waTemplate || !emailTemplate)) {
      actions.toast('Need both channels + templates', 'error')
      return
    }

    setSending(true)
    setSendPulse((n) => n + 1)
    actions.prepareAndSend(buildPayload(campaign.id, picked, sendMode))
    const label =
      sendMode === 'both'
        ? 'WhatsApp + Email'
        : sendMode === 'whatsapp'
          ? 'WhatsApp'
          : 'Email'
    actions.toast(`Queued ${label} → ${picked.length} creator(s)`, 'success')
    window.setTimeout(() => setSending(false), 900)
    setPicked([])
  }

  /** Demo: same influencer, two campaigns → one unified WhatsApp thread */
  const demoDualCampaign = () => {
    if (!wa || !waTemplate) {
      actions.toast('Connect WhatsApp first', 'error')
      return
    }
    const campA = state.campaigns.find((c) => c.id === 'camp_summer_glow')
    const campB = state.campaigns.find((c) => c.id === 'camp_festive_lookbook')
    const shared = 'inf_1' // Priya — on both rosters
    if (!campA || !campB) return

    setSending(true)
    actions.prepareAndSend(
      buildPayload(campA.id, [shared], mode === 'email' ? 'email' : 'whatsapp'),
    )
    window.setTimeout(() => {
      actions.prepareAndSend(
        buildPayload(campB.id, [shared], mode === 'email' ? 'email' : 'whatsapp'),
      )
      const accountId = mode === 'email' ? email?.id : wa?.phoneNumberId
      if (accountId) {
        const key = `${state.organization.id}:${mode === 'email' ? 'email' : 'whatsapp'}:${accountId}:${shared}`
        actions.selectConversation(key)
      }
      actions.toast(
        'Demo: 2 campaigns → same creator. One unified chat, two campaign tags.',
        'success',
      )
      actions.setTab('inbox')
      setSending(false)
    }, 700)
  }

  if (mode === 'none') {
    return (
      <div className="floor floor-empty">
        <p className="floor-kicker">Home</p>
        <h2 className="floor-display">No channels connected</h2>
        <p className="floor-copy">
          Connect WhatsApp, Email, or both. Home adapts to whichever channels are live.
        </p>
        <button type="button" className="btn primary" onClick={() => actions.setTab('connect')}>
          Connect channels
        </button>
      </div>
    )
  }

  const title =
    mode === 'both'
      ? 'Channels ready'
      : mode === 'whatsapp'
        ? 'WhatsApp connected'
        : 'Email connected'

  return (
    <div className={`floor mode-${mode}${sending ? ' firing' : ''}`} key={sendPulse}>
      <header className="floor-mast">
        <div>
          <p className="floor-kicker">Home · {state.organization.name}</p>
          <h2 className="floor-display">{title}</h2>
          <p className="floor-copy soft">
            Pick a campaign → select creators → preview → send. Same creator in two campaigns =
            one WhatsApp chat with campaign tags.
          </p>
        </div>
        <div className="home-actions">
          <div className="floor-clock">
            <span className="pulse-dot" />
            {openThreads.length} open · {multiCampaignThreads.length} multi-campaign
          </div>
          <button type="button" className="btn secondary" onClick={demoDualCampaign}>
            <Layers size={16} /> Demo: 2 campaigns → 1 chat
          </button>
        </div>
      </header>

      <section
        className={`channel-pair${mode !== 'both' ? ' single' : ''}`}
        aria-label="Connected channels"
      >
        {(mode === 'whatsapp' || mode === 'both') && wa ? (
          <button
            type="button"
            className={`channel-card wa interactive${sendMode === 'whatsapp' || sendMode === 'both' ? ' selected' : ''}`}
            onClick={() => {
              if (mode === 'both') {
                setSendMode((m) =>
                  m === 'whatsapp' ? 'both' : m === 'both' ? 'email' : 'whatsapp',
                )
              } else setSendMode('whatsapp')
            }}
          >
            <div className="channel-label">
              <MessageCircle size={16} /> WhatsApp channel
            </div>
            <div className="channel-body">
              <span className="channel-title">{wa.phoneDisplay}</span>
              <span className="channel-meta">{wa.displayName}</span>
            </div>
            <div className="channel-foot">
              <span>{wa.qualityRating} · {wa.messagingTier}</span>
              <span className="muted-xs">Tap to include in send</span>
            </div>
          </button>
        ) : null}
        {(mode === 'email' || mode === 'both') && email ? (
          <button
            type="button"
            className={`channel-card email interactive${sendMode === 'email' || sendMode === 'both' ? ' selected' : ''}`}
            onClick={() => {
              if (mode === 'both') {
                setSendMode((m) =>
                  m === 'email' ? 'both' : m === 'both' ? 'whatsapp' : 'email',
                )
              } else setSendMode('email')
            }}
          >
            <div className="channel-label">
              <Mail size={16} /> Email channel
            </div>
            <div className="channel-body">
              <span className="channel-title">{email.fromEmail}</span>
              <span className="channel-meta">{email.fromName}</span>
            </div>
            <div className="channel-foot">
              <span>{email.provider.toUpperCase()}</span>
              <span className="muted-xs">Tap to include in send</span>
            </div>
          </button>
        ) : null}
        {mode !== 'both' ? (
          <button
            type="button"
            className="channel-ghost"
            onClick={() => actions.setTab('connect')}
          >
            <div className="channel-label">Add another channel</div>
            <p className="channel-meta">
              Connect {mode === 'whatsapp' ? 'Email' : 'WhatsApp'} for dual send
            </p>
          </button>
        ) : null}
      </section>

      {mode === 'both' ? (
        <div className="send-mode-bar">
          <span className="muted-xs">Sending via</span>
          {(
            [
              ['whatsapp', 'WhatsApp'],
              ['email', 'Email'],
              ['both', 'Both'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip${sendMode === id ? ' on' : ''}`}
              onClick={() => setSendMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="home-grid">
        <section className="mission-block">
          <div className="floor-section-head row-between">
            <div>
              <h3>Campaigns</h3>
              <p>Select one to arm recipients</p>
            </div>
            <label className="field inline">
              <span>Brand</span>
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value)
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
          </div>
          <ul className="mission-list">
            {campaignRows.map(({ campaign: c, brand: b, waSent, emailSent, replies }) => {
              const active = c.id === (campaign?.id ?? '')
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`mission-row${active ? ' armed' : ''}`}
                    onClick={() => {
                      setArmedCampaignId(c.id)
                      actions.selectCampaign(c.id)
                      setPicked([])
                      setPreviewInfId('')
                    }}
                  >
                    <div className="mission-name">
                      <strong>
                        {c.kind === 'outreach' ? 'Outreach · ' : ''}
                        {c.name}
                      </strong>
                      <span>
                        {b ? b.name : 'Org-level'} · {c.status}
                        {c.audienceSource === 'collection'
                          ? ' · collection'
                          : c.audienceSource === 'my_creators'
                            ? ' · my creators'
                            : ''}
                      </span>
                    </div>
                    <div className="mission-tracks">
                      {(mode === 'whatsapp' || mode === 'both') && (
                        <div className="mini-track wa">
                          <i
                            style={{
                              width: `${Math.max(Math.min(100, waSent * 18 + 8), 4)}%`,
                            }}
                          />
                          <em>WA {waSent}</em>
                        </div>
                      )}
                      {(mode === 'email' || mode === 'both') && (
                        <div className="mini-track email">
                          <i
                            style={{
                              width: `${Math.max(Math.min(100, emailSent * 18 + 8), 4)}%`,
                            }}
                          />
                          <em>Email {emailSent}</em>
                        </div>
                      )}
                    </div>
                    <div className="mission-reply">{replies} replies</div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="preview-live card">
          <div className="floor-section-head">
            <h3>
              <Sparkles size={16} /> Live preview
            </h3>
            <p>
              {previewInf
                ? `As ${previewInf.name}${brand ? ` · ${brand.shortName}` : ''}`
                : 'Select a creator'}
            </p>
          </div>
          {(sendMode === 'whatsapp' || sendMode === 'both') && (
            <div className="preview-bubble whatsapp">{waPreview.body || '…'}</div>
          )}
          {(sendMode === 'email' || sendMode === 'both') && (
            <>
              {emailPreview.subject ? (
                <p className="email-subject">
                  <strong>Subject:</strong> {emailPreview.subject}
                </p>
              ) : null}
              <div className="preview-bubble email">{emailPreview.body || '…'}</div>
            </>
          )}
        </section>
      </div>

      <section className="bench-block">
        <div className="floor-section-head row-between">
          <div>
            <h3>
              Recipients · {campaign?.name}
              {brand ? ` · ${brand.shortName}` : ''}
            </h3>
            <p>Click to select · click again to preview as that creator</p>
          </div>
          <div className="row-gap">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                const ids = roster.map((i) => i.id)
                setPicked(ids)
                if (ids[0]) setPreviewInfId(ids[0])
              }}
            >
              Select all
            </button>
            <button type="button" className="btn ghost" onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
        </div>
        <div className="bench">
          {roster.map((inf) => {
            const on = picked.includes(inf.id)
            const previewing = previewInf?.id === inf.id
            return (
              <button
                key={inf.id}
                type="button"
                className={`bench-chip${on ? ' armed' : ''}${previewing ? ' previewing' : ''}`}
                onClick={() => {
                  togglePick(inf.id)
                  setPreviewInfId(inf.id)
                }}
              >
                <span className="bench-initials">
                  {inf.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="bench-text">
                  <strong>{inf.name}</strong>
                  <small>{inf.handle}</small>
                </span>
              </button>
            )
          })}
        </div>
        <div className="fire-bar">
          <div className="fire-meta">
            <span>{picked.length} selected</span>
            <span className="sep">·</span>
            <span>
              via{' '}
              {sendMode === 'both'
                ? 'WhatsApp + Email'
                : sendMode === 'whatsapp'
                  ? 'WhatsApp'
                  : 'Email'}
            </span>
          </div>
          <div className="row-gap">
            <button
              type="button"
              className="btn secondary"
              onClick={() => actions.setTab('inbox')}
            >
              Open inbox <ArrowRight size={14} />
            </button>
            <button type="button" className="fire-btn" onClick={send} disabled={sending}>
              <Send size={16} />
              {sending ? 'Sending…' : 'Send now'}
            </button>
          </div>
        </div>
      </section>

      <section className="tide-block">
        <div className="floor-section-head row-between">
          <div>
            <h3>Recent activity</h3>
            <p>Open threads — click to jump into unified chat</p>
          </div>
        </div>
        {state.conversations.length === 0 ? (
          <p className="floor-copy soft">
            Nothing yet. Send above, or try <strong>Demo: 2 campaigns → 1 chat</strong>.
          </p>
        ) : (
          <ol className="tide-list">
            {[...state.conversations]
              .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
              .slice(0, 6)
              .map((c) => {
                const inf = state.influencers.find((i) => i.id === c.influencerId)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`tide-item ${c.channel}`}
                      onClick={() => {
                        actions.selectConversation(c.id)
                        actions.setTab('inbox')
                      }}
                    >
                      <span className="tide-channel">
                        {c.channel === 'whatsapp' ? 'WA' : 'Email'}
                      </span>
                      <span className="tide-who">{inf?.name ?? 'Creator'}</span>
                      <span className="tide-body">
                        {c.lastPreview ||
                          `${c.campaignIds.length} campaign(s) · ${c.status}`}
                      </span>
                      <span className="tide-time">
                        {c.campaignIds.length > 1
                          ? `${c.campaignIds.length} camps`
                          : new Date(c.lastMessageAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ol>
        )}
      </section>
    </div>
  )
}
