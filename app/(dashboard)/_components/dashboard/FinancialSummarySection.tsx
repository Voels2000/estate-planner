import { CollapsibleSection } from '@/components/CollapsibleSection'
import { AssetAllocationSummary, type AssetAllocationContext } from '@/components/AssetAllocationSummary'
import { fmt, fmtExact } from '@/app/(dashboard)/_components/dashboard/formatters'
import { NetWorthBar, SummaryCard } from '@/app/(dashboard)/_components/dashboard/ui-primitives'
import { hasFinancialData } from '@/app/(dashboard)/_components/dashboard/state-helpers'

type FinancialSummarySectionProps = {
  storageKey: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  netWorthBySource: {
    financial: number
    realEstateEquity: number
    business: number
    insurance: number
  }
  mortgageBalance: number
  otherLiabilities: number
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  allocationContext: AssetAllocationContext
}

export function FinancialSummarySection(props: FinancialSummarySectionProps) {
  const hasData = hasFinancialData(props)
  const debtToAsset = props.totalAssets > 0 ? Math.round((props.totalLiabilities / props.totalAssets) * 100) : 0
  const totalNetWorthSources =
    props.netWorthBySource.financial + props.netWorthBySource.realEstateEquity + props.netWorthBySource.business

  return (
    <CollapsibleSection
      title="Financial Summary"
      subtitle={hasData ? `Net worth ${fmtExact(props.netWorth)}` : 'Add assets and income to see your summary'}
      defaultOpen={true}
      storageKey={props.storageKey}
      locked={!hasData}
      lockedMessage="Add your assets, liabilities, income, and expenses to see your full financial summary."
      lockedHref="/assets"
      lockedHrefLabel="Add assets"
    >
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">Net Worth</p>
        <p className={`text-4xl font-bold mb-1 ${props.netWorth >= 0 ? 'text-neutral-900' : 'text-red-600'}`}>
          {fmtExact(props.netWorth)}
        </p>
        <p className="text-xs text-neutral-400">Total assets minus liabilities</p>
      </div>

      {totalNetWorthSources > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">By Source</p>
          <NetWorthBar
            label="Financial Assets"
            value={props.netWorthBySource.financial}
            total={totalNetWorthSources}
            color="bg-blue-500"
          />
          <NetWorthBar
            label="Real Estate (FMV)"
            value={props.netWorthBySource.realEstateEquity}
            total={totalNetWorthSources}
            color="bg-emerald-500"
          />
          <NetWorthBar
            label="Business Interests"
            value={props.netWorthBySource.business}
            total={totalNetWorthSources}
            color="bg-violet-500"
          />
          <div className="flex items-center gap-3 pt-1 border-t border-neutral-100 mt-2">
            <span className="w-36 text-xs text-neutral-400 shrink-0">Mortgage Balance</span>
            <div className="flex-1" />
            <span className="w-20 text-right text-xs font-semibold text-red-500">- {fmt(props.mortgageBalance)}</span>
          </div>
          <div className="flex items-center gap-3 pt-1 border-t border-neutral-100 mt-2">
            <span className="w-36 text-xs text-neutral-400 shrink-0">Other Liabilities</span>
            <div className="flex-1" />
            <span className="w-20 text-right text-xs font-semibold text-red-500">- {fmt(props.otherLiabilities)}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Annual Income" value={fmt(props.totalIncome)} sub="All sources incl. SS" icon="💰" />
        <SummaryCard label="Annual Expenses" value={fmt(props.totalExpenses)} sub="All categories" icon="💸" />
        <SummaryCard
          label="Savings Rate"
          value={`${props.savingsRate}%`}
          sub="Income minus expenses"
          icon="📊"
          highlight={props.savingsRate >= 20 ? 'green' : props.savingsRate >= 10 ? 'yellow' : 'red'}
        />
        <SummaryCard
          label="Debt-to-Asset"
          value={props.totalAssets > 0 ? `${debtToAsset}%` : '—'}
          sub="Liabilities / assets"
          icon="📉"
          highlight={props.totalAssets > 0 && debtToAsset < 50 ? 'green' : 'yellow'}
        />
      </div>

      <AssetAllocationSummary context={props.allocationContext} />
    </CollapsibleSection>
  )
}
