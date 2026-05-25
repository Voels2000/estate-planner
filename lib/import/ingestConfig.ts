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
    name: [
      'name', 'asset', 'assetname', 'description', 'account', 'accountname',
      'accountdescription', 'securityname', 'holding', 'investment',
      'positionname', 'fundname',
    ],
    type: [
      'type', 'assettype', 'category', 'accounttype', 'assetcategory',
      'securitytype', 'investmenttype', 'class', 'assetclass',
    ],
    value: [
      'value', 'amount', 'balance', 'marketvalue', 'currentvalue', 'worth',
      'totalvalue', 'currentbalance', 'marketprice', 'presentvalue',
      'accountvalue', 'portfoliovalue', 'endingvalue', 'endingbalance',
    ],
    owner: ['owner', 'person', 'whose', 'holder', 'accountholder', 'ownedby'],
    notes: ['notes', 'note', 'comments', 'memo', 'description', 'details'],
  },
  liabilities: {
    name: [
      'name', 'loan', 'loanname', 'description', 'creditor', 'lender',
      'accountname', 'debtname', 'liability',
    ],
    type: [
      'type', 'loantype', 'debttype', 'category', 'liabilitytype',
      'accounttype', 'debtcategory',
    ],
    balance: [
      'balance', 'amount', 'outstanding', 'remaining', 'owed', 'currentbalance',
      'principalbalance', 'outstandingbalance', 'loanbalance', 'debtbalance',
    ],
    interest_rate: [
      'rate', 'interestrate', 'apr', 'interest', 'annualrate',
      'interestpercent', 'rate%',
    ],
    monthly_payment: [
      'payment', 'monthlypayment', 'installment', 'monthly',
      'monthlyinstallment', 'regularpayment', 'paymentamount',
    ],
    notes: ['notes', 'note', 'comments', 'memo', 'description'],
  },
  income: {
    source: [
      'source', 'type', 'description', 'name', 'incometype', 'incomesource',
      'paymenttype', 'revenuetype',
    ],
    amount: [
      'amount', 'annual', 'income', 'salary', 'annualamount', 'grossincome',
      'annualincome', 'yearlyamount', 'annualpay', 'compensation',
    ],
    start_year: ['startyear', 'start', 'year', 'from', 'beginningyear', 'effectiveyear'],
    end_year: ['endyear', 'end', 'through', 'until', 'to', 'stopyear', 'lastyear'],
    owner: ['owner', 'person', 'whose'],
    inflation_adjust: ['inflationadjust', 'inflation', 'cola', 'adjustforinflation'],
  },
  expenses: {
    category: [
      'category', 'type', 'description', 'name', 'expensetype', 'expensecategory',
      'spendingcategory',
    ],
    amount: [
      'amount', 'annual', 'cost', 'expense', 'annualamount', 'annualcost',
      'yearlyamount', 'annualexpense', 'spending',
    ],
    start_year: ['startyear', 'start', 'year', 'from', 'beginningyear'],
    end_year: ['endyear', 'end', 'through', 'until', 'to', 'stopyear'],
    inflation_adjust: ['inflationadjust', 'inflation', 'cola', 'adjustforinflation'],
  },
}

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_\-\(\)\$\%\#\/\\,\.]+/g, '')
}

function headerMatchesAlias(header: string, aliasList: string[]): boolean {
  const norm = normalizeHeader(header)
  if (aliasList.includes(norm)) return true
  if (aliasList.some((alias) => norm.includes(alias))) return true
  if (aliasList.some((alias) => alias.includes(norm) && norm.length >= 3)) return true
  return false
}

function normalizedHeadersMatchAny(headers: string[], candidates: string[]): boolean {
  return headers.some((h) => {
    const norm = normalizeHeader(h)
    return candidates.some(
      (c) => norm === c || norm.includes(c) || (norm.length >= 3 && c.includes(norm)),
    )
  })
}

export function detectTable(headers: string[]): ImportTable | null {
  if (
    normalizedHeadersMatchAny(headers, ['value', 'assetvalue', 'marketvalue', 'currentvalue', 'worth', 'marketprice']) &&
    normalizedHeadersMatchAny(headers, ['name', 'assetname', 'description', 'account', 'accountname', 'securityname', 'holding'])
  ) {
    return 'assets'
  }
  if (
    normalizedHeadersMatchAny(headers, ['balance', 'outstanding', 'remaining', 'owed', 'loanbalance']) &&
    normalizedHeadersMatchAny(headers, ['type', 'loantype', 'debttype', 'category', 'liabilitytype']) &&
    normalizedHeadersMatchAny(headers, ['name', 'loan', 'loanname', 'creditor', 'description', 'lender'])
  ) {
    return 'liabilities'
  }
  if (
    normalizedHeadersMatchAny(headers, ['amount', 'income', 'salary', 'annual', 'annualamount', 'grossincome']) &&
    normalizedHeadersMatchAny(headers, ['source', 'type', 'description', 'name', 'incometype', 'incomesource'])
  ) {
    return 'income'
  }
  if (
    normalizedHeadersMatchAny(headers, ['amount', 'cost', 'expense', 'annualamount', 'spending']) &&
    normalizedHeadersMatchAny(headers, ['category', 'type', 'description', 'name', 'expensetype'])
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
    const match = headers.find((header) => headerMatchesAlias(header, aliasList))
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
