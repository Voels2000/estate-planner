'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WaitlistRow } from '@/app/api/admin/waitlist/route'

type Summary = {
  waiting: number
  invited: number
  converted: number
}

function rowStatus(row: WaitlistRow): 'Waiting' | 'Invited' | 'Converted' {
  if (row.converted) return 'Converted'
  if (row.invited_at) return 'Invited'
  return 'Waiting'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function WaitlistTab() {
  const [rows, setRows] = useState<WaitlistRow[]>([])
  const [summary, setSummary] = useState<Summary>({ waiting: 0, invited: 0, converted: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'invited' | 'converted'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkEmails, setBulkEmails] = useState('')
  const [bulkLabel, setBulkLabel] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/waitlist')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load waitlist')
      setRows(json.data.rows as WaitlistRow[])
      setSummary(json.data.summary as Summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load waitlist')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let result = rows
    const q = search.trim().toLowerCase()
    if (q) result = result.filter((r) => r.email.toLowerCase().includes(q))
    if (statusFilter !== 'all') {
      result = result.filter((r) => rowStatus(r).toLowerCase() === statusFilter)
    }
    return result
  }, [rows, search, statusFilter])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function inviteEmail(email: string, label?: string) {
    const res = await fetch('/api/admin/waitlist/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, label }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Invite failed')
  }

  async function handleInviteRow(row: WaitlistRow, reinvite = false) {
    setInvitingId(row.id)
    setActionMessage(null)
    setError(null)
    try {
      await inviteEmail(row.email, row.invite_label ?? undefined)
      setActionMessage(
        reinvite
          ? `Re-invited ${row.email}`
          : `Invitation sent to ${row.email}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInvitingId(null)
    }
  }

  async function handleInviteSelected() {
    const targets = filtered.filter(
      (r) => selected.has(r.id) && !r.converted,
    )
    if (targets.length === 0) return

    setActionMessage(null)
    setError(null)
    let sent = 0
    for (const row of targets) {
      setInvitingId(row.id)
      try {
        await inviteEmail(row.email)
        sent += 1
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invite failed')
        break
      }
    }
    setInvitingId(null)
    if (sent > 0) {
      setActionMessage(`Invited ${sent} of ${targets.length} selected.`)
      setSelected(new Set())
      await load()
    }
  }

  async function handleBulkInvite() {
    const emails = bulkEmails
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e.includes('@'))

    if (emails.length === 0 || !bulkLabel.trim()) return

    setBulkRunning(true)
    setBulkProgress(`Sending 0 of ${emails.length}…`)
    setActionMessage(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/waitlist/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, label: bulkLabel.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Bulk invite failed')

      const sentCount = (json.sent as string[]).length
      const failedCount = (json.failed as Array<{ email: string }>).length
      setBulkProgress(null)
      setActionMessage(
        `Bulk invite complete: ${sentCount} sent${failedCount ? `, ${failedCount} failed` : ''}.`,
      )
      if (failedCount) {
        setError(
          `Failed: ${(json.failed as Array<{ email: string; error: string }>)
            .map((f) => `${f.email} (${f.error})`)
            .join('; ')}`,
        )
      }
      setBulkOpen(false)
      setBulkEmails('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk invite failed')
      setBulkProgress(null)
    } finally {
      setBulkRunning(false)
    }
  }

  const previewCount = bulkEmails
    .split('\n')
    .map((e) => e.trim())
    .filter((e) => e.includes('@')).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Waitlist</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Summary: {summary.waiting} waiting · {summary.invited} invited ·{' '}
            {summary.converted} converted
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['all', 'All', rows.length],
                ['waiting', 'Waiting', summary.waiting],
                ['invited', 'Invited', summary.invited],
                ['converted', 'Converted', summary.converted],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  statusFilter === key
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm min-w-[200px]"
          />
          <button
            type="button"
            onClick={handleInviteSelected}
            disabled={selected.size === 0 || invitingId !== null}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
          >
            Invite selected
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Bulk invite
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      {actionMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          {actionMessage}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-neutral-400 py-12 text-center animate-pulse">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-500 py-12 text-center">No waitlist entries found.</p>
        ) : (
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 w-10" />
                {['Email', 'Score', 'Source', 'Joined', 'Status', ''].map((h) => (
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
              {filtered.map((row) => {
                const status = rowStatus(row)
                return (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      {!row.converted && (
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">{row.email}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {row.score ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{row.source}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {status === 'Converted' ? (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          Signed up
                        </span>
                      ) : status === 'Invited' ? (
                        <span className="text-xs text-neutral-600">
                          Invited {formatDate(row.invited_at)}
                          {row.invite_label ? ` (${row.invite_label})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600">
                          Waiting
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!row.converted && (
                        <button
                          type="button"
                          onClick={() => handleInviteRow(row, Boolean(row.invited_at))}
                          disabled={invitingId === row.id}
                          className="text-xs font-medium text-[color:var(--mwm-navy)] hover:underline disabled:opacity-50"
                        >
                          {invitingId === row.id
                            ? 'Sending…'
                            : row.invited_at
                              ? 'Re-invite'
                              : 'Invite'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close"
            onClick={() => !bulkRunning && setBulkOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-neutral-900">Bulk invite</h3>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Emails (one per line)
              </label>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                rows={8}
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono"
                placeholder="jane@example.com&#10;bob@example.com"
              />
              <p className="text-xs text-neutral-400 mt-1">{previewCount} email(s) detected</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Cohort label (required)
              </label>
              <input
                type="text"
                value={bulkLabel}
                onChange={(e) => setBulkLabel(e.target.value)}
                placeholder="beta-cohort-1"
                className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            {bulkProgress && (
              <p className="text-sm text-neutral-600">{bulkProgress}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                disabled={bulkRunning}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkInvite}
                disabled={bulkRunning || previewCount === 0 || !bulkLabel.trim()}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {bulkRunning ? 'Sending…' : `Invite ${previewCount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
