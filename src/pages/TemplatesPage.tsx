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
import { useWhatsAppStore } from '../store/WhatsAppStore'
import type { OutreachChannel } from '../types'

export function TemplatesPage() {
  const { state, actions } = useWhatsAppStore()
  const [listTab, setListTab] = useState<'meta' | 'local'>('meta')
  const [filter, setFilter] = useState<'all' | OutreachChannel>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  const sortedLocal = useMemo(() => {
    const list =
      filter === 'all' ? state.templates : state.templates.filter((t) => t.channel === filter)
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.templates, filter])

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
            <h2>Templates</h2>
            <p className="card-lead">
              List & sync approved scripts here. Create in a popup. Map CSV / phones /
              influencers when you send.
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
            <p className="muted-xs" style={{ marginTop: 8 }}>
              Source: <code>{API_BASE_URL}</code>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Language</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metaTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="muted">
                          {metaError
                            ? metaError
                            : metaLoading
                              ? 'Loading…'
                              : 'No Meta templates yet. Create one to get started.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    metaTemplates.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.name}</strong>
                          <p className="muted-xs truncate">
                            {t.components?.find((c) => c.type === 'BODY')?.text ?? '—'}
                          </p>
                        </td>
                        <td>{t.language}</td>
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
                    <th>Channel</th>
                    <th>Wiring</th>
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
                          <p className="muted-xs truncate">{t.body}</p>
                        </td>
                        <td>
                          <ChannelBadge channel={t.channel} />
                        </td>
                        <td>
                          <div className="binding-pills">
                            {t.bindings.map((b) => (
                              <span key={b.slot} className="binding-pill">
                                {'{{' + b.slot + '}}'}→{b.field.split('.').pop()}
                              </span>
                            ))}
                          </div>
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
