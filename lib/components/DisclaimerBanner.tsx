// lib/components/DisclaimerBanner.tsx
export function DisclaimerBanner({ context }: { context?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
      <span className="font-semibold text-neutral-600">Disclaimer: </span>
      {context
        ? `This ${context} is based on data you have entered and is designed to help you plan and prepare for conversations with your estate attorney, CPA, and financial advisor. `
        : 'This analysis is based on data you have entered and is designed to help you plan and prepare for conversations with your estate attorney, CPA, and financial advisor. '}
      Numbers update automatically as your data changes.
    </div>
  )
}
