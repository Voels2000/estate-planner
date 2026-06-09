export type OpsTaskCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'once'

export type OpsTaskRow = {
  id: string
  slug: string
  title: string
  description: string | null
  cadence: OpsTaskCadence
  next_due_at: string
  last_completed_at: string | null
  last_completed_by: string | null
  completion_method: string | null
  completion_notes: string | null
  status: string
  auto_complete: boolean
  script_command: string | null
  category: string
  created_at: string
  updated_at: string
}

export type OpsTaskUrgency = 'overdue' | 'due-today' | 'due-soon' | 'upcoming' | 'completed'

export function computeOpsTaskUrgency(
  task: Pick<OpsTaskRow, 'next_due_at' | 'status' | 'cadence'>,
  now = new Date(),
): OpsTaskUrgency {
  if (task.status === 'completed' && task.cadence === 'once') {
    return 'completed'
  }
  const due = new Date(task.next_due_at)
  const diffMs = due.getTime() - now.getTime()
  if (diffMs < 0) return 'overdue'
  if (diffMs < 24 * 60 * 60 * 1000) return 'due-today'
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return 'due-soon'
  return 'upcoming'
}

export function advanceOpsTaskDueDate(cadence: OpsTaskCadence, from = new Date()): string | null {
  const next = new Date(from)
  switch (cadence) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      return next.toISOString()
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      return next.toISOString()
    case 'quarterly':
      next.setMonth(next.getMonth() + 3)
      return next.toISOString()
    case 'annual':
      next.setFullYear(next.getFullYear() + 1)
      return next.toISOString()
    case 'daily':
      next.setDate(next.getDate() + 1)
      return next.toISOString()
    case 'once':
      return null
    default:
      return null
  }
}
