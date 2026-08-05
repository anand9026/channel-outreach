import { Database, Server } from 'lucide-react'
import { API_BASE_URL, resolveOrgId } from '../lib/api'

/** Shows which backend org + API the workspace is talking to. */
export function BackendWorkspaceCard({ compact }: { compact?: boolean }) {
  return (
    <section className={`rx-backend-panel${compact ? ' compact' : ''}`}>
      <div className="rx-row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="rx-backend-icon" aria-hidden>
          <Server size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rx-backend-title">SQL-backed workspace</div>
          <p className="rx-backend-body">
            Campaigns, inbox threads, and message history persist in reelax-server
            outreach tables. Pass <span className="mono">?org_id=XXXXXX</span> in
            the URL for now; auth token org comes later.
          </p>
          <dl className="rx-backend-kv">
            <div>
              <dt>Org ID</dt>
              <dd className="mono" title="?org_id= URL param, or VITE_OUTREACH_ORG_ID">
                {resolveOrgId()}
              </dd>
            </div>
            <div>
              <dt>API</dt>
              <dd className="mono rx-backend-api" title={API_BASE_URL}>
                {API_BASE_URL.replace(/^https?:\/\//, '')}
              </dd>
            </div>
          </dl>
        </div>
        <span className="rx-badge dark">
          <Database size={11} /> Live
        </span>
      </div>
    </section>
  )
}
