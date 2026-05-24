export type ImportTable = 'assets' | 'liabilities' | 'income' | 'expenses'

export const IMPORT_TABLES: ImportTable[] = ['assets', 'liabilities', 'income', 'expenses']

const REQUIRED_FIELDS: Record<ImportTable, string[]> = {
  assets: ['name', 'type', 'value'],
  liabilities: ['name', 'type', 'balance'],
  income: ['source', 'amount', 'start_year'],
  expenses: ['category', 'amount', 'start_year'],
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  type: 'Type',
  value: 'Value',
  owner: 'Owner',
  notes: 'Notes',
  balance: 'Balance',
  interest_rate: 'Interest rate',
  monthly_payment: 'Monthly payment',
  source: 'Source',
  amount: 'Amount',
  start_year: 'Start year',
  end_year: 'End year',
  inflation_adjust: 'Inflation adjust',
  category: 'Category',
}

const TABLE_FIELD_KEYS: Record<ImportTable, string[]> = {
  assets: ['name', 'type', 'value', 'owner', 'notes'],
  liabilities: ['name', 'type', 'balance', 'interest_rate', 'monthly_payment', 'notes'],
  income: ['source', 'amount', 'start_year', 'end_year', 'inflation_adjust', 'owner'],
  expenses: ['category', 'amount', 'start_year', 'end_year', 'inflation_adjust'],
}

export const FIELD_ALIASES: Record<ImportTable, Record<string, string[]>> = {
  assets: {
    name: ['name', 'asset', 'assetname', 'description', 'account', 'accountname'],
    type: ['type', 'assettype', 'category', 'accounttype'],
    value: ['value', 'amount', 'balance', 'marketvalue', 'currentvalue', 'worth'],
    owner: ['owner', 'person', 'whose', 'holder'],
    notes: ['notes', 'note', 'comments'],
  },
  liabilities: {
    name: ['name', 'loan', 'loanname', 'description', 'creditor'],
    type: ['type', 'loantype', 'debttype', 'category'],
    balance: ['balance', 'amount', 'outstanding', 'remaining', 'owed'],
    interest_rate: ['rate', 'interestrate', 'apr', 'interest'],
    monthly_payment: ['payment', 'monthlypayment', 'installment', 'monthly'],
    notes: ['notes', 'note', 'comments'],
  },
  income: {
    source: ['source', 'type', 'description', 'name', 'incometype'],
    amount: ['amount', 'annual', 'income', 'salary', 'annualamount'],
    start_year: ['startyear', 'start', 'year', 'from'],
    end_year: ['endyear', 'end', 'through', 'until', 'to'],
    owner: ['owner', 'person', 'whose'],
    inflation_adjust: ['inflationadjust', 'inflation', 'cola', 'adjustforinflation'],
  },
  expenses: {
    category: ['category', 'type', 'description', 'name'],
    amount: ['amount', 'annual', 'cost', 'expense', 'annualamount'],
    start_year: ['startyear', 'start', 'year', 'from'],
    end_year: ['endyear', 'end', 'through', 'until', 'to'],
    inflation_adjust: ['inflationadjust', 'inflation', 'cola', 'adjustforinflation'],
  },
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '')
}

export function detectTable(headers: string[]): ImportTable | null {
  const h = headers.map(normalizeHeader)
  if (
    h.some((col) => ['value', 'assetvalue', 'marketvalue', 'currentvalue'].includes(col)) &&
    h.some((col) => ['name', 'assetname', 'description', 'account', 'accountname'].includes(col))
  ) {
    return 'assets'
  }
  if (
    h.some((col) => ['balance', 'amount', 'outstanding', 'remaining', 'owed'].includes(col)) &&
    h.some((col) => ['type', 'loantype', 'debttype', 'category'].includes(col)) &&
    h.some((col) => ['name', 'loan', 'loanname', 'creditor', 'description'].includes(col))
  ) {
    return 'liabilities'
  }
  if (
    h.some((col) => ['amount', 'income', 'salary', 'annual', 'annualamount'].includes(col)) &&
    h.some((col) => ['source', 'type', 'description', 'name', 'incometype'].includes(col))
  ) {
    return 'income'
  }
  if (
    h.some((col) => ['amount', 'cost', 'expense', 'annualamount'].includes(col)) &&
    h.some((col) => ['category', 'type', 'description', 'name'].includes(col))
  ) {
    return 'expenses'
  }
  return null
}

/** Maps file column header → DB field name (client field_map shape). */
export function suggestFieldMap(headers: string[], table: ImportTable): Record<string, string> {
  const aliases = FIELD_ALIASES[table] ?? {}
  const map: Record<string, string> = {}
  const usedDbFields = new Set<string>()

  for (const [dbField, aliasList] of Object.entries(aliases)) {
    const match = headers.find((header) =>
      aliasList.includes(normalizeHeader(header)),
    )
    if (match && !usedDbFields.has(dbField)) {
      map[match] = dbField
      usedDbFields.add(dbField)
    }
  }
  return map
}

export function buildTableFieldsResponse(): Record<
  ImportTable,
  { value: string; label: string; required?: boolean }[]
> {
  const out = {} as Record<ImportTable, { value: string; label: string; required?: boolean }[]>
  for (const table of IMPORT_TABLES) {
    const required = new Set(REQUIRED_FIELDS[table])
    out[table] = TABLE_FIELD_KEYS[table].map((value) => ({
      value,
      label: FIELD_LABELS[value] ?? value,
      ...(required.has(value) ? { required: true } : {}),
    }))
  }
  return out
}
