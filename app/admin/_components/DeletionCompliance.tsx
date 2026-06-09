'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DeletionReason } from '@/lib/compliance/deleteUser'

type ScheduledDeletion = {
  id: string
  user_id: string
  email: string
  reason: string
  scheduled_for: string
  status: string
  stripe_customer_id?: string | null
  cancel_reason?: string | null
}

type AuditEntry = {
  id: string
  email: string
  reason: string
  initiated_by: string
  dry_run: boolean
  success: boolean
  auth_deleted: boolean
  error_message?: string | null
  completed_at: string
  rows_deleted: Record<string, number>
}

type ExecuteForm = {
  userId: string
  email: string
  reason: DeletionReason
  dryRun: boolean
}

type PrivacyRequest = {
  id: string
  user_id?: string | null
  email: string
  request_type: string
  status: string
  received_at: string
  due_at: string
  notes?: string | null
}

type LookupResult = {
  userId: string
  email: string
  fullName: string | null
  role: string | null
  hasProfile: boolean
}

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

export function DeletionCompliance() {
  const [view, setView] = useState<
    'schedule' | 'audit' | 'execute' | 'privacy'
  >('schedule')
  const [schedule, setSchedule] = useState<ScheduledDeletion[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [savingPrivacyId, setSavingPrivacyId] = useState<string | null>(null)
  const [form, setForm] = useState<ExecuteForm>({
    userId: '',
    email: '',
    reason: 'user_request',
    dryRun: true,
  })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [executing, setExecuting] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [showAddPrivacy, setShowAddPrivacy] = useState(false)
  const [addPrivacyEmail, setAddPrivacyEmail] = useState('')
  const [addPrivacyType, setAddPrivacyType] = useState('access')
  const [addPrivacyDescription, setAddPrivacyDescription] = useState('')
  const [addPrivacyReceived, setAddPrivacyReceived] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [addPrivacySubmitting, setAddPrivacySubmitting] = useState(false)
  const [addPrivacyMessage, setAddPrivacyMessage] = useState<string | null>(null)

  function fillExecuteForm(params: {
    userId: string
    email: string
    reason?: DeletionReason
  }) {
    setForm((prev) => ({
      ...prev,
      userId: params.userId,
      email: params.email,
      reason: params.reason ?? prev.reason,
    }))
    setLookupResult(null)
    setLookupError(null)
    setResult(null)
    setView('execute')
  }

  async function lookupUserByEmail(emailOverride?: string) {
    const email = (emailOverride ?? form.email).trim()
    if (!email) {
      setLookupError('Enter an email address first')
      return
    }

    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    setFetchError(null)

    try {
      const res = await fetch(
        `/api/admin/deletions?view=lookup&email=${encodeURIComponent(email)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error ?? 'User not found')
        setForm((prev) => ({ ...prev, email, userId: '' }))
        return
      }

      const resolved = data.data as LookupResult
      setLookupResult(resolved)
      setForm((prev) => ({
        ...prev,
        email: resolved.email,
        userId: resolved.userId,
      }))
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  const fetchData = useCallback(async () => {
    if (view === 'execute') return
    setLoading(true)
    setFetchError(null)
    try {
      const viewParam =
        view === 'audit' ? 'audit' : view === 'privacy' ? 'privacy' : 'schedule'
      const res = await fetch(`/api/admin/deletions?view=${viewParam}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load data')
      }
      if (view === 'schedule') setSchedule(data.data ?? [])
      if (view === 'audit') setAuditLog(data.data ?? [])
      if (view === 'privacy') setPrivacyRequests(data.data ?? [])
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function handleExecute() {
    if (!form.userId || !form.email) return
    if (
      !form.dryRun &&
      !confirm(
        `PERMANENTLY DELETE all data for ${form.email}?\n\nThis cannot be undone.`,
      )
    ) {
      return
    }

    setExecuting(true)
    setResult(null)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/deletions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setResult(data)
      if (!res.ok && data.error) {
        setFetchError(String(data.error))
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setExecuting(false)
    }
  }

  async function handlePrivacyStatusUpdate(
    id: string,
    status: string,
    notes: string,
  ) {
    setSavingPrivacyId(id)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/deletions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Update failed')
      }
      await fetchData()
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSavingPrivacyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Data & Compliance</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Washington WCPA — scheduled deletions, privacy requests (45-day SLA),
          audit trail, and admin-triggered deletions. Dry-run before live delete.
        </p>
      </div>

      {fetchError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {fetchError}
        </p>
      )}

      <div className="flex gap-2 border-b border-neutral-200">
        {(['schedule', 'privacy', 'audit', 'execute'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setView(tab)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              view === tab
                ? 'border-b-2 border-neutral-900 text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab === 'schedule'
              ? 'Scheduled Deletions'
              : tab === 'privacy'
                ? 'Privacy Requests'
                : tab === 'audit'
                  ? 'Audit Log'
                  : 'Execute Deletion'}
          </button>
        ))}
      </div>

      {view === 'schedule' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-neutral-500">Loading…</p>
          ) : schedule.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">No scheduled deletions on record.</p>
          ) : (
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {[
                    'Email',
                    'Reason',
                    'Scheduled For',
                    'Status',
                    'Days Until',
                    'Cancel reason',
                    '',
                  ].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {schedule.map((row) => {
                  const daysUntil = Math.ceil(
                    (new Date(row.scheduled_for).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  )
                  return (
                    <tr key={row.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm font-mono text-neutral-900">
                        {row.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                          {row.reason.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(row.scheduled_for).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            row.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : row.status === 'executed'
                                ? 'bg-green-100 text-green-700'
                                : row.status === 'cancelled'
                                  ? 'bg-neutral-100 text-neutral-600'
                                  : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {row.status === 'pending'
                          ? daysUntil > 0
                            ? `${daysUntil}d`
                            : 'Due now'
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {row.cancel_reason?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() =>
                              fillExecuteForm({
                                userId: row.user_id,
                                email: row.email,
                                reason:
                                  row.reason === 'user_request'
                                    ? 'user_request'
                                    : row.reason === 'subscription_cancelled'
                                      ? 'subscription_cancelled'
                                      : 'admin_initiated',
                              })
                            }
                            className="text-xs font-medium text-neutral-700 hover:text-neutral-900"
                          >
                            Execute →
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'audit' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-neutral-500">Loading…</p>
          ) : auditLog.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">No deletions on record.</p>
          ) : (
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {[
                    'Email',
                    'Reason',
                    'Initiated By',
                    'Completed',
                    'Result',
                    'Auth Deleted',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {auditLog.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm font-mono text-neutral-900">
                      {row.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700">
                        {row.reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-neutral-600">
                      {row.initiated_by === 'system'
                        ? 'System (cron)'
                        : row.initiated_by === 'cli'
                          ? 'CLI'
                          : `${row.initiated_by.slice(0, 8)}…`}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(row.completed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {row.dry_run ? (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                          Dry run
                        </span>
                      ) : row.success ? (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          Deleted
                        </span>
                      ) : (
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700"
                          title={row.error_message ?? undefined}
                        >
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-neutral-600">
                      {row.auth_deleted ? '✓' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'privacy' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">
              Email-only intake (privacy@mywealthmaps.com) — create a tracked request here.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowAddPrivacy(true)
                setAddPrivacyMessage(null)
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50"
            >
              + Add request
            </button>
          </div>
          {addPrivacyMessage && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              {addPrivacyMessage}
            </p>
          )}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-neutral-500">Loading…</p>
          ) : privacyRequests.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">No privacy requests on record.</p>
          ) : (
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {[
                    'Email',
                    'Type',
                    'Status',
                    'Received',
                    'Due',
                    'Days left',
                    'Notes',
                    '',
                  ].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {privacyRequests.map((row) => {
                  const daysLeft = Math.ceil(
                    (new Date(row.due_at).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  )
                  return (
                    <tr key={row.id} className="hover:bg-neutral-50 align-top">
                      <td className="px-4 py-3 text-sm font-mono text-neutral-900">
                        {row.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {row.request_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            void handlePrivacyStatusUpdate(
                              row.id,
                              e.target.value,
                              row.notes ?? '',
                            )
                          }
                          disabled={savingPrivacyId === row.id}
                          className={inputClass}
                        >
                          <option value="pending">pending</option>
                          <option value="in_progress">in progress</option>
                          <option value="completed">completed</option>
                          <option value="denied">denied</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(row.received_at).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(row.due_at).toLocaleDateString('en-US')}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-medium ${
                          daysLeft < 0
                            ? 'text-red-600'
                            : daysLeft <= 7
                              ? 'text-amber-600'
                              : 'text-neutral-600'
                        }`}
                      >
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 max-w-[12rem]">
                        {row.notes ?? '—'}
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <button
                          type="button"
                          disabled={savingPrivacyId === row.id}
                          onClick={() => {
                            const notes = prompt('Admin notes:', row.notes ?? '')
                            if (notes !== null) {
                              void handlePrivacyStatusUpdate(row.id, row.status, notes)
                            }
                          }}
                          className="block text-xs font-medium text-neutral-700 hover:text-neutral-900"
                        >
                          Edit notes
                        </button>
                        {row.request_type === 'deletion' && row.status !== 'completed' ? (
                          row.user_id ? (
                            <button
                              type="button"
                              onClick={() =>
                                fillExecuteForm({
                                  userId: row.user_id!,
                                  email: row.email,
                                  reason: 'user_request',
                                })
                              }
                              className="block text-xs font-medium text-neutral-700 hover:text-neutral-900"
                            >
                              Execute →
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  email: row.email,
                                  userId: '',
                                  reason: 'user_request',
                                }))
                                setView('execute')
                                void lookupUserByEmail(row.email)
                              }}
                              className="block text-xs font-medium text-neutral-700 hover:text-neutral-900"
                            >
                              Look up & execute →
                            </button>
                          )
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {showAddPrivacy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900">Add privacy request</h3>
              <input
                type="email"
                placeholder="Email"
                value={addPrivacyEmail}
                onChange={(e) => setAddPrivacyEmail(e.target.value)}
                className={inputClass}
              />
              <select
                value={addPrivacyType}
                onChange={(e) => setAddPrivacyType(e.target.value)}
                className={inputClass}
              >
                <option value="access">access</option>
                <option value="deletion">deletion</option>
                <option value="correction">correction</option>
                <option value="portability">portability</option>
                <option value="opt_out">opt out</option>
              </select>
              <textarea
                placeholder="Description (optional)"
                value={addPrivacyDescription}
                onChange={(e) => setAddPrivacyDescription(e.target.value)}
                rows={2}
                className={inputClass}
              />
              <label className="block text-xs text-neutral-500">
                Received date
                <input
                  type="date"
                  value={addPrivacyReceived}
                  onChange={(e) => setAddPrivacyReceived(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddPrivacy(false)}
                  className="text-sm text-neutral-500 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addPrivacySubmitting || !addPrivacyEmail.trim()}
                  onClick={async () => {
                    setAddPrivacySubmitting(true)
                    setFetchError(null)
                    try {
                      const res = await fetch('/api/admin/privacy-requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: addPrivacyEmail.trim(),
                          request_type: addPrivacyType,
                          description: addPrivacyDescription.trim() || undefined,
                          received_at: addPrivacyReceived,
                        }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error ?? 'Create failed')
                      const due = new Date(data.due_at).toLocaleDateString('en-US')
                      setAddPrivacyMessage(
                        `Request #${data.id.slice(0, 8)}… created. Due by ${due}.`,
                      )
                      setShowAddPrivacy(false)
                      setAddPrivacyEmail('')
                      setAddPrivacyDescription('')
                      await fetchData()
                    } catch (err) {
                      setFetchError(
                        err instanceof Error ? err.message : 'Create failed',
                      )
                    } finally {
                      setAddPrivacySubmitting(false)
                    }
                  }}
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {view === 'execute' && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Use dry run first</p>
            <p className="mt-1 text-xs text-amber-700">
              Dry run shows what would be deleted without making changes. Confirm the
              correct user before executing a live deletion.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value })
                    setLookupResult(null)
                    setLookupError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void lookupUserByEmail()
                    }
                  }}
                  placeholder="user@example.com"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => void lookupUserByEmail()}
                  disabled={lookupLoading || !form.email.trim()}
                  className="shrink-0 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {lookupLoading ? 'Looking up…' : 'Look up'}
                </button>
              </div>
              {lookupError ? (
                <p className="mt-2 text-xs text-red-600">{lookupError}</p>
              ) : null}
              {lookupResult ? (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
                  <p className="font-medium">
                    {lookupResult.fullName ?? 'No profile name'}
                    {lookupResult.role ? ` · ${lookupResult.role}` : ''}
                    {!lookupResult.hasProfile ? ' · auth only (no profile)' : ''}
                  </p>
                  <p className="mt-1 font-mono text-green-800">{lookupResult.userId}</p>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                User ID (UUID)
              </label>
              <input
                type="text"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder="Look up by email, or paste UUID manually"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Reason
              </label>
              <select
                value={form.reason}
                onChange={(e) =>
                  setForm({ ...form, reason: e.target.value as DeletionReason })
                }
                className={inputClass}
              >
                <option value="user_request">User request (WCPA)</option>
                <option value="admin_initiated">Admin initiated</option>
                <option value="subscription_cancelled">Subscription cancelled</option>
                <option value="account_closed">Account closed</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.dryRun}
                onChange={(e) => setForm({ ...form, dryRun: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Dry run (preview only — no data deleted)
            </label>

            <button
              type="button"
              onClick={() => void handleExecute()}
              disabled={executing || !form.userId || !form.email}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
                form.dryRun
                  ? 'bg-neutral-900 hover:bg-neutral-800'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {executing
                ? 'Processing…'
                : form.dryRun
                  ? 'Preview deletion'
                  : 'Execute permanent deletion'}
            </button>
          </div>

          {result && (
            <div
              className={`rounded-xl border p-4 ${
                result.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {result.success
                  ? form.dryRun
                    ? 'Dry run complete'
                    : 'Deletion complete'
                  : 'Deletion failed'}
              </p>
              {result.error != null && (
                <p className="mt-1 text-xs text-red-700">{String(result.error)}</p>
              )}
              {result.rowsDeleted != null &&
                typeof result.rowsDeleted === 'object' && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-neutral-600 mb-1">
                      Rows {form.dryRun ? 'that would be' : ''} deleted:
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {Object.entries(result.rowsDeleted as Record<string, number>)
                        .filter(([, count]) => count > 0)
                        .map(([table, count]) => (
                          <div
                            key={table}
                            className="flex justify-between text-xs"
                          >
                            <span className="font-mono text-neutral-600">{table}</span>
                            <span className="font-medium text-neutral-900">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
