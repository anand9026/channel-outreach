import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Shield,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { IgIcon } from '../BrandIcons'
import type { EmailAccount, InstagramAccount, WhatsAppNumber } from '../../types'

export type ChannelHealth = 'healthy' | 'degraded' | 'disconnected' | 'limited' | 'pending'

function healthForWa(n?: WhatsAppNumber): ChannelHealth {
  if (!n) return 'disconnected'
  if (n.qualityRating === 'RED') return 'limited'
  if (n.qualityRating === 'YELLOW') return 'degraded'
  return 'healthy'
}

function healthLabel(h: ChannelHealth): string {
  if (h === 'healthy') return 'Healthy'
  if (h === 'degraded') return 'Degraded'
  if (h === 'limited') return 'Limited'
  if (h === 'pending') return 'Pending review'
  return 'Not connected'
}

type BoardProps = {
  whatsAppNumbers: WhatsAppNumber[]
  emailAccounts: EmailAccount[]
  instagramAccounts: InstagramAccount[]
  loadingGmail?: boolean
  loadingWa?: boolean
  onConnectWa: () => void
  onConnectIg: () => void
  onConnectGmail: () => void
  onRefreshGmail: () => void
  onRefreshWa: () => void
}

export function ChannelsBoard({
  whatsAppNumbers,
  emailAccounts,
  instagramAccounts,
  loadingGmail,
  loadingWa,
  onConnectWa,
  onConnectIg,
  onConnectGmail,
  onRefreshGmail,
  onRefreshWa,
}: BoardProps) {
  const gmail = emailAccounts.find((a) => a.provider === 'gmail')
  const waHealth = healthForWa(whatsAppNumbers[0])
  const emailHealth: ChannelHealth = gmail ? 'healthy' : 'disconnected'
  const igHealth: ChannelHealth = instagramAccounts.length ? 'healthy' : 'disconnected'

  return (
    <div className="rx-channels-board" data-testid="channels-board">
      <ChannelCard
        title="WhatsApp Business"
        icon={<MessageCircle size={18} />}
        health={waHealth}
        accountCount={whatsAppNumbers.length}
        onConnect={onConnectWa}
        onRefresh={onRefreshWa}
        loading={loadingWa}
      >
        {whatsAppNumbers.map((n) => (
          <AccountRow
            key={n.id}
            primary={n.displayName}
            secondary={`${n.phoneDisplay} · tier ${n.messagingTier}`}
            meta={`Quality ${n.qualityRating}`}
          />
        ))}
        <PermissionsMatrix channel="whatsapp" connected={whatsAppNumbers.length > 0} />
      </ChannelCard>

      <ChannelCard
        title="Instagram DM"
        icon={<IgIcon size={18} />}
        health={igHealth}
        accountCount={instagramAccounts.length}
        onConnect={onConnectIg}
      >
        {instagramAccounts.map((a) => (
          <AccountRow
            key={a.id}
            primary={`@${a.handle}`}
            secondary={a.displayName}
            meta="DM window · 24h"
          />
        ))}
        <PermissionsMatrix channel="instagram" connected={instagramAccounts.length > 0} />
      </ChannelCard>

      <ChannelCard
        title="Gmail"
        icon={<Mail size={18} />}
        health={emailHealth}
        accountCount={gmail ? 1 : 0}
        onConnect={onConnectGmail}
        onRefresh={onRefreshGmail}
        loading={loadingGmail}
      >
        {gmail ? (
          <AccountRow primary={gmail.fromEmail} secondary={gmail.fromName} meta="OAuth connected" />
        ) : null}
        <PermissionsMatrix channel="email" connected={Boolean(gmail)} />
      </ChannelCard>

      <ChannelCard
        title="Facebook"
        icon={<Link2 size={18} />}
        health="disconnected"
        accountCount={0}
        soon
      />

      <ChannelCard
        title="LinkedIn"
        icon={<Link2 size={18} />}
        health="disconnected"
        accountCount={0}
        soon
      />
    </div>
  )
}

function ChannelCard({
  title,
  icon,
  health,
  accountCount,
  children,
  onConnect,
  onRefresh,
  loading,
  soon,
}: {
  title: string
  icon: ReactNode
  health: ChannelHealth
  accountCount: number
  children?: React.ReactNode
  onConnect?: () => void
  onRefresh?: () => void
  loading?: boolean
  soon?: boolean
}) {
  return (
    <div className={`rx-channel-card${soon ? ' is-soon' : ''}`}>
      <div className="rx-channel-card-head">
        <div className="rx-channel-card-title">
          {icon}
          <span>{title}</span>
        </div>
        <span className={`rx-health-pill ${health}`}>{healthLabel(health)}</span>
      </div>
      {!soon ? (
        <div className="rx-channel-card-sub">
          {accountCount} account{accountCount === 1 ? '' : 's'} connected
        </div>
      ) : (
        <div className="rx-channel-card-sub">Coming soon</div>
      )}
      {children}
      <div className="rx-channel-card-actions">
        {soon ? (
          <button type="button" className="rx-btn ghost sm" disabled>
            Notify me
          </button>
        ) : (
          <>
            {onRefresh ? (
              <button type="button" className="rx-btn ghost sm" onClick={onRefresh} disabled={loading}>
                {loading ? <Loader2 size={12} className="rx-spin" /> : <RefreshCw size={12} />}
                Refresh
              </button>
            ) : null}
            {onConnect ? (
              <button type="button" className="rx-btn secondary sm" onClick={onConnect}>
                {accountCount ? 'Add account' : 'Connect'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function AccountRow({
  primary,
  secondary,
  meta,
}: {
  primary: string
  secondary?: string
  meta?: string
}) {
  return (
    <div className="rx-channel-account">
      <div className="rx-channel-account-primary">{primary}</div>
      {secondary ? <div className="rx-channel-account-secondary">{secondary}</div> : null}
      {meta ? <div className="rx-channel-account-meta">{meta}</div> : null}
    </div>
  )
}

function PermissionsMatrix({
  channel,
  connected,
}: {
  channel: 'whatsapp' | 'instagram' | 'email'
  connected: boolean
}) {
  const rows =
    channel === 'email'
      ? [
          ['Read inbox', true],
          ['Send message', true],
          ['Read profile', true],
        ]
      : [
          ['Read inbox', connected],
          ['Send message', connected],
          ['Read profile', connected],
          ['Read insights', channel === 'whatsapp' ? connected : false, !connected],
          ['Manage templates', channel === 'whatsapp' ? connected : false],
        ]

  return (
    <div className="rx-permissions-matrix">
      <div className="rx-permissions-title">
        <Shield size={11} /> Permissions
      </div>
      <table>
        <tbody>
          {rows.map(([scope, granted, optional]) => (
            <tr key={String(scope)}>
              <td>{scope}</td>
              <td>
                {granted ? (
                  <CheckCircle2 size={12} className="rx-perm-ok" />
                ) : optional ? (
                  <span title="Optional">
                    <AlertTriangle size={12} className="rx-perm-warn" />
                  </span>
                ) : (
                  <span className="rx-text-xs rx-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
