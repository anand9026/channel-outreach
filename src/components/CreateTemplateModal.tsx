import {
  ExternalLink,
  Image as ImageIcon,
  Info,
  Phone,
  Plus,
  Reply,
  Trash2,
  Video as VideoIcon,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ApiError, createGmailTemplate, createWhatsAppTemplate } from '../lib/api'
import { extractMetaSlots } from '../lib/templateSlots'
import { toMetaBody, toMetaTemplateName } from '../lib/metaTemplate'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel, TemplateCategory } from '../types'

const categories: TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION']

// Common Meta template languages. Meta accepts BCP-47-ish codes.
const languages = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ar', label: 'Arabic' },
]

type HeaderKind = 'none' | 'text' | 'image' | 'video' | 'document'
type ButtonMode = 'none' | 'quick_reply' | 'cta'

interface QuickReplyBtn {
  id: string
  text: string
}
interface CtaButton {
  id: string
  kind: 'URL' | 'PHONE_NUMBER'
  text: string
  url?: string
  phone?: string
}

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

let uidCounter = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${++uidCounter}`

export function CreateTemplateModal({ open, onClose, onCreated }: Props) {
  const { actions } = useWhatsAppStore()
  const [channel, setChannel] = useState<OutreachChannel>('whatsapp')

  // Core
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('UTILITY')
  const [language, setLanguage] = useState('en_US')

  // Email
  const [subject, setSubject] = useState('')

  // Header
  const [headerKind, setHeaderKind] = useState<HeaderKind>('none')
  const [headerText, setHeaderText] = useState('')
  const [headerMediaUrl, setHeaderMediaUrl] = useState('')

  // Body
  const [body, setBody] = useState('Hello {{1}}, thanks for connecting with us.')
  const [samples, setSamples] = useState<Record<string, string>>({ '1': 'Priya' })

  // Footer
  const [footer, setFooter] = useState('')

  // Buttons
  const [buttonMode, setButtonMode] = useState<ButtonMode>('none')
  const [quickReplies, setQuickReplies] = useState<QuickReplyBtn[]>([
    { id: uid('qr'), text: 'Yes, interested' },
  ])
  const [ctaButtons, setCtaButtons] = useState<CtaButton[]>([
    { id: uid('cta'), kind: 'URL', text: 'View brief', url: 'https://' },
  ])

  const [submitting, setSubmitting] = useState(false)

  const slots = useMemo(() => extractMetaSlots(body), [body])
  const previewBody = useMemo(
    () => body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => samples[n] || `{{${n}}}`),
    [body, samples],
  )

  if (!open) return null

  const reset = () => {
    setName('')
    setCategory('UTILITY')
    setLanguage('en_US')
    setSubject('')
    setHeaderKind('none')
    setHeaderText('')
    setHeaderMediaUrl('')
    setBody('Hello {{1}}, thanks for connecting with us.')
    setSamples({ '1': 'Priya' })
    setFooter('')
    setButtonMode('none')
    setQuickReplies([{ id: uid('qr'), text: 'Yes, interested' }])
    setCtaButtons([{ id: uid('cta'), kind: 'URL', text: 'View brief', url: 'https://' }])
    setChannel('whatsapp')
  }
  const close = () => {
    reset()
    onClose()
  }

  const addQuickReply = () => {
    if (quickReplies.length >= 3) return
    setQuickReplies((prev) => [...prev, { id: uid('qr'), text: '' }])
  }
  const addCta = (kind: 'URL' | 'PHONE_NUMBER') => {
    if (ctaButtons.length >= 2) return
    setCtaButtons((prev) => [
      ...prev,
      kind === 'URL'
        ? { id: uid('cta'), kind, text: '', url: 'https://' }
        : { id: uid('cta'), kind, text: '', phone: '+1' },
    ])
  }

  const buildMetaComponents = (): Array<Record<string, unknown>> | null => {
    const components: Array<Record<string, unknown>> = []

    // HEADER
    if (headerKind === 'text') {
      const t = headerText.trim()
      if (!t) {
        actions.toast('Header text is empty', 'error')
        return null
      }
      const headerSlots = extractMetaSlots(t)
      const comp: Record<string, unknown> = {
        type: 'HEADER',
        format: 'TEXT',
        text: t,
      }
      if (headerSlots.length > 0) {
        comp.example = {
          header_text: headerSlots.map((s) => samples[s] || `example_${s}`),
        }
      }
      components.push(comp)
    } else if (headerKind === 'image' || headerKind === 'video' || headerKind === 'document') {
      const url = headerMediaUrl.trim()
      if (!url) {
        actions.toast(`Header ${headerKind} URL is required`, 'error')
        return null
      }
      const key =
        headerKind === 'image'
          ? 'header_handle'
          : headerKind === 'video'
            ? 'header_handle'
            : 'header_handle'
      components.push({
        type: 'HEADER',
        format: headerKind.toUpperCase(),
        example: { [key]: [url] },
      })
    }

    // BODY (required)
    const { text: metaText, examples } = toMetaBody(body.trim())
    if (!metaText) {
      actions.toast('Body is required', 'error')
      return null
    }
    const exampleValues = examples.map((ex, i) => {
      const slot = String(i + 1)
      return samples[slot]?.trim() || ex
    })
    const bodyComp: Record<string, unknown> = { type: 'BODY', text: metaText }
    if (exampleValues.length > 0) {
      bodyComp.example = { body_text: [exampleValues] }
    }
    components.push(bodyComp)

    // FOOTER
    if (footer.trim()) {
      components.push({ type: 'FOOTER', text: footer.trim() })
    }

    // BUTTONS
    if (buttonMode === 'quick_reply') {
      const buttons = quickReplies
        .map((b) => b.text.trim())
        .filter(Boolean)
        .map((text) => ({ type: 'QUICK_REPLY', text }))
      if (buttons.length === 0) {
        actions.toast('Add at least one quick reply', 'error')
        return null
      }
      components.push({ type: 'BUTTONS', buttons })
    } else if (buttonMode === 'cta') {
      const buttons: Array<Record<string, unknown>> = []
      for (const b of ctaButtons) {
        const text = b.text.trim()
        if (!text) continue
        if (b.kind === 'URL') {
          const url = (b.url || '').trim()
          if (!url) continue
          buttons.push({ type: 'URL', text, url })
        } else {
          const phone = (b.phone || '').trim()
          if (!phone) continue
          buttons.push({ type: 'PHONE_NUMBER', text, phone_number: phone })
        }
      }
      if (buttons.length === 0) {
        actions.toast('Add at least one call-to-action button', 'error')
        return null
      }
      components.push({ type: 'BUTTONS', buttons })
    }

    return components
  }

  const submit = async () => {
    if (!name.trim() || !body.trim()) {
      actions.toast('Name and body are required', 'error')
      return
    }

    if (channel === 'whatsapp') {
      const metaName = toMetaTemplateName(name)
      if (!metaName) {
        actions.toast('Invalid template name (lowercase, underscores only)', 'error')
        return
      }
      const components = buildMetaComponents()
      if (!components) return

      setSubmitting(true)
      try {
        await createWhatsAppTemplate({
          name: metaName,
          category,
          language,
          body: body.trim(),
          components,
        })
        actions.submitTemplate({
          channel: 'whatsapp',
          name: metaName,
          category,
          body: body.trim(),
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

    // Email path — persist via Gmail outreach API
    if (!subject.trim()) {
      actions.toast('Email subject is required', 'error')
      return
    }
    setSubmitting(true)
    try {
      await createGmailTemplate({
        template_name: name.trim(),
        subject_template: subject.trim(),
        html_template: body.trim(),
      })
      actions.submitTemplate({
        channel: 'email',
        name: name.trim(),
        category,
        subject: subject.trim(),
        body: body.trim(),
        bindings: [],
        brandId: null,
      })
      actions.toast(`Saved Gmail template ${name.trim()}`, 'success')
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
  }

  return (
    <div className="rx-modal-scrim" role="dialog" aria-modal="true" onClick={close}>
      <div
        className="rx-modal rx-tpl-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 920,
          maxWidth: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="rx-modal-head">
          <div className="rx-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="rx-modal-title">Create template</div>
              <div className="rx-text-xs rx-muted" style={{ marginTop: 4 }}>
                Design a full Meta-approved template with header, body, footer and interactive buttons.
              </div>
            </div>
            <button className="rx-icon-btn" onClick={close} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className="rx-modal-body rx-tpl-body"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 24,
            overflow: 'auto',
            minHeight: 0,
            flex: 1,
            alignItems: 'start',
          }}
        >
          {/* -------- LEFT: builder -------- */}
          <div className="rx-col rx-gap">
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

            <div className="rx-row" style={{ gap: 12, alignItems: 'flex-end' }}>
              <div className="rx-field" style={{ flex: 1 }}>
                <label className="rx-label">Template name</label>
                <input
                  className="rx-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="welcome_outreach_v1"
                  data-testid="tpl-name"
                />
              </div>
              <div className="rx-field" style={{ width: 160 }}>
                <label className="rx-label">Category</label>
                <select
                  className="rx-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {channel === 'whatsapp' && (
                <div className="rx-field" style={{ width: 160 }}>
                  <label className="rx-label">Language</label>
                  <select
                    className="rx-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    data-testid="tpl-language"
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
              )}
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

            {channel === 'whatsapp' && (
              <>
                {/* HEADER */}
                <div className="rx-tpl-section">
                  <div className="rx-tpl-section-head">
                    <span className="rx-tpl-section-title">Header <span className="rx-muted rx-text-xs">— optional</span></span>
                    <div className="rx-seg sm">
                      {(['none', 'text', 'image', 'video', 'document'] as HeaderKind[]).map((k) => (
                        <button
                          key={k}
                          className={`rx-seg-btn${headerKind === k ? ' is-active' : ''}`}
                          onClick={() => setHeaderKind(k)}
                          data-testid={`header-${k}`}
                        >
                          {k === 'none' ? 'None' : k[0].toUpperCase() + k.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {headerKind === 'text' && (
                    <input
                      className="rx-input"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="Order update for {{1}}"
                      maxLength={60}
                    />
                  )}
                  {headerKind !== 'none' && headerKind !== 'text' && (
                    <div className="rx-col rx-gap">
                      <input
                        className="rx-input"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        placeholder={
                          headerKind === 'image'
                            ? 'https://\u2026/image.jpg'
                            : headerKind === 'video'
                              ? 'https://\u2026/video.mp4'
                              : 'https://\u2026/document.pdf'
                        }
                      />
                      <div className="rx-text-xs rx-muted">
                        <Info size={11} style={{ verticalAlign: -1 }} /> Meta requires an
                        example media URL during review {'\u2014'} the real media is bound per
                        send.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* BODY */}
            <div className="rx-tpl-section">
              <div className="rx-tpl-section-head">
                <span className="rx-tpl-section-title">Body <span className="rx-danger rx-text-xs">required</span></span>
                {channel === 'whatsapp' ? (
                  <span className="rx-text-xs rx-muted mono">
                    use {'{{1}}, {{2}}\u2026'} for variables
                  </span>
                ) : null}
              </div>
              <textarea
                className="rx-textarea"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1024}
              />
              <div className="rx-text-xs rx-muted" style={{ textAlign: 'right' }}>
                {body.length}/1024
              </div>
              {channel === 'whatsapp' && slots.length > 0 && (
                <div className="rx-col rx-gap" style={{ marginTop: 8 }}>
                  <div className="rx-label">Sample values (required by Meta review)</div>
                  <div className="rx-tpl-samples">
                    {slots.map((s) => (
                      <div key={s} className="rx-field">
                        <label className="rx-label mono">{`{{${s}}}`}</label>
                        <input
                          className="rx-input"
                          value={samples[s] ?? ''}
                          onChange={(e) =>
                            setSamples((prev) => ({ ...prev, [s]: e.target.value }))
                          }
                          placeholder={`Sample for {{${s}}}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {channel === 'whatsapp' && (
              <>
                {/* FOOTER */}
                <div className="rx-tpl-section">
                  <div className="rx-tpl-section-head">
                    <span className="rx-tpl-section-title">Footer <span className="rx-muted rx-text-xs">— optional</span></span>
                    <span className="rx-text-xs rx-muted">{footer.length}/60</span>
                  </div>
                  <input
                    className="rx-input"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    placeholder="Reply STOP to opt out"
                    maxLength={60}
                  />
                </div>

                {/* BUTTONS */}
                <div className="rx-tpl-section">
                  <div className="rx-tpl-section-head">
                    <span className="rx-tpl-section-title">Buttons <span className="rx-muted rx-text-xs">— optional, up to 3</span></span>
                    <div className="rx-seg sm">
                      {(['none', 'quick_reply', 'cta'] as ButtonMode[]).map((k) => (
                        <button
                          key={k}
                          className={`rx-seg-btn${buttonMode === k ? ' is-active' : ''}`}
                          onClick={() => setButtonMode(k)}
                          data-testid={`buttons-${k}`}
                        >
                          {k === 'none' ? 'None' : k === 'quick_reply' ? 'Quick replies' : 'Call to action'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {buttonMode === 'quick_reply' && (
                    <div className="rx-col rx-gap">
                      {quickReplies.map((b, i) => (
                        <div key={b.id} className="rx-row" style={{ gap: 8 }}>
                          <Reply size={13} className="rx-muted" />
                          <input
                            className="rx-input"
                            value={b.text}
                            onChange={(e) =>
                              setQuickReplies((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, text: e.target.value } : x,
                                ),
                              )
                            }
                            placeholder={`Quick reply ${i + 1}`}
                            maxLength={25}
                          />
                          <button
                            type="button"
                            className="rx-icon-btn"
                            onClick={() =>
                              setQuickReplies((prev) => prev.filter((_, j) => j !== i))
                            }
                            aria-label="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {quickReplies.length < 3 && (
                        <button
                          type="button"
                          className="rx-btn ghost sm"
                          onClick={addQuickReply}
                        >
                          <Plus size={12} /> Add quick reply
                        </button>
                      )}
                    </div>
                  )}

                  {buttonMode === 'cta' && (
                    <div className="rx-col rx-gap">
                      {ctaButtons.map((b, i) => (
                        <div key={b.id} className="rx-tpl-cta-row">
                          <select
                            className="rx-select"
                            style={{ width: 140 }}
                            value={b.kind}
                            onChange={(e) =>
                              setCtaButtons((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? { ...x, kind: e.target.value as 'URL' | 'PHONE_NUMBER' }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option value="URL">Visit website</option>
                            <option value="PHONE_NUMBER">Call phone</option>
                          </select>
                          <input
                            className="rx-input"
                            value={b.text}
                            onChange={(e) =>
                              setCtaButtons((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, text: e.target.value } : x,
                                ),
                              )
                            }
                            placeholder="Button label"
                            maxLength={25}
                          />
                          {b.kind === 'URL' ? (
                            <input
                              className="rx-input"
                              value={b.url ?? ''}
                              onChange={(e) =>
                                setCtaButtons((prev) =>
                                  prev.map((x, j) =>
                                    j === i ? { ...x, url: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="https://"
                            />
                          ) : (
                            <input
                              className="rx-input"
                              value={b.phone ?? ''}
                              onChange={(e) =>
                                setCtaButtons((prev) =>
                                  prev.map((x, j) =>
                                    j === i ? { ...x, phone: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="+91 98765 43210"
                            />
                          )}
                          <button
                            type="button"
                            className="rx-icon-btn"
                            onClick={() =>
                              setCtaButtons((prev) => prev.filter((_, j) => j !== i))
                            }
                            aria-label="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {ctaButtons.length < 2 && (
                        <div className="rx-row" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="rx-btn ghost sm"
                            onClick={() => addCta('URL')}
                          >
                            <ExternalLink size={12} /> Add website
                          </button>
                          <button
                            type="button"
                            className="rx-btn ghost sm"
                            onClick={() => addCta('PHONE_NUMBER')}
                          >
                            <Phone size={12} /> Add phone
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* -------- RIGHT: sticky preview -------- */}
          <div className="rx-tpl-preview-wrap">
            <div className="rx-tpl-preview-label">Preview</div>
            <div className={`rx-tpl-preview ${channel}`}>
              {channel === 'email' && subject ? (
                <div className="rx-subject">
                  <strong>{subject}</strong>
                </div>
              ) : null}

              {channel === 'whatsapp' && headerKind === 'text' && headerText ? (
                <div className="rx-tpl-pv-header text">
                  <strong>{headerText.replace(/\{\{(\d+)\}\}/g, (_, n: string) => samples[n] || `{{${n}}}`)}</strong>
                </div>
              ) : null}
              {channel === 'whatsapp' && headerKind === 'image' && (
                <div className="rx-tpl-pv-header media">
                  {headerMediaUrl ? (
                    <img src={headerMediaUrl} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="rx-tpl-pv-placeholder"><ImageIcon size={22} /> Image</div>
                  )}
                </div>
              )}
              {channel === 'whatsapp' && headerKind === 'video' && (
                <div className="rx-tpl-pv-header media">
                  <div className="rx-tpl-pv-placeholder"><VideoIcon size={22} /> Video</div>
                </div>
              )}
              {channel === 'whatsapp' && headerKind === 'document' && (
                <div className="rx-tpl-pv-header doc">
                  {'\u{1F4C4}'} Document.pdf
                </div>
              )}

              <div className="rx-tpl-pv-body">{previewBody}</div>

              {channel === 'whatsapp' && footer ? (
                <div className="rx-tpl-pv-footer">{footer}</div>
              ) : null}

              {channel === 'whatsapp' && buttonMode === 'quick_reply' && (
                <div className="rx-tpl-pv-buttons">
                  {quickReplies
                    .filter((b) => b.text.trim())
                    .map((b) => (
                      <div key={b.id} className="rx-tpl-pv-btn qr">{b.text}</div>
                    ))}
                </div>
              )}
              {channel === 'whatsapp' && buttonMode === 'cta' && (
                <div className="rx-tpl-pv-buttons">
                  {ctaButtons
                    .filter((b) => b.text.trim())
                    .map((b) => (
                      <div key={b.id} className="rx-tpl-pv-btn cta">
                        {b.kind === 'URL' ? <ExternalLink size={12} /> : <Phone size={12} />}
                        {b.text}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="rx-text-xs rx-muted" style={{ marginTop: 10 }}>
              <Info size={11} style={{ verticalAlign: -1 }} /> WhatsApp templates go through
              Meta review after submission. Marketing category may take longer.
            </div>
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
              ? 'Submitting\u2026'
              : channel === 'whatsapp'
                ? 'Submit to Meta'
                : 'Save email script'}
          </button>
        </div>
      </div>
    </div>
  )
}
