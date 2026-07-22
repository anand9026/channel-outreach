import { ArrowRightLeft, Clock } from 'lucide-react'
import { WAIT_HOUR_OPTIONS, channelOrderLabel } from '../lib/cascade'
import type { CascadeOptions, ChannelOrder } from '../types'

interface CascadeControlsProps {
  value: CascadeOptions
  onChange: (next: CascadeOptions) => void
  /** When false, hide the whole panel (single-channel send). */
  enabled: boolean
  /** Allow turning cascade off → send both immediately */
  allowDisable?: boolean
  cascadeEnabled: boolean
  onCascadeEnabledChange: (on: boolean) => void
}

export function CascadeControls({
  value,
  onChange,
  enabled,
  allowDisable = true,
  cascadeEnabled,
  onCascadeEnabledChange,
}: CascadeControlsProps) {
  if (!enabled) return null

  const firstWhen: 'now' | 'schedule' = value.firstAt ? 'schedule' : 'now'
  const localFirstAt = value.firstAt
    ? toDatetimeLocal(value.firstAt)
    : toDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000).toISOString())

  return (
    <div className="cascade-panel">
      <div className="cascade-head">
        <div>
          <h4>
            <ArrowRightLeft size={16} /> Channel order & schedule
          </h4>
          <p>
            Send one channel first. Hold the second until they reply — or the wait expires.
          </p>
        </div>
        {allowDisable ? (
          <label className="toggle-inline">
            <input
              type="checkbox"
              checked={cascadeEnabled}
              onChange={(e) => onCascadeEnabledChange(e.target.checked)}
            />
            Cascade
          </label>
        ) : null}
      </div>

      {!cascadeEnabled ? (
        <p className="cascade-off muted-xs">Both channels send immediately (no follow-up hold).</p>
      ) : (
        <div className="cascade-grid">
          <label className="field">
            <span>Order</span>
            <select
              value={value.order}
              onChange={(e) =>
                onChange({ ...value, order: e.target.value as ChannelOrder })
              }
            >
              <option value="whatsapp_first">WhatsApp → then Email</option>
              <option value="email_first">Email → then WhatsApp</option>
            </select>
          </label>

          <label className="field">
            <span>First send</span>
            <select
              value={firstWhen}
              onChange={(e) => {
                if (e.target.value === 'now') {
                  onChange({ ...value, firstAt: null })
                } else {
                  onChange({
                    ...value,
                    firstAt: new Date(localFirstAt).toISOString(),
                  })
                }
              }}
            >
              <option value="now">Send now</option>
              <option value="schedule">Schedule first channel</option>
            </select>
          </label>

          {firstWhen === 'schedule' ? (
            <label className="field">
              <span>
                <Clock size={12} /> First channel at
              </span>
              <input
                type="datetime-local"
                value={localFirstAt}
                onChange={(e) =>
                  onChange({
                    ...value,
                    firstAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
              />
            </label>
          ) : null}

          <label className="field">
            <span>Follow-up wait</span>
            <select
              value={value.waitHours}
              onChange={(e) =>
                onChange({
                  ...value,
                  waitHours: Number(e.target.value) as 24 | 48 | 72,
                })
              }
            >
              {WAIT_HOUR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.demoHint})
                </option>
              ))}
            </select>
          </label>

          <label className="check-row cascade-stop">
            <input
              type="checkbox"
              checked={value.stopOnReply}
              onChange={(e) => onChange({ ...value, stopOnReply: e.target.checked })}
            />
            <span>
              Stop second channel if they reply on the first
              <small className="muted-xs">
                {channelOrderLabel(value.order)} · demo wait is compressed
              </small>
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
