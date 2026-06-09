'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  computeOpsTaskUrgency,
  type OpsTaskRow,
  type OpsTaskUrgency,
} from '@/lib/admin/opsTasks'

export type CronHealthRow = {
  job_name: string
  last_run_at: string | null
  last_status: string | null
  last_message: string | null
  consecutive_failures: number
  updated_at: string
}

export type OpsInboxCounts = {
  overdueTasks: number
  dueTodayTasks: number
  overdueDeletions: number
  urgentPrivacy: number
  pendingDirectories: number
  cronFailures: number
  staleCrons: number
}

type Props = {
  initialTasks: OpsTaskRow[]
  cronHealth: CronHealthRow[]
  inboxCounts: OpsInboxCounts
  onSwitchTab: (tab: string) => void
  fetchedAt: string
  mrr?: number
  activeSubscriptions?: number
}

const CATEGORY_LABELS: Record<string, string> = {
  compliance: 'Compliance',
  legal: 'Legal',
  security: 'Security',
  ops: 'Ops',
  billing: 'Billing',
}

function formatAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return '<1h ago'
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function cronStatusDot(job: CronHealthRow): 'ok' | 'warning' | 'error' | 'unknown' {
  const staleMs = 26 * 60 * 60 * 1000
  if (
    job.last_status === 'error' ||
    (job.consecutive_failures ?? 0) > 1
  ) {
    return 'error'
  }
  if (
    !job.last_run_at ||
    Date.now() - new Date(job.last_run_at).getTime() > staleMs
  ) {
    return 'warning'
  }
  if (job.last_status === 'warning') return 'warning'
  if (job.last_status === 'ok') return 'ok'
  return 'unknown'
}

const DOT_CLASS = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  unknown: 'bg-neutral-300',
}

