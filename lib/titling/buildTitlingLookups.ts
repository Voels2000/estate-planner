import type {
  AnyTitling,
  AssetTitling,
  Beneficiary,
  BusinessTitlingRow,
  InsurancePolicyTitling,
  RealEstateTitling,
  TitlingKind,
} from './types'

export type TitlingLookups = {
  assetTitlingByAssetId: Map<string, AssetTitling>
  realEstateTitlingById: Map<string, RealEstateTitling>
  insuranceTitlingByPolicyId: Map<string, InsurancePolicyTitling>
  businessTitlingById: Map<string, BusinessTitlingRow>
  /** key: `${kind}:${entityId}:${primary|contingent}` */
  beneficiariesByEntity: Map<string, Beneficiary[]>
  getTitling: (kind: TitlingKind, id: string) => AnyTitling | null
  getBeneficiaries: (kind: TitlingKind, id: string, type: 'primary' | 'contingent') => Beneficiary[]
}

function entityIdForBeneficiary(kind: TitlingKind, b: Beneficiary): string | null {
  if (kind === 'asset') return b.asset_id
  if (kind === 're') return b.real_estate_id
  if (kind === 'insurance') return b.insurance_policy_id
  return b.business_id
}

function beneficiaryKey(kind: TitlingKind, id: string, type: 'primary' | 'contingent'): string {
  return `${kind}:${id}:${type}`
}

export function beneficiaryMatchesEntity(
  kind: TitlingKind,
  entityId: string,
  b: Beneficiary,
): boolean {
  if (kind === 'asset') return b.asset_id === entityId
  if (kind === 're') return b.real_estate_id === entityId
  if (kind === 'insurance') return b.insurance_policy_id === entityId
  return b.business_id === entityId
}

export function buildTitlingLookups(params: {
  assetTitling: AssetTitling[]
  realEstateTitling: RealEstateTitling[]
  insurancePolicyTitling: InsurancePolicyTitling[]
  businessTitling: BusinessTitlingRow[]
  beneficiaries: Beneficiary[]
}): TitlingLookups {
  const assetTitlingByAssetId = new Map(params.assetTitling.map((t) => [t.asset_id, t]))
  const realEstateTitlingById = new Map(params.realEstateTitling.map((t) => [t.real_estate_id, t]))
  const insuranceTitlingByPolicyId = new Map(
    params.insurancePolicyTitling.map((t) => [t.insurance_policy_id, t]),
  )
  const businessTitlingById = new Map(params.businessTitling.map((t) => [t.business_id, t]))

  const beneficiariesByEntity = new Map<string, Beneficiary[]>()
  const kinds: TitlingKind[] = ['asset', 're', 'insurance', 'business']
  for (const b of params.beneficiaries) {
    for (const kind of kinds) {
      const entityId = entityIdForBeneficiary(kind, b)
      if (!entityId) continue
      const key = beneficiaryKey(kind, entityId, b.beneficiary_type)
      const list = beneficiariesByEntity.get(key)
      if (list) list.push(b)
      else beneficiariesByEntity.set(key, [b])
    }
  }

  const getTitling = (kind: TitlingKind, id: string): AnyTitling | null => {
    if (kind === 'asset') return assetTitlingByAssetId.get(id) ?? null
    if (kind === 're') return realEstateTitlingById.get(id) ?? null
    if (kind === 'insurance') return insuranceTitlingByPolicyId.get(id) ?? null
    return businessTitlingById.get(id) ?? null
  }

  const getBeneficiaries = (
    kind: TitlingKind,
    id: string,
    type: 'primary' | 'contingent',
  ): Beneficiary[] => beneficiariesByEntity.get(beneficiaryKey(kind, id, type)) ?? []

  return {
    assetTitlingByAssetId,
    realEstateTitlingById,
    insuranceTitlingByPolicyId,
    businessTitlingById,
    beneficiariesByEntity,
    getTitling,
    getBeneficiaries,
  }
}
