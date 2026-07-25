import { CheckCircle2, Mail, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { IgIcon } from './BrandIcons'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { Drawer } from './Drawer'

/**
 * Full-viewport first-run onboarding.
 * Shown until at least one channel is connected.
 * Uses the same underlying connectWhatsApp / connectEmail / connectInstagram store actions.
 */
export function OnboardingSheet() {
  const { state, actions } = useWhatsAppStore()
  const [waDrawer, setWaDrawer] = useState(false)
  const [emailDrawer, setEmailDrawer] = useState(false)
  const [igDrawer, setIgDrawer] = useState(false)
  const mode = connectionMode(state)

  return (
    <div className="rx-onboard-scrim" data-testid="onboarding">
      <div className="rx-onboard">
        <div className="rx-onboard-eyebrow">Welcome to Reelax Outreach</div>
        <h1 className="rx-onboard-title">Let&rsquo;s send your first message.</h1>
        <p className="rx-onboard-lead">
          Connect a channel to start reaching creators. You can add the others anytime — Reelax
          handles the sequencing, replies, and analytics in one place.
        </p>

        <div className="rx-connect-grid three">
          <ConnectCard
            channel="wa"
            icon={<MessageCircle size={22} />}
            title="WhatsApp Business"
            body="Send approved templates and manage replies inside the 24-hour window. Uses your WABA phone number."
            connected={state.whatsAppNumbers.length > 0}
            onConnect={() => setWaDrawer(true)}
          />
          <ConnectCard
            channel="ig"
            icon={<IgIcon size={22} />}
            title="Instagram DM"
            body="Reach creators inside Instagram Direct — the native place they read pitches. Uses your IG Business account."
            connected={state.instagramAccounts.length > 0}
            onConnect={() => setIgDrawer(true)}
          />
          <ConnectCard
            channel="email"
            icon={<Mail size={22} />}
            title="Email"
            body="Send from your verified sending domain (SendGrid / SES / SMTP). Free-form messages, no approval needed."
            connected={state.emailAccounts.length > 0}
            onConnect={() => setEmailDrawer(true)}
          />
        </div>

        {mode !== 'none' ? (
          <div className="rx-onboard-skip">
            You&rsquo;re ready to send.{' '}
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => actions.setTab('campaigns')}
              data-testid="onboarding-continue"
            >
              Continue &rarr;
            </button>
          </div>
        ) : (
          <div className="rx-onboard-skip">
            Not ready?{' '}
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => {
                // Skip: pretend WhatsApp is connected so the app is usable
                actions.connectWhatsApp({
                  displayName: 'Nova Beauty Support',
                  phoneDisplay: '+91 80 4567 8901',
                  phoneNumberId: 'demo_phone_1',
                  wabaId: 'demo_waba_1',
                  businessId: 'demo_biz_1',
                })
              }}
              data-testid="onboarding-skip"
            >
              Explore with demo data
            </button>
          </div>
        )}
      </div>

      <WaConnectDrawer open={waDrawer} onClose={() => setWaDrawer(false)} />
      <EmailConnectDrawer open={emailDrawer} onClose={() => setEmailDrawer(false)} />
      <InstagramConnectDrawer open={igDrawer} onClose={() => setIgDrawer(false)} />
    </div>
  )
}

