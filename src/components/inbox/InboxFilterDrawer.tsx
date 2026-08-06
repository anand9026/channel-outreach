import { SlidersHorizontal, X } from 'lucide-react'
import type { ConversationIntent, ConversationStatus, OutreachChannel } from '../../types'
import { useWhatsAppStore } from '../../store/WhatsAppStore'

const INTENT_OPTIONS: ConversationIntent[] = [
  'interested',
  'pricing',
  'negotiation',
  'accepted',
  'rejected',
]

const STATUS_OPTIONS: ConversationStatus[] = ['open', 'pending', 'resolved']

const CHANNEL_OPTIONS: OutreachChannel[] = ['whatsapp', 'email', 'instagram']

type Props = {
  open: boolean
  onClose: () => void
}

export function InboxFilterDrawer({ open, onClose }: Props) {
  const { state, actions } = useWhatsAppStore()
  const f = state.inboxFilters

  if (!open) return null

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  return (
    <div className="rx-filter-drawer-backdrop" onClick={onClose} data-testid="inbox-filter-backdrop">
      <aside
        className="rx-filter-drawer"
        onClick={(e) => e.stopPropagation()}
        data-testid="inbox-filter-drawer"
        aria-label="Inbox filters"
      >
        <div className="rx-filter-drawer-head">
          <div className="rx-filter-drawer-title">
            <SlidersHorizontal size={16} /> Filters
          </div>
          <button type="button" className="rx-btn ghost sm" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="rx-filter-section">
          <div className="rx-filter-label">Campaigns</div>
          <div className="rx-filter-chips">
            {state.campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`rx-chip${f.campaignIds.includes(c.id) ? ' is-active' : ''}`}
                onClick={() =>
                  actions.setInboxFilters({
                    campaignIds: toggle(f.campaignIds, c.id),
                  })
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rx-filter-section">
          <div className="rx-filter-label">Channel</div>
          <div className="rx-filter-chips">
            {CHANNEL_OPTIONS.map((ch) => (
              <button
                key={ch}
                type="button"
                className={`rx-chip${f.channels.includes(ch) ? ' is-active' : ''}`}
                onClick={() =>
                  actions.setInboxFilters({ channels: toggle(f.channels, ch) })
                }
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        <div className="rx-filter-section">
          <div className="rx-filter-label">Status</div>
          <div className="rx-filter-chips">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`rx-chip${f.statuses.includes(s) ? ' is-active' : ''}`}
                onClick={() =>
                  actions.setInboxFilters({ statuses: toggle(f.statuses, s) })
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="rx-filter-section">
          <div className="rx-filter-label">Intent</div>
          <div className="rx-filter-chips">
            {INTENT_OPTIONS.map((intent) => (
              <button
                key={intent}
                type="button"
                className={`rx-chip rx-intent-chip intent-${intent}${f.intents.includes(intent) ? ' is-active' : ''}`}
                onClick={() =>
                  actions.setInboxFilters({ intents: toggle(f.intents, intent) })
                }
              >
                {intent.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="rx-filter-section">
          <div className="rx-filter-label">Assignee</div>
          <select
            className="rx-select"
            value={f.assigneeId || ''}
            onChange={(e) =>
              actions.setInboxFilters({ assigneeId: e.target.value || null })
            }
          >
            <option value="">Any</option>
            <option value="__unassigned__">Unassigned</option>
            {state.team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rx-filter-drawer-foot">
          <button
            type="button"
            className="rx-btn ghost"
            onClick={() => actions.resetInboxFilters()}
          >
            Clear all
          </button>
          <button type="button" className="rx-btn accent" onClick={onClose}>
            Apply
          </button>
        </div>
      </aside>
    </div>
  )
}
