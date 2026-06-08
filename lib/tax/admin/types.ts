export type TaxScanSeverity = 'error' | 'warn' | 'info'

export type TaxScanIssue = {
  id: string
  domain: TaxDomain
  severity: TaxScanSeverity
  message: string
  detail?: string
}

export type TaxDomain =
  | 'federal_tax_config'
  | 'federal_estate_tax_brackets'
  | 'federal_tax_brackets'
  | 'state_estate_tax_rules'
  | 'state_income_tax_brackets'
  | 'state_inheritance_tax_rules'
  | 'irmaa_brackets'

export type TaxScanResult = {
  taxYear: number
  scannedAt: string
  ok: boolean
  issues: TaxScanIssue[]
  summary: Record<TaxDomain, { rowCount: number; complete: boolean }>
}

export type ManualVerifySection = {
  alwaysVerify: TaxDomain[]
  stateEstate: string[]
  stateIncome: string[]
  notes?: string
}

export type TaxRolloverDraft = {
  sourceYear: number
  targetYear: number
  createdAt: string
  manualVerify: {
    sections: TaxDomain[]
    stateEstate: string[]
    stateIncome: string[]
    notes?: string
  }
  counts: Partial<Record<TaxDomain, number>>
  /** Rows to insert (ids stripped). federal_tax_config omitted — manual edit only. */
  payload: {
    federal_estate_tax_brackets: Record<string, unknown>[]
    federal_tax_brackets: Record<string, unknown>[]
    state_estate_tax_rules: Record<string, unknown>[]
    state_income_tax_brackets: Record<string, unknown>[]
    state_inheritance_tax_rules: Record<string, unknown>[]
    irmaa_brackets: Record<string, unknown>[]
  }
  targetYearAlreadyHasData: boolean
}

export type TaxApplyResult = {
  targetYear: number
  appliedAt: string
  appliedBy: string
  sections: TaxDomain[]
  rowsInserted: Partial<Record<TaxDomain, number>>
  rowsDeleted: Partial<Record<TaxDomain, number>>
}
