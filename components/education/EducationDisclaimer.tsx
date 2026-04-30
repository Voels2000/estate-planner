import { Card } from '@/components/ui/Card'

/**
 * Legal / informational disclaimer for education routes — styled consistently with the education shell.
 */
export function EducationDisclaimer() {
  return (
    <Card className="education-disclaimer rounded-r-md border-0 px-4 py-3">
      <p className="text-xs leading-relaxed">
        ⚠️ <strong>Educational purposes only.</strong> Nothing on this platform constitutes financial, legal,
        tax, or investment advice. Consult a licensed professional for guidance specific to your situation
        before making planning decisions.
      </p>
    </Card>
  )
}
