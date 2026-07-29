import { CheckCircle2, Mail, MessageCircle, Moon, Plus, Sparkles, Sun, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { IgIcon } from './BrandIcons'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import { Drawer } from './Drawer'
import {
  EmailConnectDrawer,
  InstagramConnectDrawer,
  WaConnectDrawer,
} from './OnboardingSheet'

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useWhatsAppStore()
  const [waDrawer, setWaDrawer] = useState(false)
  const [emailDrawer, setEmailDrawer] = useState(false)
  const [igDrawer, setIgDrawer] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleKeywords, setRuleKeywords] = useState('')
  const [ruleLabels, setRuleLabels] = useState('')

  const gmailAccount = state.emailAccounts.find((a) => a.provider === 'gmail')
  const emailConnected = Boolean(gmailAccount)

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Settings" subtitle="Channels · Brands · Team · Preferences" size="lg">
        <section>
          <div className="rx-section-title">Channels</div>

          {/* WhatsApp */}
          <div className="rx-card compact rx-mb-2">
            <div className="rx-row">
              <div className="rx-connect-icon wa">
                <MessageCircle size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="rx-card-title">WhatsApp Business</div>
                <div className="rx-card-sub">
                  {state.whatsAppNumbers.length
                    ? `${state.whatsAppNumbers.length} number${state.whatsAppNumbers.length > 1 ? 's' : ''} connected`
                    : 'Not connected'}
                </div>
              </div>
              <button type="button" className="rx-btn secondary sm" onClick={() => setWaDrawer(true)}>
                <Plus size={14} /> Add number
              </button>
            </div>
            {state.whatsAppNumbers.length ? (
              <div className="rx-col rx-gap" style={{ marginTop: 12 }}>
                {state.whatsAppNumbers.map((n) => (
                  <div
                    key={n.id}
                    className="rx-row"
                    style={{
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.displayName}</div>
                      <div className="mono rx-text-xs rx-muted">{n.phoneDisplay}</div>
                    </div>
                    <span className="rx-badge success">
                      <CheckCircle2 size={11} /> {n.qualityRating}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Instagram */}
          <div className="rx-card compact rx-mb-2">
            <div className="rx-row">
              <div className="rx-connect-icon ig">
                <IgIcon size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="rx-card-title">Instagram DM</div>
                <div className="rx-card-sub">
                  {state.instagramAccounts.length
                    ? `${state.instagramAccounts.length} account${state.instagramAccounts.length > 1 ? 's' : ''} connected`
                    : 'Not connected'}
                </div>
              </div>
              <button type="button" className="rx-btn secondary sm" onClick={() => setIgDrawer(true)}>
                <Plus size={14} /> Add account
              </button>
            </div>
            {state.instagramAccounts.length ? (
              <div className="rx-col rx-gap" style={{ marginTop: 12 }}>
                {state.instagramAccounts.map((n) => (
                  <div
                    key={n.id}
                    className="rx-row"
                    style={{
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.displayName}</div>
                      <div className="mono rx-text-xs rx-muted">@{n.handle}</div>
                    </div>
                    <span className="rx-badge success">
                      <CheckCircle2 size={11} /> Live
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Email / Gmail */}
          <div className="rx-card compact rx-mb-4">
            <div className="rx-row">
              <div className="rx-connect-icon email">
                <Mail size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="rx-card-title">Gmail</div>
                <div className="rx-card-sub">
                  {emailConnected
                    ? gmailAccount?.fromEmail || '1 Gmail connection'
                    : 'Not connected'}
                </div>
              </div>
              <button
                type="button"
                className="rx-btn secondary sm"
                onClick={() => setEmailDrawer(true)}
              >
                <Plus size={14} /> {emailConnected ? 'Reconnect' : 'Connect Gmail'}
              </button>
            </div>
            {emailConnected && gmailAccount ? (
              <div className="rx-col rx-gap" style={{ marginTop: 12 }}>
                <div
                  className="rx-row"
                  style={{
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{gmailAccount.fromName}</div>
                    <div className="mono rx-text-xs rx-muted">
                      {gmailAccount.fromEmail} · Gmail
                    </div>
                  </div>
                  <span className="rx-badge success">
                    <CheckCircle2 size={11} /> Verified
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="rx-section-title">Brands</div>
          <div className="rx-list rx-mb-4">
            {state.brands.map((b) => (
              <div key={b.id} className="rx-list-item" style={{ cursor: 'default' }}>
                <div className="rx-avatar">{b.shortName.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="rx-list-name">{b.name}</div>
                  <div className="rx-list-sub">{b.shortName}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="rx-section-title">Team</div>
          <div className="rx-list">
            {state.team.map((m) => (
              <div key={m.id} className="rx-list-item" style={{ cursor: 'default' }}>
                <div className="rx-avatar">{m.initials}</div>
                <div>
                  <div className="rx-list-name">{m.name}</div>
                  <div className="rx-list-sub">Team member</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="rx-section-title">Appearance</div>
          <div className="rx-card compact rx-mb-4">
            <div className="rx-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="rx-card-title">Theme</div>
                <div className="rx-card-sub">Match your OS or pick a fixed theme.</div>
              </div>
              <div className="rx-seg" data-testid="theme-toggle">
                <button
                  type="button"
                  className={`rx-seg-btn${state.prefs.theme === 'light' ? ' is-active' : ''}`}
                  onClick={() => actions.setTheme('light')}
                >
                  <Sun size={12} /> Light
                </button>
                <button
                  type="button"
                  className={`rx-seg-btn${state.prefs.theme === 'dark' ? ' is-active' : ''}`}
                  onClick={() => actions.setTheme('dark')}
                  data-testid="theme-dark"
                >
                  <Moon size={12} /> Dark
                </button>
                <button
                  type="button"
                  className={`rx-seg-btn${state.prefs.theme === 'system' ? ' is-active' : ''}`}
                  onClick={() => actions.setTheme('system')}
                >
                  System
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="rx-section-title">Canned replies</div>
          <div className="rx-card compact rx-mb-4">
            <div className="rx-col rx-gap">
              {state.cannedReplies.map((c) => (
                <div key={c.id} className="rx-canned-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rx-canned-title"><Zap size={11} /> {c.title}</div>
                    <div className="rx-text-xs rx-muted" style={{ marginTop: 2 }}>{c.body}</div>
                  </div>
                  <button
                    type="button"
                    className="rx-icon-btn"
                    aria-label="Delete canned reply"
                    onClick={() => actions.deleteCanned(c.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div className="rx-canned-add">
                <input
                  className="rx-input"
                  placeholder="Title (e.g. Confirm slot)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <textarea
                  className="rx-textarea"
                  rows={2}
                  placeholder="Message body"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                />
                <button
                  type="button"
                  className="rx-btn secondary sm"
                  onClick={() => {
                    if (!newTitle.trim() || !newBody.trim()) return
                    actions.upsertCanned({ title: newTitle.trim(), body: newBody.trim() })
                    setNewTitle('')
                    setNewBody('')
                  }}
                  data-testid="add-canned"
                >
                  <Plus size={12} /> Add canned reply
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="rx-section-title">
            <Sparkles size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
            Auto-label rules
          </div>
          <div className="rx-card compact rx-mb-4">
            <div className="rx-text-xs rx-muted rx-mb-2">
              When a creator&rsquo;s inbound message contains any keyword, we auto-add labels to
              the thread {'\u2014'} turning your inbox into a semi-automated triage system.
            </div>
            <div className="rx-col rx-gap">
              {state.autoLabelRules.map((r) => (
                <div key={r.id} className="rx-rule-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rx-rule-title">
                      <span className="rx-rule-name">{r.name}</span>
                      <label className="rx-switch" aria-label="Enable rule">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => actions.toggleRule(r.id, e.target.checked)}
                          data-testid={`rule-toggle-${r.id}`}
                        />
                        <span />
                      </label>
                    </div>
                    <div className="rx-rule-meta">
                      <div>
                        <span className="rx-text-xs rx-muted">Keywords:</span>{' '}
                        {r.keywords.map((k) => (
                          <span key={k} className="rx-chip xs mono">{k}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span className="rx-text-xs rx-muted">Adds:</span>{' '}
                        {r.labels.map((l) => (
                          <span key={l} className="rx-chip xs">{l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rx-icon-btn"
                    aria-label="Delete rule"
                    onClick={() => actions.deleteRule(r.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div className="rx-canned-add">
                <input
                  className="rx-input"
                  placeholder="Rule name (e.g. Contract sent)"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
                <input
                  className="rx-input"
                  placeholder="Keywords, comma-separated (e.g. contract, signed)"
                  value={ruleKeywords}
                  onChange={(e) => setRuleKeywords(e.target.value)}
                />
                <input
                  className="rx-input"
                  placeholder="Labels to add, comma-separated (e.g. contract sent)"
                  value={ruleLabels}
                  onChange={(e) => setRuleLabels(e.target.value)}
                />
                <button
                  type="button"
                  className="rx-btn secondary sm"
                  onClick={() => {
                    const keywords = ruleKeywords
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                    const labels = ruleLabels
                      .split(',')
                      .map((s) => s.trim().toLowerCase())
                      .filter(Boolean)
                    if (!ruleName.trim() || keywords.length === 0 || labels.length === 0) return
                    actions.upsertRule({
                      name: ruleName.trim(),
                      keywords,
                      labels,
                      enabled: true,
                    })
                    setRuleName('')
                    setRuleKeywords('')
                    setRuleLabels('')
                  }}
                  data-testid="add-rule"
                >
                  <Plus size={12} /> Add rule
                </button>
              </div>
            </div>
          </div>
        </section>
      </Drawer>

      <WaConnectDrawer open={waDrawer} onClose={() => setWaDrawer(false)} />
      <EmailConnectDrawer open={emailDrawer} onClose={() => setEmailDrawer(false)} />
      <InstagramConnectDrawer open={igDrawer} onClose={() => setIgDrawer(false)} />
    </>
  )
}
