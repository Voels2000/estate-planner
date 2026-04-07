import { createAdminClient } from '@/lib/supabase/admin'

export type HealthScoreComponent = {
  key: string
  label: string
  score: number
  maxScore: number
  status: 'good' | 'warning' | 'critical'
  actionLabel: string
  actionHref: string
}

export type EstateHealthScore = {
  score: number
  components: HealthScoreComponent[]
  computedAt: string
}

export async function computeEstateHealthScore(
  householdId: string,
  ownerId: string,
): Promise<EstateHealthScore> {
  const admin = createAdminClient()

  const [
    { data: household },
    { data: healthCheck },
    { data: assets },
    { data: beneficiaries },
    { data: estateDocuments },
    { data: domicile },
  ] = await Promise.all([
    admin
      .from('households')
      .select('has_spouse, state_primary, person1_birth_year, person2_birth_year, filing_status')
      .eq('id', householdId)
      .single(),
    admin
      .from('estate_health_check')
      .select('has_will, has_trust, has_poa, has_hcd, beneficiaries_current')
      .eq('household_id', householdId)
      .maybeSingle(),
    admin.from('assets').select('id, value, owner').eq('owner_id', ownerId),
    admin.from('beneficiaries').select('id, allocation_pct, contingent').eq('owner_id', ownerId),
    admin.from('estate_documents').select('document_type, exists').eq('owner_id', ownerId),
    admin.from('domicile_analysis').select('risk_score, risk_level').eq('household_id', householdId).maybeSingle(),
  ])

  const components: HealthScoreComponent[] = []

  const hasWill =
    healthCheck?.has_will === true || estateDocuments?.some((d) => d.document_type === 'will' && d.exists)
  const hasTrust =
    healthCheck?.has_trust === true || estateDocuments?.some((d) => d.document_type === 'trust' && d.exists)
  const docScore = hasWill && hasTrust ? 20 : hasWill || hasTrust ? 12 : 0
  components.push({
    key: 'documents',
    label: 'Estate Documents',
    score: docScore,
    maxScore: 20,
    status: docScore >= 20 ? 'good' : docScore >= 12 ? 'warning' : 'critical',
    actionLabel: docScore >= 20 ? 'Documents on file' : 'Add estate documents',
    actionHref: '/titling',
  })

  const hasPOA =
    healthCheck?.has_poa === true || estateDocuments?.some((d) => d.document_type === 'poa' && d.exists)
  const hasHCD =
    healthCheck?.has_hcd === true ||
    estateDocuments?.some((d) => d.document_type === 'healthcare_directive' && d.exists)
  const incapacityScore = hasPOA && hasHCD ? 15 : hasPOA || hasHCD ? 8 : 0
  components.push({
    key: 'incapacity',
    label: 'Incapacity Planning',
    score: incapacityScore,
    maxScore: 15,
    status: incapacityScore >= 15 ? 'good' : incapacityScore >= 8 ? 'warning' : 'critical',
    actionLabel: incapacityScore >= 15 ? 'POA & healthcare directive on file' : 'Add incapacity documents',
    actionHref: '/incapacity',
  })

  const primaryBenes = (beneficiaries ?? []).filter((b) => !b.contingent)
  const contingentBenes = (beneficiaries ?? []).filter((b) => b.contingent)
  const primaryTotal = primaryBenes.reduce((s, b) => s + (b.allocation_pct ?? 0), 0)
  const hasBeneficiaries =
    healthCheck?.beneficiaries_current === true || (primaryBenes.length > 0 && Math.round(primaryTotal) === 100)
  const hasContingent = contingentBenes.length > 0
  const beneScore = hasBeneficiaries && hasContingent ? 20 : hasBeneficiaries ? 13 : primaryBenes.length > 0 ? 6 : 0
  components.push({
    key: 'beneficiaries',
    label: 'Beneficiary Designations',
    score: beneScore,
    maxScore: 20,
    status: beneScore >= 20 ? 'good' : beneScore >= 13 ? 'warning' : 'critical',
    actionLabel: beneScore >= 20 ? 'Beneficiaries current' : 'Review beneficiaries',
    actionHref: '/titling',
  })

  const totalAssets = (assets ?? []).length
  const titlingScore = totalAssets >= 3 ? 15 : totalAssets >= 1 ? 8 : 0
  components.push({
    key: 'titling',
    label: 'Asset Titling',
    score: titlingScore,
    maxScore: 15,
    status: titlingScore >= 15 ? 'good' : titlingScore >= 8 ? 'warning' : 'critical',
    actionLabel: titlingScore >= 15 ? 'Assets documented' : 'Document your assets',
    actionHref: '/assets',
  })

  const hasDomicile = household?.state_primary != null
  const domicileRisk = domicile?.risk_level
  const domicileScore = !hasDomicile
    ? 0
    : domicileRisk === 'low'
      ? 15
      : domicileRisk === 'medium'
        ? 9
        : domicileRisk === 'high'
          ? 3
          : hasDomicile
            ? 9
            : 0
  components.push({
    key: 'domicile',
    label: 'Domicile Clarity',
    score: domicileScore,
    maxScore: 15,
    status: domicileScore >= 15 ? 'good' : domicileScore >= 9 ? 'warning' : 'critical',
    actionLabel: domicileScore >= 15 ? 'Domicile clear' : 'Review domicile',
    actionHref: '/domicile-analysis',
  })

  const totalAssetValue = (assets ?? []).reduce((s, a) => s + Number(a.value ?? 0), 0)
  const hasEstateTaxAwareness = totalAssetValue > 0
  const estateTaxScore =
    totalAssetValue >= 1_000_000 ? (hasEstateTaxAwareness ? 10 : 0) : totalAssetValue > 0 ? 15 : 5
  components.push({
    key: 'estate_tax',
    label: 'Estate Tax Awareness',
    score: estateTaxScore,
    maxScore: 15,
    status: estateTaxScore >= 15 ? 'good' : estateTaxScore >= 10 ? 'warning' : 'critical',
    actionLabel: estateTaxScore >= 15 ? 'Estate tax reviewed' : 'Review estate tax exposure',
    actionHref: '/estate-tax',
  })

  const totalScore = Math.min(
    100,
    components.reduce((s, c) => s + c.score, 0),
  )

  const componentScores = Object.fromEntries(components.map((c) => [c.key, { score: c.score, maxScore: c.maxScore }]))

  await admin
    .from('estate_health_scores')
    .upsert(
      {
        household_id: householdId,
        score: totalScore,
        component_scores: componentScores,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id' },
    )

  return {
    score: totalScore,
    components,
    computedAt: new Date().toISOString(),
  }
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200'
  if (score >= 50) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

export function scoreLabel(score: number): string {
  if (score >= 75) return 'Strong'
  if (score >= 50) return 'Needs Attention'
  return 'At Risk'
}
