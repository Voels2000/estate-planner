type SummaryCardProps = {
  label: string
  value: string
  sub: string
  highlight?: 'green' | 'red' | 'amber'
}

export function SummaryCard({ label, value, sub, highlight }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'red'
              ? 'text-red-600'
              : highlight === 'amber'
                ? 'text-amber-600'
                : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}
