import { FEATURE_TIERS } from '@/lib/tiers'

/** Consumer billing matrix column — 0 = free floor; 1–3 = paid plans. */
export type BillingMatrixTier = 0 | 1 | 2 | 3

export type BillingMatrixGroupId = 'finances' | 'planning' | 'confidence' | 'estate'

export type BillingMatrixRow = {
  label: string
  group: BillingMatrixGroupId
  /** Keys in FEATURE_TIERS (or planned keys) — used to keep matrix aligned with gates. */
  featureKeys: readonly string[]
  minTier: BillingMatrixTier
}

export const BILLING_MATRIX_GROUP_LABELS: Record<BillingMatrixGroupId, string> = {
  finances: 'Your finances',
  planning: 'Planning',
  confidence: 'Confidence',
  estate: 'Estate',
}

/**
 * Capability matrix for /billing — minTier must match FEATURE_TIERS for listed keys.
 * See docs/BILLING_PAGE_COPY_SPEC.md.
 */
export const BILLING_CAPABILITY_ROWS: readonly BillingMatrixRow[] = [
  {
    label: 'Enter assets, debts, income, property & business values',
    group: 'finances',
    featureKeys: ['assets', 'liabilities', 'income', 'expenses', 'profile', 'businesses', 'property-casualty'],
    minTier: 0,
  },
  {
    label: 'Net worth dashboard',
    group: 'finances',
    featureKeys: ['net-worth-view'],
    minTier: 0,
  },
  {
    label: 'Export your data (CSV / Excel)',
    group: 'finances',
    featureKeys: ['data-export'],
    minTier: 0,
  },
  {
    label: 'Forward projection (your trajectory)',
    group: 'planning',
    featureKeys: ['projections'],
    minTier: 1,
  },
  {
    label: 'What-if scenarios & state-move comparison',
    group: 'planning',
    featureKeys: ['scenarios'],
    minTier: 1,
  },
  {
    label: 'Import data (CSV / Excel)',
    group: 'planning',
    featureKeys: ['import'],
    minTier: 1,
  },
  {
    label: 'Probability analysis — thousands of market simulations',
    group: 'confidence',
    featureKeys: ['monte-carlo'],
    minTier: 2,
  },
  {
    label: 'Social Security, Roth & RMD optimization',
    group: 'confidence',
    featureKeys: ['social-security', 'roth', 'rmd', 'complete'],
    minTier: 2,
  },
  {
    label: 'Asset allocation & real-estate analysis',
    group: 'confidence',
    featureKeys: ['allocation', 'real-estate', 'digital-assets'],
    minTier: 2,
  },
  {
    label: 'Estate-tax exposure & multi-state comparison',
    group: 'estate',
    featureKeys: ['estate-tax', 'domicile-analysis'],
    minTier: 3,
  },
  {
    label: 'Gifting, titling & trust strategy',
    group: 'estate',
    featureKeys: [
      'gifting',
      'titling',
      'trust-will',
      'my-estate-trust-strategy',
      'charitable',
      'business-succession',
      'incapacity',
    ],
    minTier: 3,
  },
  {
    label: 'Document vault & family estate plan',
    group: 'estate',
    featureKeys: ['document-vault', 'my-family', 'my-estate-strategy'],
    minTier: 3,
  },
] as const

/** Cumulative check: included at column tier when column >= row minTier. */
export function isBillingCapabilityIncluded(
  row: BillingMatrixRow,
  columnTier: BillingMatrixTier,
): boolean {
  return columnTier >= row.minTier
}

/** Resolve min tier from FEATURE_TIERS keys (max required). Falls back to row.minTier. */
export function resolveRowMinTierFromFeatures(row: BillingMatrixRow): BillingMatrixTier {
  let max = 0 as BillingMatrixTier
  for (const key of row.featureKeys) {
    const required = FEATURE_TIERS[key]
    if (required != null && required > max) {
      max = required as BillingMatrixTier
    }
  }
  return max > 0 ? max : row.minTier
}

export function billingMatrixRowsByGroup(): Array<{
  group: BillingMatrixGroupId
  label: string
  rows: BillingMatrixRow[]
}> {
  const order: BillingMatrixGroupId[] = ['finances', 'planning', 'confidence', 'estate']
  return order.map((group) => ({
    group,
    label: BILLING_MATRIX_GROUP_LABELS[group],
    rows: BILLING_CAPABILITY_ROWS.filter((r) => r.group === group),
  }))
}
