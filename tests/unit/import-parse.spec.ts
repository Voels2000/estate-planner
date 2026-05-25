/**
 * Import parse unit tests — Sprint F-2
 * Tests 1 (preamble), 2 (sheet picker), 6 (alias matching)
 *
 * Run: npm run test:import:unit
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { detectHeaderRow, parseCsvText, parseExcelBuffer } from '../../lib/import/parseFile'
import { suggestFieldMap } from '../../lib/import/ingestConfig'

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/import')

test.describe('Import — header row detection (Test 1)', () => {
  test('detects header on row 4 for preamble CSV', () => {
    const csvText = fs.readFileSync(path.join(FIXTURES, 'preamble.csv'), 'utf-8')
    const parsed = parseCsvText(csvText)
    expect(parsed.header_row_index).toBe(3)
    expect(parsed.headers).toContain('name')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].name).toBe('Primary Residence')
  })

  test('detects header on row 1 for clean CSV', () => {
    const lines = [
      ['name', 'type', 'value'],
      ['Primary Residence', 'primary_residence', '850000'],
    ]
    expect(detectHeaderRow(lines)).toBe(0)
  })
})

test.describe('Import — Excel sheet picker (Test 2)', () => {
  test('workbook has Summary and Assets sheets', () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'two-sheets.xlsx'))
    const assets = parseExcelBuffer(buf, { sheetName: 'Assets' })
    expect(assets.sheet_names).toContain('Summary')
    expect(assets.sheet_names).toContain('Assets')
    expect(assets.selected_sheet).toBe('Assets')
    expect(assets.rows.length).toBeGreaterThan(0)
    expect(assets.rows[0].name).toBe('Playwright XLSX Asset')
  })

  test('Summary sheet has no importable data rows', () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'two-sheets.xlsx'))
    expect(() => parseExcelBuffer(buf, { sheetName: 'Summary' })).toThrow(
      /no data rows/i,
    )
  })
})

test.describe('Import — alias matching (Test 6)', () => {
  test('maps broker-style headers to DB fields', () => {
    const headers = ['Current Market Value ($)', 'Account Name', 'Asset Category']
    const map = suggestFieldMap(headers, 'assets')
    expect(map['Current Market Value ($)']).toBe('value')
    expect(map['Account Name']).toBe('name')
    expect(map['Asset Category']).toBe('type')
  })

  test('maps exact canonical headers', () => {
    const headers = ['name', 'type', 'value', 'owner', 'notes']
    const map = suggestFieldMap(headers, 'assets')
    expect(map['name']).toBe('name')
    expect(map['type']).toBe('type')
    expect(map['value']).toBe('value')
  })

  test('maps income headers with punctuation', () => {
    const headers = ['Annual Salary (USD)', 'Income Source', 'Start Year']
    const map = suggestFieldMap(headers, 'income')
    expect(map['Annual Salary (USD)']).toBe('amount')
    expect(map['Income Source']).toBe('source')
    expect(map['Start Year']).toBe('start_year')
  })
})
