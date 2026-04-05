'use client'
// app/advisor/clients/[clientId]/_tabs/TaxTab.tsx
// Estate tax summary — read-only advisor view
// Data comes from calculate_state_estate_tax() RPC called server-side in page.tsx

import { ClientViewShellProps } from '../_client-view-shell'
import { formatCurrency } from '../_utils'

export default function TaxTab({ estateTax, household }: ClientViewShellProps) {

  if (!estateTax || estateTax.success === false) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center text-slate-400">
        <span className="text-4xl mb-3">◆</span>
        <p className="text-sm font-medium">No estate tax data available</p>
        <p className="text-xs mt-1 text-center max-w-xs">
          {estateTax?.error ?? 'Estate tax calculation requires household and asset data to be complete.'}
        </p>
      </div>
    )
  }

  const {
    tax_year,
    domicile_state,
    has_state_estate_tax,
    gross_estate,
    marital_deduction,
    adjusted_gross_estate,
    state_exemption,
    taxable_estate,
    estimated_state_tax,
    effective_rate_pct,
    ny_cliff_applies,
    out_of_state_property_tax,
  } = estateTax

  const hasStateTax = has_state_estate_tax === true
  const situsProperties: any[] = out_of_state_property_tax ?? []
  const totalSitusTax = situsProperties.reduce((s: number, p: any) => s + (p.estimated_situs_tax ?? 0), 0)
  const totalTaxLiability = (estimated_state_tax ?? 0) + totalSitusTax

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Estate Tax Summary</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {domicile_state} · Tax year {tax_year} · {household.filing_status === 'married_filing_jointly' ? 'Married filing jointly' : 'Single filer'}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${totalTaxLiability > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {formatCurrency(totalTaxLiability)}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Total Tax Liability</div>
        </div>
      </div>

      {/* ── NY cliff warning ── */}
      {ny_cliff_applies && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-800">New York Estate Tax Cliff Applies</p>
            <p className="text-sm text-red-700 mt-0.5">
              The estate exceeds 105% of the NY exemption threshold. The entire estate is taxable —
              not just the amount above the exemption. This cliff significantly increases tax liability.
              Consider estate planning strategies to reduce the gross estate below the cliff threshold.
            </p>
          </div>
        </div>
      )}

      {/* ── No state tax notice ── */}
      {!hasStateTax && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">{domicile_state} Has No State Estate Tax</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              The client's domicile state does not impose a state estate tax.
              {situsProperties.length > 0 && ' However, out-of-state property may still be subject to situs state taxation — see below.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">

        {/* ── Estate Tax Waterfall ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {domicile_state} Estate Tax Calculation
          </h3>

          <div className="space-y-0">
            <WaterfallRow
              label="Gross Estate"
              value={gross_estate}
              description="Total assets + real estate"
              bold
            />
            <WaterfallRow
              label="Marital Deduction"
              value={marital_deduction}
              description="Federal unlimited marital deduction — assets passing to surviving spouse (50% applied)"
              deduction
            />
            <WaterfallRow
              label="Adjusted Gross Estate"
              value={adjusted_gross_estate}
              description="After marital deduction"
              bold
              highlight
            />
            {hasStateTax && (
              <WaterfallRow
                label="State Exemption"
                value={state_exemption}
                description={`${domicile_state} estate tax exemption`}
                deduction
              />
            )}
            <WaterfallRow
              label="Taxable Estate"
              value={taxable_estate}
              description={hasStateTax ? 'Subject to state estate tax' : 'No state tax applies'}
              bold
            />
            {hasStateTax && (
              <>
                <div className="border-t border-slate-100 mt-3 pt-3">
                  <WaterfallRow
                    label="Estimated State Tax"
                    value={estimated_state_tax}
                    description={`Effective rate: ${effective_rate_pct ?? 0}%`}
                    bold
                    tax
                  />
                </div>
              </>
            )}
          </div>

          {!hasStateTax && taxable_estate === 0 && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
              <p className="text-xs text-emerald-700 font-medium">No state estate tax liability</p>
            </div>
          )}
        </div>

        {/* ── Tax Summary Cards ── */}
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <TaxStatCard
              label="Gross Estate"
              value={formatCurrency(gross_estate, true)}
            />
            <TaxStatCard
              label="Taxable Estate"
              value={formatCurrency(taxable_estate, true)}
            />
            <TaxStatCard
              label="State Tax"
              value={formatCurrency(estimated_state_tax, true)}
              highlight={estimated_state_tax > 0}
            />
            <TaxStatCard
              label="Effective Rate"
              value={`${effective_rate_pct ?? 0}%`}
              highlight={(effective_rate_pct ?? 0) > 0}
            />
          </div>

          {/* Planning insight */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Planning Insights</h3>
            <div className="space-y-2">
              {totalTaxLiability === 0 && (
                <Insight
                  type="positive"
                  text="No current estate tax liability. Monitor as estate grows."
                />
              )}
              {totalTaxLiability > 0 && totalTaxLiability < 100_000 && (
                <Insight
                  type="moderate"
                  text="Moderate estate tax exposure. Review gifting strategies and trust options."
                />
              )}
              {totalTaxLiability >= 100_000 && totalTaxLiability < 500_000 && (
                <Insight
                  type="high"
                  text="Significant estate tax liability. Recommend irrevocable trust review and annual gifting program."
                />
              )}
              {totalTaxLiability >= 500_000 && (
                <Insight
                  type="critical"
                  text="High estate tax liability. Immediate planning recommended — ILIT, charitable strategies, and family limited partnership structures should be evaluated."
                />
              )}
              {marital_deduction > 0 && (
                <Insight
                  type="info"
                  text="Marital deduction applied. Portability election and QTIP trust should be reviewed at first spouse death."
                />
              )}
              {ny_cliff_applies && (
                <Insight
                  type="critical"
                  text="NY cliff tax applies. Reducing gross estate below 105% of exemption could eliminate cliff and significantly reduce liability."
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Situs / Out-of-State Property ── */}
      {situsProperties.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Out-of-State Property Tax (Situs)</h3>
            <div className="text-right">
              <span className="text-sm font-bold text-red-700">{formatCurrency(totalSitusTax)}</span>
              <span className="text-xs text-slate-400 ml-1">total situs tax</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Property</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Situs State</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Property Value</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Est. Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {situsProperties.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{p.property}</td>
                    <td className="py-2.5 text-slate-500">{p.situs_state}</td>
                    <td className="py-2.5 text-right text-slate-800">{formatCurrency(p.property_value)}</td>
                    <td className="py-2.5 text-right font-medium text-red-700">{formatCurrency(p.estimated_situs_tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Properties located in states with estate tax that differ from the client's domicile state
            may be subject to situs taxation independent of domicile state rules.
          </p>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WaterfallRow({ label, value, description, bold, deduction, highlight, tax }: {
  label: string
  value: number | null
  description?: string
  bold?: boolean
  deduction?: boolean
  highlight?: boolean
  tax?: boolean
}) {
  return (
    <div className={`flex items-start justify-between py-2.5 ${highlight ? 'bg-slate-50 -mx-2 px-2 rounded' : ''}`}>
      <div>
        <p className={`text-sm ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="text-right ml-4">
        {deduction && value !== null && value > 0 && (
          <span className="text-xs text-slate-400 mr-1">−</span>
        )}
        <span className={`text-sm ${
          tax ? 'font-bold text-red-700' :
          bold ? 'font-semibold text-slate-800' :
          deduction ? 'text-slate-500' : 'text-slate-700'
        }`}>
          {formatCurrency(value ?? 0)}
        </span>
      </div>
    </div>
  )
}

function TaxStatCard({ label, value, highlight }: {
  label: string; value: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function Insight({ type, text }: {
  type: 'positive' | 'moderate' | 'high' | 'critical' | 'info'
  text: string
}) {
  const styles = {
    positive: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    moderate:  'bg-amber-50 text-amber-800 border-amber-200',
    high:      'bg-orange-50 text-orange-800 border-orange-200',
    critical:  'bg-red-50 text-red-800 border-red-200',
    info:      'bg-blue-50 text-blue-800 border-blue-200',
  }
  const dots = {
    positive: 'bg-emerald-500',
    moderate:  'bg-amber-400',
    high:      'bg-orange-500',
    critical:  'bg-red-500',
    info:      'bg-blue-400',
  }
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${styles[type]}`}>
      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dots[type]}`} />
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  )
}
