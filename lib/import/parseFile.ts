import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ParsedSheet = {
  headers: string[]
  rows: Record<string, string>[]
  header_row_index: number
  sheet_names?: string[]
  selected_sheet?: string | null
}

/** Known import column aliases for header-row scoring (Sprint F-2). */
const HEADER_SCORE_ALIASES = new Set([
  'name', 'asset', 'assetname', 'description', 'account', 'accountname',
  'accountdescription', 'securityname', 'holding', 'investment', 'positionname', 'fundname',
  'type', 'assettype', 'category', 'accounttype', 'assetcategory', 'securitytype', 'investmenttype',
  'class', 'assetclass',
  'value', 'amount', 'balance', 'marketvalue', 'currentvalue', 'worth', 'totalvalue',
  'currentbalance', 'marketprice', 'presentvalue', 'accountvalue', 'portfoliovalue',
  'endingvalue', 'endingbalance',
  'owner', 'person', 'whose', 'holder', 'accountholder', 'ownedby', 'notes', 'note', 'comments', 'memo', 'details',
  'loan', 'loanname', 'creditor', 'lender', 'debtname', 'liability', 'loantype', 'debttype', 'liabilitytype',
  'debtcategory', 'outstanding', 'remaining', 'owed', 'principalbalance', 'outstandingbalance',
  'loanbalance', 'debtbalance', 'rate', 'interestrate', 'apr', 'interest', 'annualrate', 'interestpercent',
  'payment', 'monthlypayment', 'installment', 'monthly', 'monthlyinstallment', 'regularpayment', 'paymentamount',
  'source', 'incometype', 'incomesource', 'salary', 'annual', 'annualamount', 'grossincome', 'annualincome',
  'yearlyamount', 'annualpay', 'compensation', 'paymenttype', 'revenuetype',
  'startyear', 'start', 'year', 'from', 'beginningyear', 'effectiveyear',
  'endyear', 'end', 'through', 'until', 'to', 'stopyear', 'lastyear',
  'expense', 'cost', 'housing', 'healthcare', 'food', 'travel', 'entertainment', 'charitable', 'spending',
  'expensetype', 'expensecategory', 'spendingcategory', 'annualcost', 'yearlyamount', 'annualexpense',
])

function normalizeCellForScore(cell: string): string {
  return cell.toLowerCase().replace(/[\s_\-\(\)\$\%\#\/\\,\.]+/g, '')
}

/**
 * Find the best header row in raw grid data.
 * Scores each row by alias matches; falls back to row 0.
 */
export function detectHeaderRow(rawRows: string[][], maxScanRows = 20): number {
  const scanLimit = Math.min(rawRows.length, maxScanRows)
  let bestRow = 0
  let bestScore = 0

  for (let i = 0; i < scanLimit; i++) {
    const row = rawRows[i]
    if (!row || row.every((cell) => !String(cell ?? '').trim())) continue

    const score = row.reduce((acc, cell) => {
      if (!cell) return acc
      const normalized = normalizeCellForScore(String(cell))
      const directMatch = HEADER_SCORE_ALIASES.has(normalized)
      const substringMatch = [...HEADER_SCORE_ALIASES].some(
        (alias) => normalized.includes(alias) || (normalized.length >= 3 && alias.includes(normalized)),
      )
      return acc + (directMatch ? 2 : substringMatch ? 1 : 0)
    }, 0)

    if (score > bestScore) {
      bestScore = score
      bestRow = i
    }
  }

  return bestRow
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value == null) {
      out[key] = ''
    } else {
      out[key] = String(value).trim()
    }
  }
  return out
}

function isEmptyRow(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => v.trim() === '')
}

function rowsFromRawGrid(rawRows: string[][], headerRowIndex: number): ParsedSheet {
  const headerCells = (rawRows[headerRowIndex] ?? []).map((c) => String(c ?? '').trim())
  const effectiveHeaders = headerCells.map((h, i) => h || `Column ${i + 1}`)

  const rows: Record<string, string>[] = []
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const cells = rawRows[r] ?? []
    if (cells.every((c) => !String(c ?? '').trim())) continue
    const row: Record<string, string> = {}
    effectiveHeaders.forEach((header, i) => {
      row[header] = String(cells[i] ?? '').trim()
    })
    if (!isEmptyRow(row)) rows.push(row)
  }

  return {
    headers: effectiveHeaders,
    rows,
    header_row_index: headerRowIndex,
  }
}

export function parseCsvText(fileText: string): ParsedSheet {
  const rawResult = Papa.parse<string[]>(fileText, {
    header: false,
    skipEmptyLines: false,
  })
  if (rawResult.errors.length > 0) {
    throw new Error(rawResult.errors[0]?.message ?? 'CSV parse failed')
  }

  const rawRows = (rawResult.data as string[][]).map((row) =>
    row.map((cell) => String(cell ?? '')),
  )
  const headerRowIndex = detectHeaderRow(rawRows)

  if (headerRowIndex >= rawRows.length - 1) {
    throw new Error('File contains no data rows after header detection')
  }

  const parsed = rowsFromRawGrid(rawRows, headerRowIndex)
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    throw new Error('File contains no data rows')
  }
  return parsed
}

export type ParseExcelOptions = {
  sheetName?: string | null
}

export function parseExcelBuffer(buffer: Buffer, options?: ParseExcelOptions): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = workbook.SheetNames
  if (sheetNames.length === 0) {
    throw new Error('Workbook contains no sheets')
  }

  const requested = options?.sheetName
  const selectedSheet =
    requested && sheetNames.includes(requested) ? requested : sheetNames[0]
  const sheet = workbook.Sheets[selectedSheet]
  if (!sheet) {
    throw new Error(`Sheet not found: ${selectedSheet}`)
  }

  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
  }) as string[][]
  const normalizedRaw = rawRows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '')),
  )
  const headerRowIndex = detectHeaderRow(normalizedRaw)
  const parsed = rowsFromRawGrid(normalizedRaw, headerRowIndex)

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    throw new Error('Selected sheet contains no data rows')
  }

  return {
    ...parsed,
    sheet_names: sheetNames,
    selected_sheet: selectedSheet,
  }
}
