import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateTemplateModal } from '../components/CreateTemplateModal'
import { SendWizard } from '../components/SendWizard'
import { ChannelBadge, TemplateStatusBadge } from '../components/StatusBadge'
import {
  API_BASE_URL,
  ApiError,
  listWhatsAppTemplates,
  type MetaTemplate,
} from '../lib/api'
import { fillMetaBody, extractMetaSlots } from '../lib/templateSlots'
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel } from '../types'

function metaBody(t: MetaTemplate): string {
  return t.components?.find((c) => c.type === 'BODY')?.text ?? ''
}

function samplePreview(t: MetaTemplate): string {
  const body = metaBody(t)
  const slots = extractMetaSlots(body)
  const example =
    t.components?.find((c) => c.type === 'BODY')?.example?.body_text?.[0] ?? []
  const values: Record<string, string> = {}
  slots.forEach((s, i) => {
    values[s] = example[i] || `value_${s}`
  })
  return fillMetaBody(body, values) || body || '—'
}

export function TemplatesPage() {
  const { state, actions } = useWhatsAppStore()
  const [listTab, setListTab] = useState<'meta' | 'local'>('meta')
  const [filter, setFilter] = useState<'all' | OutreachChannel>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'APPROVED' | 'ALL'>('APPROVED')

  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  const sortedLocal = useMemo(() => {
    const list =
      filter === 'all' ? state.templates : state.templates.filter((t) => t.channel === filter)
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.templates, filter])

  const visibleMeta = useMemo(() => {
    if (statusFilter === 'ALL') return metaTemplates
    return metaTemplates.filter((t) => t.status === 'APPROVED')
  }, [metaTemplates, statusFilter])

  const syncMetaTemplates = useCallback(async () => {
    setMetaLoading(true)
    setMetaError(null)
    try {
      const list = await listWhatsAppTemplates({ limit: 50 })
      setMetaTemplates(list)
      actions.toast(`Synced ${list.length} Meta template(s)`, 'success')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to sync templates'
      setMetaTemplates([])
      setMetaError(
        `${message}. Ensure WHATSAPP_OUTREACH_ACCESS_TOKEN is set on the API server.`,
      )
      actions.toast(message, 'error')
    } finally {
      setMetaLoading(false)
    }
  }, [actions])

  useEffect(() => {
    void syncMetaTemplates()
  }, [syncMetaTemplates])

  return (
    <div className="page-grid">
      <section className="card">
        <div className="row-between">
          <div>
            <h2>Template library</h2>
            <p className="card-lead">
              Approved scripts for sending. Create = Meta body + samples only (no brand /
              influencer). Mapping happens in Send / Campaigns.
            </p>
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="btn secondary"
              disabled={metaLoading}
              onClick={() => void syncMetaTemplates()}
            >
              {metaLoading ? 'Syncing…' : 'Refresh Meta'}
            </button>
            <button
              type="button"
              className="btn primary wa"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} /> Create template
            </button>
          </div>
        </div>

        <div className="segmented" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={listTab === 'meta' ? 'active' : ''}
            onClick={() => setListTab('meta')}
          >
            Meta WhatsApp
          </button>
          <button
            type="button"
            className={listTab === 'local' ? 'active' : ''}
            onClick={() => setListTab('local')}
          >
            Local scripts
          </button>
        </div>

        {listTab === 'meta' ? (
          <>
            <div className="row-between" style={{ marginTop: 8 }}>
              <p className="muted-xs">
                Source: <code>{API_BASE_URL}</code>
              </p>
              <div className="segmented">
                <button
                  type="button"
                  className={statusFilter === 'APPROVED' ? 'active' : ''}
                  onClick={() => setStatusFilter('APPROVED')}
                >
                  Approved
                </button>
                <button
                  type="button"
                  className={statusFilter === 'ALL' ? 'active' : ''}
                  onClick={() => setStatusFilter('ALL')}
                >
                  All statuses
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Preview</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMeta.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="muted">
                          {metaError
                            ? metaError
                            : metaLoading
                              ? 'Loading…'
                              : statusFilter === 'APPROVED'
                                ? 'No APPROVED templates yet — create one and wait for Meta.'
                                : 'No Meta templates yet.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visibleMeta.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.name}</strong>
                          <p className="muted-xs">
                            {t.language} · {t.category}
                          </p>
                        </td>
                        <td>
                          <p className="template-preview-cell">{samplePreview(t)}</p>
                          <p className="muted-xs truncate">Raw: {metaBody(t) || '—'}</p>
                        </td>
                        <td>{t.category}</td>
                        <td>
                          <TemplateStatusBadge
                            status={
                              t.status === 'APPROVED'
                                ? 'APPROVED'
                                : t.status === 'REJECTED'
                                  ? 'REJECTED'
                                  : t.status === 'PENDING'
                                    ? 'PENDING'
                                    : 'DRAFT'
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="segmented" style={{ marginTop: 8 }}>
              {(['all', 'whatsapp', 'email'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Preview</th>
                    <th>Channel</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLocal.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="muted">No local scripts yet.</p>
                      </td>
                    </tr>
                  ) : (
                    sortedLocal.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.name}</strong>
                        </td>
                        <td>
                          <p className="template-preview-cell">
                            {t.subject ? `${t.subject} — ` : ''}
                            {t.body}
                          </p>
                        </td>
                        <td>
                          <ChannelBadge channel={t.channel} />
                        </td>
                        <td>
                          <TemplateStatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <SendWizard />

      <CreateTemplateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void syncMetaTemplates()}
      />
    </div>
  )
}
