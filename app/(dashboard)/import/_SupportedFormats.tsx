'use client'

const FORMATS = [
  {
    icon: '📊',
    title: 'Broker exports',
    desc: 'Schwab, Fidelity, Vanguard, Betterment and others — upload as-is, we auto-detect the format.',
    examples: ['Schwab One Account CSV', 'Fidelity brokerage export', 'Vanguard portfolio CSV'],
  },
  {
    icon: '📋',
    title: 'Multi-sheet Excel workbooks',
    desc: 'One file for your whole picture — assets, liabilities, income, and expenses on separate tabs.',
    examples: ['Business Owner workbook', 'Real Estate Investor workbook', 'Executive workbook'],
  },
  {
    icon: '📄',
    title: 'Single-table CSV',
    desc: 'One table per file. We map your column names automatically — no specific format required.',
    examples: ['Assets list', 'Liabilities list', 'Income sources'],
  },
] as const

export function SupportedFormats() {
  return (
    <div className="mb-6 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
      <p className="mb-4 text-sm font-medium text-[color:var(--mwm-navy)]">What you can upload</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FORMATS.map((f) => (
          <div key={f.title} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                {f.icon}
              </span>
              <p className="text-sm font-medium text-[color:var(--mwm-navy)]">{f.title}</p>
            </div>
            <p className="text-xs leading-relaxed text-[color:var(--mwm-text-secondary)]">
              {f.desc}
            </p>
            <ul className="mt-1 space-y-0.5">
              {f.examples.map((ex) => (
                <li
                  key={ex}
                  className="text-[11px] text-[color:var(--mwm-text-secondary)] before:mr-1.5 before:content-['·']"
                >
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-[color:var(--mwm-border)] pt-3 text-xs text-[color:var(--mwm-text-secondary)]">
        Starting from scratch?{' '}
        <span className="font-medium text-[color:var(--mwm-navy)]">
          Download a persona template below
        </span>{' '}
        — fill it in and upload it in the drop zone.
      </p>
    </div>
  )
}
