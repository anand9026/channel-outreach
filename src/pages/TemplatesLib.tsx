import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CreateTemplateModal } from '../components/CreateTemplateModal'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { useWhatsAppStore } from '../store/WhatsAppStore'

export function TemplatesLib() {
  const { state } = useWhatsAppStore()
  const [tab, setTab] = useState<'all' | 'whatsapp' | 'email'>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const templates = useMemo(() => {
    return state.templates
      .filter((t) => (tab === 'all' ? true : t.channel === tab))
      .filter((t) =>
        !search
          ? true
          : t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.body.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.templates, tab, search])

  return (
    <div className="rx-page">
      <PageHeader
        title="Messages"
        subtitle="Your library of WhatsApp templates and email scripts. Reusable, personalizable, approvable."
        actions={
          <button
            type="button"
            className="rx-btn primary"
            onClick={() => setCreateOpen(true)}
            data-testid="new-template"
          >
            <Plus size={14} /> New template
          </button>
        }
      />

      <div className="rx-row rx-mb-4" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div className="rx-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={14} className="rx-search-icon" />
          <input
            className="rx-input"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="rx-seg">
          <button
            className={`rx-seg-btn${tab === 'all' ? ' is-active' : ''}`}
            onClick={() => setTab('all')}
          >
            All
          </button>
          <button
            className={`rx-seg-btn${tab === 'whatsapp' ? ' is-active' : ''}`}
            onClick={() => setTab('whatsapp')}
          >
            WhatsApp
          </button>
          <button
            className={`rx-seg-btn${tab === 'email' ? ' is-active' : ''}`}
            onClick={() => setTab('email')}
          >
            Email
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          body="Create your first template. WhatsApp templates need Meta approval; email scripts are ready instantly."
          primaryAction={
            <button type="button" className="rx-btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New template
            </button>
          }
        />
      ) : (
        <div className="rx-card flush">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>Category</th>
                <th>Variables</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
                    <div className="rx-text-xs rx-muted" style={{ marginTop: 2 }}>
                      {t.body.slice(0, 80)}…
                    </div>
                  </td>
                  <td>
                    <span className={`rx-badge ${t.channel === 'whatsapp' ? 'wa' : 'email'}`}>
                      {t.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    </span>
                  </td>
                  <td>
                    <span className="rx-text-2 rx-text-sm">{t.category}</span>
                  </td>
                  <td>
                    <span className="mono rx-text-sm">
                      {t.variables.length > 0 ? t.variables.join(', ') : '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`rx-badge ${statusClass(t.status)}`}>{t.status}</span>
                  </td>
                  <td>
                    <span className="rx-text-xs rx-muted">
                      {new Date(t.updatedAt).toLocaleDateString('en', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTemplateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function statusClass(s: string) {
  switch (s) {
    case 'APPROVED':
    case 'ACTIVE':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
    case 'DISABLED':
      return 'danger'
    default:
      return ''
  }
}
