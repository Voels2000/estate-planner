import { Card } from '@/components/ui/Card'

/**
 * Legal / informational disclaimer for education routes — styled consistently with the education shell.
 */
export function EducationDisclaimer() {
  return (
    <Card className="border-amber-200/90 bg-amber-50/60 px-4 py-3">
      <p className="text-xs leading-relaxed text-amber-950/85">
        <span className="font-semibold text-amber-950">Disclaimer: </span>
        This education guide is for informational and planning purposes only. It does not constitute legal,
        tax, financial, or investment advice. Consult a qualified attorney, CPA, or financial advisor before
        making decisions based on this material.
      </p>
    </Card>
  )
}
