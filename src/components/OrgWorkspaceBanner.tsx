import { Building2, Database } from 'lucide-react'
import { resolveOrgId } from '../lib/api'
import { useWhatsAppStore } from '../store/WhatsAppStore'

/** Slim org context strip shown above page content. */
export function OrgWorkspaceBanner() {
  const { state } = useWhatsAppStore()
  const orgId = resolveOrgId()
  const sqlThreads = state.conversations.filter((c) => c.outreachThreadId).length
  const liveThreads = state.conversations.filter((c) => c.isLive).length

  return (
    <div className="rx-org-strip" role="status" aria-label="Workspace context">
      <div className="rx-org-strip-inner">
        <span className="rx-org-strip-icon" aria-hidden>
          <Building2 size={14} />
        </span>
        <span className="rx-org-strip-label">{state.organization.name}</span>
        <span className="rx-org-strip-sep" aria-hidden>·</span>
        <span className="rx-org-strip-id mono" title="org_id for SQL-backed outreach">
          {orgId}
        </span>
        {sqlThreads > 0 ? (
          <>
            <span className="rx-org-strip-sep" aria-hidden>·</span>
            <span className="rx-org-strip-stat">
              <Database size={11} /> {sqlThreads} SQL thread{sqlThreads === 1 ? '' : 's'}
            </span>
          </>
        ) : null}
        {liveThreads > 0 ? (
          <>
            <span className="rx-org-strip-sep" aria-hidden>·</span>
            <span className="rx-org-strip-live">
              <span className="rx-live-dot-sm" aria-hidden /> {liveThreads} live
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}
