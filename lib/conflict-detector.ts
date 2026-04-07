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

// Rule 1: No primary beneficiary designated on any asset
function ruleNoBeneficiary(assets: any[], beneficiaries: any[]): Conflict[] {
  const conflicts: Conflict[] = []
  const assetsWithPrimary = new Set(beneficiaries.filter((b) => !b.contingent && b.asset_id).map((b) => b.asset_id))
  for (const asset of assets) {
    if (!assetsWithPrimary.has(asset.id)) {
      conflicts.push({
        conflict_type: 'no_primary_beneficiary',
        severity: 'warning',
        asset_id: asset.id,
        real_estate_id: null,
        description: `"${asset.name}" has no primary beneficiary designated. This asset may pass through probate.`,
        recommended_action: 'Add a primary beneficiary designation to this asset.',
      })
    }
  }
  return conflicts
}

// Rule 2: Primary beneficiary allocations do not total 100%
function ruleAllocationNotHundred(assets: any[], beneficiaries: any[]): Conflict[] {
  const conflicts: Conflict[] = []
  for (const asset of assets) {
    const primaries = beneficiaries.filter((b) => !b.contingent && b.asset_id === asset.id)
    if (primaries.length === 0) continue
    const total = primaries.reduce((s: number, b: any) => s + Number(b.allocation_pct ?? 0), 0)
    if (Math.abs(total - 100) > 0.5) {
      conflicts.push({
        conflict_type: 'allocation_not_100',
        severity: 'critical',
        asset_id: asset.id,
        real_estate_id: null,
        description: `"${asset.name}" primary beneficiaries total ${total.toFixed(1)}% - must equal 100%.`,
        recommended_action: 'Adjust beneficiary allocations so primary beneficiaries total exactly 100%.',
      })
    }
  }
  return conflicts
}

// Rule 3: No contingent beneficiary (risk of lapse)
function ruleNoContingentBeneficiary(assets: any[], beneficiaries: any[]): Conflict[] {
  const conflicts: Conflict[] = []
  const assetsWithPrimary = new Set(beneficiaries.filter((b) => !b.contingent && b.asset_id).map((b) => b.asset_id))
  const assetsWithContingent = new Set(beneficiaries.filter((b) => b.contingent && b.asset_id).map((b) => b.asset_id))
  for (const asset of assets) {
    if (assetsWithPrimary.has(asset.id) && !assetsWithContingent.has(asset.id)) {
      conflicts.push({
        conflict_type: 'no_contingent_beneficiary',
        severity: 'warning',
        asset_id: asset.id,
        real_estate_id: null,
        description: `"${asset.name}" has no contingent beneficiary. If the primary beneficiary predeceases, assets may go through probate.`,
        recommended_action: 'Add a contingent beneficiary to protect against lapse.',
      })
    }
  }
  return conflicts
}

// Rule 4: Sole ownership on married estate (probate exposure)
function ruleSoleOwnershipMarried(assets: any[], realEstate: any[], hasSpouse: boolean): Conflict[] {
  if (!hasSpouse) return []
  const conflicts: Conflict[] = []

  for (const asset of assets) {
    if (asset.owner === 'person1' || asset.owner === 'person2') {
      // Only flag if titling is explicitly sole or not set
      const titling = asset.titling
      if (!titling || titling === 'individual_p1' || titling === 'individual_p2') {
        conflicts.push({
          conflict_type: 'sole_ownership_married',
          severity: 'warning',
          asset_id: asset.id,
          real_estate_id: null,
          description: `"${asset.name}" is titled in one spouse's name only. This may create probate exposure and estate planning inefficiencies.`,
          recommended_action: 'Review whether this asset should be jointly titled, held in trust, or have a TOD designation added.',
        })
      }
    }
  }

  for (const re of realEstate) {
    if (re.owner === 'person1' || re.owner === 'person2') {
      conflicts.push({
        conflict_type: 'sole_ownership_real_estate',
        severity: 'critical',
        asset_id: null,
        real_estate_id: re.id,
        description: `"${re.name}" is real estate titled in one spouse's name only. This is a high-priority probate and estate tax exposure.`,
        recommended_action: 'Consider retitling as joint tenants with right of survivorship (JTWROS) or transferring to a revocable living trust.',
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
      description:
        'Estate value exceeds $1M with no trust on file. Assets may be subject to probate and estate tax exposure without proper structure.',
      recommended_action: hasWill
        ? 'Consider establishing a revocable living trust to avoid probate and provide more flexible estate distribution.'
        : 'Establish both a will and a revocable living trust. Consult an estate attorney.',
    },
  ]
}

// -- Main detector -----------------------------------------------------------

export async function detectConflicts(householdId: string, ownerId: string): Promise<ConflictReport> {
  const admin = createAdminClient()

  const [{ data: assets }, { data: realEstate }, { data: beneficiaries }, { data: healthCheck }] = await Promise.all([
    admin.from('assets').select('id, name, type, value, owner, titling, liquidity').eq('owner_id', ownerId),
    admin
      .from('real_estate')
      .select('id, name, current_value, mortgage_balance, owner, is_primary_residence, situs_state')
      .eq('owner_id', ownerId),
    admin
      .from('asset_beneficiaries')
      .select('id, asset_id, real_estate_id, beneficiary_type, full_name, allocation_pct, contingent')
      .eq('owner_id', ownerId),
    admin
      .from('estate_health_check')
      .select('has_will, has_trust, has_poa, has_hcd, beneficiaries_current')
      .eq('household_id', householdId)
      .maybeSingle(),
  ])

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
  await admin.from('household_alerts').delete().eq('household_id', householdId).eq('alert_type', 'beneficiary_conflict')

  if (allConflicts.length > 0) {
    await admin.from('household_alerts').insert(
      allConflicts.map((c) => ({
        household_id: householdId,
        alert_type: 'beneficiary_conflict',
        severity: c.severity,
        title: conflictTitle(c.conflict_type),
        description: c.description,
        action_href: '/titling',
        action_label: 'Review in Titling & Beneficiaries',
        updated_at: new Date().toISOString(),
      })),
    )
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
    no_primary_beneficiary: 'Missing Beneficiary',
    allocation_not_100: 'Beneficiary Allocation Error',
    no_contingent_beneficiary: 'No Contingent Beneficiary',
    sole_ownership_married: 'Sole Ownership - Married Estate',
    sole_ownership_real_estate: 'Real Estate Titling Gap',
    large_estate_no_trust: 'Large Estate Without Trust',
  }
  return titles[type] ?? 'Estate Planning Issue'
}
