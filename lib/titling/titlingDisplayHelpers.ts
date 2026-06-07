import { displayPersonFirstName } from '@/lib/display-person-name'

export type OwnerBucketId = 'person1' | 'person2' | 'joint' | 'trust' | 'other' | 'unknown' | 'unassigned'

const OWNER_BUCKET_ORDER: OwnerBucketId[] = [
  'person1',
  'person2',
  'joint',
  'trust',
  'other',
  'unknown',
  'unassigned',
]

export function normalizeOwnerBucket(owner: string | null): OwnerBucketId {
  const o = owner?.trim().toLowerCase() ?? ''
  if (!o) return 'unassigned'
  if (o === 'person1' || o === 'person2' || o === 'joint' || o === 'trust' || o === 'other') return o
  return 'unknown'
}

export function ownerBucketLabel(id: OwnerBucketId, p1First: string, p2First: string): string {
  switch (id) {
    case 'person1':
      return p1First
    case 'person2':
      return p2First
    case 'joint':
      return 'Joint'
    case 'trust':
      return 'Trust'
    case 'other':
      return 'Other'
    case 'unknown':
      return 'Unknown'
    case 'unassigned':
      return 'Unassigned'
    default:
      return 'Unknown'
  }
}

function titlingOwnerStorageKey(tab: 'assets' | 'insurance', id: OwnerBucketId): string {
  return `titling-${tab === 'assets' ? 'assets' : 'insurance'}-${id}`
}

export function groupRowsByOwnerBucket<T extends { owner: string | null }>(
  rows: T[],
  p1First: string,
  p2First: string,
  tab: 'assets' | 'insurance',
): { id: OwnerBucketId; title: string; storageKey: string; rows: T[] }[] {
  const map = new Map<OwnerBucketId, T[]>()
  for (const row of rows) {
    const id = normalizeOwnerBucket(row.owner)
    if (!map.has(id)) map.set(id, [])
    map.get(id)!.push(row)
  }
  const out: { id: OwnerBucketId; title: string; storageKey: string; rows: T[] }[] = []
  for (const id of OWNER_BUCKET_ORDER) {
    const bucketRows = map.get(id)
    if (!bucketRows?.length) continue
    out.push({
      id,
      title: ownerBucketLabel(id, p1First, p2First),
      storageKey: titlingOwnerStorageKey(tab, id),
      rows: bucketRows,
    })
  }
  return out
}

export function titlingFinancialOwnerLabel(owner: string | null, p1: string, p2: string): string {
  if (owner === 'person2') return p2
  if (owner === 'joint') return 'Joint'
  if (owner === 'trust') return 'Trust'
  if (owner === 'other') return 'Other'
  if (owner == null || String(owner).trim() === '') return 'Unassigned'
  return p1
}

export function ownerLabel(owner: string | null, p1: string, p2: string): string {
  if (owner === 'person2') return p2
  if (owner === 'joint') return 'Joint'
  return p1
}

export function formatTitlingDollars(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const TITLE_TYPES = [
  { value: 'sole', label: 'Sole Ownership' },
  { value: 'joint_wros', label: 'Joint Tenancy (WROS)' },
  { value: 'tenants_in_common', label: 'Tenants in Common' },
  { value: 'community_property', label: 'Community Property' },
  { value: 'tod_pod', label: 'TOD / POD' },
  { value: 'trust_owned', label: 'Trust Owned' },
  { value: 'corporate', label: 'Corporate / LLC' },
]

export function titleLabel(value: string): string {
  return TITLE_TYPES.find((t) => t.value === value)?.label ?? value
}

export function buildAssetTitlingOptions(
  person1LegalName: string | null,
  person2LegalName: string | null,
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [
    { value: '', label: 'Not set' },
    {
      value: 'individual_p1',
      label: `Individual (${displayPersonFirstName(person1LegalName, 'Person 1')})`,
    },
  ]
  if (person2LegalName?.trim()) {
    options.push({
      value: 'individual_p2',
      label: `Individual (${displayPersonFirstName(person2LegalName)})`,
    })
  }
  options.push(
    { value: 'joint_tenants', label: 'Joint Tenants (JTWROS)' },
    { value: 'tenants_in_common', label: 'Tenants in Common' },
    { value: 'trust', label: 'Trust' },
    { value: 'entity', label: 'Entity (LLC/Corp)' },
    { value: 'pod', label: 'POD / Transfer on Death' },
    { value: 'tod', label: 'TOD (Securities)' },
  )
  return options
}

export const BENEFICIARY_EXEMPT_TITLE_TYPES = new Set(['joint_wros', 'community_property'])

export function titlingExemptFromBeneficiaryGap(titling: { title_type: string } | null): boolean {
  return !!(titling && BENEFICIARY_EXEMPT_TITLE_TYPES.has(titling.title_type))
}
