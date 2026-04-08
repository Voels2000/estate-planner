// components/consumer/SunsetAlert.tsx
// Sprint 64 - Consumer alert for federal exemption sunset exposure
// Shown on dashboard for households with $0 current federal tax but sunset exposure
'use client'

interface Props {
  currentFederalTax:  number
  sunsetFederalTax:   number
  stateTax?:          number
  stateCode?:         string
  householdName?:     string
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function SunsetAlert({
  currentFederalTax,
  sunsetFederalTax,
  stateTax = 0,
  stateCode,
  householdName,
}: Props) {
  // Only show if current tax is $0 but sunset creates exposure
  if (currentFederalTax > 0 || sunsetFederalTax <= 0) return null

  const totalSunsetExposure = sunsetFederalTax + stateTax

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <h3 className="text-base font-semibold text-amber-900">
            Federal Exemption Sunset Alert
          </h3>
          <p className="text-sm text-amber-800 mt-1">
            {householdName ? `The ${householdName} household currently` : 'You currently'} owe{' '}
            <strong>$0 in federal estate tax</strong> under current law. However, the Tax Cuts and
            Jobs Act exemption is scheduled to be cut roughly in half on{' '}
            <strong>January 1, 2026</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-amber-200 p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Current Federal Tax</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{fmt(currentFederalTax)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Under current law</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Post-Sunset Federal Tax</p>
          <p className="text-xl font-bold text-red-700 mt-1">{fmt(sunsetFederalTax)}</p>
          <p className="text-xs text-slate-400 mt-0.5">If exemption sunsets</p>
        </div>
      </div>

      {stateTax > 0 && stateCode && (
        <div className="bg-white rounded-lg border border-amber-200 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{stateCode} State Estate Tax</p>
            <p className="text-sm text-slate-400 mt-0.5">Already applies under current law</p>
          </div>
          <p className="text-lg font-bold text-amber-700">{fmt(stateTax)}</p>
        </div>
      )}

      {totalSunsetExposure > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-red-800">Total post-sunset exposure</p>
          <p className="text-lg font-bold text-red-800">{fmt(totalSunsetExposure)}</p>
        </div>
      )}

      <p className="text-xs text-amber-700">
        Planning strategies such as gifting, trust structures, and domicile changes may reduce
        this exposure. Speak with your advisor before December 31, 2025.
      </p>
    </div>
  )
}
