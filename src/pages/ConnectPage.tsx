import { CheckCircle2, Mail, Shield, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { QualityBadge } from '../components/StatusBadge'
import { API_BASE_URL, ApiError, getWhatsAppConnection } from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { EmailProvider } from '../types'

export function ConnectPage() {
  const { state, actions } = useWhatsAppStore()
  const [displayName, setDisplayName] = useState('Nova Beauty Support')
  const [phoneDisplay, setPhoneDisplay] = useState('+91 80 4567 8901')
  const [fromName, setFromName] = useState('Nova Beauty Partnerships')
  const [fromEmail, setFromEmail] = useState('partnerships@novabeauty.co')
  const [provider, setProvider] = useState<EmailProvider>('sendgrid')
  const [domain, setDomain] = useState('novabeauty.co')
  const [loadingConnection, setLoadingConnection] = useState(false)

  const step = state.connectStep

  const loadCloudApiTestNumber = async () => {
    setLoadingConnection(true)
    try {
      const info = await getWhatsAppConnection()
      if (!info?.phone_number_id || !info?.waba_id) {
        actions.toast('API returned incomplete connection info', 'error')
        return
      }
      if (!info.has_access_token) {
        actions.toast(
          'Server has no WHATSAPP_OUTREACH_ACCESS_TOKEN — set it in reelax-server .env',
          'error',
        )
        return
      }
      actions.connectWhatsApp({
        displayName: 'Cloud API Test Number',
        phoneDisplay: '+1 555 (Meta test)',
        phoneNumberId: info.phone_number_id,
        wabaId: info.waba_id,
        businessId: 'bridgeness',
      })
      actions.toast(`Loaded from ${API_BASE_URL}`, 'success')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load connection'
      actions.toast(message, 'error')
    } finally {
      setLoadingConnection(false)
    }
  }

  return (
    <div className="page-grid">
      <section className="card">
        <h2>Channels</h2>
        <p className="card-lead">
          Connect WhatsApp and/or Email for <strong>{state.organization.name}</strong>. When any
          channel is live, Home becomes the first screen — not a metrics dashboard.
        </p>

        <div className="channel-split">
          <div className="channel-panel">
            <div className="channel-panel-head wa">
              <Smartphone size={18} />
              <h3>WhatsApp</h3>
            </div>
            {state.whatsAppNumbers.length > 0 ? (
              <div className="stack gap-3">
                {state.whatsAppNumbers.map((n) => (
                  <div key={n.id} className="connected-card">
                    <div className="connected-head">
                      <div>
                        <p className="connected-name">{n.displayName}</p>
                        <p className="muted">{n.phoneDisplay}</p>
                      </div>
                      <QualityBadge quality={n.qualityRating} />
                    </div>
                    <dl className="meta-grid">
                      <div>
                        <dt>Phone number ID</dt>
                        <dd>{n.phoneNumberId}</dd>
                      </div>
                      <div>
                        <dt>WABA ID</dt>
                        <dd>{n.wabaId}</dd>
                      </div>
                      <div>
                        <dt>Messaging tier</dt>
                        <dd>{n.messagingTier}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => actions.openConnect(true, 'whatsapp')}
                >
                  Connect another number
                </button>
              </div>
            ) : (
              <div className="empty-panel compact">
                <p>No WhatsApp number connected.</p>
                <p className="muted-xs" style={{ marginBottom: 12 }}>
                  API: <code>{API_BASE_URL}</code>
                </p>
                <div className="stack gap-2">
                  <button
                    type="button"
                    className="btn primary wa"
                    disabled={loadingConnection}
                    onClick={() => void loadCloudApiTestNumber()}
                  >
                    {loadingConnection
                      ? 'Loading…'
                      : 'Use Cloud API test number'}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => actions.openConnect(true, 'whatsapp')}
                  >
                    Start Embedded Signup (demo)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="channel-panel">
            <div className="channel-panel-head email">
              <Mail size={18} />
              <h3>Email</h3>
            </div>
            {state.emailAccounts.length > 0 ? (
              <div className="stack gap-3">
                {state.emailAccounts.map((a) => (
                  <div key={a.id} className="connected-card">
                    <div className="connected-head">
                      <div>
                        <p className="connected-name">{a.fromName}</p>
                        <p className="muted">{a.fromEmail}</p>
                      </div>
                      <span className="status-badge badge-success">Verified</span>
                    </div>
                    <dl className="meta-grid">
                      <div>
                        <dt>Provider</dt>
                        <dd>{a.provider.toUpperCase()}</dd>
                      </div>
                      <div>
                        <dt>Domain</dt>
                        <dd>{a.domain}</dd>
                      </div>
                      <div>
                        <dt>Connected</dt>
                        <dd>{new Date(a.connectedAt).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => actions.openEmailConnect(true)}
                >
                  Connect another sender
                </button>
              </div>
            ) : (
              <div className="empty-panel compact">
                <p>No email sending domain connected.</p>
                <button
                  type="button"
                  className="btn primary email"
                  onClick={() => actions.openEmailConnect(true)}
                >
                  Connect email domain
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card muted-card">
        <h3>After you connect</h3>
        <ul className="checklist">
          <li>
            <CheckCircle2 size={16} /> Home opens with your live channels
          </li>
          <li>
            <CheckCircle2 size={16} /> Pick a campaign, select influencers, then send
          </li>
          <li>
            <Shield size={16} /> Threads stay isolated per org · channel · influencer
          </li>
        </ul>
        {state.whatsAppNumbers.length > 0 || state.emailAccounts.length > 0 ? (
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 16 }}
            onClick={() => actions.setTab('floor')}
          >
            Go to Home
          </button>
        ) : null}
      </section>

      {state.connectModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Meta Embedded Signup</h3>
            <p className="muted">Step {step + 1} of 3 — simulated UI</p>

            {step === 0 ? (
              <div className="stack gap-3">
                <label className="field">
                  <span>Business display name</span>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>
                <label className="field">
                  <span>Phone number</span>
                  <input value={phoneDisplay} onChange={(e) => setPhoneDisplay(e.target.value)} />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="signup-preview">
                <p>Select WhatsApp Business Account</p>
                <button type="button" className="select-row active">
                  Nova Beauty WABA · India
                </button>
                <button type="button" className="select-row">
                  Nova Beauty Global WABA
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="signup-preview">
                <p>Permissions granted</p>
                <ul className="checklist compact">
                  <li>
                    <CheckCircle2 size={16} /> whatsapp_business_management
                  </li>
                  <li>
                    <CheckCircle2 size={16} /> whatsapp_business_messaging
                  </li>
                </ul>
              </div>
            ) : null}

            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => actions.openConnect(false)}
              >
                Cancel
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => actions.setConnectStep(step + 1)}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary wa"
                  onClick={() =>
                    actions.connectWhatsApp({
                      displayName,
                      phoneDisplay,
                      phoneNumberId: `pn_${Date.now().toString(36)}`,
                      wabaId: 'waba_nova_beauty_01',
                      businessId: 'biz_nova_meta_8821',
                    })
                  }
                >
                  Complete connection
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {state.emailModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Connect email sending</h3>
            <p className="muted">Simulate ESP / SMTP domain verification</p>
            <div className="stack gap-3">
              <label className="field">
                <span>From name</span>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </label>
              <label className="field">
                <span>From email</span>
                <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
              </label>
              <label className="field">
                <span>Provider</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as EmailProvider)}
                >
                  <option value="sendgrid">SendGrid</option>
                  <option value="ses">Amazon SES</option>
                  <option value="smtp">Custom SMTP</option>
                </select>
              </label>
              <label className="field">
                <span>Sending domain</span>
                <input value={domain} onChange={(e) => setDomain(e.target.value)} />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => actions.openEmailConnect(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary email"
                onClick={() =>
                  actions.connectEmail({ fromName, fromEmail, provider, domain })
                }
              >
                Verify & connect
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
