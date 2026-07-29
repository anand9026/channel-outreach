import { AlertTriangle, Plus, RefreshCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CreateTemplateModal } from '../components/CreateTemplateModal'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import {
  GMAIL_USER_ID,
  listGmailTemplates,
  listWhatsAppTemplates,
  type GmailTemplate,
  type MetaTemplate,
} from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'

type Row = {
  key: string
  source: 'local' | 'meta' | 'gmail'
  name: string
  channel: 'whatsapp' | 'email' | 'instagram'
  category: string
  body: string
  variables: string[]
  status: string
  updatedAt: string
}

function extractMetaBody(t: MetaTemplate): { body: string; variables: string[] } {
  const bodyComp = (t.components || []).find(
    (c) => (c.type || '').toUpperCase() === 'BODY',
  )
  const body = bodyComp?.text || ''
  const slots = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])
  return { body, variables: [...new Set(slots)] }
}

export function TemplatesLib() {
  const { state } = useWhatsAppStore()
  const [tab, setTab] = useState<'all' | 'whatsapp' | 'email'>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [gmailTemplates, setGmailTemplates] = useState<GmailTemplate[]>([])
  const [gmailError, setGmailError] = useState<string | null>(null)

  const loadMeta = async () => {
    setMetaLoading(true)
    setMetaError(null)
    try {
      const res = await listWhatsAppTemplates({ limit: 100 })
      setMetaTemplates(res)
    } catch (e) {
      setMetaError((e as Error).message || 'Could not load Meta templates')
    } finally {
      setMetaLoading(false)
    }
  }

  const loadGmail = async () => {
    setGmailError(null)
    try {
      const gmailAcc = state.emailAccounts.find(
        (a) => a.provider === 'gmail' && a.userId,
      )
      const userId = gmailAcc?.userId || GMAIL_USER_ID
      const res = await listGmailTemplates({ user_id: userId })
      setGmailTemplates(res)
    } catch (e) {
      setGmailError((e as Error).message || 'Could not load Gmail templates')
    }
  }

  useEffect(() => {
    void loadMeta()
    void loadGmail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo<Row[]>(() => {
    const localRows: Row[] = state.templates.map((t) => ({
      key: `local:${t.id}`,
      source: 'local',
      name: t.name,
      channel: t.channel,
      category: t.category,
      body: t.body,
      variables: t.variables,
      status: t.status,
      updatedAt: t.updatedAt,
    }))

    const localNames = new Set(
      state.templates
        .filter((t) => t.channel === 'whatsapp')
        .map((t) => t.name.toLowerCase()),
    )
    const metaRows: Row[] = metaTemplates
      // De-dupe against local WhatsApp templates with the same name
      .filter((t) => !localNames.has((t.name || '').toLowerCase()))
      .map((t) => {
        const { body, variables } = extractMetaBody(t)
        return {
          key: `meta:${t.id}`,
          source: 'meta',
          name: t.name,
          channel: 'whatsapp',
          category: t.category,
          body,
          variables,
          status: t.status,
          updatedAt: '',
        }
      })

    const gmailRows: Row[] = gmailTemplates.map((t) => {
      const bodyText = (t.html_template || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return {
        key: `gmail:${t.template_id}`,
        source: 'gmail',
        name: t.name || t.template_name,
        channel: 'email',
        category: 'UTILITY',
        body: bodyText,
        variables: [],
        status: 'ACTIVE',
        updatedAt: t.updated_at || t.created_at || '',
      }
    })

    return [...localRows, ...metaRows, ...gmailRows]
      .filter((r) => (tab === 'all' ? true : r.channel === tab))
      .filter((r) =>
        !search
          ? true
          : r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.body.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.templates, metaTemplates, gmailTemplates, tab, search])

  return (
    <div className="rx-page">
      <PageHeader
        title="Messages"
        subtitle="Your library of WhatsApp templates and email scripts. Reusable, personalizable, approvable."
        actions={
          <>
            <button
              type="button"
              className="rx-btn secondary"
              onClick={() => {
                void loadMeta()
                void loadGmail()
              }}
              disabled={metaLoading}
              title="Refresh Meta and Gmail templates"
              data-testid="refresh-meta-templates"
            >
              <RefreshCcw size={13} className={metaLoading ? 'rx-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              className="rx-btn primary"
              onClick={() => setCreateOpen(true)}
              data-testid="new-template"
            >
              <Plus size={14} /> New template
            </button>
          </>
        }
      />

      {metaError ? (
        <div
          className="rx-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            marginBottom: 16,
            borderColor: 'var(--warning, #f59e0b)',
            background: 'var(--warning-soft, #fef3c7)',
            color: 'var(--warning, #92400e)',
          }}
          data-testid="meta-templates-error"
        >
          <AlertTriangle size={14} />
          <span className="rx-text-sm">
            Meta template sync failed: {metaError}. Local templates still work.
          </span>
        </div>
      ) : null}

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

      {rows.length === 0 ? (
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
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.key} data-testid={`template-row-${t.source}-${t.name}`}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
                    <div className="rx-text-xs rx-muted" style={{ marginTop: 2 }}>
                      {t.body ? t.body.slice(0, 80) + (t.body.length > 80 ? '…' : '') : '—'}
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
                    {t.source === 'meta' ? (
                      <span className="rx-live-tag mono">META</span>
                    ) : t.source === 'gmail' ? (
                      <span className="rx-live-tag mono" style={{ background: 'rgba(47, 128, 255, 0.14)', color: 'var(--email)' }}>GMAIL</span>
                    ) : (
                      <span className="rx-text-xs rx-muted">local</span>
                    )}
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
  switch (s?.toUpperCase()) {
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
