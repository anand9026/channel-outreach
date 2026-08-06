import {
  AlertTriangle,
  Bell,
  BellOff,
  Bookmark,
  Check,
  CheckSquare,
  Filter,
  Flame,
  Inbox as InboxIcon,
  Mail,
  MessageCircle,
  RefreshCcw,
  Search,
  Tag,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CampaignInboxRow } from '../components/inbox/CampaignInboxRow'
import { ConversationThread } from '../components/inbox/ConversationThread'
import { InboxFilterDrawer } from '../components/inbox/InboxFilterDrawer'
import {
  activeInboxFilterCount,
  conversationPassesInboxFilters,
} from '../components/inbox/inbox-filter-utils'
import {
  expandToInboxCampaignRows,
  inboxRowMatchesCampaignFilter,
} from '../components/inbox/inbox-campaign-rows'
import {
  isCreatorConversation,
  isOutreachConversation,
} from '../components/inbox/inbox-conversation-utils'
import { EmptyState } from '../components/EmptyState'
import { IgIcon } from '../components/BrandIcons'
import { resolveOrgId } from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { Conversation, Influencer, Message, OutreachChannel } from '../types'
import { AD_HOC_CAMPAIGN_ID } from '../types'

function formatSince(ts: string | null): string {
  if (!ts) return 'never'
  const diff = Math.max(0, Date.now() - new Date(ts).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

type SavedView =
  | 'creators'
  | 'all'
  | 'unread'
  | 'hot'
  | 'unanswered_24h'
  | 'replied'
  | 'live'

const savedViewDefs: Array<{ id: SavedView; label: string; icon: typeof Bookmark }> = [
  { id: 'creators', label: 'Creators', icon: MessageCircle },
  { id: 'all', label: 'All mail', icon: InboxIcon },
  { id: 'unread', label: 'Unread', icon: Bell },
  { id: 'hot', label: 'Hot leads', icon: Flame },
  { id: 'unanswered_24h', label: 'Unanswered 24h', icon: AlertTriangle },
  { id: 'replied', label: 'Replied', icon: MessageCircle },
  { id: 'live', label: 'Live only', icon: Wifi },
]

function passesSavedView(
  c: Conversation,
  view: SavedView,
  messagesForConv: Message[],
  inf?: Influencer,
): boolean {
  if (!isOutreachConversation(c, inf, messagesForConv)) return false
  switch (view) {
    case 'creators':
      return isCreatorConversation(c, inf)
    case 'unread':
      return c.unreadCount > 0
    case 'hot':
      return (c.labels || []).some((l) => l.toLowerCase().includes('hot'))
    case 'unanswered_24h': {
      if (!c.lastInboundAt) return false
      const lastOut = messagesForConv
        .filter((m) => m.direction === 'outbound')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const inboundAt = new Date(c.lastInboundAt).getTime()
      const ageHrs = (Date.now() - inboundAt) / 36e5
      if (ageHrs > 24) return false
      if (!lastOut) return true
      return new Date(lastOut.createdAt).getTime() < inboundAt
    }
    case 'replied':
      return messagesForConv.some((m) => m.direction === 'inbound')
    case 'live':
      return Boolean(c.isLive)
    default:
      return true
  }
}

export function InboxV2() {
  const { state, actions } = useWhatsAppStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | OutreachChannel>('all')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [savedView, setSavedView] = useState<SavedView>('creators')
  const [syncing, setSyncing] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // Force re-render every 20s so the "last synced Xs ago" label ticks.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 20000)
    return () => window.clearInterval(id)
  }, [])

  const messagesByConv = useMemo(() => {
    const map = new Map<string, Message[]>()
    for (const m of state.messages) {
      const list = map.get(m.conversationId) || []
      list.push(m)
      map.set(m.conversationId, list)
    }
    return map
  }, [state.messages])

  const allLabels = useMemo(() => {
    const s = new Set<string>()
    for (const c of state.conversations) for (const l of c.labels || []) s.add(l)
    return [...s].sort()
  }, [state.conversations])

  const inboxRows = useMemo(() => {
    const rows = expandToInboxCampaignRows(state.conversations, state.messages)
    return rows
      .filter((row) => inboxRowMatchesCampaignFilter(row, state.inboxCampaignFilter))
      .filter((row) => {
        if (tab === 'all') return true
        return row.channels.includes(tab)
      })
      .filter((row) => {
        const conv = state.conversations.find((c) => c.id === row.conversationId)
        if (!conv) return false
        return conversationPassesInboxFilters(conv, row, state.inboxFilters)
      })
      .filter((row) => {
        const conv = state.conversations.find((c) => c.id === row.conversationId)
        if (!conv) return false
        if (labelFilter ? !(conv.labels || []).includes(labelFilter) : false) return false
        const inf = state.influencers.find((i) => i.id === row.influencerId)
        return passesSavedView(conv, savedView, messagesByConv.get(conv.id) || [], inf)
      })
      .filter((row) => {
        if (!search) return true
        const inf = state.influencers.find((i) => i.id === row.influencerId)
        const campaign = state.campaigns.find((c) => c.id === row.campaignId)
        const conv = state.conversations.find((c) => c.id === row.conversationId)
        return (
          inf?.name.toLowerCase().includes(search.toLowerCase()) ||
          inf?.handle.toLowerCase().includes(search.toLowerCase()) ||
          inf?.phone.toLowerCase().includes(search.toLowerCase()) ||
          (inf?.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (campaign?.name || '').toLowerCase().includes(search.toLowerCase()) ||
          row.lastPreview?.toLowerCase().includes(search.toLowerCase()) ||
          (conv?.labels || []).some((l) => l.toLowerCase().includes(search.toLowerCase()))
        )
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  }, [
    state.conversations,
    state.messages,
    state.inboxCampaignFilter,
    state.influencers,
    state.inboxFilters,
    state.campaigns,
    tab,
    labelFilter,
    savedView,
    search,
    messagesByConv,
  ])

  const selectedRow = useMemo(() => {
    if (!state.selectedConversationId) return null
    const match = inboxRows.find(
      (r) =>
        r.conversationId === state.selectedConversationId &&
        (state.selectedInboxCampaignId
          ? r.campaignId === state.selectedInboxCampaignId
          : true),
    )
    return match || inboxRows.find((r) => r.conversationId === state.selectedConversationId) || null
  }, [inboxRows, state.selectedConversationId, state.selectedInboxCampaignId])

  const selected = state.conversations.find((c) => c.id === state.selectedConversationId)

  useEffect(() => {
    if (!selectedRow && inboxRows.length > 0 && !selectMode) {
      const first = inboxRows[0]
      actions.selectConversation(first.conversationId, first.campaignId)
    }
  }, [inboxRows, selectedRow, actions, selectMode])

  const { polling, lastSyncedAt, lastError, connection } = state.liveInbox
  const liveThreadCount = state.conversations.filter((c) => c.isLive).length
  const notifyEnabled = state.prefs.notifyEnabled

  const onSyncNow = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await actions.syncLiveInboxNow()
    } finally {
      setSyncing(false)
    }
  }

  const toggleSelected = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => {
    setSelection(new Set())
    setSelectMode(false)
  }

  return (
    <>
      <div style={{ padding: '32px 40px 20px' }}>
        <div className="rx-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 className="rx-page-title">Inbox</h1>
            <p className="rx-page-sub">
              Creator conversations from your outreach campaigns — WhatsApp and email, per channel.
            </p>
          </div>
          <div className="rx-row" style={{ gap: 8 }}>
            <button
              type="button"
              className="rx-btn ghost sm"
              onClick={() => {
                if (notifyEnabled) actions.disableNotifications()
                else void actions.enableNotifications()
              }}
              data-testid="toggle-notifications"
              title={notifyEnabled ? 'Notifications on' : 'Enable desktop notifications'}
            >
              {notifyEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              {notifyEnabled ? 'Notify on' : 'Notify'}
            </button>
            <div className="rx-live-bar" data-testid="live-inbox-bar" role="status" aria-live="polite">
              <span
                className={`rx-live-dot${polling && !lastError ? ' is-on' : lastError ? ' is-err' : ''}`}
                aria-hidden
              />
              <div className="rx-live-meta">
                <div className="rx-live-title">
                  {polling ? (lastError ? 'Live · retrying' : 'Live') : 'Paused'}
                  {liveThreadCount > 0 ? (
                    <span className="rx-live-count mono">· {liveThreadCount}</span>
                  ) : null}
                </div>
                <div className="rx-live-sub mono">
                  {lastError ? (
                    <span className="rx-live-err" title={lastError}>
                      <AlertTriangle size={11} /> {lastError.slice(0, 40)}
                    </span>
                  ) : (
                    <>synced {formatSince(lastSyncedAt)}</>
                  )}
                  {connection?.phone_number_id ? (
                    <span className="rx-live-pnid" title={connection.phone_number_id}>
                      · pnid {connection.phone_number_id.slice(-6)}
                    </span>
                  ) : null}
                  <span className="rx-live-pnid" title="Outreach org_id">
                    · org {resolveOrgId()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="rx-btn ghost sm"
                onClick={onSyncNow}
                disabled={syncing}
                title="Sync now"
                data-testid="sync-inbox-now"
              >
                <RefreshCcw size={13} className={syncing ? 'rx-spin' : ''} />
              </button>
              <button
                type="button"
                className="rx-btn ghost sm"
                onClick={() => actions.setLivePolling(!polling)}
                title={polling ? 'Pause live polling' : 'Resume live polling'}
                data-testid="toggle-live-polling"
              >
                {polling ? <Wifi size={13} /> : <WifiOff size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Campaign scope + saved views */}
        <div className="rx-inbox-toolbar" data-testid="inbox-toolbar">
          <label className="rx-inbox-campaign-picker">
            <span className="rx-text-xs rx-muted">Campaign</span>
            <select
              className="rx-select sm"
              value={state.inboxCampaignFilter}
              onChange={(e) => actions.setInboxCampaignFilter(e.target.value as 'all' | string)}
              data-testid="inbox-campaign-picker"
            >
              <option value="all">All campaigns</option>
              {state.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={AD_HOC_CAMPAIGN_ID}>Ad-hoc</option>
            </select>
          </label>
        </div>

        <div className="rx-saved-views" data-testid="saved-views">
          <button
            type="button"
            className={`rx-chip${activeInboxFilterCount(state.inboxFilters) ? ' is-active' : ''}`}
            onClick={() => setFilterOpen(true)}
            data-testid="open-inbox-filters"
          >
            <Filter size={11} /> Filters
            {activeInboxFilterCount(state.inboxFilters) > 0 ? (
              <span className="rx-nav-badge">{activeInboxFilterCount(state.inboxFilters)}</span>
            ) : null}
          </button>
          {savedViewDefs.map((v) => {
            const Icon = v.icon
            return (
              <button
                key={v.id}
                type="button"
                className={`rx-chip${savedView === v.id ? ' is-active' : ''}`}
                onClick={() => setSavedView(v.id)}
                data-testid={`view-${v.id}`}
              >
                <Icon size={11} /> {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="rx-bulk-bar" data-testid="bulk-bar">
          <span className="rx-text-sm">{selection.size} selected</span>
          <div className="rx-row" style={{ gap: 8 }}>
            <button
              type="button"
              className="rx-btn secondary sm"
              disabled={selection.size === 0}
              onClick={() => {
                const convIds = [...new Set([...selection].map((rowId) => rowId.split('::')[0]))]
                actions.bulkResolve(convIds)
                actions.toast(`Resolved ${selection.size} thread${selection.size > 1 ? 's' : ''}`, 'success')
                clearSelection()
              }}
              data-testid="bulk-resolve"
            >
              <Check size={12} /> Resolve
            </button>
            <select
              className="rx-select sm"
              defaultValue=""
              onChange={(e) => {
                const memberId = e.target.value || undefined
                if (selection.size > 0) {
                  const convIds = [...new Set([...selection].map((rowId) => rowId.split('::')[0]))]
                  actions.bulkAssign(convIds, memberId)
                  actions.toast(`Assigned ${selection.size} thread${selection.size > 1 ? 's' : ''}`, 'success')
                  clearSelection()
                }
                e.currentTarget.value = ''
              }}
              data-testid="bulk-assign"
            >
              <option value="">Assign to…</option>
              {state.team.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button type="button" className="rx-btn ghost sm" onClick={clearSelection}>
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rx-inbox">
        <div className="rx-inbox-list">
          <div className="rx-inbox-list-head">
            <div className="rx-search">
              <Search size={14} className="rx-search-icon" />
              <input
                className="rx-input"
                placeholder="Search creators, phone, or messages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="rx-row" style={{ gap: 6, alignItems: 'center' }}>
              <div className="rx-seg">
                <button className={`rx-seg-btn${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>All</button>
                <button className={`rx-seg-btn${tab === 'whatsapp' ? ' is-active' : ''}`} onClick={() => setTab('whatsapp')} title="WhatsApp"><MessageCircle size={12} /></button>
                <button className={`rx-seg-btn${tab === 'instagram' ? ' is-active' : ''}`} onClick={() => setTab('instagram')} title="Instagram"><IgIcon size={12} /></button>
                <button className={`rx-seg-btn${tab === 'email' ? ' is-active' : ''}`} onClick={() => setTab('email')} title="Email"><Mail size={12} /></button>
              </div>
              <button
                type="button"
                className={`rx-btn ghost sm${selectMode ? ' is-active' : ''}`}
                onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
                title="Multi-select"
                data-testid="toggle-select-mode"
              >
                <CheckSquare size={12} />
              </button>
            </div>
            {allLabels.length > 0 && (
              <div className="rx-label-filter">
                <button
                  className={`rx-chip${!labelFilter ? ' is-active' : ''}`}
                  onClick={() => setLabelFilter(null)}
                >
                  All labels
                </button>
                {allLabels.map((l) => (
                  <button
                    key={l}
                    className={`rx-chip${labelFilter === l ? ' is-active' : ''}`}
                    onClick={() => setLabelFilter(l === labelFilter ? null : l)}
                  >
                    <Tag size={10} /> {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {inboxRows.length === 0 ? (
            <div style={{ padding: 32 }}>
              <EmptyState
                title={savedView === 'creators' ? 'No creator conversations yet' : 'No conversations match'}
                body={
                  savedView === 'creators'
                    ? 'Send a campaign to a creator to start a conversation here.'
                    : 'Try switching the saved view, campaign filter, or clearing search.'
                }
              />
            </div>
          ) : (
            inboxRows.map((row) => {
              const conv = state.conversations.find((c) => c.id === row.conversationId)!
              const inf = state.influencers.find((i) => i.id === row.influencerId)
              const campaign = state.campaigns.find((c) => c.id === row.campaignId)
              const rowSelected =
                state.selectedConversationId === row.conversationId &&
                (state.selectedInboxCampaignId
                  ? state.selectedInboxCampaignId === row.campaignId
                  : selectedRow?.rowId === row.rowId)
              return (
                <CampaignInboxRow
                  key={row.rowId}
                  row={row}
                  conversation={conv}
                  campaign={campaign}
                  influencer={inf}
                  selected={rowSelected}
                  selectMode={selectMode}
                  checked={selection.has(row.rowId)}
                  onSelect={() => {
                    if (selectMode) toggleSelected(row.rowId)
                    else actions.selectConversation(row.conversationId, row.campaignId)
                  }}
                  onToggleCheck={() => toggleSelected(row.rowId)}
                />
              )
            })
          )}
        </div>

        {selected && selectedRow ? (
          <ConversationThread scopedCampaignId={selectedRow.campaignId} />
        ) : (
          <EmptyThread />
        )}
      </div>
      <InboxFilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)} />
    </>
  )
}

function EmptyThread() {
  return (
    <div className="rx-thread">
      <div style={{ margin: 'auto', padding: 40 }}>
        <EmptyState
          icon={<MessageCircle size={20} />}
          title="Pick a conversation"
          body="Select a chat from the list to see the thread."
        />
      </div>
    </div>
  )
}
