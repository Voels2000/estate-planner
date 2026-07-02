'use client'

type Props = {
  connectedCount: number
  monthlyCost: number
  documentGapsTotal: number
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-1,#f8f9fb)] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--mwm-navy)]">{value}</p>
    </div>
  )
}

export function AttorneyDashboardMetricCards({
  connectedCount,
  monthlyCost,
  documentGapsTotal,
}: Props) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <MetricCard
        label="Connected clients"
        value={String(connectedCount)}
      />
      <MetricCard
        label="This month's cost"
        value={`$${monthlyCost.toLocaleString()}`}
      />
      <MetricCard
        label="Document gaps flagged"
        value={String(documentGapsTotal)}
      />
    </div>
  )
}
