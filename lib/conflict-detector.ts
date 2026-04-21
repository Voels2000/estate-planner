// lib/conflict-detector.ts
// 5-rule beneficiary conflict detector + asset titling gap analyzer (Sprint 58)
// All output is data - no UI concerns here.

import { createAdminClient } from '@/lib/supabase/admin'

export type ConflictSeverity = 'critical' | 'warning' | 'info'

export type Conflict = {
  conflict_type: string
  severity: ConflictSeverity
  asset_id: string | null
  real_estate_id: string | null
  description: string
  recommended_action: string
}

export type ConflictReport = {
  conflicts: Conflict[]
  critical: number
  warnings: number
  computedAt: string
}

// -- Rule definitions --------------------------------------------------------

function getBeneficiaryGapCounts(assets: any[], beneficiaries: any[]) {
  const assetsWithPrimary = new Set(
    beneficiaries.filter((b) => b.beneficiary_type === 'primary' && b.asset_id).map((b) => b.asset_id),
  )
  const assetsWithContingent = new Set(
    beneficiaries.filter((b) => b.beneficiary_type === 'contingent' && b.asset_id).map((b) => b.asset_id),
  )

  const missingPrimary = assets.filter((asset) => !assetsWithPrimary.has(asset.id))
  const missingContingent = assets.filter((asset) => assetsWithPrimary.has(asset.id) && !assetsWithContingent.has(asset.id))

  return {
    missingPrimaryCount: missingPrimary.length,
    missingContingentCount: missingContingent.length,
  }
}

// Rule 1: No primary beneficiary designated on any asset
function ruleNoBeneficiary(assets: any[], beneficiaries: any[]): Conflict[] {
  const conflicts: Conflict[] = []
  const { missingPrimaryCount, missingContingentCount } = getBeneficiaryGapCounts(assets, beneficiaries)
  if (missingPrimaryCount > 0) {
    conflicts.push({
      conflict_type: 'no_primary_beneficiary',
      severity: 'warning',
      asset_id: null,
      real_estate_id: null,
      description: `${missingPrimaryCount} account${missingPrimaryCount !== 1 ? 's have' : ' has'} no primary beneficiary and ${missingContingentCount} account${missingContingentCount !== 1 ? 's have' : ' has'} no contingent beneficiary on file.`,
      recommended_action: 'A primary beneficiary designation is worth reviewing for these accounts.',
    })
  }
  return conflicts
}

// Rule 2: Primary beneficiary allocations do not total 100%
function ruleAllocationNotHundred(assets: any[], beneficiaries: any[]): Conflict[] {
  const conflicts: Conflict[] = []
  for (const asset of assets) {
    const primaries = beneficiaries.filter((b) => b.beneficiary_type === 'primary' && b.asset_id === asset.id)
    if (primaries.length === 0) continue
    const total = primaries.reduce((s: number, b: any) => s + Number(b.allocation_pct ?? 0), 0)
    if (Math.abs(total - 100) > 0.5) {
      conflicts.push({
        conflict_type: 'allocation_not_100',
        severity: 'critical',
        asset_id: asset.id,
        real_estate_id: null,
        description: `"${asset.name}" primary beneficiary allocations total ${total.toFixed(1)}% — a designation totaling 100% is typically required.`,
        recommended_action: 'Reviewing the allocation split with your advisor or attorney may be worthwhile.',
      })
    }
  }
  return conflicts
}

// Rule 3: No contingent beneficiary (risk of lapse)
function ruleNoContingentBeneficiary(assets: any[], beneficiaries: any[]): Conflict[] {
  const conflicts: Conflict[] = []
  const { missingPrimaryCount, missingContingentCount } = getBeneficiaryGapCounts(assets, beneficiaries)
  if (missingContingentCount > 0) {
    conflicts.push({
      conflict_type: 'no_contingent_beneficiary',
      severity: 'warning',
      asset_id: null,
      real_estate_id: null,
      description: `${missingPrimaryCount} account${missingPrimaryCount !== 1 ? 's have' : ' has'} no primary beneficiary and ${missingContingentCount} account${missingContingentCount !== 1 ? 's have' : ' has'} no contingent beneficiary on file.`,
      recommended_action: 'A contingent designation is worth discussing with your advisor.',
    })
  }
  return conflicts
}

// Rule 4: Sole ownership on married estate (probate exposure)
function ruleSoleOwnershipMarried(assets: any[], realEstate: any[], hasSpouse: boolean): Conflict[] {
  if (!hasSpouse) return []
  const conflicts: Conflict[] = []

  const soleOwnedAssets = assets.filter((asset) => {
    if (asset.owner !== 'person1' && asset.owner !== 'person2') return false
    const titling = asset.titling
    return !titling || titling === 'individual_p1' || titling === 'individual_p2'
  })

  if (soleOwnedAssets.length > 0) {
    conflicts.push({
      conflict_type: 'sole_ownership_married',
      severity: 'warning',
      asset_id: null,
      real_estate_id: null,
      description: `${soleOwnedAssets.length} account${soleOwnedAssets.length !== 1 ? 's are' : ' is'} titled in one spouse's name only.`,
      recommended_action: 'Joint titling, trust ownership, or TOD designations are options worth reviewing with your attorney.',
    })
  }

  for (const re of realEstate) {
    if (re.owner === 'person1' || re.owner === 'person2') {
      conflicts.push({
        conflict_type: 'sole_ownership_real_estate',
        severity: 'critical',
        asset_id: null,
        real_estate_id: re.id,
        description: `"${re.name}" is real estate titled in one spouse's name only.`,
        recommended_action: 'Retitling options such as JTWROS or trust transfer are worth discussing with your estate attorney.',
      })
    }
  }

  return conflicts
}

