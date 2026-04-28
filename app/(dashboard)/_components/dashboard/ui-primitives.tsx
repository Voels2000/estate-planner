import { fmt } from '@/app/(dashboard)/_components/dashboard/formatters'

export function SummaryCard({ label, value, sub, icon, highlight }: {
  label: string
  value: string
  sub: string
  icon: string
  highlight?: 'green' | 'yellow' | 'red'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      </div>
      <p
        className={`text-xl font-bold ${
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'yellow'
              ? 'text-yellow-600'
              : highlight === 'red'
                ? 'text-red-600'
                : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
    </div>
  )
}

export function NetWorthBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs text-neutral-500 shrink-0">{label}</span>
      <div className="flex-1 bg-neutral-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-xs font-semibold text-neutral-700">{fmt(value)}</span>
    </div>
  )
}

export function StatBox({ label, value, sub, highlight }: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-400 mb-1">{label}</p>
      <p
        className={`text-xl font-bold ${
          highlight === 'green'
            ? 'text-emerald-600'
            : highlight === 'red'
              ? 'text-red-600'
              : highlight === 'amber'
                ? 'text-amber-600'
                : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}
