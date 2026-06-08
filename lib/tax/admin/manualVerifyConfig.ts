import { readFileSync } from 'fs'
import { join } from 'path'
import type { ManualVerifySection, TaxDomain } from '@/lib/tax/admin/types'

type ManualVerifyFile = {
  default?: Partial<ManualVerifySection>
  [year: string]: Partial<ManualVerifySection> | undefined
}

let cached: ManualVerifyFile | null = null

function loadFile(): ManualVerifyFile {
  if (cached) return cached
  const path = join(process.cwd(), 'data/tax-rollover/manual-verify.json')
  cached = JSON.parse(readFileSync(path, 'utf8')) as ManualVerifyFile
  return cached
}

export function getManualVerifyForYear(targetYear: number): ManualVerifySection {
  const file = loadFile()
  const base = file.default ?? {}
  const yearKey = String(targetYear)
  const yearOverride = file[yearKey] ?? {}

  return {
    alwaysVerify: (yearOverride.alwaysVerify ??
      base.alwaysVerify ??
      ['federal_tax_config', 'irmaa_brackets']) as TaxDomain[],
    stateEstate: yearOverride.stateEstate ?? base.stateEstate ?? [],
    stateIncome: yearOverride.stateIncome ?? base.stateIncome ?? [],
    notes: yearOverride.notes ?? base.notes,
  }
}

/** Reset cache in tests. */
export function resetManualVerifyCache(): void {
  cached = null
}
