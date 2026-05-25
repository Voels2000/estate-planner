import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const summarySheet = XLSX.utils.aoa_to_sheet([
  ['My Portfolio Summary'],
  ['Generated for testing'],
])

const assetsData = [
  ['name', 'type', 'value', 'owner'],
  ['Playwright XLSX Asset', 'taxable_brokerage', '75000', 'person1'],
]
const assetsSheet = XLSX.utils.aoa_to_sheet(assetsData)

const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
XLSX.utils.book_append_sheet(workbook, assetsSheet, 'Assets')

const outDir = path.join(process.cwd(), 'tests/fixtures/import')
fs.mkdirSync(outDir, { recursive: true })
const outputPath = path.join(outDir, 'two-sheets.xlsx')
XLSX.writeFile(workbook, outputPath)
console.log('Generated:', outputPath)
