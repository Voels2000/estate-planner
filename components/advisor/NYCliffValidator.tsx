'use client'

import { validateNYCliffCases, type DbStateExemption } from '@/lib/projection/stateRegistry'

interface Props {
  year: number
  dbExemptions?: DbStateExemption[]
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function NYCliffValidator({ year, dbExemptions }: Props) {
  const results = validateNYCliffCases(year, dbExemptions)
  console.log('NYCliffValidator:', { year, dbExemptions: dbExemptions?.length, results: results.length, firstResult: results[0] })
  const allPassed = results.every(r => r.passed)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">NY Cliff Edge Case Validation</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {allPassed ? '✓ All cases pass' : `${results.filter(r => !r.passed).length} failing`}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left text-xs font-semibold text-slate-500 pb-2">Case</th>
            <th className="text-right text-xs font-semibold text-slate-500 pb-2">Estate</th>
            <th className="text-center text-xs font-semibold text-slate-500 pb-2">Expected Cliff</th>
            <th className="text-center text-xs font-semibold text-slate-500 pb-2">Actual</th>
            <th className="text-center text-xs font-semibold text-slate-500 pb-2">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {results.map(r => (
            <tr key={r.label} className={`hover:bg-slate-50 ${!r.passed ? 'bg-red-50' : ''}`}>
              <td className="py-2.5 text-slate-700">{r.label}</td>
              <td className="py-2.5 text-right text-slate-500">{fmt(r.estate)}</td>
              <td className="py-2.5 text-center">
                {r.expected
                  ? <span className="text-red-600 font-medium">Yes</span>
                  : <span className="text-slate-400">No</span>}
              </td>
              <td className="py-2.5 text-center">
                {r.actual
                  ? <span className="text-red-600 font-medium">Yes</span>
                  : <span className="text-slate-400">No</span>}
              </td>
              <td className="py-2.5 text-center">
                {r.passed
                  ? <span className="text-emerald-600">✓</span>
                  : <span className="text-red-600 font-bold">✗</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        NY cliff triggers when estate exceeds 105% of exemption. At that point
        the entire estate is taxable with no exemption offset.
      </p>
    </div>
  )
}
