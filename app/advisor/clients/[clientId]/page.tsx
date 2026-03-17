import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotesPanel from './NotesPanel'

function formatDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

export default async function ClientDetailPage({
  params,
}: {
  params: { clientId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify this advisor is linked to this client
  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id, client_status')
    .eq('advisor_id', user.id)
    .eq('client_id', params.clientId)
    .single()

  if (!link) redirect('/advisor')

  // Fetch client data (household first so we can use its id for projections)
  const [
    { data: profile },
    { data: household },
    { data: assets },
    { data: liabilities },
    { data: income },
    { data: expenses },
    { data: notes },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.clientId).single(),
    supabase.from('households').select('*').eq('owner_id', params.clientId).single(),
    supabase.from('assets').select('*').eq('owner_id', params.clientId),
    supabase.from('liabilities').select('*').eq('owner_id', params.clientId),
    supabase.from('income').select('*').eq('owner_id', params.clientId),
    supabase.from('expenses').select('*').eq('owner_id', params.clientId),
    supabase.from('advisor_notes')
      .select('*')
      .eq('advisor_id', user.id)
      .eq('client_id', params.clientId)
      .order('created_at', { ascending: false }),
  ])

  const { data: projections } = household?.id
    ? await supabase
        .from('projections')
        .select('scenario_name, summary, calculated_at')
        .eq('household_id', household.id)
        .order('calculated_at', { ascending: false })
        .limit(5)
    : { data: [] }

  const totalAssets = (assets ?? []).reduce((s, a) => s + Number(a.value), 0)
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const netWorth = totalAssets - totalLiabilities
  const totalIncome = (income ?? []).reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a href="/advisor" className="text-sm text-neutral-500 hover:text-neutral-700">
            ← Back to Clients
          </a>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">
            {profile?.full_name ?? 'Client'}
          </h1>
          <p className="text-sm text-neutral-500">{profile?.email}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          link.client_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
          link.client_status === 'needs_review' ? 'bg-amber-100 text-amber-700' :
          link.client_status === 'at_risk' ? 'bg-red-100 text-red-700' :
          'bg-neutral-100 text-neutral-500'
        }`}>
          {link.client_status ?? 'active'}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Net Worth" value={formatDollars(netWorth)}
          highlight={netWorth >= 0 ? 'green' : 'red'} />
        <StatCard label="Total Assets" value={formatDollars(totalAssets)} />
        <StatCard label="Total Liabilities" value={formatDollars(totalLiabilities)} />
        <StatCard label="Annual Income" value={formatDollars(totalIncome * 12)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saved Scenarios */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Saved Scenarios
          </h2>
          {!projections || projections.length === 0 ? (
            <p className="text-sm text-neutral-400">No scenarios saved yet.</p>
          ) : (
            <div className="space-y-3">
              {projections.map((p) => (
                <div key={p.calculated_at}
                  className="flex items-center justify-between rounded-lg border border-neutral-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{p.scenario_name}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(p.calculated_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-900">
                      {formatDollars(p.summary?.at_retirement ?? 0)}
                    </p>
                    <p className="text-xs text-neutral-400">at retirement</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Advisor Notes */}
        <NotesPanel
          advisorId={user.id}
          clientId={params.clientId}
          initialNotes={notes ?? []}
        />
      </div>

      {/* Household details */}
      {household && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
            Household Details
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <Detail label="Filing Status" value={household.filing_status?.replace(/_/g, ' ')} />
            <Detail label="Primary State" value={household.state_primary} />
            <Detail label="Retirement Age" value={household.person1_retirement_age} />
            <Detail label="SS Claiming Age" value={household.person1_ss_claiming_age} />
            <Detail label="Inflation Rate" value={`${household.inflation_rate}%`} />
            <Detail label="Growth (Accumulation)" value={`${household.growth_rate_accumulation ?? 7}%`} />
            <Detail label="Growth (Retirement)" value={`${household.growth_rate_retirement ?? 5}%`} />
            <Detail label="Longevity Age" value={household.person1_longevity_age} />
            <Detail label="Deduction Mode" value={household.deduction_mode} />
            <Detail label="Has Spouse" value={household.has_spouse ? 'Yes' : 'No'} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }: {
  label: string; value: string; highlight?: 'green' | 'red'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${
        highlight === 'green' ? 'text-green-600' :
        highlight === 'red' ? 'text-red-600' :
        'text-neutral-900'
      }`}>{value}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 font-medium text-neutral-900 capitalize">{value ?? '—'}</p>
    </div>
  )
}
