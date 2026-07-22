import type {
  ConversationStatus,
  DeliveryStatus,
  OutreachChannel,
  PhoneQuality,
  TemplateStatus,
} from '../types'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'wa' | 'email'

const toneClass: Record<BadgeTone, string> = {
  neutral: 'badge-neutral',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  wa: 'badge-wa',
  email: 'badge-email',
}

function toneForTemplate(status: TemplateStatus): BadgeTone {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
    case 'DISABLED':
      return 'error'
    default:
      return 'neutral'
  }
}

function toneForDelivery(status: DeliveryStatus): BadgeTone {
  switch (status) {
    case 'read':
      return 'info'
    case 'delivered':
    case 'sent':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'error'
    case 'queued':
    case 'scheduled':
      return 'warning'
    default:
      return 'neutral'
  }
}

function toneForConversation(status: ConversationStatus): BadgeTone {
  switch (status) {
    case 'open':
      return 'wa'
    case 'pending':
      return 'warning'
    case 'resolved':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function toneForQuality(q: PhoneQuality): BadgeTone {
  switch (q) {
    case 'GREEN':
      return 'success'
    case 'YELLOW':
      return 'warning'
    case 'RED':
      return 'error'
    default:
      return 'neutral'
  }
}

interface StatusBadgeProps {
  label: string
  tone?: BadgeTone
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge ${toneClass[tone]}`}>{label}</span>
}

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return <StatusBadge label={status} tone={toneForTemplate(status)} />
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <StatusBadge label={status} tone={toneForDelivery(status)} />
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  return <StatusBadge label={status} tone={toneForConversation(status)} />
}

export function QualityBadge({ quality }: { quality: PhoneQuality }) {
  return <StatusBadge label={quality} tone={toneForQuality(quality)} />
}

export function ChannelBadge({ channel }: { channel: OutreachChannel }) {
  return (
    <StatusBadge
      label={channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
      tone={channel === 'whatsapp' ? 'wa' : 'email'}
    />
  )
}
