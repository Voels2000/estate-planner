import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { ProspectSelects } from './_prospect-selects'

const ASSET_MIDPOINTS: Record<string, number> = {
  sm: 3_000_000, md: 10_000_000, lg: 22_500_000, xl: 40_000_000,
}
const ESTATE_TAX_STATES = ['CT', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA', 'DC']
const STATE_EXEMPTIONS: Record<string, number> = {
  CT: 12920000, HI: 5490000, IL: 4000000, ME: 6800000, MD: 5000000, MA: 1000000,
  MN: 3000000, NY: 6940000, OR: 1000000, RI: 1733264, VT: 5000000, WA: 2193000, DC: 4528800,
}
const STATE_TOP_RATES: Record<string, number> = {
  CT: 0.12, HI: 0.20, IL: 0.16, ME: 0.12, MD: 0.16, MA: 0.16,
  MN: 0.16, NY: 0.16, OR: 0.16, RI: 0.16, VT: 0.16, WA: 0.20, DC: 0.16,
}
const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString()}`
}

interface Props {
  searchParams: Promise<{ state?: string; range?: string; marital?: string; biz?: string; age?: string }>
}

export default async function ProspectPage({ searchParams }: Props) {
  const params = await searchParams
  const state = params.state ?? 'CA'
  const range = params.range ?? 'md'
  const marital = params.marital ?? 'married'
  const businessOwner = params.biz === '1'
  const age = parseInt(params.age ?? '55')
  const hasResult = !!params.range

  let result = null
  if (hasResult) {
    const assets = ASSET_MIDPOINTS[range] ?? 10_000_000
    const exemptionCurrent = marital === 'married' ? 27_220_000 : 13_610_000
    const exemptionSunset = marital === 'married' ? 14_400_000 : 7_200_000
    const taxableCurrent = Math.max(0, assets - exemptionCurrent)
    const federalTaxCurrent = Math.round(taxableCurrent * 0.40)
    const taxableSunset = Math.max(0, assets - exemptionSunset)
    const federalTaxSunset = Math.round(taxableSunset * 0.40)
    const sunsetDelta = federalTaxSunset - federalTaxCurrent
    let stateTax = 0
    if (ESTATE_TAX_STATES.includes(state)) {
      const stateExemption = STATE_EXEMPTIONS[state] ?? 2_000_000
      stateTax = Math.round(Math.max(0, assets - stateExemption) * (STATE_TOP_RATES[state] ?? 0.16))
    }
    const gaps: string[] = []
    if (assets > exemptionSunset) gaps.push('Potential estate tax exposure under sunset scenario')
    if (marital === 'married' && assets > 5_000_000) gaps.push('Credit shelter trust opportunity at first death')
    if (businessOwner) gaps.push('Business succession and valuation planning needed')
    if (assets > 10_000_000) gaps.push('Annual gifting program could reduce estate over time')
    if (ESTATE_TAX_STATES.includes(state)) gaps.push(`${state} state estate tax applies - separate from federal`)
    if (age > 60) gaps.push('Beneficiary designation review recommended')
    const lookAt: string[] = [
      'Review all beneficiary designations and account titling',
      'Analyze federal and state estate tax exposure under current and sunset law',
    ]
    if (marital === 'married') lookAt.push('Evaluate portability election and credit shelter trust')
    if (assets > 10_000_000) lookAt.push('Annual gifting program and lifetime exemption utilization')
    if (businessOwner) lookAt.push('Business succession plan and valuation discount strategies')
    if (sunsetDelta > 500_000) lookAt.push('Sunset planning window - strategies available before December 31, 2025')
    if (ESTATE_TAX_STATES.includes(state)) lookAt.push(`${state} state estate tax mitigation strategies`)
    result = { federalTaxCurrent, federalTaxSunset, sunsetDelta, stateTax, state, gaps: gaps.slice(0, 5), lookAt: lookAt.slice(0, 6) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Prospect Mode</h1>
      <p className="text-sm text-neutral-500">Generate an Estate Planning Opportunity Summary. No data is stored.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form method="GET" className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-neutral-900">Prospect Profile</h2>

          <ProspectSelects state={state} range={range} marital={marital} age={age} usStates={US_STATES} />

          <div className="flex items-center gap-3">
            <input type="checkbox" name="biz" value="1" id="biz" defaultChecked={businessOwner} className="w-4 h-4 rounded border-neutral-300" />
            <label htmlFor="biz" className="text-sm text-neutral-700">Business owner</label>
          </div>

        </form>

        {result && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Estate Planning Opportunity Summary</h2>

            <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Federal Estate Tax</h3>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Current law</span>
                <span className="font-semibold">{fmt(result.federalTaxCurrent)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Sunset scenario</span>
                <span className="font-semibold text-amber-700">{fmt(result.federalTaxSunset)}</span>
              </div>
              {result.sunsetDelta > 0 && (
                <div className="flex justify-between text-sm border-t border-neutral-100 pt-2">
                  <span className="font-medium">Additional tax under sunset</span>
                  <span className="font-bold text-red-600">{fmt(result.sunsetDelta)}</span>
                </div>
              )}
              {result.stateTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{result.state} state estate tax</span>
                  <span className="font-semibold text-amber-700">{fmt(result.stateTax)}</span>
                </div>
              )}
            </div>

            {result.gaps.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Top Planning Gaps</h3>
                <div className="space-y-2">
                  {result.gaps.map((gap, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0">o</span>
                      <span className="text-sm text-neutral-700">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
              <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">What we would look at together</h3>
              <div className="space-y-2">
                {result.lookAt.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-bold text-xs mt-0.5">{i + 1}.</span>
                    <span className="text-sm text-indigo-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <DisclaimerBanner context="prospect analysis" />
          </div>
        )}
      </div>
    </div>
  )
}
