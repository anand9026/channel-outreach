import {
  BarChart3,
  Inbox,
  LayoutTemplate,
  Megaphone,
  Home,
  Plug,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { TabId } from '../types'
import { connectionMode, useWhatsAppStore } from '../store/WhatsAppStore'
import { ToastStack } from './Toast'

const nav: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'floor', label: 'Home', icon: Home },
  { id: 'connect', label: 'Channels', icon: Plug },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export function Layout({ children }: { children: ReactNode }) {
  const { state, actions } = useWhatsAppStore()
  const mode = connectionMode(state)
  const openCount = state.conversations.filter((c) => c.status !== 'resolved').length
  const pendingTemplates = state.templates.filter((t) => t.status === 'PENDING').length
  const onFloor = state.activeTab === 'floor'
  const live = mode !== 'none'

  const subtitles: Partial<Record<TabId, string>> = {
    floor:
      mode === 'both'
        ? 'WhatsApp + Email connected · pick a campaign and send'
        : mode === 'whatsapp'
          ? 'WhatsApp connected · add Email anytime'
          : mode === 'email'
            ? 'Email connected · add WhatsApp anytime'
            : 'Connect a channel to get started',
    connect: 'Connect WhatsApp, Email, or both',
    templates: 'List Meta templates · create in popup · send with CSV / phones / influencers',
    campaigns: 'Attach channels and send to campaign influencers',
    inbox: 'Conversations per org, channel, and influencer',
    analytics: 'Delivery and replies by channel',
  }

  return (
    <div className={`app-shell${onFloor ? ' on-floor' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Home size={20} strokeWidth={2.2} />
          </div>
          <div>
            <p className="brand-title">Reelax Outreach</p>
            <p className="brand-sub">{state.organization.name}</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map(({ id, label, icon: Icon }) => {
            const active = state.activeTab === id
            let badge: number | undefined
            if (id === 'inbox') badge = openCount
            if (id === 'templates') badge = pendingTemplates || undefined
            const locked = id === 'floor' && !live
            return (
              <button
                key={id}
                type="button"
                className={`nav-item${active ? ' active' : ''}${locked ? ' dim' : ''}`}
                onClick={() => actions.setTab(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {badge ? <span className="nav-badge">{badge}</span> : null}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <p className="muted-xs">
            {mode === 'none'
              ? 'No channels connected'
              : mode === 'both'
                ? 'WhatsApp + Email live'
                : `${mode === 'whatsapp' ? 'WhatsApp' : 'Email'} only`}
          </p>
          <p className="muted-xs">
            WA {state.whatsAppNumbers.length ? '●' : '○'} · Email{' '}
            {state.emailAccounts.length ? '●' : '○'} · {state.brands.length} brands
          </p>
        </div>
      </aside>
      <div className="main-column">
        {!onFloor ? (
          <header className="topbar">
            <div>
              <h1 className="page-title">{nav.find((n) => n.id === state.activeTab)?.label}</h1>
              <p className="page-subtitle">{subtitles[state.activeTab]}</p>
            </div>
          </header>
        ) : null}
        <main className={`content${onFloor ? ' floor-content' : ''}`}>{children}</main>
      </div>
      <ToastStack />
    </div>
  )
}
