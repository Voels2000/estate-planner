import { buildTitlingLookups, beneficiaryMatchesEntity } from './buildTitlingLookups'
import type {
  AssetTitling,
  Beneficiary,
  BusinessTitlingRow,
  InsurancePolicyTitling,
  RealEstateTitling,
  TitlingKind,
} from './types'

type Asset = { id: string }
type RealEstateItem = { id: string }
type InsurancePolicyRow = { id: string }
type BusinessRow = { id: string }

const BENEFICIARY_EXEMPT_TITLE_TYPES = new Set(['joint_wros', 'community_property'])

export function getTitlingWarnings(params: {
  assets: Asset[]
  realEstate: RealEstateItem[]
  insurance: InsurancePolicyRow[]
  businesses: BusinessRow[]
  assetTitling: AssetTitling[]
  realEstateTitling: RealEstateTitling[]
  insurancePolicyTitling: InsurancePolicyTitling[]
  businessTitling: BusinessTitlingRow[]
  beneficiaries: Beneficiary[]
}): string[] {
  const {
    assets,
    realEstate,
    insurance,
    businesses,
    assetTitling,
    realEstateTitling,
    insurancePolicyTitling,
    businessTitling,
    beneficiaries,
  } = params

  const lookups = buildTitlingLookups({
    assetTitling,
    realEstateTitling,
    insurancePolicyTitling,
    businessTitling,
    beneficiaries,
  })

  const warnings: string[] = []

  const untitledAssets = assets.filter((a) => !lookups.assetTitlingByAssetId.has(a.id))
  if (untitledAssets.length > 0) {
    warnings.push(`${untitledAssets.length} asset(s) have no title type set`)
  }

  const untitledRE = realEstate.filter((r) => !lookups.realEstateTitlingById.has(r.id))
  if (untitledRE.length > 0) {
    warnings.push(`${untitledRE.length} property(ies) have no title type set`)
  }

  const untitledIns = insurance.filter((p) => !lookups.insuranceTitlingByPolicyId.has(p.id))
  if (untitledIns.length > 0) {
    warnings.push(`${untitledIns.length} insurance policy/policies have no title type set`)
  }

  const untitledBiz = businesses.filter((b) => !lookups.businessTitlingById.has(b.id))
  if (untitledBiz.length > 0) {
    warnings.push(`${untitledBiz.length} business interest(s) have no title type set`)
  }

  const needsPrimary = (
    items: { id: string; kind: TitlingKind }[],
    label: string,
  ) => {
    const missing = items.filter((item) => {
      const titling = lookups.getTitling(item.kind, item.id)
      if (titling && BENEFICIARY_EXEMPT_TITLE_TYPES.has(titling.title_type)) return false
      return lookups.getBeneficiaries(item.kind, item.id, 'primary').length === 0
    })
    if (missing.length > 0) {
      warnings.push(`${missing.length} ${label}`)
    }
  }

  needsPrimary(
    assets.map((a) => ({ id: a.id, kind: 'asset' as const })),
    'asset(s) have no primary beneficiary',
  )
  needsPrimary(
    insurance.map((p) => ({ id: p.id, kind: 'insurance' as const })),
    'insurance policy/policies have no primary beneficiary',
  )
  needsPrimary(
    businesses.map((b) => ({ id: b.id, kind: 'business' as const })),
    'business interest(s) have no primary beneficiary',
  )

  const allItems: { id: string; kind: TitlingKind }[] = [
    ...assets.map((a) => ({ id: a.id, kind: 'asset' as const })),
    ...realEstate.map((r) => ({ id: r.id, kind: 're' as const })),
    ...insurance.map((p) => ({ id: p.id, kind: 'insurance' as const })),
    ...businesses.map((b) => ({ id: b.id, kind: 'business' as const })),
  ]

  let allocationWarning = false
  for (const item of allItems) {
    if (allocationWarning) break
    for (const btype of ['primary', 'contingent'] as const) {
      const bens = beneficiaries.filter(
        (b) => b.beneficiary_type === btype && beneficiaryMatchesEntity(item.kind, item.id, b),
      )
      if (bens.length === 0) continue
      const total = bens.reduce((s, b) => s + Number(b.allocation_pct), 0)
      if (Math.abs(total - 100) > 0.01) {
        warnings.push(`${btype} beneficiary allocations for one or more items don't add up to 100%`)
        allocationWarning = true
        break
      }
    }
  }

  return [...new Set(warnings)]
}
