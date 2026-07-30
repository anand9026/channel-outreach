import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Shield,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { IgIcon } from '../components/BrandIcons'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import {
  InstagramConnectDrawer,
  WaConnectDrawer,
} from '../components/OnboardingSheet'
import {
  API_BASE_URL,
  ApiError,
  getGmailConnectUrl,
  getGmailConnection,
  getWhatsAppConnection,
} from '../lib/api'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'

/**
 * Unified channel hub — same card language as onboarding, one mental model
 * for WhatsApp / Instagram / Gmail. Connecting Gmail syncs into the store
 * so send flows and onboarding see it immediately.
 */
export function ConnectPage() {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const [waDrawer, setWaDrawer] = useState(false)
  const [igDrawer, setIgDrawer] = useState(false)
  const [loadingWa, setLoadingWa] = useState(false)
  const [loadingGmail, setLoadingGmail] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)

  const gmailAccount = state.emailAccounts.find((a) => a.provider === 'gmail')
  const emailConnected = Boolean(gmailAccount)
  const waConnected = state.whatsAppNumbers.length > 0
  const igConnected = state.instagramAccounts.length > 0

  const refreshGmail = async (opts?: { quiet?: boolean }) => {
    setLoadingGmail(true)
    try {
      const info = await getGmailConnection()
      actions.syncGmail(info || null)
      if (!opts?.quiet) {
        actions.toast(
          info?.connected
            ? info.email_address
              ? `Gmail live · ${info.email_address}`
              : 'Gmail live'
            : 'No Gmail account connected yet',
          info?.connected ? 'success' : 'info',
        )
      }
    } catch (err) {
      if (!opts?.quiet) {
        actions.toast(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load Gmail connection',
          'error',
        )
      }
    } finally {
      setLoadingGmail(false)
    }
  }

  useEffect(() => {
    void refreshGmail({ quiet: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connectGmail = async () => {
    setConnectingGmail(true)
    try {
      const data = await getGmailConnectUrl()
      if (!data?.oauth_url) {
        actions.toast('OAuth URL missing from API response', 'error')
        return
      }
      // Persist intent so return feels intentional even if redirect is slow.
      window.sessionStorage.setItem('rx-gmail-connecting', '1')
      window.location.href = data.oauth_url
    } catch (err) {
      actions.toast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to start Gmail OAuth',
        'error',
      )
      setConnectingGmail(false)
    }
  }

  const loadCloudApiTestNumber = async () => {
    setLoadingWa(true)
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
      actions.toast(`WhatsApp loaded from ${API_BASE_URL}`, 'success')
    } catch (err) {
      actions.toast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load connection',
        'error',
      )
    } finally {
      setLoadingWa(false)
    }
  }

  return (
    <div className="rx-page">
      <PageHeader
        title="Channels"
        subtitle="Connect once. Send, reply, and measure from the same workspace."
        actions={
          mode !== 'none' ? (
            <button
              type="button"
              className="rx-btn accent"
              onClick={() => actions.setTab('quicksend')}
            >
              Send a message <ArrowRight size={14} />
            </button>
          ) : null
        }
      />

      <div className="rx-connect-grid three rx-mb-4">
        {/* WhatsApp */}
        <article className={`rx-connect-card${waConnected ? ' is-connected' : ''}`}>
          <div className="rx-connect-icon wa">
            <MessageCircle size={22} />
          </div>
          <div className="rx-connect-title">WhatsApp Business</div>
          <p className="rx-connect-body">
            Approved templates + 24-hour reply window. Best for high-intent creator outreach.
          </p>

          {waConnected ? (
            <div className="rx-col rx-gap" style={{ marginTop: 4 }}>
              {state.whatsAppNumbers.map((n) => (
                <div key={n.id} className="rx-channel-identity">
                  <div>
                    <div className="rx-channel-identity-name">{n.displayName}</div>
                    <div className="mono rx-text-xs rx-muted">{n.phoneDisplay}</div>
                  </div>
                  <span className="rx-badge success">
                    <CheckCircle2 size={11} /> Live
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rx-help" style={{ marginTop: 2 }}>
              API <span className="mono">{API_BASE_URL}</span>
            </div>
          )}

          <div className="rx-connect-foot">
            {waConnected ? (
              <span className="rx-badge success">
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span className="rx-badge">Not connected</span>
            )}
            <div className="rx-row" style={{ gap: 8 }}>
              {!waConnected ? (
                <button
                  type="button"
                  className="rx-btn secondary sm"
                  disabled={loadingWa}
                  onClick={() => void loadCloudApiTestNumber()}
                >
                  {loadingWa ? <Loader2 size={13} className="rx-spin" /> : null}
                  Use test number
                </button>
              ) : null}
              <button
                type="button"
                className={`rx-btn ${waConnected ? 'secondary' : 'primary'} sm`}
                onClick={() => setWaDrawer(true)}
              >
                {waConnected ? 'Add number' : 'Connect'}
              </button>
            </div>
          </div>
        </article>

        {/* Instagram */}
        <article className={`rx-connect-card${igConnected ? ' is-connected' : ''}`}>
          <div className="rx-connect-icon ig">
            <IgIcon size={22} />
          </div>
          <div className="rx-connect-title">Instagram DM</div>
          <p className="rx-connect-body">
            Reach creators where they already reply. Uses your Instagram Business account.
          </p>

          {igConnected ? (
            <div className="rx-col rx-gap" style={{ marginTop: 4 }}>
              {state.instagramAccounts.map((a) => (
                <div key={a.id} className="rx-channel-identity">
                  <div>
                    <div className="rx-channel-identity-name">{a.displayName}</div>
                    <div className="mono rx-text-xs rx-muted">@{a.handle}</div>
                  </div>
                  <span className="rx-badge success">
                    <CheckCircle2 size={11} /> Live
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rx-connect-foot">
            {igConnected ? (
              <span className="rx-badge success">
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span className="rx-badge">Not connected</span>
            )}
            <button
              type="button"
              className={`rx-btn ${igConnected ? 'secondary' : 'primary'} sm`}
              onClick={() => setIgDrawer(true)}
            >
              {igConnected ? 'Add account' : 'Connect'}
            </button>
          </div>
        </article>

        {/* Gmail */}
        <article className={`rx-connect-card${emailConnected ? ' is-connected' : ''}`}>
          <div className="rx-connect-icon email">
            <Mail size={22} />
          </div>
          <div className="rx-connect-title">Gmail</div>
          <p className="rx-connect-body">
            Send from your Google account to any email address. Templates optional —
            compose freeform anytime.
          </p>

          {emailConnected && gmailAccount ? (
            <div className="rx-channel-identity" style={{ marginTop: 4 }}>
              <div>
                <div className="rx-channel-identity-name">{gmailAccount.fromName}</div>
                <div className="mono rx-text-xs rx-muted">
                  {gmailAccount.fromEmail || 'Signed in with Google'}
                </div>
              </div>
              <span className="rx-badge success">
                <CheckCircle2 size={11} /> Verified
              </span>
            </div>
          ) : (
            <div className="rx-help" style={{ marginTop: 2 }}>
              Sign in with Google. We request send + read so replies land in Inbox.
            </div>
          )}

          <div className="rx-connect-foot">
            {emailConnected ? (
              <span className="rx-badge success">
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span className="rx-badge">Not connected</span>
            )}
            <div className="rx-row" style={{ gap: 8 }}>
              {emailConnected ? (
                <button
                  type="button"
                  className="rx-btn ghost sm"
                  disabled={loadingGmail}
                  onClick={() => void refreshGmail()}
                  aria-label="Refresh Gmail connection"
                >
                  {loadingGmail ? (
                    <Loader2 size={13} className="rx-spin" />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                className={`rx-btn ${emailConnected ? 'secondary' : 'primary'} sm`}
                disabled={connectingGmail}
                onClick={() => void connectGmail()}
              >
                {connectingGmail ? (
                  <>
                    <Loader2 size={13} className="rx-spin" /> Redirecting…
                  </>
                ) : (
                  <>
                    <Link2 size={13} />
                    {emailConnected ? 'Reconnect' : 'Continue with Google'}
                  </>
                )}
              </button>
            </div>
          </div>
        </article>
      </div>

      {mode === 'none' ? (
        <EmptyState
          icon={<Shield size={22} />}
          title="No channels yet"
          body="Connect at least one channel above. Quick Send and campaigns unlock as soon as something is live."
        />
      ) : (
        <section className="rx-card compact">
          <div className="rx-row" style={{ justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div className="rx-card-title">You&rsquo;re ready to outreach</div>
              <div className="rx-card-sub">
                {emailConnected
                  ? 'Email anyone from Quick Send — paste addresses or upload a CSV.'
                  : 'Add Gmail to send email alongside WhatsApp and Instagram.'}
              </div>
            </div>
            <div className="rx-row" style={{ gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                className="rx-btn secondary sm"
                onClick={() => actions.setTab('campaigns')}
              >
                Campaigns
              </button>
              <button
                type="button"
                className="rx-btn accent sm"
                onClick={() => actions.setTab('quicksend')}
              >
                Quick Send <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </section>
      )}

      <WaConnectDrawer open={waDrawer} onClose={() => setWaDrawer(false)} />
      <InstagramConnectDrawer open={igDrawer} onClose={() => setIgDrawer(false)} />
    </div>
  )
}
