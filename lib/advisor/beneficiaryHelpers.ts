// Shared beneficiary data helpers for PDF export (and future EstateTab reuse).
// No React imports — pure data transformation.

export interface AssetBeneficiaryRow {
  id: string
  full_name: string | null
  relationship: string | null
  allocation_pct: number | null
  beneficiary_type: 'primary' | 'contingent' | string
  asset_id: string | null
  real_estate_id: string | null
  insurance_policy_id: string | null
  business_id: string | null
}

export interface BeneficiaryPerson {
  name: string
  relationship: string
  allocationPct: number
  type: 'primary' | 'contingent'
}

export type BeneficiaryStatus = 'complete' | 'missing_primary' | 'missing_contingent' | 'no_data'

export interface BeneficiaryAccountGroup {
  accountId: string
  accountName: string
  accountType: string
  estimatedValue: number
  owner: string
  primaryBenes: BeneficiaryPerson[]
  contingentBenes: BeneficiaryPerson[]
  status: BeneficiaryStatus
}

export interface BeneficiarySummary {
  totalAccounts: number
  completeCount: number
  missingPrimaryCount: number
  missingContingentCount: number
  noDataCount: number
  groups: BeneficiaryAccountGroup[]
}

function accountTypeLabel(assetType: string | null): string {
  const map: Record<string, string> = {
    retirement: 'Retirement account',
    '401k': '401(k)',
    ira: 'IRA',
    roth: 'Roth IRA',
    life_insurance: 'Life insurance',
    brokerage: 'Brokerage account',
    savings: 'Savings account',
    real_estate: 'Real estate',
    business: 'Business interest',
    education: '529 plan',
    '529': '529 plan',
    hsa: 'HSA',
    annuity: 'Annuity',
  }
  return map[assetType?.toLowerCase() ?? ''] ?? (assetType ?? 'Account')
}

function deriveStatus(primary: BeneficiaryPerson[], contingent: BeneficiaryPerson[]): BeneficiaryStatus {
  if (primary.length === 0) return 'missing_primary'
  if (contingent.length === 0) return 'missing_contingent'
  return 'complete'
}

function resolveOwnerLabel(
  ownerCode: string | null | undefined,
  person1Name?: string | null,
  person2Name?: string | null,
  fallback = 'Primary owner',
): string {
  if (!ownerCode) return person1Name ?? fallback
  const o = ownerCode.toLowerCase()
  if (o === 'person1' || o === 'primary' || o === 'p1') return person1Name ?? fallback
  if (o === 'person2' || o === 'spouse' || o === 'p2') return person2Name ?? 'Spouse'
  return ownerCode
}

export function buildBeneficiaryAccountGroups(params: {
  benRows: AssetBeneficiaryRow[]
  assets: Array<{
    id: string
    name?: string | null
    type?: string | null
    value?: number | null
    owner?: string | null
  }>
  realEstate?: Array<{ id: string; name?: string | null; address?: string | null; current_value?: number | null }>
  insurance?: Array<{ id: string; policy_name?: string | null; death_benefit?: number | null }>
  businesses?: Array<{ id: string; name?: string | null; business_name?: string | null; estimated_value?: number | null }>
  person1Name?: string | null
  person2Name?: string | null
}): BeneficiarySummary {
  const {
    benRows,
    assets,
    realEstate = [],
    insurance = [],
    businesses = [],
    person1Name,
    person2Name,
  } = params

  const assetMap = new Map(assets.map((a) => [a.id, a]))
  const reMap = new Map(realEstate.map((r) => [r.id, r]))
  const insMap = new Map(insurance.map((i) => [i.id, i]))
  const bizMap = new Map(businesses.map((b) => [b.id, b]))

  const groupMap = new Map<
    string,
    {
      accountId: string
      accountName: string
      accountType: string
      estimatedValue: number
      owner: string
      primary: BeneficiaryPerson[]
      contingent: BeneficiaryPerson[]
    }
  >()

  for (const row of benRows) {
    let accountId = ''
    let accountName = ''
    let accountType = ''
    let estimatedValue = 0
    let owner = person1Name ?? 'Primary owner'

    if (row.asset_id) {
      const a = assetMap.get(row.asset_id)
      accountId = row.asset_id
      accountName = a?.name ?? accountTypeLabel(a?.type ?? null)
      accountType = a?.type ?? 'account'
      estimatedValue = Number(a?.value ?? 0)
      owner = resolveOwnerLabel(a?.owner, person1Name, person2Name, owner)
    } else if (row.real_estate_id) {
      const r = reMap.get(row.real_estate_id)
      accountId = row.real_estate_id
      accountName = r?.address ?? r?.name ?? 'Real estate'
      accountType = 'real_estate'
      estimatedValue = Number(r?.current_value ?? 0)
    } else if (row.insurance_policy_id) {
      const i = insMap.get(row.insurance_policy_id)
      accountId = row.insurance_policy_id
      accountName = i?.policy_name ?? 'Life insurance'
      accountType = 'life_insurance'
      estimatedValue = Number(i?.death_benefit ?? 0)
    } else if (row.business_id) {
      const b = bizMap.get(row.business_id)
      accountId = row.business_id
      accountName = b?.business_name ?? b?.name ?? 'Business interest'
      accountType = 'business'
      estimatedValue = Number(b?.estimated_value ?? 0)
    } else {
      continue
    }

    if (!groupMap.has(accountId)) {
      groupMap.set(accountId, {
        accountId,
        accountName,
        accountType,
        estimatedValue,
        owner,
        primary: [],
        contingent: [],
      })
    }

    const group = groupMap.get(accountId)!
    const person: BeneficiaryPerson = {
      name: row.full_name ?? 'Unknown',
      relationship: row.relationship ?? '—',
      allocationPct: Number(row.allocation_pct ?? 0),
      type: row.beneficiary_type as 'primary' | 'contingent',
    }

    if (row.beneficiary_type === 'primary') {
      group.primary.push(person)
    } else {
      group.contingent.push(person)
    }
  }

  const groups: BeneficiaryAccountGroup[] = Array.from(groupMap.values()).map((g) => ({
    accountId: g.accountId,
    accountName: g.accountName,
    accountType: g.accountType,
    estimatedValue: g.estimatedValue,
    owner: g.owner,
    primaryBenes: g.primary,
    contingentBenes: g.contingent,
    status: deriveStatus(g.primary, g.contingent),
  }))

  const statusOrder: Record<BeneficiaryStatus, number> = {
    missing_primary: 0,
    missing_contingent: 1,
    no_data: 2,
    complete: 3,
  }
  groups.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  return {
    totalAccounts: groups.length,
    completeCount: groups.filter((g) => g.status === 'complete').length,
    missingPrimaryCount: groups.filter((g) => g.status === 'missing_primary').length,
    missingContingentCount: groups.filter((g) => g.status === 'missing_contingent').length,
    noDataCount: groups.filter((g) => g.status === 'no_data').length,
    groups,
  }
}
