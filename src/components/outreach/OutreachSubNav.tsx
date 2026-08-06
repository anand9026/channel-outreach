import { useWhatsAppStore } from '../../store/WhatsAppStore'
import type { TabId } from '../../types'
import { normalizeTab } from '../../types'
import { outreachNavItems } from './outreach-nav'

export function OutreachSubNav() {
  const { state, actions } = useWhatsAppStore()
  const active = normalizeTab(state.activeTab)
  const openCount = state.conversations.filter(
    (c) => c.status !== 'resolved' && c.unreadCount > 0,
  ).length
  const pendingTemplates = state.templates.filter((t) => t.status === 'PENDING').length

  return (
    <nav className="rx-outreach-subnav" aria-label="Outreach" data-testid="outreach-subnav">
      {outreachNavItems.map(({ id, label, icon: Icon, testId }) => {
        const isActive = active === id
        let badge: number | undefined
        if (id === 'inbox') badge = openCount || undefined
        if (id === 'templates') badge = pendingTemplates || undefined
        return (
          <button
            key={id}
            type="button"
            className={`rx-outreach-subnav-item${isActive ? ' is-active' : ''}`}
            onClick={() => actions.setTab(id as TabId)}
            data-testid={testId}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
            {badge ? <span className="rx-outreach-subnav-badge">{badge}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
