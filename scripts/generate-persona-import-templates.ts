/**
 * Generate persona import workbooks for Sprint Import Expansion Phase 4.
 * Run: npx tsx scripts/generate-persona-import-templates.ts
 */
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const outDir = path.join(process.cwd(), 'public/templates')
fs.mkdirSync(outDir, { recursive: true })

function instructionsSheet(lines: string[][]) {
  return XLSX.utils.aoa_to_sheet([
    ['My Wealth Maps — Import Template Instructions'],
    [''],
    ...lines,
    [''],
    ['Column headers are human-readable; types are auto-mapped on import.'],
    ['Valid owners: person1, person2, joint'],
  ])
}

function writeWorkbook(
  filename: string,
  sheets: Record<string, string[][]>,
  instructions: string[][],
) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, instructionsSheet(instructions), 'Instructions')
  for (const [name, data] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name)
  }
  const out = path.join(outDir, filename)
  XLSX.writeFile(wb, out)
  console.log('Wrote', out)
}

writeWorkbook(
  'template-business-owner.xlsx',
  {
    Assets: [
      ['Account Name', 'Asset Category', 'Current Value', 'Owner', 'Notes'],
      ['Family LLC Interest', 'Business Interest', '1200000', 'person1', 'Operating company'],
      ['Brokerage Account', 'Brokerage Account', '450000', 'person1', 'Fidelity'],
      ['Traditional 401(k)', '401(k)', '380000', 'person1', ''],
    ],
    Liabilities: [
      ['Loan Name', 'Loan Type', 'Balance', 'Interest Rate', 'Monthly Payment'],
      ['SBA Business Loan', 'Business Loan', '250000', '6.5', '4200'],
      ['Home Mortgage', 'Mortgage', '680000', '3.25', '3100'],
    ],
    Income: [
      ['Income Source', 'Annual Amount', 'Start Year', 'Owner'],
      ['W-2 Salary', '185000', '2026', 'person1'],
      ['Business Distributions', '240000', '2026', 'person1'],
    ],
    Expenses: [
      ['Category', 'Annual Amount', 'Start Year'],
      ['Living expenses', '120000', '2026'],
      ['Charitable giving', '35000', '2026'],
    ],
  },
  [
    ['Business Owner template — example rows for a business owner household.'],
    ['Sheets: Assets, Liabilities, Income, Expenses'],
    ['Asset Category examples: Brokerage Account, 401(k), Business Interest'],
  ],
)

writeWorkbook(
  'template-real-estate.xlsx',
  {
    Assets: [
      ['Account Name', 'Asset Category', 'Current Value', 'Owner'],
      ['Primary Checking', 'Checking Account', '45000', 'person1'],
    ],
    'Real Estate': [
      ['Property Name', 'Property Type', 'Current Value', 'Situs State', 'Mortgage Balance', 'Owner'],
      ['123 Oak Street', 'Primary Home', '920000', 'CA', '410000', 'person1'],
      ['456 Palm Ave', 'Rental Property', '650000', 'AZ', '280000', 'joint'],
      ['789 Lake Road', 'Vacation Home', '480000', 'CO', '0', 'person2'],
    ],
    Liabilities: [
      ['Loan Name', 'Loan Type', 'Balance'],
      ['Oak St Mortgage', 'Mortgage', '410000'],
      ['Palm Ave Mortgage', 'Mortgage', '280000'],
    ],
    Income: [
      ['Income Source', 'Annual Amount', 'Start Year'],
      ['Rental — Palm Ave', '36000', '2026'],
      ['W-2 Salary', '210000', '2026'],
    ],
    Expenses: [
      ['Category', 'Annual Amount', 'Start Year'],
      ['Property maintenance', '18000', '2026'],
    ],
  },
  [
    ['Real Estate Portfolio template — properties with situs states.'],
    ['Property Type examples: Primary Home, Rental Property, Vacation Home'],
  ],
)

writeWorkbook(
  'template-executive.xlsx',
  {
    Assets: [
      ['Account Name', 'Asset Category', 'Current Value', 'Owner', 'Notes'],
      ['Company RSU Account', 'Individual Stock', '320000', 'person1', 'Unvested RSUs'],
      ['Traditional 401(k)', '401(k)', '890000', 'person1', ''],
      ['Brokerage Account', 'Brokerage Account', '275000', 'person1', 'Schwab'],
      ['Roth IRA', 'Roth IRA', '145000', 'person1', ''],
    ],
    Liabilities: [
      ['Loan Name', 'Loan Type', 'Balance'],
      ['Primary Mortgage', 'Mortgage', '520000'],
    ],
    Income: [
      ['Income Source', 'Annual Amount', 'Start Year', 'Owner'],
      ['W-2 Base Salary', '285000', '2026', 'person1'],
      ['Annual Bonus', '95000', '2026', 'person1'],
      ['RSU Vest (estimated)', '180000', '2026', 'person1'],
    ],
    Expenses: [
      ['Category', 'Annual Amount', 'Start Year'],
      ['Household spending', '145000', '2026'],
    ],
  },
  [
    ['Executive / RSU template — equity comp + retirement accounts.'],
    ['Asset Category examples: Individual Stock, 401(k), Roth IRA, Brokerage Account'],
  ],
)
