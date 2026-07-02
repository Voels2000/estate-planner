'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AttorneyUpgradePrompt } from '@/components/attorney/AttorneyUpgradePrompt'
import { AttorneyDashboardMetricCards } from '@/components/attorney/AttorneyDashboardMetricCards'
import { AttorneyValuePropBanner } from '@/components/attorney/AttorneyValuePropBanner'
import { SendIntakeRequestModal } from '@/components/attorney/SendIntakeRequestModal'
import { formatRosterNetWorth } from '@/lib/roster/rosterNetWorth'
import type { AttorneyConnectionBillingSummary } from '@/lib/billing/attorneyConnectionBillingSummary'
import { attorneyPortalSubtitleLine } from '@/lib/copy/connectionBillingMarketing'

type ClientCard = {
  connection_id: string
  household_id: string
  granted_at: string | null
  advisor_pdf_access: boolean
  full_name: string
  email: string
  household_name: string
  state: string
  complexity_flag: string
  doc_count: number
  docs_on_file?: number
  docs_total?: number
  missing_docs?: string
  roster_net_worth?: number
  last_updated?: string | null
  matter_stage?: string
  client_status?: string
}

type IntakeRequestRow = {
  id: string
  client_email: string
  client_name: string | null
  displayStatus: 'sent' | 'opened' | 'completed' | 'expired'
  sent_at: string
}

type Props = {
  attorneyName: string
  clients: ClientCard[]
  showDocHealth?: boolean
  attorneyTier?: number
  clientLimit?: number
  totalClients?: number
  connectionBillingEnabled?: boolean
  connectionBillingSummary?: AttorneyConnectionBillingSummary | null
  documentGapsTotal?: number
}

const STATUS_BADGE: Record<IntakeRequestRow['displayStatus'], string> = {
  sent: 'bg-neutral-100 text-neutral-600',
  opened: 'bg-[var(--mwm-gold-pale)] text-[color:var(--mwm-navy)]',
  completed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
}

