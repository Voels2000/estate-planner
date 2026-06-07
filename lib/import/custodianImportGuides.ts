export type CustodianImportGuide = {
  id: string
  name: string
  exportSteps: string[]
  tips: string[]
  templateHref?: string
}

/** Phase A — no Plaid; help users export custodian CSVs we already normalize. */
export const CUSTODIAN_IMPORT_GUIDES: CustodianImportGuide[] = [
  {
    id: 'schwab',
    name: 'Charles Schwab',
    exportSteps: [
      'Log in at schwab.com → Accounts → select the account.',
      'Export or download Positions / Holdings as CSV (Schwab One® export).',
      'Upload the CSV here — we map Symbol, Quantity, Market Value, and Account Description automatically.',
    ],
    tips: [
      'Include all taxable and retirement accounts you want on your balance sheet.',
      'One export per account is fine; upload each file or combine in Excel first.',
    ],
    templateHref: '/templates/custodian-positions-sample.csv',
  },
  {
    id: 'fidelity',
    name: 'Fidelity',
    exportSteps: [
      'Log in at fidelity.com → Accounts & Trade → Portfolio.',
      'Download positions / account summary as CSV or Excel.',
      'Upload here — Fidelity account type labels map to our asset categories.',
    ],
    tips: [
      'Use the brokerage export, not tax forms (1099).',
      '401(k) and IRA exports work the same way as taxable brokerage.',
    ],
    templateHref: '/templates/custodian-positions-sample.csv',
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    exportSteps: [
      'Log in at vanguard.com → My Accounts → Balances.',
      'Export holdings or download transaction/position CSV where available.',
      'Upload — Vanguard Individual / Brokerage labels are recognized.',
    ],
    tips: [
      'Mutual fund and ETF positions both import as assets.',
    ],
    templateHref: '/templates/custodian-positions-sample.csv',
  },
]
