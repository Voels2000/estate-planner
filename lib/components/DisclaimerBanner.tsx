// lib/components/DisclaimerBanner.tsx
export function DisclaimerBanner({ context }: { context?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
      <span className="font-semibold text-neutral-600">Disclaimer: </span>
      {context
        ? `This ${context} is generated from data you have provided and is intended for informational and planning purposes only. `
        : 'This analysis is generated from data you have provided and is intended for informational and planning purposes only. '}
      It does not constitute legal, tax, or financial advice. Consult a qualified estate attorney, CPA, or financial advisor
      before making estate planning decisions.
    </div>
  )
}
