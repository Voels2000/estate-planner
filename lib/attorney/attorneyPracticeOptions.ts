/** Slugs stored in `attorney_listings.specializations` — aligned with seed import + directory filters. */
export const ATTORNEY_PRACTICE_AREAS = [
  { slug: 'estate-planning', label: 'Estate planning' },
  { slug: 'trusts', label: 'Trusts' },
  { slug: 'probate', label: 'Probate' },
  { slug: 'tax-planning', label: 'Tax planning' },
  { slug: 'business-succession', label: 'Business succession' },
  { slug: 'elder-law', label: 'Elder law' },
] as const

export type AttorneyPracticeAreaSlug = (typeof ATTORNEY_PRACTICE_AREAS)[number]['slug']

export const ATTORNEY_FEE_STRUCTURE_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'flat-fee', label: 'Flat fee' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'consultation', label: 'Consultation-based' },
] as const

export type AttorneyFeeStructure = (typeof ATTORNEY_FEE_STRUCTURE_OPTIONS)[number]['value']

export const ATTORNEY_CREDENTIAL_SUGGESTIONS = [
  'JD',
  'LL.M.',
  'ACTEC',
  'CPA',
  'CFP',
  'AEP',
  'ChFC',
  'CLU',
  'CIMA',
  'CPWA',
  'RICP',
] as const

/** Map legacy seed / register-page labels to checklist slugs. */
const SPECIALIZATION_ALIASES: Record<string, AttorneyPracticeAreaSlug> = {
  tax: 'tax-planning',
  'tax law': 'tax-planning',
  'estate planning': 'estate-planning',
  'elder law': 'elder-law',
  'business succession': 'business-succession',
  'trust administration': 'trusts',
}

export function normalizeAttorneyPracticeAreaSlug(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const alias = SPECIALIZATION_ALIASES[lower]
  if (alias) return alias
  const known = ATTORNEY_PRACTICE_AREAS.find((a) => a.slug === lower)
  if (known) return known.slug
  return lower.replace(/\s+/g, '-')
}

export function normalizeAttorneySpecializations(
  values: string[] | null | undefined,
): AttorneyPracticeAreaSlug[] {
  const slugs = new Set<AttorneyPracticeAreaSlug>()
  for (const raw of values ?? []) {
    const slug = normalizeAttorneyPracticeAreaSlug(raw)
    if (!slug) continue
    const known = ATTORNEY_PRACTICE_AREAS.find((a) => a.slug === slug)
    if (known) slugs.add(known.slug)
  }
  return [...slugs]
}

const FEE_ALIASES: Record<string, AttorneyFeeStructure> = {
  hourly: 'hourly',
  hour: 'hourly',
  'flat fee': 'flat-fee',
  flat: 'flat-fee',
  'flat-fee': 'flat-fee',
  hybrid: 'hybrid',
  consultation: 'consultation',
  'consultation-based': 'consultation',
  'consultation based': 'consultation',
  retainer: 'hybrid',
  aum: 'hybrid',
}

export function normalizeAttorneyFeeStructure(
  raw: string | null | undefined,
): AttorneyFeeStructure | null {
  if (!raw?.trim()) return null
  const key = raw.trim().toLowerCase()
  const mapped = FEE_ALIASES[key]
  if (mapped) return mapped
  const known = ATTORNEY_FEE_STRUCTURE_OPTIONS.find((o) => o.value === key)
  return known?.value ?? null
}

export function normalizeAttorneyCredentials(values: string[] | null | undefined): string[] {
  const out = new Set<string>()
  for (const raw of values ?? []) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const upper = trimmed.replace(/®/g, '').toUpperCase()
    if (upper === 'LLM') {
      out.add('LL.M.')
    } else if (upper === 'LL.M' || upper === 'LL.M.') {
      out.add('LL.M.')
    } else {
      out.add(trimmed)
    }
  }
  return [...out]
}

export function normalizeLicensedStates(values: string[] | null | undefined): string[] {
  const out = new Set<string>()
  for (const raw of values ?? []) {
    const code = raw.trim().toUpperCase()
    if (code.length === 2) out.add(code)
  }
  return [...out].sort()
}

/** Human label for directory cards, filters, and admin tables. */
export function formatAttorneyPracticeAreaLabel(slug: string): string {
  const known = ATTORNEY_PRACTICE_AREAS.find((a) => a.slug === slug)
  if (known) return known.label
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Human label for fee_structure slug or legacy freeform value. */
export function formatAttorneyFeeStructureLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const normalized = normalizeAttorneyFeeStructure(value)
  if (normalized) {
    return ATTORNEY_FEE_STRUCTURE_OPTIONS.find((o) => o.value === normalized)?.label ?? value
  }
  return value.trim()
}

export const ATTORNEY_PRACTICE_PROFILE_FIELD_COUNT = 4
