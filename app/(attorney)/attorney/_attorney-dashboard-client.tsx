'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AttorneyUpgradePrompt } from '@/components/attorney/AttorneyUpgradePrompt'
import { AttorneyValuePropBanner } from '@/components/attorney/AttorneyValuePropBanner'
import { SendIntakeRequestModal } from '@/components/attorney/SendIntakeRequestModal'
import { RosterNetWorthColumnHeader } from '@/components/shared/RosterNetWorthColumnHeader'
import { formatRosterNetWorth } from '@/lib/roster/rosterNetWorth'

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
  referralCode?: string | null
  eventReferralUrls?: Record<string, string> | null
  showDocHealth?: boolean
  attorneyTier?: number
  clientLimit?: number
  totalClients?: number
}

const STATUS_BADGE: Record<IntakeRequestRow['displayStatus'], string> = {
  sent: 'bg-neutral-100 text-neutral-600',
  opened: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
}

const EVENT_REFERRAL_LABELS: Record<string, string> = {
  'selling-a-business': 'Selling a business',
  'death-of-spouse': 'Death of a spouse',
  'serious-diagnosis': 'Serious diagnosis',
  'receiving-inheritance': 'Receiving an inheritance',
  divorce: 'Divorce',
  'approaching-retirement': 'Approaching retirement',
  'large-rsu-vest': 'Large RSU vest / liquidity event',
  'new-child-grandchild': 'New child or grandchild',
  'getting-married': 'Getting married',
  'remarriage-blended-family': 'Remarriage / blended family',
  'aging-parent-needs-care': 'Aging parent needs care',
  'loss-of-parent': 'Loss of a parent',
  'starting-a-business': 'Starting a business',
  'selling-a-home': 'Selling a home',
  'multi-state-real-estate': 'Multi-state real estate',
  'child-reaching-adulthood': 'Child reaching adulthood',
  'disability-early-retirement': 'Disability / early retirement',
  'estate-tax-law-change': 'Estate tax law change',
  'first-time-high-net-worth': 'First-time high-net-worth',
  'major-job-change': 'Major job change',
  'five-year-plan-review': 'Five-year plan review',
  'rmd-start-age': 'RMD start age (72–75, by birth year)',
  'medicare-eligibility': 'Medicare eligibility (65)',
  'social-security-timing': 'Social Security timing (62)',
}

const EVENT_REFERRAL_GROUPS: { label: string; slugs: string[] }[] = [
  {
    label: 'Business & Wealth Events',
    slugs: ['selling-a-business', 'starting-a-business', 'large-rsu-vest', 'first-time-high-net-worth', 'major-job-change'],
  },
  {
    label: 'Family & Life Transitions',
    slugs: ['death-of-spouse', 'serious-diagnosis', 'divorce', 'getting-married', 'remarriage-blended-family', 'new-child-grandchild', 'child-reaching-adulthood', 'loss-of-parent', 'aging-parent-needs-care', 'disability-early-retirement'],
  },
  {
    label: 'Real Estate & Inheritance',
    slugs: ['selling-a-home', 'multi-state-real-estate', 'receiving-inheritance'],
  },
  {
    label: 'Retirement & Tax Planning',
    slugs: ['approaching-retirement', 'rmd-start-age', 'medicare-eligibility', 'social-security-timing', 'estate-tax-law-change', 'five-year-plan-review'],
  },
]