export function OpsHomeTab({
  initialTasks,
  cronHealth,
  inboxCounts,
  onSwitchTab,
  fetchedAt,
  mrr = 0,
  activeSubscriptions = 0,
}: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completeNotes, setCompleteNotes] = useState('')
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addDue, setAddDue] = useState('')
  const [addCategory, setAddCategory] = useState('ops')
  const [error, setError] = useState<string | null>(null)
  const [minutesAgo, setMinutesAgo] = useState(0)

  useEffect(() => {
    const update = () => {
      setMinutesAgo(
        Math.max(0, Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 60000)),
      )
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [fetchedAt])

  const tasksWithUrgency = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        urgency: computeOpsTaskUrgency(t),
      })),
    [tasks],
  )

  const grouped = useMemo(() => {
    const order: OpsTaskUrgency[] = [
      'overdue',
      'due-today',
      'due-soon',
      'upcoming',
      'completed',
    ]
    const map = new Map<OpsTaskUrgency, typeof tasksWithUrgency>()
    for (const u of order) map.set(u, [])
    for (const t of tasksWithUrgency) {
      if (t.cadence === 'once' && t.status === 'completed') {
        map.get('completed')!.push(t)
        continue
      }
      if (t.status === 'completed' && t.cadence !== 'once') continue
      map.get(t.urgency)!.push(t)
    }
    return map
  }, [tasksWithUrgency])

  const markComplete = useCallback(async (id: string) => {
    setError(null)
    setCompletingId(null)
    try {
      const res = await fetch('/api/admin/ops-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes: completeNotes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Update failed')
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? (data.task as OpsTaskRow) : t)),
      )
      setCompleteNotes('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }, [completeNotes])

  const addOneTimeTask = useCallback(async () => {
    setError(null)
    if (!addTitle.trim()) return
    try {
      const res = await fetch('/api/admin/ops-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDescription.trim() || undefined,
          due_at: addDue || undefined,
          category: addCategory,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Create failed')
      setTasks((prev) => [...prev, data.task as OpsTaskRow].sort(
        (a, b) =>
          new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime(),
      ))
      setShowAddModal(false)
      setAddTitle('')
      setAddDescription('')
      setAddDue('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }, [addTitle, addDescription, addDue, addCategory])

  const inboxRows = [
    {
      label: 'Overdue tasks',
      count: inboxCounts.overdueTasks,
      action: inboxCounts.overdueTasks > 0 ? 'View →' : '✓',
      scrollTo: 'ops-tasks',
    },
    {
      label: 'Due today',
      count: inboxCounts.dueTodayTasks,
      action: inboxCounts.dueTodayTasks > 0 ? 'View →' : '✓',
      scrollTo: 'ops-tasks',
    },
    {
      label: 'Deletions overdue',
      count: inboxCounts.overdueDeletions,
      action: inboxCounts.overdueDeletions > 0 ? 'Review →' : '✓',
      tab: 'compliance',
    },
    {
      label: 'Privacy SLA ≤7d',
      count: inboxCounts.urgentPrivacy,
      action: inboxCounts.urgentPrivacy > 0 ? 'Review →' : '✓',
      tab: 'compliance',
    },
    {
      label: 'Directory pending',
      count: inboxCounts.pendingDirectories,
      action: inboxCounts.pendingDirectories > 0 ? 'Review →' : '✓',
      tab: 'directories',
    },
    {
      label: 'Cron failures',
      count: inboxCounts.cronFailures,
      action: inboxCounts.cronFailures > 0 ? 'View →' : '✓',
      scrollTo: 'cron-health',
    },
    {
      label: 'Crons stale (>26h)',
      count: inboxCounts.staleCrons,
      action: inboxCounts.staleCrons > 0 ? 'View →' : '✓',
      scrollTo: 'cron-health',
    },
  ]

  const renderTaskGroup = (
    title: string,
    items: typeof tasksWithUrgency,
    limit?: number,
  ) => {
    const shown = limit ? items.slice(0, limit) : items
    if (shown.length === 0) return null
    return (
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
          {title}
        </p>
        <ul className="space-y-2">
          {shown.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-neutral-100 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                <p className="text-xs text-neutral-500">
                  {CATEGORY_LABELS[task.category] ?? task.category}
                  {' · '}
                  {task.cadence}
                  {task.urgency === 'due-soon' || task.urgency === 'upcoming'
                    ? ` · due ${new Date(task.next_due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : ''}
                </p>
              </div>
              {completingId === task.id ? (
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    className="text-sm border border-neutral-300 rounded-lg px-2 py-1"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => markComplete(task.id)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[color:var(--mwm-navy)] text-white"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCompletingId(null)
                        setCompleteNotes('')
                      }}
                      className="text-xs text-neutral-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCompletingId(task.id)}
                  className="text-xs font-medium text-[color:var(--mwm-navy)] hover:underline shrink-0"
                >
                  Mark done ✓
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const upcoming = grouped.get('upcoming') ?? []

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Est. MRR', value: `$${mrr.toLocaleString()}`, sub: `${activeSubscriptions} active subs`, accent: true },
          { label: 'Overdue tasks', value: String(inboxCounts.overdueTasks), sub: 'calendar obligations' },
          { label: 'Due today', value: String(inboxCounts.dueTodayTasks), sub: 'ops tasks' },
          { label: 'Cron issues', value: String(inboxCounts.cronFailures + inboxCounts.staleCrons), sub: 'failures + stale' },
          { label: 'Directory pending', value: String(inboxCounts.pendingDirectories), sub: 'advisor + attorney' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{tile.label}</p>
            <p className={`text-xl font-bold mt-1 ${tile.accent ? 'text-emerald-600' : 'text-neutral-900'}`}>
              {tile.value}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">{tile.sub}</p>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[color:var(--mwm-navy)]">
            ⚡ Ops Inbox
          </h2>
          <span className="text-xs text-neutral-400">
            Last updated {minutesAgo}m
          </span>
        </div>
        <ul className="divide-y divide-neutral-100">
          {inboxRows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span className="text-neutral-700">{row.label}</span>
              <div className="flex items-center gap-3">
                <span
                  className={`font-semibold tabular-nums ${
                    row.count > 0 ? 'text-amber-700' : 'text-emerald-600'
                  }`}
                >
                  {row.count}
                </span>
                {row.count > 0 ? (
                  row.tab ? (
                    <button
                      type="button"
                      onClick={() => onSwitchTab(row.tab!)}
                      className="text-xs font-medium text-[color:var(--mwm-navy)] hover:underline"
                    >
                      {row.action}
                    </button>
                  ) : (
                    <a
                      href={`#${row.scrollTo}`}
                      className="text-xs font-medium text-[color:var(--mwm-navy)] hover:underline"
                    >
                      {row.action}
                    </a>
                  )
                ) : (
                  <span className="text-xs text-emerald-600">{row.action}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="ops-tasks"
        className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-neutral-900">Ops Tasks</h2>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50"
          >
            + Add one-time task
          </button>
        </div>
        {renderTaskGroup('Overdue', grouped.get('overdue') ?? [])}
        {renderTaskGroup('Due today', grouped.get('due-today') ?? [])}
        {renderTaskGroup('Due soon (7 days)', grouped.get('due-soon') ?? [])}
        {renderTaskGroup(
          'Upcoming',
          upcoming,
          showAllUpcoming ? undefined : 5,
        )}
        {upcoming.length > 5 && !showAllUpcoming && (
          <button
            type="button"
            onClick={() => setShowAllUpcoming(true)}
            className="text-xs text-neutral-500 hover:text-neutral-800"
          >
            Show all upcoming
          </button>
        )}
      </section>

      <section
        id="cron-health"
        className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6"
      >
        <h2 className="text-base font-semibold text-neutral-900 mb-4">Cron Health</h2>
        <ul className="space-y-3">
          {cronHealth.map((job) => {
            const dot = cronStatusDot(job)
            const stale =
              !job.last_run_at ||
              Date.now() - new Date(job.last_run_at).getTime() >
                26 * 60 * 60 * 1000
            return (
              <li
                key={job.job_name}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[dot]}`}
                />
                <span className="font-mono text-neutral-800 min-w-[160px]">
                  {job.job_name}
                </span>
                <span className="text-neutral-500">
                  {job.last_status ?? 'unknown'}
                </span>
                <span className="text-neutral-400">{formatAgo(job.last_run_at)}</span>
                {stale && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    stale
                  </span>
                )}
                {job.last_message && (
                  <span className="text-xs text-neutral-500 truncate max-w-md">
                    {job.last_message}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Data & Compliance', tab: 'compliance' },
            { label: 'Users', tab: 'users' },
            { label: 'Tax Rules', tab: 'tax_rules' },
            { label: 'Funnel', tab: 'funnel' },
            { label: 'Directories', tab: 'directories' },
            { label: 'Debug', tab: 'debug' },
          ].map((link) => (
            <button
              key={link.tab}
              type="button"
              onClick={() => onSwitchTab(link.tab)}
              className="text-sm text-left px-4 py-3 rounded-xl border border-neutral-200 hover:border-[color:var(--gold)] hover:bg-neutral-50 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </section>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Add one-time task</h3>
            <input
              type="text"
              placeholder="Title"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Description (optional)"
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              rows={2}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={addDue}
              onChange={(e) => setAddDue(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-sm text-neutral-500 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addOneTimeTask}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-[color:var(--mwm-navy)] text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DirectoriesTab({
  pendingAdvisor,
  pendingAttorney,
}: {
  pendingAdvisor: number
  pendingAttorney: number
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Directories</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Review advisor and attorney directory nominations awaiting approval.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/admin/advisor-directory"
          className="block bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 hover:border-[color:var(--gold)] transition-colors"
        >
          <h3 className="font-semibold text-neutral-900">Advisor Directory</h3>
          <p className="mt-2 text-3xl font-bold text-[color:var(--mwm-navy)]">
            {pendingAdvisor}
          </p>
          <p className="text-sm text-neutral-500 mt-1">pending nominations</p>
          <span className="inline-block mt-4 text-sm font-medium text-[color:var(--mwm-navy)]">
            Review →
          </span>
        </Link>
        <Link
          href="/admin/attorney-directory"
          className="block bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 hover:border-[color:var(--gold)] transition-colors"
        >
          <h3 className="font-semibold text-neutral-900">Attorney Directory</h3>
          <p className="mt-2 text-3xl font-bold text-[color:var(--mwm-navy)]">
            {pendingAttorney}
          </p>
          <p className="text-sm text-neutral-500 mt-1">pending nominations</p>
          <span className="inline-block mt-4 text-sm font-medium text-[color:var(--mwm-navy)]">
            Review →
          </span>
        </Link>
      </div>
    </div>
  )
}
