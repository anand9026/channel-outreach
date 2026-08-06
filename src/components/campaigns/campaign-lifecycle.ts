import type { Campaign, CampaignLifecycleStatus } from '../../types'

export type KanbanColumnId = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed'

export const kanbanColumns: Array<{ id: KanbanColumnId; label: string }> = [
  { id: 'draft', label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'running', label: 'Running' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
]

export function campaignKanbanColumn(c: Campaign): KanbanColumnId {
  const status = String(c.status)
  if (status === 'draft') return 'draft'
  if (status === 'scheduled') return 'scheduled'
  if (status === 'paused') return 'paused'
  if (status === 'completed') return 'completed'
  if (status === 'attention') return 'running'
  if (status === 'running' || status === 'active') return 'running'
  return 'draft'
}

export function campaignStatusLabel(c: Campaign): string {
  const col = campaignKanbanColumn(c)
  if (col === 'running' && c.status === 'attention') return 'Attention'
  return kanbanColumns.find((k) => k.id === col)?.label || c.status
}

export function isRunningCampaign(c: Campaign): boolean {
  return campaignKanbanColumn(c) === 'running'
}

export function mapToLifecycleStatus(col: KanbanColumnId): CampaignLifecycleStatus {
  if (col === 'running') return 'running'
  if (col === 'scheduled') return 'scheduled'
  if (col === 'paused') return 'paused'
  if (col === 'completed') return 'completed'
  return 'draft'
}