// Rule 5: Asset in taxable estate without a plan (>$1M estates)
function ruleLargeEstateNoTrust(assets: any[], realEstate: any[], hasWill: boolean, hasTrust: boolean): Conflict[] {
  const totalAssets =
    assets.reduce((s: number, a: any) => s + Number(a.value ?? 0), 0) +
    realEstate.reduce((s: number, r: any) => s + Number(r.current_value ?? 0), 0)

  if (totalAssets < 1_000_000) return []
  if (hasTrust) return []

  return [
    {
      conflict_type: 'large_estate_no_trust',
      severity: hasTrust ? 'info' : hasWill ? 'warning' : 'critical',
      asset_id: null,
      real_estate_id: null,
      description: 'Estate value exceeds $1M with no trust on file.',
      recommended_action: hasWill
        ? 'A revocable living trust is one option worth discussing with your attorney to help avoid probate.'
        : 'Both a will and a revocable living trust are worth discussing with an estate attorney.',
    },
  ]
}

// -- Main detector -----------------------------------------------------------

export async function detectConflicts(householdId: string, ownerId: string): Promise<ConflictReport> {
  const admin = createAdminClient()

  const [{ data: assets }, { data: realEstate }, { data: healthCheck }] = await Promise.all([
    admin.from('assets').select('id, name, type, value, owner, titling, liquidity').eq('owner_id', ownerId),
    admin
      .from('real_estate')
      .select('id, name, current_value, mortgage_balance, owner, is_primary_residence, situs_state')
      .eq('owner_id', ownerId),
    admin
      .from('estate_health_check')
      .select('has_will, has_trust, has_poa, has_hcd, beneficiaries_current')
      .eq('household_id', householdId)
      .maybeSingle(),
  ])

  // Fetch beneficiaries by asset_id - owner_id is unreliable across auth contexts
  const assetIds = (assets ?? []).map((a) => a.id)
  const { data: beneficiaries } =
    assetIds.length > 0
      ? await admin
          .from('asset_beneficiaries')
          .select('id, asset_id, real_estate_id, beneficiary_type, full_name, allocation_pct')
          .in('asset_id', assetIds)
      : { data: [] }

  const { data: household } = await admin.from('households').select('has_spouse').eq('id', householdId).single()

  const hasSpouse = household?.has_spouse ?? false
  const hasWill = healthCheck?.has_will === true
  const hasTrust = healthCheck?.has_trust === true

  // Run all 5 rules
  const allConflicts: Conflict[] = [
    ...ruleNoBeneficiary(assets ?? [], beneficiaries ?? []),
    ...ruleAllocationNotHundred(assets ?? [], beneficiaries ?? []),
    ...ruleNoContingentBeneficiary(assets ?? [], beneficiaries ?? []),
    ...ruleSoleOwnershipMarried(assets ?? [], realEstate ?? [], hasSpouse),
    ...ruleLargeEstateNoTrust(assets ?? [], realEstate ?? [], hasWill, hasTrust),
  ]

  const critical = allConflicts.filter((c) => c.severity === 'critical').length
  const warnings = allConflicts.filter((c) => c.severity === 'warning').length

  // Persist conflicts - delete old, insert fresh
  await admin.from('beneficiary_conflicts').delete().eq('household_id', householdId)

  if (allConflicts.length > 0) {
    await admin.from('beneficiary_conflicts').insert(
      allConflicts.map((c) => ({
        household_id: householdId,
        ...c,
        updated_at: new Date().toISOString(),
      })),
    )
  }

  // Update health score conflict counts
  await admin
    .from('estate_health_scores')
    .update({
      critical_conflicts: critical,
      warning_conflicts: warnings,
      updated_at: new Date().toISOString(),
    })
    .eq('household_id', householdId)

  // Write household alerts for consumer dashboard
  const conflictRuleIds = [
    'conflict_no_primary_beneficiary',
    'conflict_allocation_not_100',
    'conflict_no_contingent_beneficiary',
    'conflict_sole_ownership_married',
    'conflict_sole_ownership_real_estate',
    'conflict_large_estate_no_trust',
  ]

  // Resolve all conflict-related rules before upserting current conflicts.
  for (const ruleId of conflictRuleIds) {
    await admin.rpc('resolve_household_alert', {
      p_household_id: householdId,
      p_rule_id: ruleId,
    })
  }

  // Upsert only currently triggered conflicts.
  for (const c of allConflicts) {
    const ruleId = `conflict_${c.conflict_type}`
    await admin.rpc('upsert_household_alert', {
      p_household_id: householdId,
      p_rule_id: ruleId,
      p_alert_type: 'beneficiary_conflict',
      p_severity: c.severity === 'critical' ? 'high' : c.severity,
      p_title: conflictTitle(c.conflict_type),
      p_description: c.description,
      p_action_href: '/titling',
      p_action_label: 'Review in Titling & Beneficiaries',
      p_context_data: { conflict_type: c.conflict_type, asset_id: c.asset_id },
    })
  }

  return {
    conflicts: allConflicts,
    critical,
    warnings,
    computedAt: new Date().toISOString(),
  }
}

function conflictTitle(type: string): string {
  const titles: Record<string, string> = {
    no_primary_beneficiary: 'Beneficiary Gaps: Primary / Contingent',
    allocation_not_100: 'Beneficiary Allocation Error',
    no_contingent_beneficiary: 'Beneficiary Gaps: Primary / Contingent',
    sole_ownership_married: 'Sole Ownership - Married Estate',
    sole_ownership_real_estate: 'Real Estate Titling Gap',
    large_estate_no_trust: 'Large Estate Without Trust',
  }
  return titles[type] ?? 'Estate Planning Issue'
}
