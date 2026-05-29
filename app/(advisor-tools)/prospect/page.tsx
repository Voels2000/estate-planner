import { createClient } from '@/lib/supabase/server'
import { calculateProspectSummary } from '@/lib/prospect/calculateProspectSummary'
import { PROSPECT_US_STATES } from '@/lib/prospect/constants'
import { ProspectSelects } from './_prospect-selects'
import { ProspectResults } from './_prospect-results'

interface Props {
  searchParams: Promise<{
    state?: string
    range?: string
    marital?: string
    biz?: string
    age?: string
    name?: string
  }>
}

export default async function ProspectPage({ searchParams }: Props) {
  const params = await searchParams
  const state = params.state ?? 'CA'
  const range = params.range ?? 'md'
  const marital = (params.marital ?? 'married') as 'single' | 'married'
  const businessOwner = params.biz === '1'
  const age = parseInt(params.age ?? '55', 10)
  const prospectName = params.name?.trim() ?? ''
  const hasResult = params.range != null

  const supabase = await createClient()

  let summary = null
  if (hasResult) {
    summary = await calculateProspectSummary(supabase, {
      state,
      range,
      marital,
      businessOwner,
      age,
    })
  }

  const pdfUrl = hasResult
    ? `/api/advisor/prospect-pdf?${new URLSearchParams({
        state,
        range,
        marital,
        biz: businessOwner ? '1' : '0',
        age: String(age),
        name: prospectName || 'Prospect',
      }).toString()}`
    : ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Prospect Mode</h1>
      <p className="text-sm text-neutral-500">
        Generate an Estate Planning Opportunity Summary. No data is stored.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form method="GET" className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-neutral-900">Prospect Profile</h2>

          <ProspectSelects
            state={state}
            range={range}
            marital={marital}
            age={age}
            name={prospectName}
            usStates={PROSPECT_US_STATES}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="biz"
              value="1"
              id="biz"
              defaultChecked={businessOwner}
              className="w-4 h-4 rounded border-neutral-300"
            />
            <label htmlFor="biz" className="text-sm text-neutral-700">
              Business owner
            </label>
          </div>
        </form>

        {summary && (
          <ProspectResults summary={summary} pdfUrl={pdfUrl} prospectName={prospectName} />
        )}
      </div>
    </div>
  )
}
