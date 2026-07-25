import { BarChart3, Inbox, LayoutTemplate, Send, Settings, Zap } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { TabId } from '../types'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { ToastStack } from './Toast'
import { SettingsDrawer } from './SettingsDrawer'
import { OnboardingSheet } from './OnboardingSheet'

const primaryNav: {
  id: Exclude<TabId, 'connect' | 'floor'>
  label: string
  icon: typeof Send
}[] = [
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'quicksend', label: 'Quick Send', icon: Zap },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'templates', label: 'Messages', icon: LayoutTemplate },
  { id: 'analytics', label: 'Results', icon: BarChart3 },
]

export function Layout({ children }: { children: ReactNode }) {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const openCount = state.conversations.filter((c) => c.status !== 'resolved' && c.unreadCount > 0)
    .length
  const pendingTemplates = state.templates.filter((t) => t.status === 'PENDING').length
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Redirect legacy 'connect' / 'floor' tab values to 'campaigns'
  useEffect(() => {
    if (state.activeTab === 'connect' || state.activeTab === 'floor') {
      actions.setTab('campaigns')
    }
  }, [state.activeTab, actions])

  const showOnboarding = mode === 'none'
  const activeTab =
    state.activeTab === 'floor' || state.activeTab === 'connect' ? 'campaigns' : state.activeTab

  return (
    <div className="rx-shell">
      <aside className="rx-sidebar" data-testid="rx-sidebar">
        <div className="rx-brand">
          <div className="rx-brand-mark">R</div>
          <div>
            <div className="rx-brand-name">Reelax Outreach</div>
            <div className="rx-brand-org">{state.organization.name}</div>
          </div>
        </div>

        <nav className="rx-nav" aria-label="Primary">
          {primaryNav.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            let badge: number | undefined
            if (id === 'inbox') badge = openCount || undefined
            if (id === 'templates') badge = pendingTemplates || undefined
            return (
              <button
                key={id}
                type="button"
                className={`rx-nav-item${isActive ? ' is-active' : ''}`}
                onClick={() => actions.setTab(id)}
                data-testid={`nav-${id}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {badge ? <span className="rx-nav-badge">{badge}</span> : null}
              </button>
            )
          })}
        </nav>

        <div className="rx-sidebar-footer">
          <div className="rx-conn-status">
            <span
              className={`rx-dot${state.whatsAppNumbers.length ? ' is-live-wa' : ''}`}
              aria-hidden
            />
            WhatsApp {state.whatsAppNumbers.length ? 'live' : 'not connected'}
          </div>
          <div className="rx-conn-status">
            <span
              className={`rx-dot${state.emailAccounts.length ? ' is-live-email' : ''}`}
              aria-hidden
            />
            Email {state.emailAccounts.length ? 'live' : 'not connected'}
          </div>
          <button
            type="button"
            className="rx-settings-btn"
            onClick={() => setSettingsOpen(true)}
            data-testid="open-settings"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <div className="rx-main">
        <main>{children}</main>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {showOnboarding ? <OnboardingSheet /> : null}
      <ToastStack />
    </div>
  )
}
