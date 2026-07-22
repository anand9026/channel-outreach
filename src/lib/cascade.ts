import type { CascadeOptions, ChannelOrder, OutreachChannel } from '../types'

/** Compress product wait hours into interactive demo delays. */
export function demoWaitMs(waitHours: number): number {
  if (waitHours <= 24) return 10_000
  if (waitHours <= 48) return 20_000
  return 30_000
}

export function channelOrderLabel(order: ChannelOrder): string {
  return order === 'whatsapp_first' ? 'WhatsApp → Email' : 'Email → WhatsApp'
}

export function firstChannel(order: ChannelOrder): OutreachChannel {
  return order === 'whatsapp_first' ? 'whatsapp' : 'email'
}

export function secondChannel(order: ChannelOrder): OutreachChannel {
  return order === 'whatsapp_first' ? 'email' : 'whatsapp'
}

export const WAIT_HOUR_OPTIONS: Array<{ value: 24 | 48 | 72; label: string; demoHint: string }> = [
  { value: 24, label: '24 hours if no reply', demoHint: '~10s demo' },
  { value: 48, label: '48 hours if no reply', demoHint: '~20s demo' },
  { value: 72, label: '72 hours if no reply', demoHint: '~30s demo' },
]

export function defaultCascadeOptions(): CascadeOptions {
  return {
    order: 'whatsapp_first',
    firstAt: null,
    waitHours: 24,
    stopOnReply: true,
  }
}
