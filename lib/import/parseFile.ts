import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ParsedSheet = {
  headers: string[]
  rows: Record<string, string>[]
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

export function parseCsvText(fileText: string): ParsedSheet {
  const result = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV parse failed')
  }
  const headers = (result.meta.fields ?? []).filter(Boolean)
  const rows = (result.data as Record<string, unknown>[])
    .map(normalizeRow)
    .filter((row) => !isEmptyRow(row))
  return { headers, rows }
}

export function parseExcelBuffer(buffer: Buffer): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('Workbook contains no sheets')
  }
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const rows = rawRows.map(normalizeRow).filter((row) => !isEmptyRow(row))
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}
