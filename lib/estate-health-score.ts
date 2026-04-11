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

function normalizeName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function isPrimaryBeneficiaryRow(b: {
  contingent?: boolean | null
  beneficiary_type?: string | null
}): boolean {
  if (b.beneficiary_type === 'contingent') return false
  if (b.beneficiary_type === 'primary') return true
  return b.contingent !== true
}

function isContingencyBeneficiaryRow(b: {
  contingent?: boolean | null
  beneficiary_type?: string | null
}): boolean {
  if (b.beneficiary_type === 'contingent') return true
  return b.contingent === true
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
    { data: assetBenes },
    { data: estateDocuments },
    { data: domicile },
    { data: householdPeople },
    { data: assetTitlingRows },
  ] = await Promise.all([
    admin
      .from('households')
      .select(
        'has_spouse, state_primary, person1_birth_year, person2_birth_year, filing_status, base_case_scenario_id, person1_name, person2_name',
      )
      .eq('id', householdId)
      .single(),
    admin
      .from('estate_health_check')
      .select('has_will, has_trust, has_poa, has_hcd, beneficiaries_current')
      .eq('household_id', householdId)
      .maybeSingle(),
    admin.from('assets').select('id, value, owner, titling').eq('owner_id', ownerId),
    admin
      .from('asset_beneficiaries')
      .select('id, asset_id, allocation_pct, contingent, beneficiary_type, full_name')
      .eq('owner_id', ownerId),
    admin.from('estate_documents').select('document_type, exists').eq('owner_id', ownerId),
    admin.from('domicile_analysis').select('risk_score, risk_level').eq('household_id', householdId).maybeSingle(),
    admin.from('household_people').select('full_name').eq('household_id', householdId),
    admin.from('asset_titling').select('asset_id, title_type').eq('owner_id', ownerId),
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

  const benes = assetBenes ?? []
  const rosterNames = new Set<string>()
  for (const p of householdPeople ?? []) {
    const n = normalizeName(p.full_name)
    if (n) rosterNames.add(n)
  }
  for (const n of [household?.person1_name, household?.person2_name]) {
    const x = normalizeName(n as string | undefined)
    if (x) rosterNames.add(x)
  }

  const assetList = assets ?? []
  const assetTitlingByAssetId = new Map<string, { title_type: string }>()
  for (const row of assetTitlingRows ?? []) {
    const aid = row.asset_id as string | undefined
    if (aid) assetTitlingByAssetId.set(aid, { title_type: String(row.title_type ?? '') })
  }

  let primaryNamesOk = true
  if (rosterNames.size > 0) {
    const primaryRows = benes.filter((b) => b.asset_id && isPrimaryBeneficiaryRow(b))
    if (primaryRows.length > 0) {
      primaryNamesOk = primaryRows.every((b) => rosterNames.has(normalizeName(b.full_name as string)))
    }
  }

  let anyPrimary = false
  let allPrimaryComplete = true
  let allHaveContingent = true

  for (const asset of assetList) {
    const forAsset = benes.filter((b) => b.asset_id === asset.id)
    const primaries = forAsset.filter(isPrimaryBeneficiaryRow)
    const primarySum = primaries.reduce((s, b) => s + Number(b.allocation_pct ?? 0), 0)
    const primaryOk = primaries.length > 0 && Math.abs(primarySum - 100) <= 0.5
    if (primaries.length > 0) anyPrimary = true
    allPrimaryComplete = allPrimaryComplete && primaryOk

    const contingentRows = forAsset.filter(isContingencyBeneficiaryRow)
    const hasContingentForAsset = contingentRows.length > 0
    allHaveContingent = allHaveContingent && (!primaryOk || hasContingentForAsset)
  }

  const hasBeneficiaries =
    healthCheck?.beneficiaries_current === true ||
    (assetList.length > 0 && allPrimaryComplete) ||
    (assetList.length === 0 && anyPrimary)
  const hasContingent =
    healthCheck?.beneficiaries_current === true ||
    (assetList.length > 0 ? allHaveContingent : hasBeneficiaries)

  let beneScore = 0
  if (hasBeneficiaries && hasContingent && primaryNamesOk) beneScore = 20
  else if (hasBeneficiaries) beneScore = 13
  else if (anyPrimary) beneScore = 6
  else beneScore = 0

  components.push({
    key: 'beneficiaries',
    label: 'Beneficiary Designations',
    score: beneScore,
    maxScore: 20,
    status: beneScore >= 20 ? 'good' : beneScore >= 13 ? 'warning' : 'critical',
    actionLabel: beneScore >= 20 ? 'Beneficiaries current' : 'Review beneficiaries',
    actionHref: '/titling',
  })

  let titlingScore = 0
  if (assetList.length > 0) {
    let documented = 0
    let anyTrustOwned = false
    for (const a of assetList) {
      const row = assetTitlingByAssetId.get(a.id)
      const col = (a.titling as string | null | undefined)?.trim()
      const documentedHere = Boolean(row?.title_type) || Boolean(col)
      if (documentedHere) documented++
      const trustHere =
        a.titling === 'trust_owned' || (row?.title_type ?? '') === 'trust_owned'
      if (trustHere) anyTrustOwned = true
    }
    const ratio = documented / assetList.length
    titlingScore = Math.min(15, Math.round(ratio * 12) + (anyTrustOwned ? 3 : 0))
  }
  components.push({
    key: 'titling',
    label: 'Asset Titling',
    score: titlingScore,
    maxScore: 15,
    status: titlingScore >= 15 ? 'good' : titlingScore >= 8 ? 'warning' : 'critical',
    actionLabel: titlingScore >= 15 ? 'Titling coverage strong' : 'Document asset titling',
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

  const totalAssetValue = assetList.reduce((s, a) => s + Number(a.value ?? 0), 0)
  const hasBaseCase = Boolean(household?.base_case_scenario_id)

  let estateTaxScore: number
  if (hasBaseCase) {
    estateTaxScore = 15
  } else if (totalAssetValue >= 1_000_000) {
    estateTaxScore = 3
  } else if (totalAssetValue >= 250_000) {
    estateTaxScore = 8
  } else if (totalAssetValue > 0) {
    estateTaxScore = 12
  } else {
    estateTaxScore = 5
  }

  components.push({
    key: 'estate_tax',
    label: 'Estate Tax Awareness',
    score: estateTaxScore,
    maxScore: 15,
    status:
      estateTaxScore >= 13 ? 'good' : estateTaxScore >= 8 ? 'warning' : 'critical',
    actionLabel: hasBaseCase ? 'Base case on file' : 'Review estate tax exposure',
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
