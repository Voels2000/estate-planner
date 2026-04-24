// lib/conflict-detector.ts
// 5-rule beneficiary conflict detector + asset titling gap analyzer (Sprint 58)
// Session 34: Alert descriptions now name specific accounts so users can act
//             without hunting through the titling page.
//             - "Missing Primary Beneficiary" lists affected account names
//             - "Missing Contingent Beneficiary" lists affected account names
//             - "Beneficiary Allocation Error" names the specific account
//             - "large_estate_no_trust" title unified (was firing from two places)

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

type AssetRow = {
  id: string
  name: string | null
  value: number | string | null
  owner: string | null
  titling: string | null
}

type RealEstateRow = {
  id: string
  name: string | null
  current_value: number | string | null
  owner: string | null
}

type BeneficiaryRow = {
  asset_id: string | null
  beneficiary_type: string | null
  allocation_pct: number | string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a list of account names naturally: "A", "A and B", "A, B, and C", "A, B, and 2 others" */
function formatAccountList(names: string[], maxShow = 3): string {
  if (names.length === 0) return 'one or more accounts'
  if (names.length === 1) return `"${names[0]}"`
  if (names.length === 2) return `"${names[0]}" and "${names[1]}"`
  if (names.length <= maxShow) {
    const last = names[names.length - 1]
    const rest = names.slice(0, -1).map(n => `"${n}"`).join(', ')
    return `${rest}, and "${last}"`
  }
  const shown = names.slice(0, maxShow).map(n => `"${n}"`).join(', ')
  const remaining = names.length - maxShow
  return `${shown}, and ${remaining} other${remaining === 1 ? '' : 's'}`
}

function getBeneficiaryGapAccounts(
  assets: AssetRow[],
  beneficiaries: BeneficiaryRow[],
): {
  missingPrimary: { id: string; name: string }[]
  missingContingent: { id: string; name: string }[]
} {
  const assetsWithPrimary = new Set(
    beneficiaries
      .filter(b => b.beneficiary_type === 'primary' && b.asset_id)
      .map(b => b.asset_id),
  )
  const assetsWithContingent = new Set(
    beneficiaries
      .filter(b => b.beneficiary_type === 'contingent' && b.asset_id)
      .map(b => b.asset_id),
  )

  const missingPrimary = assets
    .filter(a => !assetsWithPrimary.has(a.id))
    .map(a => ({ id: a.id, name: a.name ?? 'Unnamed account' }))

  const missingContingent = assets
    .filter(a => assetsWithPrimary.has(a.id) && !assetsWithContingent.has(a.id))
    .map(a => ({ id: a.id, name: a.name ?? 'Unnamed account' }))

  return { missingPrimary, missingContingent }
}

// ─── Rule 1: No primary beneficiary ──────────────────────────────────────────

function ruleNoBeneficiary(assets: AssetRow[], beneficiaries: BeneficiaryRow[]): Conflict[] {
  const { missingPrimary } = getBeneficiaryGapAccounts(assets, beneficiaries)
  if (missingPrimary.length === 0) return []

  const accountList = formatAccountList(missingPrimary.map(a => a.name))
  const count = missingPrimary.length

  return [{
    conflict_type: 'no_primary_beneficiary',
    severity: 'warning',
    asset_id: null,
    real_estate_id: null,
    description: `${count} account${count !== 1 ? 's are' : ' is'} missing a primary beneficiary: ${accountList}. Without a primary beneficiary, these assets may pass through probate.`,
    recommended_action: 'Open Titling & Beneficiaries and add a primary beneficiary to each account listed above.',
  }]
}

// ─── Rule 2: Primary beneficiary allocations ≠ 100% ──────────────────────────

function ruleAllocationNotHundred(assets: AssetRow[], beneficiaries: BeneficiaryRow[]): Conflict[] {
  const conflicts: Conflict[] = []

  for (const asset of assets) {
    const primaries = beneficiaries.filter(
      b => b.beneficiary_type === 'primary' && b.asset_id === asset.id,
    )
    if (primaries.length === 0) continue
    const total = primaries.reduce((s: number, b) => s + Number(b.allocation_pct ?? 0), 0)
    if (Math.abs(total - 100) <= 0.5) continue

    conflicts.push({
      conflict_type: 'allocation_not_100',
      severity: 'critical',
      asset_id: asset.id,
      real_estate_id: null,
      description: `"${asset.name}" has primary beneficiary allocations totaling ${total.toFixed(1)}% — they must total exactly 100%. This can prevent the designation from being honored.`,
      recommended_action: `Open Titling & Beneficiaries, find "${asset.name}", and adjust the primary beneficiary allocations to total 100%.`,
    })
  }

  return conflicts
}

// ─── Rule 3: No contingent beneficiary ───────────────────────────────────────

function ruleNoContingentBeneficiary(assets: AssetRow[], beneficiaries: BeneficiaryRow[]): Conflict[] {
  const { missingContingent } = getBeneficiaryGapAccounts(assets, beneficiaries)
  if (missingContingent.length === 0) return []

  const accountList = formatAccountList(missingContingent.map(a => a.name))
  const count = missingContingent.length

  return [{
    conflict_type: 'no_contingent_beneficiary',
    severity: 'warning',
    asset_id: null,
    real_estate_id: null,
    description: `${count} account${count !== 1 ? 's have' : ' has'} a primary beneficiary but no contingent: ${accountList}. If the primary predeceases you, these assets may pass through probate.`,
    recommended_action: 'Open Titling & Beneficiaries and add a contingent beneficiary to each account listed above.',
  }]
}

// ─── Rule 4: Sole ownership on married estate ─────────────────────────────────

function ruleSoleOwnershipMarried(
  assets: AssetRow[],
  realEstate: RealEstateRow[],
  hasSpouse: boolean,
): Conflict[] {
  if (!hasSpouse) return []
  const conflicts: Conflict[] = []

  const soleOwnedAssets = assets.filter(asset => {
    if (asset.owner !== 'person1' && asset.owner !== 'person2') return false
    const titling = asset.titling
    return !titling || titling === 'individual_p1' || titling === 'individual_p2'
  })

  if (soleOwnedAssets.length > 0) {
    const accountList = formatAccountList(soleOwnedAssets.map(a => a.name ?? 'Unnamed account'))
    conflicts.push({
      conflict_type: 'sole_ownership_married',
      severity: 'warning',
      asset_id: null,
      real_estate_id: null,
      description: `${soleOwnedAssets.length} account${soleOwnedAssets.length !== 1 ? 's are' : ' is'} titled in one spouse's name only: ${accountList}. This may create probate exposure or complicate estate administration.`,
      recommended_action: 'Consider joint titling, trust ownership, or TOD designations. Review with your attorney.',
    })
  }

  for (const re of realEstate) {
    if (re.owner === 'person1' || re.owner === 'person2') {
      conflicts.push({
        conflict_type: 'sole_ownership_real_estate',
        severity: 'critical',
        asset_id: null,
        real_estate_id: re.id,
        description: `"${re.name}" is real estate titled in one spouse's name only. Real estate in sole ownership goes through probate and may require court involvement to transfer.`,
        recommended_action: 'Retitling options such as JTWROS or trust transfer are worth discussing with your estate attorney.',
      })
    }
  }

  return conflicts
}

// ─── Rule 5: Large estate without a trust ────────────────────────────────────

function ruleLargeEstateNoTrust(
  assets: AssetRow[],
  realEstate: RealEstateRow[],
  hasWill: boolean,
  hasTrust: boolean,
): Conflict[] {
  const totalAssets =
    assets.reduce((s: number, a) => s + Number(a.value ?? 0), 0) +
    realEstate.reduce((s: number, r) => s + Number(r.current_value ?? 0), 0)

  if (totalAssets < 1_000_000 || hasTrust) return []

  return [{
    conflict_type: 'large_estate_no_trust',
    severity: hasTrust ? 'info' : hasWill ? 'warning' : 'critical',
    asset_id: null,
    real_estate_id: null,
    description: `Your estate is approximately $${Math.round(totalAssets / 1_000).toLocaleString()}K with no revocable trust on file. Estates over $1M without a trust typically go through probate, which is public, slow, and costly.`,
    recommended_action: hasWill
      ? 'A revocable living trust is worth discussing with your attorney to help avoid probate and streamline distribution.'
      : 'Both a will and a revocable living trust are worth discussing with an estate attorney.',
  }]
}

// ─── Main detector ────────────────────────────────────────────────────────────

export async function detectConflicts(
  householdId: string,
  ownerId: string,
): Promise<ConflictReport> {
  const admin = createAdminClient()

  const [
    { data: assets },
    { data: realEstate },
    { data: healthCheck },
  ] = await Promise.all([
    admin
      .from('assets')
      .select('id, name, type, value, owner, titling, liquidity')
      .eq('owner_id', ownerId),
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

  const assetIds = (assets ?? []).map(a => a.id)
  const { data: beneficiaries } =
    assetIds.length > 0
      ? await admin
          .from('asset_beneficiaries')
          .select('id, asset_id, real_estate_id, beneficiary_type, full_name, allocation_pct')
          .in('asset_id', assetIds)
      : { data: [] }

  const { data: household } = await admin
    .from('households')
    .select('has_spouse')
    .eq('id', householdId)
    .single()

  const hasSpouse = household?.has_spouse ?? false
  const hasWill  = healthCheck?.has_will  === true
  const hasTrust = healthCheck?.has_trust === true

  const allConflicts: Conflict[] = [
    ...ruleNoBeneficiary(assets ?? [], beneficiaries ?? []),
    ...ruleAllocationNotHundred(assets ?? [], beneficiaries ?? []),
    ...ruleNoContingentBeneficiary(assets ?? [], beneficiaries ?? []),
    ...ruleSoleOwnershipMarried(assets ?? [], realEstate ?? [], hasSpouse),
    ...ruleLargeEstateNoTrust(assets ?? [], realEstate ?? [], hasWill, hasTrust),
  ]

  const critical = allConflicts.filter(c => c.severity === 'critical').length
  const warnings = allConflicts.filter(c => c.severity === 'warning').length

  // Persist conflicts — delete old, insert fresh
  await admin.from('beneficiary_conflicts').delete().eq('household_id', householdId)

  if (allConflicts.length > 0) {
    await admin.from('beneficiary_conflicts').insert(
      allConflicts.map(c => ({
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

  // ── Write household_alerts ────────────────────────────────────────────────
  // Resolve all conflict-related rules first, then upsert only active ones.
  // With the unique constraint from Session 34, each rule_id maps to exactly
  // one row — no more duplicates.

  const conflictRuleIds = [
    'conflict_no_primary_beneficiary',
    'conflict_allocation_not_100',
    'conflict_no_contingent_beneficiary',
    'conflict_sole_ownership_married',
    'conflict_sole_ownership_real_estate',
    'conflict_large_estate_no_trust',
  ]

  for (const ruleId of conflictRuleIds) {
    await admin.rpc('resolve_household_alert', {
      p_household_id: householdId,
      p_rule_id: ruleId,
    })
  }

  for (const c of allConflicts) {
    const ruleId = `conflict_${c.conflict_type}`
    await admin.rpc('upsert_household_alert', {
      p_household_id: householdId,
      p_rule_id: ruleId,
      p_alert_type: 'beneficiary_conflict',
      p_severity: c.severity === 'critical' ? 'high' : c.severity === 'warning' ? 'medium' : 'low',
      p_title: conflictTitle(c.conflict_type),
      p_description: c.description,
      p_action_href: '/titling',
      p_action_label: 'Open Titling & Beneficiaries',
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

// ─── Alert titles ─────────────────────────────────────────────────────────────
// Kept distinct so MeetingPrep and AlertCenter can display them clearly.

function conflictTitle(type: string): string {
  const titles: Record<string, string> = {
    no_primary_beneficiary:     'Missing Primary Beneficiary',
    allocation_not_100:         'Beneficiary Allocation Error',
    no_contingent_beneficiary:  'Missing Contingent Beneficiary',
    sole_ownership_married:     'Sole Ownership — Married Estate',
    sole_ownership_real_estate: 'Real Estate Titling Gap',
    large_estate_no_trust:      'Large Estate Without Trust',
  }
  return titles[type] ?? 'Estate Planning Issue'
}
