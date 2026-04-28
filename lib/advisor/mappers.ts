import type { DbStateExemption } from '@/lib/projection/stateRegistry'
import type { StateBracket } from '@/lib/calculations/stateEstateTax'
import type { StateIncomeTaxBracket } from '@/lib/domicile/moveBreakeven'
import type { BeneficiaryAccessGrant } from '@/lib/types/beneficiary-grant'
import type { DomicileScheduleRow } from '@/lib/projection/domicileEngine'
import type { ClientViewShellProps } from '@/app/advisor/clients/[clientId]/_client-view-shell'
import type { AdvisorClientDatasetsResult } from '@/lib/advisor/loaders'

type AssetRow = { id: string; type?: string | null } & Record<string, unknown>
type BeneficiaryRow = {
  id: string
  full_name: string
  relationship: string | null
  allocation_pct: number | null
  beneficiary_type: string | null
  asset_id: string | null
  real_estate_id: string | null
  insurance_policy_id: string | null
  business_id: string | null
  created_at: string | null
}

type AdvisorMapperInput = Pick<
  AdvisorClientDatasetsResult,
  | 'assetsResult'
  | 'realEstateResult'
  | 'beneficiariesResult'
  | 'estateDocumentsResult'
  | 'legalDocumentsResult'
  | 'notesResult'
  | 'estateTaxResult'
  | 'scenarioResult'
  | 'domicileAnalysisResult'
  | 'domicileScheduleResult'
  | 'businessesResult'
  | 'liabilitiesResult'
  | 'businessInterestsResult'
  | 'insurancePoliciesResult'
  | 'stateExemptionsResult'
  | 'stateBracketsResult'
  | 'stateTaxRulesAllYearsResult'
  | 'stateIncomeTaxBracketsResult'
  | 'beneficiaryGrantsResult'
>

type AdvisorMappedDatasets = {
  assets: AssetRow[]
  realEstate: Record<string, unknown>[]
  beneficiaries: Array<{
    id: string
    name: string
    relationship: string | null
    allocation_pct: number | null
    account_type: string | null
    contingent: boolean
    created_at: string | null
  }>
  estateDocuments: Record<string, unknown>[]
  legalDocuments: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  estateTax: Record<string, unknown> | null
  scenario: Record<string, unknown> | null
  scenarioOutputs: Array<Record<string, unknown>>
  scenarioOutputsSecondDeath: Array<Record<string, unknown>>
  latestOutput: Record<string, unknown> | null
  assumptionSnapshot: Record<string, unknown>
  domicileAnalysis: Record<string, unknown> | null
  domicileSchedule: DomicileScheduleRow[]
  businesses: NonNullable<ClientViewShellProps['businesses']>
  liabilities: NonNullable<ClientViewShellProps['liabilities']>
  businessInterests: NonNullable<ClientViewShellProps['businessInterests']>
  insurancePolicies: NonNullable<ClientViewShellProps['insurancePolicies']>
  stateExemptions: DbStateExemption[]
  stateBrackets: StateBracket[]
  stateTaxRulesAllYears: Array<{
    state: string
    tax_year: number
    min_amount: number
    max_amount: number
    rate_pct: number
    exemption_amount: number
  }>
  stateIncomeTaxBrackets: StateIncomeTaxBracket[]
  beneficiaryGrants: BeneficiaryAccessGrant[]
}

export function mapAdvisorClientDatasets(results: AdvisorMapperInput): AdvisorMappedDatasets {
  const assets = (results.assetsResult.data ?? []) as AssetRow[]
  const realEstate = (results.realEstateResult.data ?? []) as Record<string, unknown>[]
  const beneficiaries = ((results.beneficiariesResult.data ?? []) as BeneficiaryRow[]).map((b) => {
    const linkedAsset = assets.find((a) => a.id === b.asset_id)
    const linkedType = (linkedAsset?.type ?? '').toLowerCase()
    const accountType =
      linkedType ||
      (b.real_estate_id ? 'real_estate' : b.insurance_policy_id ? 'insurance' : b.business_id ? 'business' : null)
    return {
      id: b.id,
      name: b.full_name,
      relationship: b.relationship,
      allocation_pct: b.allocation_pct,
      account_type: accountType,
      contingent: b.beneficiary_type === 'contingent',
      created_at: b.created_at,
    }
  })

  const scenario = (results.scenarioResult.data ?? null) as Record<string, unknown> | null
  const scenarioOutputs = (
    scenario && Array.isArray(scenario.outputs_s1_first) && scenario.outputs_s1_first.length > 0
      ? scenario.outputs_s1_first
      : scenario && Array.isArray(scenario.outputs)
        ? scenario.outputs
        : []
  ) as Array<Record<string, unknown>>
  const scenarioOutputsSecondDeath = (
    scenario && Array.isArray(scenario.outputs_s2_first) && scenario.outputs_s2_first.length > 0
      ? scenario.outputs_s2_first
      : scenarioOutputs
  ) as Array<Record<string, unknown>>
  const latestOutput = scenarioOutputs.length > 0 ? scenarioOutputs[0] : null
  const assumptionSnapshot = (scenario?.assumption_snapshot ?? {}) as Record<string, unknown>

  return {
    assets,
    realEstate,
    beneficiaries,
    estateDocuments: (results.estateDocumentsResult.data ?? []) as Record<string, unknown>[],
    legalDocuments: (results.legalDocumentsResult.data ?? []) as Record<string, unknown>[],
    notes: (results.notesResult.data ?? []) as Record<string, unknown>[],
    estateTax: (results.estateTaxResult.data ?? null) as Record<string, unknown> | null,
    scenario,
    scenarioOutputs,
    scenarioOutputsSecondDeath,
    latestOutput,
    assumptionSnapshot,
    domicileAnalysis: results.domicileAnalysisResult.data ?? null,
    domicileSchedule: (results.domicileScheduleResult.data ?? []) as DomicileScheduleRow[],
    businesses: (results.businessesResult.data ?? []) as NonNullable<ClientViewShellProps['businesses']>,
    liabilities: (results.liabilitiesResult.data ?? []) as NonNullable<ClientViewShellProps['liabilities']>,
    businessInterests: (results.businessInterestsResult.data ?? []) as NonNullable<ClientViewShellProps['businessInterests']>,
    insurancePolicies: (results.insurancePoliciesResult.data ?? []) as NonNullable<ClientViewShellProps['insurancePolicies']>,
    stateExemptions: (results.stateExemptionsResult.data ?? []) as DbStateExemption[],
    stateBrackets: (results.stateBracketsResult.data ?? []) as StateBracket[],
    stateTaxRulesAllYears: (results.stateTaxRulesAllYearsResult.data ?? []) as AdvisorMappedDatasets['stateTaxRulesAllYears'],
    stateIncomeTaxBrackets: (results.stateIncomeTaxBracketsResult.data ?? []) as StateIncomeTaxBracket[],
    beneficiaryGrants: (results.beneficiaryGrantsResult.data ?? []) as BeneficiaryAccessGrant[],
  }
}
