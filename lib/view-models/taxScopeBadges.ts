import type { AdvisoryMetric } from '@/lib/advisoryMetrics'

type TaxScope = AdvisoryMetric['scope']

type TaxScopeBadge = {
  label: string
  className: string
}

const TAX_SCOPE_BADGES: Record<TaxScope, TaxScopeBadge> = {
  federal: { label: 'Federal', className: 'bg-blue-100 text-blue-700' },
  state: { label: 'State', className: 'bg-emerald-100 text-emerald-700' },
  both: { label: 'Fed + State', className: 'bg-violet-100 text-violet-700' },
  strategy: { label: 'Strategy', className: 'bg-amber-100 text-amber-700' },
}

export function getTaxScopeBadge(scope: TaxScope): TaxScopeBadge {
  return TAX_SCOPE_BADGES[scope]
}
