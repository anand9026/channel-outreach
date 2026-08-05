import { AlertTriangle, Plus, RefreshCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CreateTemplateModal } from '../components/CreateTemplateModal'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import {
  GMAIL_USER_ID,
  listGmailTemplates,
  listOutreachTemplates,
  listWhatsAppTemplates,
  resolveOrgId,
  syncOutreachWhatsAppTemplates,
  type GmailTemplate,
  type MetaTemplate,
  type OutreachTemplateRow,
} from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'

type Row = {
  key: string
  source: 'local' | 'meta' | 'gmail' | 'registry'
  name: string
  channel: 'whatsapp' | 'email' | 'instagram'
  category: string
  body: string
  variables: string[]
  status: string
  updatedAt: string
}

function mapRegistryMedium(medium: string): 'whatsapp' | 'email' | 'instagram' {
  const m = (medium || '').toLowerCase()
  if (m.includes('whatsapp') || m === 'wa') return 'whatsapp'
  if (m.includes('gmail') || m.includes('email')) return 'email'
  if (m.includes('instagram') || m === 'ig') return 'instagram'
  return 'whatsapp'
}

function registryRow(t: OutreachTemplateRow): Row {
  const channel = mapRegistryMedium(t.medium)
  const body = (t.body_template || t.html_template || t.subject_template || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  let variables: string[] = []
  if (Array.isArray(t.variables_schema)) {
    variables = t.variables_schema.map(String)
  } else if (t.variables_schema && typeof t.variables_schema === 'object') {
    const vs = t.variables_schema as { slots?: string[]; variables?: string[] }
    variables = vs.slots || vs.variables || []
  }
  return {
    key: `registry:${t.outreach_template_id}`,
    source: 'registry',
    name: t.external_name || t.name,
    channel,
    category: t.category || '—',
    body,
    variables,
    status: (t.status || 'ACTIVE').toUpperCase(),
    updatedAt: t.date_modified
      ? new Date(t.date_modified).toISOString()
      : String(t.date_added || ''),
  }
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
  const [sourceTab, setSourceTab] = useState<'all' | 'registry' | 'meta' | 'gmail' | 'local'>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([])
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [gmailTemplates, setGmailTemplates] = useState<GmailTemplate[]>([])
  const [, setGmailError] = useState<string | null>(null)
  const [registryTemplates, setRegistryTemplates] = useState<OutreachTemplateRow[]>([])
  const [registryLoading, setRegistryLoading] = useState(false)
  const [registryError, setRegistryError] = useState<string | null>(null)

  const loadMeta = async () => {
    setMetaLoading(true)
    setMetaError(null)
    try {
      const res = await listWhatsAppTemplates({ limit: 100 })
      setMetaTemplates(res)
      try {
        await syncOutreachWhatsAppTemplates({
          org_id: resolveOrgId(),
          status: 'APPROVED',
        })
        await loadRegistry()
      } catch {
        /* registry sync is best-effort */
      }
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

  const loadRegistry = async () => {
    setRegistryLoading(true)
    setRegistryError(null)
    try {
      const res = await listOutreachTemplates({ org_id: resolveOrgId() })
      setRegistryTemplates(res)
    } catch (e) {
      setRegistryError((e as Error).message || 'Could not load SQL template registry')
    } finally {
      setRegistryLoading(false)
    }
  }

  useEffect(() => {
    void loadMeta()
    void loadGmail()
    void loadRegistry()
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
        key: `gmail:${t.template_name}`,
        source: 'gmail',
        name: t.template_name,
        channel: 'email',
        category: 'UTILITY',
        body: bodyText,
        variables: [],
        status: 'ACTIVE',
        updatedAt: t.updated_at || '',
      }
    })

    const registryRows: Row[] = registryTemplates.map(registryRow)

    return [...localRows, ...registryRows, ...metaRows, ...gmailRows]
      .filter((r) => (tab === 'all' ? true : r.channel === tab))
      .filter((r) => (sourceTab === 'all' ? true : r.source === sourceTab))
      .filter((r) =>
        !search
          ? true
          : r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.body.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.templates, metaTemplates, gmailTemplates, registryTemplates, tab, sourceTab, search])

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
                void loadRegistry()
              }}
              disabled={metaLoading || registryLoading}
              title="Refresh Meta, Gmail, and SQL registry"
              data-testid="refresh-meta-templates"
            >
              <RefreshCcw size={13} className={metaLoading || registryLoading ? 'rx-spin' : ''} />
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

      {registryError ? (
        <div
          className="rx-card rx-alert-soft"
          style={{ marginBottom: 16 }}
          data-testid="registry-templates-error"
        >
          <AlertTriangle size={14} />
          <span className="rx-text-sm">
            SQL registry sync failed: {registryError}. Other sources still work.
          </span>
        </div>
      ) : null}

      <div className="rx-row rx-mb-4" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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

      <div className="rx-source-tabs rx-mb-4" data-testid="template-source-tabs">
        {(
          [
            ['all', 'All sources'],
            ['registry', 'SQL registry'],
            ['local', 'Local drafts'],
            ['meta', 'Meta'],
            ['gmail', 'Gmail'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rx-chip${sourceTab === id ? ' is-active' : ''}`}
            onClick={() => setSourceTab(id)}
            data-testid={`source-tab-${id}`}
          >
            {id === 'registry' ? <span className="mono">SQL</span> : null} {label}
          </button>
        ))}
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
                    {t.source === 'registry' ? (
                      <span className="rx-sql-tag mono" title={`org ${resolveOrgId()}`}>SQL</span>
                    ) : t.source === 'meta' ? (
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