const complexityColor: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export function AttorneyDashboardClient({
  attorneyName,
  clients,
  showDocHealth = false,
  attorneyTier = 0,
  clientLimit = 3,
  totalClients = 0,
  connectionBillingEnabled = false,
  connectionBillingSummary = null,
  documentGapsTotal = 0,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [intakeModalOpen, setIntakeModalOpen] = useState(false)
  const [intakeRequests, setIntakeRequests] = useState<IntakeRequestRow[]>([])
  const [sentThisMonth, setSentThisMonth] = useState(0)
  const [monthlyCap, setMonthlyCap] = useState<number | null>(attorneyTier === 0 ? 5 : null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/attorney/intake-requests')
        if (!res.ok) return
        const data = await res.json()
        setIntakeRequests(data.requests ?? [])
        setSentThisMonth(data.sentThisMonth ?? 0)
        setMonthlyCap(data.monthlyCap ?? null)
      } catch {
        // non-fatal
      }
    })()
  }, [])

  const filtered = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.state.toLowerCase().includes(search.toLowerCase()),
  )

  const FREE_TIER_CAP = 3
  const atCap = !connectionBillingEnabled && attorneyTier === 0 && totalClients >= FREE_TIER_CAP
  const showFullDocHealth = connectionBillingEnabled || attorneyTier >= 1

  function handleIntakeSent(email: string) {
    setToast(`Invitation sent to ${email}.`)
    setTimeout(() => setToast(null), 4000)
    void fetch('/api/attorney/intake-requests')
      .then((r) => r.json())
      .then((data) => {
        setIntakeRequests(data.requests ?? [])
        setSentThisMonth(data.sentThisMonth ?? 0)
      })
      .catch(() => {})
    router.refresh()
  }

  function DocHealthTable({ rows }: { rows: ClientCard[] }) {
    return (
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
          <tr>
            <th className="px-4 py-3 text-left">Client</th>
            <th className="px-4 py-3 text-left">Estate Value</th>
            <th className="px-4 py-3 text-left">Docs on File</th>
            <th className="px-4 py-3 text-left">Missing</th>
            <th className="px-4 py-3 text-left">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((client) => (
            <tr key={client.connection_id} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-medium text-neutral-900">{client.full_name}</td>
              <td className="px-4 py-3 text-neutral-600">
                {client.roster_net_worth != null && client.roster_net_worth > 0
                  ? formatRosterNetWorth(client.roster_net_worth)
                  : '—'}
              </td>
              <td className="px-4 py-3 text-neutral-600">
                {client.docs_on_file ?? 0} / {client.docs_total ?? 5}
              </td>
              <td className="px-4 py-3 text-xs text-amber-700">{client.missing_docs ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-neutral-400">
                {client.last_updated
                  ? new Date(client.last_updated).toLocaleDateString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const pendingIntake = intakeRequests.filter((r) => r.displayStatus !== 'completed')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <SendIntakeRequestModal
        open={intakeModalOpen}
        onClose={() => setIntakeModalOpen(false)}
        onSent={handleIntakeSent}
        sentThisMonth={sentThisMonth}
        monthlyCap={monthlyCap}
      />

      {toast && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Attorney Portal</h1>
          <p className="text-neutral-500 mt-1">
            {connectionBillingEnabled ? (
              attorneyPortalSubtitleLine(connectionBillingSummary?.ratePerClient)
            ) : (
              <>
                Welcome back, {attorneyName}. You have access to {totalClients || clients.length} client
                {(totalClients || clients.length) !== 1 ? 's' : ''}.
                {attorneyTier === 0 && totalClients > clientLimit && (
                  <span className="block text-xs text-amber-600 mt-1">
                    Free tier shows {clientLimit} clients.{' '}
                    <Link href="/attorney/billing" className="underline">
                      Upgrade for full practice view →
                    </Link>
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setIntakeModalOpen(true)}
            className="rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
          >
            Send intake request
          </button>
          {monthlyCap != null && (
            <span className="text-xs text-neutral-400">
              {sentThisMonth} of {monthlyCap} intake requests this month
            </span>
          )}
        </div>
      </div>

      {connectionBillingEnabled && (
        <AttorneyDashboardMetricCards
          connectedCount={connectionBillingSummary?.connectedCount ?? totalClients}
          monthlyCost={connectionBillingSummary?.estimatedMonthly ?? 0}
          documentGapsTotal={documentGapsTotal}
        />
      )}

      {atCap && (
        <div className="mb-6">
          <AttorneyUpgradePrompt feature="client_cap" currentClientCount={totalClients} />
        </div>
      )}

      {pendingIntake.length > 0 && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
            Pending intake requests
          </h2>
          <ul className="space-y-2">
            {pendingIntake.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-neutral-900">
                    {req.client_name ?? req.client_email}
                  </span>
                  {req.client_name && (
                    <span className="ml-2 text-neutral-400">{req.client_email}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[req.displayStatus]}`}
                  >
                    {req.displayStatus}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {new Date(req.sent_at).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {clients.length > 0 && (
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-[color:var(--mwm-navy)] focus:border-transparent bg-white"
          />
        </div>
      )}

      {clients.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-neutral-200">
          <span className="mx-auto text-4xl mb-3 block text-center">👤</span>
          <p className="text-neutral-500 font-medium">No clients yet</p>
          <p className="text-neutral-400 text-sm mt-1">
            Send an intake request or share your referral links to get clients started.
          </p>
        </div>
      )}

      {clients.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
          <p className="text-neutral-500">No clients match your search.</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {filtered.map((client) => (
          <Link
            key={client.connection_id}
            href={`/attorney/clients/${client.household_id}`}
            className="block bg-white border border-neutral-200 rounded-xl p-5
                       hover:border-[color:var(--mwm-navy)]/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-[var(--mwm-gold-pale)] flex items-center
                                justify-center text-[color:var(--mwm-navy)] font-semibold text-sm shrink-0">
                  {client.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-neutral-900">{client.full_name}</p>
                  <p className="text-sm text-neutral-400">{client.email}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {client.state && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <span className="text-xs">📍</span>
                        {client.state}
                      </span>
                    )}
                    {client.matter_stage && client.matter_stage !== 'intake' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--mwm-gold-pale)] text-[color:var(--mwm-navy)] font-medium capitalize">
                        {client.matter_stage.replace('_', ' ')}
                      </span>
                    )}
                    {client.client_status && client.client_status !== 'active' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                        {client.client_status.replace('_', ' ')}
                      </span>
                    )}
                    {client.complexity_flag && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${complexityColor[client.complexity_flag] ?? 'bg-neutral-100 text-neutral-600'}`}
                      >
                        {client.complexity_flag} complexity
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <span className="text-xs">📄</span>
                      {client.doc_count} document{client.doc_count !== 1 ? 's' : ''}
                    </span>
                    {client.granted_at && (
                      <span className="text-xs text-neutral-400">
                        Access granted {new Date(client.granted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-neutral-300 group-hover:text-[color:var(--mwm-navy)] transition-colors shrink-0">›</span>
            </div>
          </Link>
        ))}
      </div>

      {showDocHealth && clients.length > 0 && showFullDocHealth && (
        <div className="mb-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <DocHealthTable rows={filtered} />
        </div>
      )}

      {showDocHealth && clients.length > 0 && !showFullDocHealth && (
        <div className="relative mb-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <div className="pointer-events-none select-none opacity-40 blur-sm">
            <DocHealthTable rows={clients.slice(0, 2)} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <AttorneyUpgradePrompt feature="doc_dashboard" />
          </div>
        </div>
      )}

      <AttorneyValuePropBanner />
    </div>
  )
}