const complexityColor: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export function AttorneyDashboardClient({
  attorneyName,
  clients,
  referralCode,
  eventReferralUrls,
  showDocHealth = false,
  attorneyTier = 0,
  clientLimit = 3,
  totalClients = 0,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [newsletterTab, setNewsletterTab] = useState<'links' | 'email' | 'text'>('links')
  const [copiedNewsletter, setCopiedNewsletter] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
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
  const atCap = attorneyTier === 0 && totalClients >= FREE_TIER_CAP

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
          <h1 className="text-2xl font-semibold text-neutral-900">Attorney Portal</h1>
          <p className="text-neutral-500 mt-1">
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

      <AttorneyValuePropBanner />

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

      {showDocHealth && clients.length > 0 && (
        attorneyTier >= 1 ? (
          <div className="mb-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <DocHealthTable rows={filtered} />
          </div>
        ) : (
          <div className="relative mb-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <div className="pointer-events-none select-none opacity-40 blur-sm">
              <DocHealthTable rows={clients.slice(0, 2)} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <AttorneyUpgradePrompt feature="doc_dashboard" />
            </div>
          </div>
        )
      )}

      {referralCode && eventReferralUrls && (() => {
        const emailCopy = `Subject: Estate planning resource for [life event] clients

I wanted to share a resource I recommend to clients navigating specific life events.

My Wealth Maps helps households with $2M–$30M understand estate tax exposure, identify plan gaps, and arrive at our meetings with focused questions.

Share the link that matches your client's situation:

${EVENT_REFERRAL_GROUPS.flatMap((g) =>
  [`${g.label}:`, ...g.slugs.map((s) => `• ${EVENT_REFERRAL_LABELS[s] ?? s}: ${eventReferralUrls[s] ?? ''}`), ''],
).join('\n')}
Visits through your links use your attorney referral code (${referralCode}).

— [Your name]`

        const textCopy = `My Wealth Maps — estate planning for $2M–$30M households.

${EVENT_REFERRAL_GROUPS.flatMap((g) =>
  g.slugs.map((s) => `${EVENT_REFERRAL_LABELS[s] ?? s}: ${eventReferralUrls[s] ?? ''}`),
).join('\n')}
Attorney ref: ${referralCode}`

        return (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden mb-8">
            <div className="px-6 pt-6 pb-4 border-b border-neutral-100">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-1">
                Newsletter Kit
              </h2>
              <p className="text-sm text-neutral-600">
                Your referral code:{' '}
                <span className="font-mono font-semibold text-neutral-900">{referralCode}</span>
                {' '}· Links use <span className="font-mono">?aref=</span> for attorney attribution.
              </p>
              <div className="flex gap-2 mt-4">
                {([
                  { key: 'links' as const, label: '🔗 All Links' },
                  { key: 'email' as const, label: '✉️ Email Copy' },
                  { key: 'text' as const, label: '📱 Plain Text' },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setNewsletterTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      newsletterTab === t.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {newsletterTab === 'links' && (
              <div className="p-6 space-y-6">
                {EVENT_REFERRAL_GROUPS.map((group) => {
                  const groupSlugs = group.slugs.filter((s) => eventReferralUrls[s])
                  if (groupSlugs.length === 0) return null
                  return (
                    <div key={group.label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
                        {group.label}
                      </p>
                      <div className="space-y-1.5">
                        {groupSlugs.map((slug) => {
                          const url = eventReferralUrls[slug]
                          return (
                            <div
                              key={slug}
                              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                            >
                              <span className="text-sm text-neutral-700 shrink-0">
                                {EVENT_REFERRAL_LABELS[slug] ?? slug}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(url)
                                    setCopiedSlug(slug)
                                    setTimeout(() => setCopiedSlug(null), 2000)
                                  } catch {
                                    window.prompt('Copy this link:', url)
                                  }
                                }}
                                className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                              >
                                {copiedSlug === slug ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {newsletterTab === 'email' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Email template
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(emailCopy)
                        setCopiedNewsletter(true)
                        setTimeout(() => setCopiedNewsletter(false), 2000)
                      } catch {
                        window.prompt('Copy this text:', emailCopy)
                      }
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {copiedNewsletter ? '✓ Copied' : 'Copy all'}
                  </button>
                </div>
                <pre className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-sans overflow-x-auto max-h-[480px] overflow-y-auto">
                  {emailCopy}
                </pre>
              </div>
            )}

            {newsletterTab === 'text' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Plain text
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(textCopy)
                        setCopiedNewsletter(true)
                        setTimeout(() => setCopiedNewsletter(false), 2000)
                      } catch {
                        window.prompt('Copy this text:', textCopy)
                      }
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {copiedNewsletter ? '✓ Copied' : 'Copy all'}
                  </button>
                </div>
                <pre className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl p-4 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto max-h-[480px] overflow-y-auto">
                  {textCopy}
                </pre>
              </div>
            )}
          </div>
        )
      })()}

      {clients.length > 0 && (
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

      <div className="space-y-3">
        {filtered.map((client) => (
          <Link
            key={client.connection_id}
            href={`/attorney/clients/${client.household_id}`}
            className="block bg-white border border-neutral-200 rounded-xl p-5
                       hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center
                                justify-center text-blue-600 font-semibold text-sm shrink-0">
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
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium capitalize">
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
              <span className="text-neutral-300 group-hover:text-blue-400 transition-colors shrink-0">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
