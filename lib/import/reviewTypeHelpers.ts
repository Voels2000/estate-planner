import {
  CANONICAL_ASSET_TYPES,
  CANONICAL_LIABILITY_TYPES,
  normalizeAssetType,
  normalizeLiabilityType,
} from './type-normalizer'
import type { ImportTable } from './ingestConfig'

export type RowTypeStatus = {
  rowIndex: number
  raw: string
  normalized: string | null
  matched: boolean
  displayLabel: string
}

/** Header mapped to the `type` DB field, if any. */
export function typeColumnHeader(fieldMap: Record<string, string>): string | null {
  for (const [header, dbField] of Object.entries(fieldMap)) {
    if (dbField === 'type') return header
  }
  return null
}

export function canonicalTypesForTable(table: string): string[] {
  if (table === 'assets') return CANONICAL_ASSET_TYPES
  if (table === 'liabilities') return CANONICAL_LIABILITY_TYPES
  return []
}

export function computeRowTypeStatuses(
  rows: Record<string, string>[],
  typeHeader: string | null,
  targetTable: ImportTable | string,
): RowTypeStatus[] {
  if (!typeHeader) return []
  const normalizer =
    targetTable === 'liabilities' ? normalizeLiabilityType : normalizeAssetType
  return rows.map((row, rowIndex) => {
    const raw = row[typeHeader]?.trim() ?? ''
    const { canonical, matched, displayLabel } = normalizer(raw)
    return { rowIndex, raw, normalized: canonical, matched, displayLabel }
  })
}

export function applyTypeNormalizationToRows(
  rows: Record<string, string>[],
  typeHeader: string | null,
  targetTable: ImportTable | string,
): Record<string, string>[] {
  if (!typeHeader) return rows
  const normalizer =
    targetTable === 'liabilities' ? normalizeLiabilityType : normalizeAssetType
  return rows.map((row) => {
    const raw = row[typeHeader]?.trim() ?? ''
    if (!raw) return row
    const { canonical } = normalizer(raw)
    if (!canonical) return row
    return { ...row, [typeHeader]: canonical }
  })
}
