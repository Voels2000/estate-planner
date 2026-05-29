import * as XLSX from 'xlsx'
import type { ImportTable } from './ingestConfig'
import { detectTable, suggestFieldMap } from './ingestConfig'
import { parseExcelBuffer, type ParsedSheet } from './parseFile'

export type ParsedImportSheet = {
  sheet_name: string
  target_table: ImportTable
  rows: Record<string, string>[]
  headers: string[]
  field_map: Record<string, string>
  header_row_index: number
  confidence: number
}

const INSTRUCTIONS_SHEET_NAMES = new Set([
  'instructions',
  'readme',
  'read me',
  'about',
  'summary',
  'cover',
])

const RECORD_TYPE_COLUMNS = new Set(['record_type', 'table', 'category'])

const TABLE_NAME_ALIASES: Record<string, ImportTable> = {
  asset: 'assets',
  assets: 'assets',
  liability: 'liabilities',
  liabilities: 'liabilities',
  debt: 'liabilities',
  debts: 'liabilities',
  income: 'income',
  earn: 'income',
  earnings: 'income',
  expense: 'expenses',
  expenses: 'expenses',
  spend: 'expenses',
  spending: 'expenses',
  real_estate: 'real_estate',
  property: 'real_estate',
  properties: 'real_estate',
}

function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase()
}

function scoreSheetNameForTable(sheetName: string, table: ImportTable): number {
  const n = normalizeSheetName(sheetName)
  if (n.includes('instruct') || INSTRUCTIONS_SHEET_NAMES.has(n)) return 0
  const hints: Record<ImportTable, string[]> = {
    assets: ['asset'],
    liabilities: ['liab', 'debt', 'loan'],
    income: ['income', 'earn', 'salary', 'revenue'],
    expenses: ['expense', 'spend', 'cost'],
    real_estate: ['real', 'estate', 'property', 'properties'],
  }
  return hints[table].some((h) => n.includes(h)) ? 0.9 : 0
}

export function inferTableFromSheetName(sheetName: string): ImportTable | null {
  const n = normalizeSheetName(sheetName)
  if (n.includes('asset') && !n.includes('real')) return 'assets'
  if (n.includes('liab') || n.includes('debt')) return 'liabilities'
  if (n.includes('income') || n.includes('earn')) return 'income'
  if (n.includes('expense') || n.includes('spend')) return 'expenses'
  if (n.includes('real') || n.includes('property') || (n.includes('estate') && !n.includes('tax')))
    return 'real_estate'
  return null
}

export function buildParsedSheet(
  sheetName: string,
  parsed: ParsedSheet,
): ParsedImportSheet | null {
  if (parsed.rows.length === 0) return null
  const fromName = inferTableFromSheetName(sheetName)
  const fromHeaders = detectTable(parsed.headers)
  const target_table = fromName ?? fromHeaders ?? 'assets'
  const nameScore = fromName ? scoreSheetNameForTable(sheetName, target_table) : 0
  const headerScore = fromHeaders === target_table ? 0.85 : 0.5
  const confidence = Math.max(nameScore, headerScore, 0.4)
  return {
    sheet_name: sheetName,
    target_table,
    rows: parsed.rows,
    headers: parsed.headers,
    field_map: suggestFieldMap(parsed.headers, target_table),
    header_row_index: parsed.header_row_index,
    confidence,
  }
}

export function parseAllExcelSheets(buffer: Buffer): {
  sheet_names: string[]
  sheets: ParsedImportSheet[]
} {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = workbook.SheetNames.filter(
    (name) => !INSTRUCTIONS_SHEET_NAMES.has(normalizeSheetName(name)),
  )
  const sheets: ParsedImportSheet[] = []
  for (const sheetName of sheetNames) {
    try {
      const parsed = parseExcelBuffer(buffer, { sheetName })
      const built = buildParsedSheet(sheetName, parsed)
      if (built) sheets.push(built)
    } catch {
      // skip empty / non-data sheets
    }
  }
  return { sheet_names: workbook.SheetNames, sheets }
}

/** Split CSV rows by record_type / table / category column into virtual sheets. */
export function splitCsvByRecordType(parsed: ParsedSheet): ParsedImportSheet[] | null {
  const typeCol = parsed.headers.find((h) => {
    const norm = h.trim().toLowerCase().replace(/[\s_-]+/g, '_')
    return RECORD_TYPE_COLUMNS.has(norm)
  })
  if (!typeCol) return null

  const groups = new Map<ImportTable, Record<string, string>[]>()
  for (const row of parsed.rows) {
    const raw = row[typeCol]?.trim().toLowerCase().replace(/[\s_-]+/g, '_') ?? ''
    const table = TABLE_NAME_ALIASES[raw]
    if (!table) continue
    const stripped = { ...row }
    delete stripped[typeCol]
    const list = groups.get(table) ?? []
    list.push(stripped)
    groups.set(table, list)
  }
  if (groups.size <= 1) return null

  const sheets: ParsedImportSheet[] = []
  for (const [target_table, rows] of groups) {
    if (rows.length === 0) continue
    const headers = parsed.headers.filter((h) => h !== typeCol)
    sheets.push({
      sheet_name: target_table,
      target_table,
      rows,
      headers,
      field_map: suggestFieldMap(headers, target_table),
      header_row_index: parsed.header_row_index,
      confidence: 0.95,
    })
  }
  return sheets.length > 1 ? sheets : null
}
