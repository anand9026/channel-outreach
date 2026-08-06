import {
  BarChart3,
  Inbox,
  LayoutTemplate,
  LayoutGrid,
  Radio,
  Send,
} from 'lucide-react'
import type { TabId } from '../../types'
import { normalizeTab } from '../../types'

export type OutreachNavItem = {
  id: TabId
  label: string
  icon: typeof Send
  testId: string
}

/** Secondary tabs inside the Outreach module (blueprint §3). */
export const outreachNavItems: OutreachNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, testId: 'nav-overview' },
  { id: 'campaigns', label: 'Campaigns', icon: Send, testId: 'nav-campaigns' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, testId: 'nav-inbox' },
  { id: 'channels', label: 'Channels', icon: Radio, testId: 'nav-channels' },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, testId: 'nav-templates' },
  { id: 'reports', label: 'Reports', icon: BarChart3, testId: 'nav-reports' },
]

export function isOutreachModuleTab(tab: TabId): boolean {
  const n = normalizeTab(tab)
  return outreachNavItems.some((item) => item.id === n)
}
