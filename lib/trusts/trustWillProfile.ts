import type { ProfileData } from '@/lib/trust-will-rules'

function mapDomicileRisk(riskLevel: string | null | undefined): ProfileData['domicileRisk'] {
  if (riskLevel === 'low') return 'low'
  if (riskLevel === 'medium') return 'moderate'
  if (riskLevel === 'high') return 'high'
  if (riskLevel === 'critical') return 'critical'
  return 'moderate'
}

function isMinorChild(dob: string | null, relationship: string): boolean {
  if (!dob) return false
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return false
  const ageMs = Date.now() - birth.getTime()
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000)
  if (ageYears >= 18) return false
  const rel = relationship.toLowerCase()
  return rel.includes('child') || rel === 'son' || rel === 'daughter' || rel === 'stepchild'
}

export function buildTrustWillProfile(input: {
  grossEstate: number
  hasSpouse: boolean
  hasExistingTrust: boolean
  hasBusinessInterests: boolean
  domicileRiskLevel: string | null | undefined
  householdPeople: Array<{ date_of_birth: string | null; relationship: string }>
}): ProfileData {
  return {
    estateValue: input.grossEstate,
    isMarried: input.hasSpouse,
    hasMinorChildren: input.householdPeople.some((p) =>
      isMinorChild(p.date_of_birth, p.relationship),
    ),
    domicileRisk: mapDomicileRisk(input.domicileRiskLevel),
    hasExistingTrust: input.hasExistingTrust,
    hasBusinessInterests: input.hasBusinessInterests,
  }
}
