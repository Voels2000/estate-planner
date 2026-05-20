import AssessClient from './_assess-client'
import { getAssessmentGateVariant } from '@/lib/analytics/abTests'

export default async function AssessPage() {
  const gateVariant = await getAssessmentGateVariant()
  return <AssessClient gateVariant={gateVariant} />
}
