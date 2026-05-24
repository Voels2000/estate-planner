// lib/components/DisclaimerBanner.tsx
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'

export function DisclaimerBanner({ context: _context }: { context?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
      <span className="font-semibold text-neutral-600">Disclaimer: </span>
      {DISCLAIMER_STRINGS.footer}
    </div>
  )
}