function ConnectCard({
  channel,
  icon,
  title,
  body,
  connected,
  onConnect,
}: {
  channel: 'wa' | 'email' | 'ig'
  icon: React.ReactNode
  title: string
  body: string
  connected: boolean
  onConnect: () => void
}) {
  return (
    <div className={`rx-connect-card${connected ? ' is-connected' : ''}`}>
      <div className={`rx-connect-icon ${channel}`}>{icon}</div>
      <div className="rx-connect-title">{title}</div>
      <p className="rx-connect-body">{body}</p>
      <div className="rx-connect-foot">
        {connected ? (
          <span className="rx-badge success">
            <CheckCircle2 size={12} /> Connected
          </span>
        ) : (
          <span className="rx-badge">Not connected</span>
        )}
        <button
          type="button"
          className={`rx-btn ${connected ? 'secondary' : 'primary'} sm`}
          onClick={onConnect}
          data-testid={`connect-${channel}`}
        >
          {connected ? 'Reconnect' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

export function WaConnectDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useWhatsAppStore()
  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState('Nova Beauty Support')
  const [phoneDisplay, setPhoneDisplay] = useState('+91 80 4567 8901')

  const close = () => {
    onClose()
    setTimeout(() => setStep(0), 320)
  }

  const finish = () => {
    actions.connectWhatsApp({
      displayName,
      phoneDisplay,
      phoneNumberId: `phn_${Math.random().toString(36).slice(2, 8)}`,
      wabaId: `waba_${Math.random().toString(36).slice(2, 8)}`,
      businessId: `biz_${Math.random().toString(36).slice(2, 8)}`,
    })
    close()
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Connect WhatsApp"
      subtitle="Meta Embedded Signup — 3 quick steps"
      size="md"
      footer={
        <>
          <button type="button" className="rx-btn ghost" onClick={close}>
            Cancel
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="rx-btn primary"
              onClick={() => setStep(step + 1)}
              data-testid="wa-next"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="rx-btn primary"
              onClick={finish}
              data-testid="wa-finish"
            >
              Complete connection
            </button>
          )}
        </>
      }
    >
      <div className="rx-steps">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`rx-step-bar${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
          />
        ))}
      </div>

      {step === 0 && (
        <>
          <div className="rx-step-label">Step 1 of 3</div>
          <h3 className="rx-step-title">Choose your business</h3>
          <p className="rx-step-desc">
            Meta Business Suite will ask you to pick or create a WhatsApp Business Account (WABA).
            For this demo, we&rsquo;ll simulate the flow.
          </p>
          <div className="rx-card compact">
            <div className="rx-card-title">Nova Beauty Co.</div>
            <div className="rx-card-sub">Verified · created 2024</div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="rx-step-label">Step 2 of 3</div>
          <h3 className="rx-step-title">Set display name</h3>
          <p className="rx-step-desc">
            This is what creators see. Choose something recognizable and human.
          </p>
          <div className="rx-col rx-gap">
            <div className="rx-field">
              <label className="rx-label">Display name</label>
              <input
                className="rx-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                data-testid="wa-display-name"
              />
            </div>
            <div className="rx-field">
              <label className="rx-label">Phone number</label>
              <input
                className="rx-input"
                value={phoneDisplay}
                onChange={(e) => setPhoneDisplay(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="rx-step-label">Step 3 of 3</div>
          <h3 className="rx-step-title">Review & connect</h3>
          <p className="rx-step-desc">
            We&rsquo;ll generate a WABA + phone number ID and connect your account.
          </p>
          <div className="rx-card compact">
            <div className="rx-row" style={{ justifyContent: 'space-between' }}>
              <span className="rx-text-2 rx-text-sm">Display name</span>
              <strong>{displayName}</strong>
            </div>
            <div className="rx-divider" />
            <div className="rx-row" style={{ justifyContent: 'space-between' }}>
              <span className="rx-text-2 rx-text-sm">Phone</span>
              <strong>{phoneDisplay}</strong>
            </div>
          </div>
        </>
      )}
    </Drawer>
  )
}

export function EmailConnectDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useWhatsAppStore()
  const [fromName, setFromName] = useState('Nova Beauty')
  const [fromEmail, setFromEmail] = useState('creators@glowlab.co')
  const [domain, setDomain] = useState('glowlab.co')

  const finish = () => {
    actions.connectEmail({ fromName, fromEmail, provider: 'sendgrid', domain })
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Connect Email"
      subtitle="Add your verified sending domain"
      size="md"
      footer={
        <>
          <button type="button" className="rx-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rx-btn primary"
            onClick={finish}
            data-testid="email-finish"
          >
            Verify &amp; connect
          </button>
        </>
      }
    >
      <div className="rx-col rx-gap">
        <div className="rx-field">
          <label className="rx-label">From name</label>
          <input className="rx-input" value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
        <div className="rx-field">
          <label className="rx-label">From email</label>
          <input className="rx-input" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
        </div>
        <div className="rx-field">
          <label className="rx-label">Domain</label>
          <input className="rx-input" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <div className="rx-help">SPF + DKIM must be set on the domain. We verify via SendGrid.</div>
        </div>
      </div>
    </Drawer>
  )
}


export function InstagramConnectDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { actions } = useWhatsAppStore()
  const [handle, setHandle] = useState('@novabeauty')
  const [displayName, setDisplayName] = useState('Nova Beauty')

  const finish = () => {
    actions.connectInstagram({
      handle: handle.replace(/^@/, ''),
      displayName,
      igUserId: `ig_${Date.now().toString(36)}`,
    })
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Connect Instagram"
      subtitle="Link your Instagram Business account to send DMs"
      size="md"
      footer={
        <>
          <button type="button" className="rx-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rx-btn primary"
            onClick={finish}
            data-testid="ig-finish"
          >
            Connect Instagram
          </button>
        </>
      }
    >
      <div className="rx-col rx-gap">
        <div className="rx-field">
          <label className="rx-label">Instagram handle</label>
          <input
            className="rx-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourbrand"
          />
          <div className="rx-help">Must be an Instagram Business or Creator account.</div>
        </div>
        <div className="rx-field">
          <label className="rx-label">Display name</label>
          <input
            className="rx-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div
          className="rx-card compact"
          style={{ background: 'var(--surface-2)', fontSize: 12 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Note</div>
          <div className="rx-muted">
            Instagram DM sending goes through Meta&rsquo;s Instagram Graph API. This UI is fully
            wired for outreach + inbox, and switches to real sends the moment the backend proxy
            exposes an <span className="mono">/instagram-outreach/messages</span> endpoint.
          </div>
        </div>
      </div>
    </Drawer>
  )
}
