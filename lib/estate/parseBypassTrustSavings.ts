import { stateHasNoPortability } from '@/lib/calculations/stateEstateTax'

export { stateHasNoPortability }

type BypassRecommendation = {
  branch: string
  reason: string
}

export function parseBypassTrustSavings(
  recommendations: BypassRecommendation[] | null | undefined,
  grossEstate: number | undefined,
  stateExemption: number | null,
  noPortability: boolean,
): number {
  const rec = recommendations?.find((r) => r.branch === 'bypass_trust')
  if (!rec) return 0

  const byMatch = rec.reason.match(/by (\$[\d,]+)/i)
  if (byMatch) {
    return parseInt(byMatch[1].replace(/[$,]/g, ''), 10)
  }

  const dollarMatches = rec.reason.match(/\$[\d,]+/g)
  if (dollarMatches?.length) {
    const last = dollarMatches[dollarMatches.length - 1]
    return parseInt(last.replace(/[$,]/g, ''), 10)
  }

  if (noPortability && stateExemption && grossEstate && grossEstate > stateExemption) {
    return Math.round(Math.max(0, (grossEstate - stateExemption) * 0.10))
  }
  return 0
}
