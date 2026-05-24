// lib/components/DisclaimerBanner.tsx
import { DISCLAIMER_STRINGS } from '@/lib/compliance/language-policy'
import { LegalFooterLinks } from '@/components/layout/LegalFooterLinks'

export function DisclaimerBanner({ context: _context }: { context?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
      <span className="font-semibold text-neutral-600">Disclaimer: </span>
      {DISCLAIMER_STRINGS.footer}
      <div className="mt-2">
        <LegalFooterLinks linkClassName="text-neutral-600 hover:text-neutral-900 underline-offset-4 hover:underline" />
      </div>
    </div>
  )
}
