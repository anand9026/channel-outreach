import { BarChart3, ChevronsLeft, ChevronsRight, Home, Megaphone, Settings, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { normalizeTab } from '../types'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { ToastStack } from './Toast'
import { SettingsDrawer } from './SettingsDrawer'
import { OnboardingSheet } from './OnboardingSheet'
import { OrgWorkspaceBanner } from './OrgWorkspaceBanner'
import { OutreachSubNav } from './outreach/OutreachSubNav'

/** Platform modules — Outreach is the active module in this app. */
const platformModules = [
  { id: 'platform-home', label: 'Home', icon: Home, disabled: true },
  { id: 'platform-creators', label: 'Creators', icon: Users, disabled: true },
  { id: 'outreach', label: 'Outreach', icon: Megaphone, disabled: false },
  { id: 'platform-analytics', label: 'Analytics', icon: BarChart3, disabled: true },
] as const

export function Layout({ children }: { children: ReactNode }) {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (state.activeTab === 'floor') {
      actions.setTab('overview')
    }
  }, [state.activeTab, actions])

  const showOnboarding = mode === 'none'
  const emailConnected = state.emailAccounts.length > 0
  const activeTab = normalizeTab(state.activeTab)

  return (
    <div className="rx-shell rx-shell-platform">
      <aside
        className={`rx-platform-rail${state.prefs.sidebarCollapsed ? ' is-collapsed' : ''}`}
        data-testid="rx-platform-rail"
      >
        <div className="rx-brand">
          <div className="rx-brand-mark">R</div>
          {!state.prefs.sidebarCollapsed && (
            <div>
              <div className="rx-brand-name">Reelax</div>
              <div className="rx-brand-org">{state.organization.name}</div>
            </div>
          )}
        </div>

        <nav className="rx-platform-nav" aria-label="Platform">
          {platformModules.map(({ id, label, icon: Icon, disabled }) => (
            <button
              key={id}
              type="button"
              className={`rx-platform-nav-item${id === 'outreach' ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
              disabled={disabled}
              title={disabled ? `${label} (platform)` : label}
              data-testid={`platform-${id}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              {!state.prefs.sidebarCollapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        <div className="rx-sidebar-footer">
          {!state.prefs.sidebarCollapsed && (
            <>
              <div className="rx-conn-status">
                <span
                  className={`rx-dot${state.whatsAppNumbers.length ? ' is-live-wa' : ''}`}
                  aria-hidden
                />
                WhatsApp {state.whatsAppNumbers.length ? 'live' : 'off'}
              </div>
              <div className="rx-conn-status">
                <span
                  className={`rx-dot${state.instagramAccounts.length ? ' is-live-ig' : ''}`}
                  aria-hidden
                />
                Instagram {state.instagramAccounts.length ? 'live' : 'off'}
              </div>
              <div className="rx-conn-status" title={state.emailAccounts[0]?.fromEmail}>
                <span className={`rx-dot${emailConnected ? ' is-live-email' : ''}`} aria-hidden />
                {emailConnected ? 'Gmail live' : 'Gmail off'}
              </div>
            </>
          )}
          <button
            type="button"
            className="rx-settings-btn"
            onClick={() => setSettingsOpen(true)}
            data-testid="open-settings"
            title="Settings"
          >
            <Settings size={16} />
            {!state.prefs.sidebarCollapsed && <span>Settings</span>}
          </button>
          <button
            type="button"
            className="rx-settings-btn rx-sidebar-collapse-btn"
            onClick={() => actions.setSidebarCollapsed(!state.prefs.sidebarCollapsed)}
            data-testid="toggle-sidebar"
            aria-label={state.prefs.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {state.prefs.sidebarCollapsed ? (
              <ChevronsRight size={16} />
            ) : (
              <>
                <ChevronsLeft size={16} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="rx-main rx-main-module">
        <OutreachSubNav />
        <OrgWorkspaceBanner />
        <main className="rx-module-content" data-active-tab={activeTab}>
          {children}
        </main>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {showOnboarding ? <OnboardingSheet /> : null}
      <ToastStack />
    </div>
  )
}
