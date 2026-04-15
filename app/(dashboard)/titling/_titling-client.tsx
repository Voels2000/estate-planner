'use client'

// ─────────────────────────────────────────
// Menu: Estate Planning > Titling & Beneficiaries
// Route: /titling
// ─────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { displayPersonFirstName } from '@/lib/display-person-name'
import { CollapsibleSection } from '@/components/CollapsibleSection'

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = {
  id: string
  name: string
  type: string
  value: number
  owner: string | null
  cost_basis?: number | null
  basis_date?: string | null
  titling?: string | null
  liquidity?: string | null
}

type RealEstateItem = {
  id: string
  name: string
  property_type: string
  current_value: number
  owner: string | null
  titling: string | null
  liquidity: string | null
  cost_basis: number | null
  basis_date: string | null
}

type InsurancePolicyRow = {
  id: string
  policy_name: string | null
  insurance_type: string | null
  death_benefit: number | null
  owner: string | null
  titling: string | null
  liquidity: string | null
  cost_basis: number | null
  basis_date: string | null
}

type BusinessRow = {
  id: string
  name: string
  estimated_value: number | null
  entity_type: string | null
  owner: string | null
  titling: string | null
  liquidity: string | null
  cost_basis: number | null
  basis_date: string | null
}

type AssetTitling = {
  id: string
  asset_id: string
  title_type: string
  notes: string | null
}

type RealEstateTitling = {
  id: string
  real_estate_id: string
  title_type: string
  notes: string | null
}

type InsurancePolicyTitling = {
  id: string
  insurance_policy_id: string
  title_type: string
  notes: string | null
}

type BusinessTitlingRow = {
  id: string
  business_id: string
  title_type: string
  notes: string | null
}

type Beneficiary = {
  id: string
  asset_id: string | null
  real_estate_id: string | null
  insurance_policy_id: string | null
  business_id: string | null
  beneficiary_type: 'primary' | 'contingent'
  full_name: string
  relationship: string | null
  email: string | null
  phone: string | null
  allocation_pct: number
  is_gst_skip?: boolean
}

type TitlingCategory = {
  value: string
  label: string
  icon: string
  sort_order: number
  is_active: boolean
}

type HouseholdPersonRow = {
  id: string
  full_name: string
  relationship: string
  date_of_birth: string | null
  is_gst_skip: boolean
}

type BeneficiaryPicklistOption = {
  value: string
  label: string
  fullName: string
  relationship: string
  isGst: boolean
}

type GapItem = {
  kind: TitlingKind
  id: string
  name: string
  subtitle: string
  owner: string | null
  needsPrimary: boolean
  needsContingent: boolean
}

type TitlingClientProps = {
  householdId: string | null
  initialAssets: Asset[]
  initialRealEstate: RealEstateItem[]
  initialAssetTitling: AssetTitling[]
  initialRealEstateTitling: RealEstateTitling[]
  initialBeneficiaries: Beneficiary[]
  initialInsurance: InsurancePolicyRow[]
  initialBusinesses: BusinessRow[]
  initialInsurancePolicyTitling: InsurancePolicyTitling[]
  initialBusinessTitling: BusinessTitlingRow[]
  householdPeople: HouseholdPersonRow[]
  hasSpouse: boolean
  person1LegalName: string | null
  person2LegalName: string | null
  categories: TitlingCategory[]
}

type TitlingKind = 'asset' | 're' | 'insurance' | 'business'

type AnyTitling = AssetTitling | RealEstateTitling | InsurancePolicyTitling | BusinessTitlingRow

// ─── Constants ────────────────────────────────────────────────────────────────

const TITLE_TYPES = [
  { value: 'sole',               label: 'Sole Ownership' },
  { value: 'joint_wros',         label: 'Joint Tenancy (WROS)' },
  { value: 'tenants_in_common',  label: 'Tenants in Common' },
  { value: 'community_property', label: 'Community Property' },
  { value: 'tod_pod',            label: 'TOD / POD' },
  { value: 'trust_owned',        label: 'Trust Owned' },
  { value: 'corporate',          label: 'Corporate / LLC' },
]

function buildAssetTitlingOptions(
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

const LIQUIDITY_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'liquid', label: 'Liquid (immediate access)' },
  { value: 'semi_liquid', label: 'Semi-liquid (30-90 days)' },
  { value: 'illiquid', label: 'Illiquid (real estate, private)' },
  { value: 'long', label: 'Long-term locked (pension, annuity)' },
]

// Exclude P&C lines — same as app/(dashboard)/titling/page.tsx
const PC_INSURANCE_TYPES = ['auto', 'homeowners', 'renters', 'umbrella', 'flood', 'earthquake', 'valuables', 'commercial', 'other']

const RELATIONSHIPS = [
  'Spouse', 'Child', 'Parent', 'Sibling', 'Grandchild',
  'Trust', 'Charity', 'Estate', 'Other',
]

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

const PREREQ_BANNER_STORAGE_KEY = 'titling-family-prerequisite-banner-dismissed'

function normalizeNameKey(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Descendants (children / grandchildren) for ordering — matches My Family groupings. */
function isDescendantRelationship(rel: string): boolean {
  const g = familyGroupLocal(rel)
  return g === 'children' || g === 'grandchildren'
}

function familyGroupLocal(rel: string): 'spouse' | 'children' | 'grandchildren' | 'other' {
  const r = rel.toLowerCase()
  if (/\b(spouse|husband|wife|partner)\b/.test(r)) return 'spouse'
  if (/grand|grandchild|grandson|granddaughter/.test(r)) return 'grandchildren'
  if (/\b(son|daughter|child|children|kid|stepchild|step-son|step-daughter)\b/.test(r)) return 'children'
  return 'other'
}

function descendantSort(a: HouseholdPersonRow, b: HouseholdPersonRow): number {
  const da = a.date_of_birth ? Date.parse(a.date_of_birth) : NaN
  const db = b.date_of_birth ? Date.parse(b.date_of_birth) : NaN
  const ta = Number.isFinite(da) ? da : Infinity
  const tb = Number.isFinite(db) ? db : Infinity
  if (ta !== tb) return ta - tb
  return a.full_name.localeCompare(b.full_name)
}

function orderedDescendants(people: HouseholdPersonRow[]): HouseholdPersonRow[] {
  return people.filter((p) => isDescendantRelationship(p.relationship)).sort(descendantSort)
}

function buildBeneficiaryPicklist(
  person1LegalName: string | null,
  person2LegalName: string | null,
  hasSpouse: boolean,
  householdPeople: HouseholdPersonRow[],
): BeneficiaryPicklistOption[] {
  const used = new Set<string>()
  const out: BeneficiaryPicklistOption[] = []

  const push = (value: string, fullName: string, relationship: string, isGst: boolean) => {
    const k = normalizeNameKey(fullName)
    if (!k) return
    if (used.has(k)) return
    used.add(k)
    const gstPart = isGst ? ' ⚠️ GST' : ''
    out.push({
      value,
      label: `${fullName} (${relationship})${gstPart}`,
      fullName,
      relationship,
      isGst,
    })
  }

  if (person1LegalName?.trim()) {
    push('hp-spouse-1', person1LegalName.trim(), 'Spouse', false)
  }
  if (hasSpouse && person2LegalName?.trim()) {
    push('hp-spouse-2', person2LegalName.trim(), 'Spouse', false)
  }

  for (const p of householdPeople) {
    const rel = p.relationship?.trim() || 'Other'
    push(`hp-row:${p.id}`, p.full_name.trim(), rel, p.is_gst_skip === true)
  }

  return out
}

function suggestPrimaryBeneficiary(params: {
  owner: string | null
  hasSpouse: boolean
  person1LegalName: string | null
  person2LegalName: string | null
  descendantsOrdered: HouseholdPersonRow[]
}): string | null {
  const { owner, hasSpouse, person1LegalName, person2LegalName, descendantsOrdered } = params
  const p1 = person1LegalName?.trim() ?? null
  const p2 = person2LegalName?.trim() ?? null
  const firstChild = descendantsOrdered[0]?.full_name.trim() ?? null

  if (owner === 'person1' && hasSpouse && p2) return p2
  if (owner === 'person2' && hasSpouse && p1) return p1
  if (owner === 'joint' && hasSpouse && p2) return p2
  if ((owner == null || owner === '') && hasSpouse && p2) return p2
  return firstChild
}

/** Matches gap-modal contingent split filter: child / son / daughter (case-insensitive);
 *  excludes grandchild, grandson, and granddaughter. */
function relationshipMatchesChildVariantsForContingentSplit(rel: string | null | undefined): boolean {
  const r = (rel ?? '').toLowerCase()
  return (
    (r.includes('child') && !r.includes('grandchild')) ||
    (r.includes('son') && !r.includes('grandson')) ||
    (r.includes('daughter') && !r.includes('granddaughter'))
  )
}

function householdChildrenForContingentSplit(people: HouseholdPersonRow[]): HouseholdPersonRow[] {
  return people.filter((p) => relationshipMatchesChildVariantsForContingentSplit(p.relationship)).sort(descendantSort)
}

/** Per-child % with 2dp; first index gets remainder so allocations sum to exactly 100. */
function contingentEvenSplitPercents(n: number): number[] {
  if (n <= 0) return []
  const perHundredth = Math.round(10000 / n)
  const remainderScaled = 10000 - perHundredth * n
  const out: number[] = []
  out.push((perHundredth + remainderScaled) / 100)
  for (let i = 1; i < n; i++) {
    out.push(perHundredth / 100)
  }
  return out
}

function picklistValueForFullName(
  fullName: string | null | undefined,
  options: BeneficiaryPicklistOption[],
): string {
  if (!fullName?.trim()) return ''
  const key = normalizeNameKey(fullName)
  const hit = options.find((o) => normalizeNameKey(o.fullName) === key)
  return hit?.value ?? '__manual__'
}

function formatDollars(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function titleLabel(value: string) {
  return TITLE_TYPES.find(t => t.value === value)?.label ?? value
}

function ownerLabel(owner: string | null, p1: string, p2: string) {
  if (owner === 'person2') return p2
  if (owner === 'joint') return 'Joint'
  return p1
}

/** Owner line on Financial Assets & Insurance cards; includes trust/other/unassigned. */
function titlingFinancialOwnerLabel(owner: string | null, p1: string, p2: string) {
  if (owner === 'person2') return p2
  if (owner === 'joint') return 'Joint'
  if (owner === 'trust') return 'Trust'
  if (owner === 'other') return 'Other'
  if (owner == null || String(owner).trim() === '') return 'Unassigned'
  return p1
}

/** Canonical buckets for grouping titling rows by `owner` (assets & insurance). */
type OwnerBucketId = 'person1' | 'person2' | 'joint' | 'trust' | 'other' | 'unknown' | 'unassigned'

const OWNER_BUCKET_ORDER: OwnerBucketId[] = [
  'person1',
  'person2',
  'joint',
  'trust',
  'other',
  'unknown',
  'unassigned',
]

function normalizeOwnerBucket(owner: string | null): OwnerBucketId {
  const o = owner?.trim().toLowerCase() ?? ''
  if (!o) return 'unassigned'
  if (o === 'person1' || o === 'person2' || o === 'joint' || o === 'trust' || o === 'other') return o
  return 'unknown'
}

function ownerBucketLabel(
  id: OwnerBucketId,
  p1First: string,
  p2First: string,
): string {
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

function groupRowsByOwnerBucket<T extends { owner: string | null }>(
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

// ─── Warning helpers ──────────────────────────────────────────────────────────

function benForItem(
  item: { id: string; kind: TitlingKind },
  b: Beneficiary
): boolean {
  if (item.kind === 'asset') return b.asset_id === item.id
  if (item.kind === 're') return b.real_estate_id === item.id
  if (item.kind === 'insurance') return b.insurance_policy_id === item.id
  return b.business_id === item.id
}

function getTitlingWarnings(
  assets: Asset[],
  realEstate: RealEstateItem[],
  insurance: InsurancePolicyRow[],
  businesses: BusinessRow[],
  assetTitling: AssetTitling[],
  realEstateTitling: RealEstateTitling[],
  insurancePolicyTitling: InsurancePolicyTitling[],
  businessTitling: BusinessTitlingRow[],
  beneficiaries: Beneficiary[]
): string[] {
  const warnings: string[] = []

  const untitledAssets = assets.filter(a => !assetTitling.find(t => t.asset_id === a.id))
  if (untitledAssets.length > 0) {
    warnings.push(`${untitledAssets.length} asset(s) have no title type set`)
  }

  const untitledRE = realEstate.filter(r => !realEstateTitling.find(t => t.real_estate_id === r.id))
  if (untitledRE.length > 0) {
    warnings.push(`${untitledRE.length} property(ies) have no title type set`)
  }

  const untitledIns = insurance.filter(p => !insurancePolicyTitling.find(t => t.insurance_policy_id === p.id))
  if (untitledIns.length > 0) {
    warnings.push(`${untitledIns.length} insurance policy/policies have no title type set`)
  }

  const untitledBiz = businesses.filter(b => !businessTitling.find(t => t.business_id === b.id))
  if (untitledBiz.length > 0) {
    warnings.push(`${untitledBiz.length} business interest(s) have no title type set`)
  }

  const needsBeneficiaryAssets = assets.filter(a => {
    const titling = assetTitling.find(t => t.asset_id === a.id)
    if (titling && ['joint_wros', 'community_property'].includes(titling.title_type)) return false
    return !beneficiaries.find(b => b.asset_id === a.id && b.beneficiary_type === 'primary')
  })
  if (needsBeneficiaryAssets.length > 0) {
    warnings.push(`${needsBeneficiaryAssets.length} asset(s) have no primary beneficiary`)
  }

  const needsBenIns = insurance.filter(p => {
    const titling = insurancePolicyTitling.find(t => t.insurance_policy_id === p.id)
    if (titling && ['joint_wros', 'community_property'].includes(titling.title_type)) return false
    return !beneficiaries.find(b => b.insurance_policy_id === p.id && b.beneficiary_type === 'primary')
  })
  if (needsBenIns.length > 0) {
    warnings.push(`${needsBenIns.length} insurance policy/policies have no primary beneficiary`)
  }

  const needsBenBiz = businesses.filter(biz => {
    const titling = businessTitling.find(t => t.business_id === biz.id)
    if (titling && ['joint_wros', 'community_property'].includes(titling.title_type)) return false
    return !beneficiaries.find(b => b.business_id === biz.id && b.beneficiary_type === 'primary')
  })
  if (needsBenBiz.length > 0) {
    warnings.push(`${needsBenBiz.length} business interest(s) have no primary beneficiary`)
  }

  const allItems: { id: string; kind: TitlingKind }[] = [
    ...assets.map(a => ({ id: a.id, kind: 'asset' as const })),
    ...realEstate.map(r => ({ id: r.id, kind: 're' as const })),
    ...insurance.map(p => ({ id: p.id, kind: 'insurance' as const })),
    ...businesses.map(b => ({ id: b.id, kind: 'business' as const })),
  ]
  for (const item of allItems) {
    for (const btype of ['primary', 'contingent'] as const) {
      const bens = beneficiaries.filter(b => b.beneficiary_type === btype && benForItem(item, b))
      if (bens.length === 0) continue
      const total = bens.reduce((s, b) => s + Number(b.allocation_pct), 0)
      if (Math.abs(total - 100) > 0.01) {
        warnings.push(`${btype} beneficiary allocations for one or more items don't add up to 100%`)
        break
      }
    }
  }

  return [...new Set(warnings)]
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TitlingClient({
  householdId,
  initialAssets,
  initialRealEstate,
  initialAssetTitling,
  initialRealEstateTitling,
  initialBeneficiaries,
  initialInsurance,
  initialBusinesses,
  initialInsurancePolicyTitling,
  initialBusinessTitling,
  householdPeople,
  hasSpouse,
  person1LegalName,
  person2LegalName,
  categories,
}: TitlingClientProps) {
  const router = useRouter()
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [realEstate, setRealEstate] = useState<RealEstateItem[]>(initialRealEstate)
  const [insurance, setInsurance] = useState<InsurancePolicyRow[]>(initialInsurance)
  const [businesses, setBusinesses] = useState<BusinessRow[]>(initialBusinesses)
  const [assetTitling, setAssetTitling] = useState<AssetTitling[]>(initialAssetTitling)
  const [realEstateTitling, setRealEstateTitling] = useState<RealEstateTitling[]>(initialRealEstateTitling)
  const [insurancePolicyTitling, setInsurancePolicyTitling] = useState<InsurancePolicyTitling[]>(initialInsurancePolicyTitling)
  const [businessTitling, setBusinessTitling] = useState<BusinessTitlingRow[]>(initialBusinessTitling)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(initialBeneficiaries)
  const [activeTab, setActiveTab] = useState<string>('assets')
  const [gapModalOpen, setGapModalOpen] = useState(false)
  const [prereqBannerDismissed, setPrereqBannerDismissed] = useState(false)

  const beneficiaryPicklistOptions = useMemo(
    () => buildBeneficiaryPicklist(person1LegalName, person2LegalName, hasSpouse, householdPeople),
    [person1LegalName, person2LegalName, hasSpouse, householdPeople],
  )

  const assetTitlingOptions = useMemo(
    () => buildAssetTitlingOptions(person1LegalName, person2LegalName),
    [person1LegalName, person2LegalName],
  )

  const descendantsOrdered = useMemo(() => orderedDescendants(householdPeople), [householdPeople])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(PREREQ_BANNER_STORAGE_KEY) === '1') {
        setPrereqBannerDismissed(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Modal state
  const [titlingModal, setTitlingModal] = useState<{
    kind: TitlingKind
    id: string
    name: string
    existing: AnyTitling | null
    asset: Asset | null
    entityRow: RealEstateItem | InsurancePolicyRow | BusinessRow | null
  } | null>(null)

  const [beneficiaryModal, setBeneficiaryModal] = useState<{
    kind: TitlingKind
    id: string
    name: string
    existing: Beneficiary | null
    beneficiaryType: 'primary' | 'contingent'
  } | null>(null)

  const warnings = getTitlingWarnings(
    assets,
    realEstate,
    insurance,
    businesses,
    assetTitling,
    realEstateTitling,
    insurancePolicyTitling,
    businessTitling,
    beneficiaries
  )

  const p1First = useMemo(
    () => displayPersonFirstName(person1LegalName, 'Person 1'),
    [person1LegalName],
  )
  const p2First = useMemo(() => displayPersonFirstName(person2LegalName), [person2LegalName])

  const assetOwnerGroups = useMemo(
    () => groupRowsByOwnerBucket(assets, p1First, p2First, 'assets'),
    [assets, p1First, p2First],
  )
  const insuranceOwnerGroups = useMemo(
    () => groupRowsByOwnerBucket(insurance, p1First, p2First, 'insurance'),
    [insurance, p1First, p2First],
  )

  async function reloadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [
      { data: assetsData },
      { data: reData },
      { data: insData },
      { data: bizData },
      { data: at },
      { data: rt },
      { data: it },
      { data: bt },
      { data: bens },
    ] = await Promise.all([
      supabase
        .from('assets')
        .select('id, name, type, value, owner, cost_basis, basis_date, titling, liquidity')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('real_estate')
        .select('id, name, property_type, current_value, owner, titling, liquidity, cost_basis, basis_date')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('insurance_policies')
        .select('id, policy_name, insurance_type, death_benefit, owner, titling, liquidity, cost_basis, basis_date')
        .eq('user_id', user.id)
        .not('insurance_type', 'in', `(${PC_INSURANCE_TYPES.join(',')})`)
        .order('created_at', { ascending: false }),
      supabase
        .from('businesses')
        .select('id, name, estimated_value, entity_type, owner, titling, liquidity, cost_basis, basis_date')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('asset_titling').select('id, asset_id, title_type, notes').eq('owner_id', user.id),
      supabase.from('real_estate_titling').select('id, real_estate_id, title_type, notes').eq('owner_id', user.id),
      supabase.from('insurance_policy_titling').select('id, insurance_policy_id, title_type, notes').eq('owner_id', user.id),
      supabase.from('business_titling').select('id, business_id, title_type, notes').eq('owner_id', user.id),
      supabase.from('asset_beneficiaries').select('id, asset_id, real_estate_id, insurance_policy_id, business_id, beneficiary_type, full_name, relationship, email, phone, allocation_pct, is_gst_skip').eq('owner_id', user.id).order('created_at', { ascending: true }),
    ])
    setAssets(assetsData ?? [])
    setRealEstate(reData ?? [])
    setInsurance(insData ?? [])
    setBusinesses(bizData ?? [])
    setAssetTitling(at ?? [])
    setRealEstateTitling(rt ?? [])
    setInsurancePolicyTitling(it ?? [])
    setBusinessTitling(bt ?? [])
    setBeneficiaries(bens ?? [])
    await refreshConflicts()
    router.refresh()
  }

  async function touchLastBeneficiaryReview() {
    if (!householdId) return
    const supabase = createClient()
    await supabase
      .from('households')
      .update({ last_beneficiary_review: new Date().toISOString() })
      .eq('id', householdId)
  }

  async function persistTitlingTitle(
    kind: TitlingKind,
    entityId: string,
    nextRaw: string,
    existing: AnyTitling | null,
  ) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const table =
      kind === 'asset' ? 'asset_titling'
      : kind === 're' ? 'real_estate_titling'
        : kind === 'insurance' ? 'insurance_policy_titling'
          : 'business_titling'
    const fkCol =
      kind === 'asset' ? 'asset_id'
      : kind === 're' ? 'real_estate_id'
        : kind === 'insurance' ? 'insurance_policy_id'
          : 'business_id'

    if (!nextRaw) {
      if (existing?.id) {
        const { error } = await supabase.from(table).delete().eq('id', existing.id)
        if (error) throw error
      }
      await reloadData()
      return
    }

    const payload = {
      title_type: nextRaw,
      notes: existing?.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await supabase.from(table).update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from(table).insert({
        ...payload,
        owner_id: user.id,
        [fkCol]: entityId,
      })
      if (error) throw error
    }

    await reloadData()
  }

  async function handleDeleteBeneficiary(id: string) {
    const supabase = createClient()
    await supabase.from('asset_beneficiaries').delete().eq('id', id)
    await reloadData()
  }

  function getBeneficiariesFor(kind: TitlingKind, id: string, type: 'primary' | 'contingent') {
    return beneficiaries.filter(b => {
      if (b.beneficiary_type !== type) return false
      if (kind === 'asset') return b.asset_id === id
      if (kind === 're') return b.real_estate_id === id
      if (kind === 'insurance') return b.insurance_policy_id === id
      return b.business_id === id
    })
  }

  function getTitlingFor(kind: TitlingKind, id: string): AnyTitling | null {
    if (kind === 'asset') return assetTitling.find(t => t.asset_id === id) ?? null
    if (kind === 're') return realEstateTitling.find(t => t.real_estate_id === id) ?? null
    if (kind === 'insurance') return insurancePolicyTitling.find(t => t.insurance_policy_id === id) ?? null
    return businessTitling.find(t => t.business_id === id) ?? null
  }

  function titlingExemptFromBeneficiaryGap(t: AnyTitling | null): boolean {
    return !!(t && ['joint_wros', 'community_property'].includes(t.title_type))
  }

  const incompleteBeneficiaryItems: GapItem[] = useMemo(() => {
    const out: GapItem[] = []
    const pushIfIncomplete = (kind: TitlingKind, id: string, name: string, subtitle: string, owner: string | null) => {
      const t = getTitlingFor(kind, id)
      if (titlingExemptFromBeneficiaryGap(t)) return
      const hasPrimary = getBeneficiariesFor(kind, id, 'primary').length > 0
      const hasContingent = getBeneficiariesFor(kind, id, 'contingent').length > 0
      if (hasPrimary && hasContingent) return
      out.push({
        kind,
        id,
        name,
        subtitle,
        owner,
        needsPrimary: !hasPrimary,
        needsContingent: !hasContingent,
      })
    }
    for (const a of assets) {
      pushIfIncomplete('asset', a.id, a.name, a.type.replace(/_/g, ' '), a.owner)
    }
    for (const r of realEstate) {
      pushIfIncomplete('re', r.id, r.name, r.property_type.replace(/_/g, ' '), r.owner)
    }
    for (const pol of insurance) {
      const displayName = pol.policy_name?.trim() || 'Insurance policy'
      const sub = (pol.insurance_type ?? 'policy').replace(/_/g, ' ')
      pushIfIncomplete('insurance', pol.id, displayName, sub, null)
    }
    for (const biz of businesses) {
      pushIfIncomplete('business', biz.id, biz.name, (biz.entity_type ?? 'entity').replace(/_/g, ' '), null)
    }
    return out
  }, [
    assets,
    realEstate,
    insurance,
    businesses,
    beneficiaries,
    assetTitling,
    realEstateTitling,
    insurancePolicyTitling,
    businessTitling,
  ])

  async function refreshConflicts() {
    try {
      await fetch('/api/estate/refresh-conflicts', { method: 'POST' })
    } catch {
      /* non-fatal */
    }
  }

  // Build tabs dynamically from DB categories
  const WIRED = ['assets', 'real_estate', 'insurance', 'business']
  const tabCounts: Record<string, number> = {
    assets: assets.length,
    real_estate: realEstate.length,
    insurance: insurance.length,
    business: businesses.length,
  }
  const tabs = categories.map(c => ({
    key: c.value,
    label: c.label,
    icon: c.icon,
    count: tabCounts[c.value] ?? null,
    wired: WIRED.includes(c.value),
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Account Titling & Beneficiaries</h1>
        <p className="mt-1 text-sm text-neutral-600">
          How each asset is titled and who inherits it. Affects estate distribution and probate.
        </p>
      </div>

      {householdPeople.length === 0 && !prereqBannerDismissed && (
        <PrerequisiteFamilyBanner
          onDismiss={() => {
            try {
              window.localStorage.setItem(PREREQ_BANNER_STORAGE_KEY, '1')
            } catch {
              /* ignore */
            }
            setPrereqBannerDismissed(true)
          }}
        />
      )}

      {incompleteBeneficiaryItems.length > 0 && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-indigo-950">
            {incompleteBeneficiaryItems.length} assets are missing beneficiary assignments
          </p>
          <button
            type="button"
            onClick={() => setGapModalOpen(true)}
            className="shrink-0 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 transition"
          >
            Review &amp; Apply Defaults →
          </button>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-1">⚠️ Action needed</p>
          <ul className="space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
            {tab.count !== null && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {tab.count}
              </span>
            )}
            {!tab.wired && (
              <span className="ml-2 rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-600">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Assets tab */}
      {activeTab === 'assets' && (
        <>
          {assets.length === 0 ? (
            <EmptyState icon="🏦" message="No assets found" sub="Add assets on the Assets page first" href="/assets" />
          ) : (
            assetOwnerGroups.map(group => (
              <CollapsibleSection
                key={group.id}
                title={group.title}
                defaultOpen={group.id === 'person1'}
                storageKey={group.storageKey}
              >
                <div className="space-y-4">
                  {group.rows.map(asset => (
                    <AssetTitlingCard
                      key={asset.id}
                      kind="asset"
                      id={asset.id}
                      name={asset.name}
                      subtitle={asset.type.replace(/_/g, ' ')}
                      value={asset.value}
                      ownerLabel={titlingFinancialOwnerLabel(asset.owner, p1First, p2First)}
                      titling={getTitlingFor('asset', asset.id)}
                      primaryBens={getBeneficiariesFor('asset', asset.id, 'primary')}
                      contingentBens={getBeneficiariesFor('asset', asset.id, 'contingent')}
                      onEditTitling={() => setTitlingModal({
                        kind: 'asset', id: asset.id, name: asset.name,
                        existing: getTitlingFor('asset', asset.id) as AssetTitling | null,
                        asset,
                        entityRow: null,
                      })}
                      onAddBeneficiary={(type) => setBeneficiaryModal({
                        kind: 'asset', id: asset.id, name: asset.name, existing: null, beneficiaryType: type,
                      })}
                      onEditBeneficiary={(ben) => setBeneficiaryModal({
                        kind: 'asset', id: asset.id, name: asset.name, existing: ben, beneficiaryType: ben.beneficiary_type,
                      })}
                      onDeleteBeneficiary={handleDeleteBeneficiary}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            ))
          )}
        </>
      )}

      {/* Real Estate tab */}
      {activeTab === 'real_estate' && (
        <CollapsibleSection
          title="Real Estate"
          defaultOpen={true}
          storageKey="titling-real-estate"
        >
          <div className="space-y-4">
          {realEstate.length === 0 ? (
            <EmptyState icon="🏠" message="No properties found" sub="Add properties on the Real Estate page first" href="/real-estate" />
          ) : (
            realEstate.map(re => (
              <AssetTitlingCard
                key={re.id}
                kind="re"
                id={re.id}
                name={re.name}
                subtitle={re.property_type.replace(/_/g, ' ')}
                value={re.current_value}
                ownerLabel={ownerLabel(
                  re.owner,
                  displayPersonFirstName(person1LegalName, 'Person 1'),
                  displayPersonFirstName(person2LegalName),
                )}
                titling={getTitlingFor('re', re.id)}
                primaryBens={getBeneficiariesFor('re', re.id, 'primary')}
                contingentBens={getBeneficiariesFor('re', re.id, 'contingent')}
                onEditTitling={() => setTitlingModal({
                  kind: 're', id: re.id, name: re.name,
                  existing: getTitlingFor('re', re.id) as RealEstateTitling | null,
                  asset: null,
                  entityRow: re,
                })}
                onAddBeneficiary={(type) => setBeneficiaryModal({
                  kind: 're', id: re.id, name: re.name, existing: null, beneficiaryType: type,
                })}
                onEditBeneficiary={(ben) => setBeneficiaryModal({
                  kind: 're', id: re.id, name: re.name, existing: ben, beneficiaryType: ben.beneficiary_type,

                })}
                onDeleteBeneficiary={handleDeleteBeneficiary}
              />
            ))
          )}
          </div>
        </CollapsibleSection>
      )}

      {/* Insurance tab */}
      {activeTab === 'insurance' && (
        <>
          {insurance.length === 0 ? (
            <EmptyState icon="🛡️" message="No insurance policies found" sub="Add life, annuity, LTC, or disability coverage on the Insurance page first" href="/insurance" />
          ) : (
            insuranceOwnerGroups.map(group => (
              <CollapsibleSection
                key={group.id}
                title={group.title}
                defaultOpen={group.id === 'person1'}
                storageKey={group.storageKey}
              >
                <div className="space-y-4">
                  {group.rows.map(pol => {
                    const displayName = pol.policy_name?.trim() || 'Insurance policy'
                    const sub = (pol.insurance_type ?? 'policy').replace(/_/g, ' ')
                    return (
                      <AssetTitlingCard
                        key={pol.id}
                        kind="insurance"
                        id={pol.id}
                        name={displayName}
                        subtitle={sub}
                        value={pol.death_benefit ?? 0}
                        ownerLabel={titlingFinancialOwnerLabel(pol.owner, p1First, p2First)}
                        titling={getTitlingFor('insurance', pol.id)}
                        primaryBens={getBeneficiariesFor('insurance', pol.id, 'primary')}
                        contingentBens={getBeneficiariesFor('insurance', pol.id, 'contingent')}
                        onEditTitling={() => setTitlingModal({
                          kind: 'insurance', id: pol.id, name: displayName,
                          existing: getTitlingFor('insurance', pol.id),
                          asset: null,
                          entityRow: pol,
                        })}
                        onAddBeneficiary={(type) => setBeneficiaryModal({
                          kind: 'insurance', id: pol.id, name: displayName, existing: null, beneficiaryType: type,
                        })}
                        onEditBeneficiary={(ben) => setBeneficiaryModal({
                          kind: 'insurance', id: pol.id, name: displayName, existing: ben, beneficiaryType: ben.beneficiary_type,
                        })}
                        onDeleteBeneficiary={handleDeleteBeneficiary}
                      />
                    )
                  })}
                </div>
              </CollapsibleSection>
            ))
          )}
        </>
      )}

      {/* Business tab */}
      {activeTab === 'business' && (
        <CollapsibleSection
          title="Business Interests"
          defaultOpen={true}
          storageKey="titling-business-interests"
        >
          <div className="space-y-4">
          {businesses.length === 0 ? (
            <EmptyState icon="🏢" message="No business interests found" sub="Add closely-held interests on the Businesses page first" href="/businesses" />
          ) : (
            businesses.map(biz => (
              <AssetTitlingCard
                key={biz.id}
                kind="business"
                id={biz.id}
                name={biz.name}
                subtitle={(biz.entity_type ?? 'entity').replace(/_/g, ' ')}
                value={biz.estimated_value ?? 0}
                ownerLabel="—"
                titling={getTitlingFor('business', biz.id)}
                primaryBens={getBeneficiariesFor('business', biz.id, 'primary')}
                contingentBens={getBeneficiariesFor('business', biz.id, 'contingent')}
                onEditTitling={() => setTitlingModal({
                  kind: 'business', id: biz.id, name: biz.name,
                  existing: getTitlingFor('business', biz.id),
                  asset: null,
                  entityRow: biz,
                })}
                onAddBeneficiary={(type) => setBeneficiaryModal({
                  kind: 'business', id: biz.id, name: biz.name, existing: null, beneficiaryType: type,
                })}
                onEditBeneficiary={(ben) => setBeneficiaryModal({
                  kind: 'business', id: biz.id, name: biz.name, existing: ben, beneficiaryType: ben.beneficiary_type,
                })}
                onDeleteBeneficiary={handleDeleteBeneficiary}
              />
            ))
          )}
          </div>
        </CollapsibleSection>
      )}

      {/* Titling Modal */}
      {titlingModal && (
        <TitlingModal
          kind={titlingModal.kind}
          id={titlingModal.id}
          name={titlingModal.name}
          existing={titlingModal.existing}
          asset={titlingModal.asset}
          entityRow={titlingModal.entityRow}
          titlingOptions={assetTitlingOptions}
          onClose={() => setTitlingModal(null)}
          onSave={async () => { await reloadData(); setTitlingModal(null) }}
        />
      )}

      {/* Beneficiary Modal */}
      {beneficiaryModal && (
        <BeneficiaryModal
          kind={beneficiaryModal.kind}
          id={beneficiaryModal.id}
          name={beneficiaryModal.name}
          existing={beneficiaryModal.existing}
          defaultType={beneficiaryModal.beneficiaryType}
          allBeneficiariesForItem={beneficiaries.filter(b =>
            benForItem({ id: beneficiaryModal.id, kind: beneficiaryModal.kind }, b) &&
            b.id !== beneficiaryModal.existing?.id
          )}
          picklistOptions={beneficiaryPicklistOptions}
          householdPeopleEmpty={householdPeople.length === 0}
          onClose={() => setBeneficiaryModal(null)}
          onSave={async () => {
            await touchLastBeneficiaryReview()
            await reloadData()
            setBeneficiaryModal(null)
          }}
        />
      )}

      {gapModalOpen && (
        <BeneficiaryGapModal
          items={incompleteBeneficiaryItems}
          picklistOptions={beneficiaryPicklistOptions}
          beneficiaries={beneficiaries}
          householdPeople={householdPeople}
          hasSpouse={hasSpouse}
          person1LegalName={person1LegalName}
          person2LegalName={person2LegalName}
          descendantsOrdered={descendantsOrdered}
          onClose={() => setGapModalOpen(false)}
          onApplied={async () => {
            await touchLastBeneficiaryReview()
            await reloadData()
            setGapModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Asset / RE card ──────────────────────────────────────────────────────────

function AssetTitlingCard({
  kind: _kind, id, name, subtitle, value, ownerLabel, titling,
  primaryBens, contingentBens,
  onEditTitling, onAddBeneficiary, onEditBeneficiary, onDeleteBeneficiary,
}: {
  kind: TitlingKind
  id: string
  name: string
  subtitle: string
  value: number
  ownerLabel: string
  titling: AnyTitling | null
  primaryBens: Beneficiary[]
  contingentBens: Beneficiary[]
  onEditTitling: () => void
  onAddBeneficiary: (type: 'primary' | 'contingent') => void
  onEditBeneficiary: (ben: Beneficiary) => void
  onDeleteBeneficiary: (id: string) => void
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const primaryTotal = primaryBens.reduce((s, b) => s + Number(b.allocation_pct), 0)
  const contingentTotal = contingentBens.reduce((s, b) => s + Number(b.allocation_pct), 0)

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* Asset header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{name}</p>
            <p className="text-xs text-neutral-400 capitalize mt-0.5">{subtitle} · {ownerLabel} · {formatDollars(value)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-3">
            {titling ? (
              <span className="text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full px-3 py-1">
                {titleLabel(titling.title_type)}
              </span>
            ) : (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-3 py-1">
                No title set
              </span>
            )}
            <button
              type="button"
              onClick={onEditTitling}
              className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
            >
              {titling ? 'Edit title' : 'Set title'}
            </button>
          </div>
        </div>
      </div>

      {/* Notes */}
      {titling?.notes && (
        <div className="px-5 py-2 bg-neutral-50 border-b border-neutral-100">
          <p className="text-xs text-neutral-500 italic">{titling.notes}</p>
        </div>
      )}

      {/* Beneficiaries */}
      <div className="px-5 py-4 space-y-4">
        {/* Primary */}
        <BeneficiarySection
          label="Primary Beneficiaries"
          bens={primaryBens}
          total={primaryTotal}
          confirmDeleteId={confirmDeleteId}
          onAdd={() => onAddBeneficiary('primary')}
          onEdit={onEditBeneficiary}
          onDelete={(id) => { setConfirmDeleteId(id) }}
          onConfirmDelete={(id) => { onDeleteBeneficiary(id); setConfirmDeleteId(null) }}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
        {/* Contingent */}
        <BeneficiarySection
          label="Contingent Beneficiaries"
          bens={contingentBens}
          total={contingentTotal}
          confirmDeleteId={confirmDeleteId}
          onAdd={() => onAddBeneficiary('contingent')}
          onEdit={onEditBeneficiary}
          onDelete={(id) => { setConfirmDeleteId(id) }}
          onConfirmDelete={(id) => { onDeleteBeneficiary(id); setConfirmDeleteId(null) }}
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
      </div>
    </div>
  )
}

// ─── Beneficiary section ──────────────────────────────────────────────────────

function BeneficiarySection({
  label, bens, total, confirmDeleteId,
  onAdd, onEdit, onDelete, onConfirmDelete, onCancelDelete,
}: {
  label: string
  bens: Beneficiary[]
  total: number
  confirmDeleteId: string | null
  onAdd: () => void
  onEdit: (ben: Beneficiary) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const allocationOk = bens.length === 0 || Math.abs(total - 100) < 0.01

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
          {bens.length > 0 && (
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              allocationOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {total.toFixed(0)}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
        >
          + Add
        </button>
      </div>

      {bens.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">None added</p>
      ) : (
        <div className="space-y-2">
          {bens.map(ben => (
            <div key={ben.id} className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {ben.full_name}
                  {ben.is_gst_skip && (
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 ml-1">GST Skip</span>
                  )}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {ben.relationship && <span>{ben.relationship}</span>}
                  {ben.relationship && (ben.email || ben.phone) && <span> · </span>}
                  {ben.email && <span>{ben.email}</span>}
                  {ben.email && ben.phone && <span> · </span>}
                  {ben.phone && <span>{ben.phone}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-700">{Number(ben.allocation_pct).toFixed(0)}%</span>
                {confirmDeleteId === ben.id ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="text-neutral-500">Delete?</span>
                    <button type="button" onClick={() => onConfirmDelete(ben.id)} className="text-red-600 font-medium hover:text-red-800">Yes</button>
                    <button type="button" onClick={onCancelDelete} className="text-neutral-400 hover:text-neutral-600">No</button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <button type="button" onClick={() => onEdit(ben)} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">Edit</button>
                    <button type="button" onClick={() => onDelete(ben.id)} className="text-xs text-red-500 font-medium hover:text-red-700">Delete</button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Titling Modal ────────────────────────────────────────────────────────────

function TitlingModal({
  kind, id, name, existing, asset, entityRow, titlingOptions, onClose, onSave,
}: {
  kind: TitlingKind
  id: string
  name: string
  existing: AnyTitling | null
  asset: Asset | null
  entityRow: RealEstateItem | InsurancePolicyRow | BusinessRow | null
  titlingOptions: { value: string; label: string }[]
  onClose: () => void
  onSave: () => void
}) {
  const [titleType, setTitleType] = useState(existing?.title_type ?? 'sole')
  const [assetTitling, setAssetTitling] = useState(asset?.titling ?? '')
  const [ownerTitling, setOwnerTitling] = useState(
    entityRow ? (entityRow.titling ?? '') : '',
  )
  const [liquidity, setLiquidity] = useState(
    (kind === 'asset' ? asset?.liquidity : entityRow?.liquidity) ?? '',
  )
  const [costBasis, setCostBasis] = useState(() => {
    const cb = kind === 'asset' ? asset?.cost_basis : entityRow?.cost_basis
    return cb == null ? '' : String(cb)
  })
  const [basisDate, setBasisDate] = useState(
    (kind === 'asset' ? asset?.basis_date : entityRow?.basis_date) ?? '',
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const table =
        kind === 'asset' ? 'asset_titling'
        : kind === 're' ? 'real_estate_titling'
          : kind === 'insurance' ? 'insurance_policy_titling'
            : 'business_titling'
      const fkCol =
        kind === 'asset' ? 'asset_id'
        : kind === 're' ? 'real_estate_id'
          : kind === 'insurance' ? 'insurance_policy_id'
            : 'business_id'
      const payload = {
        title_type: titleType,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await supabase.from(table).update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from(table).insert({
          ...payload,
          owner_id: user.id,
          [fkCol]: id,
        })
        if (error) throw error
      }

      const parsedCostBasis = costBasis.trim() === '' ? null : Number(costBasis)
      if (parsedCostBasis !== null && Number.isNaN(parsedCostBasis)) {
        throw new Error('Cost basis must be a valid number.')
      }

      if (kind === 'asset') {
        const { error: assetError } = await supabase
          .from('assets')
          .update({
            titling: assetTitling || null,
            liquidity: liquidity || null,
            cost_basis: parsedCostBasis,
            basis_date: basisDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (assetError) throw assetError
      } else if (kind === 're') {
        const { error: reErr } = await supabase
          .from('real_estate')
          .update({
            titling: ownerTitling || null,
            liquidity: liquidity || null,
            cost_basis: parsedCostBasis,
            basis_date: basisDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (reErr) throw reErr
      } else if (kind === 'insurance') {
        const { error: insErr } = await supabase
          .from('insurance_policies')
          .update({
            titling: ownerTitling || null,
            liquidity: liquidity || null,
            cost_basis: parsedCostBasis,
            basis_date: basisDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (insErr) throw insErr
      } else if (kind === 'business') {
        const { error: bizErr } = await supabase
          .from('businesses')
          .update({
            titling: ownerTitling || null,
            liquidity: liquidity || null,
            cost_basis: parsedCostBasis,
            basis_date: basisDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
        if (bizErr) throw bizErr
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell title={`Set Title — ${name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
        {kind === 'asset' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title Type</label>
              <select value={titleType} onChange={e => setTitleType(e.target.value)} className={inputClass}>
                {TITLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-neutral-400">{getTitleDescription(titleType)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Titling</label>
              <select
                value={assetTitling}
                onChange={e => setAssetTitling(e.target.value)}
                className={inputClass}
              >
                {titlingOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Liquidity</label>
              <select
                value={liquidity}
                onChange={e => setLiquidity(e.target.value)}
                className={inputClass}
              >
                {LIQUIDITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cost Basis</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costBasis}
                  onChange={e => setCostBasis(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Basis Date</label>
                <input
                  type="date"
                  value={basisDate}
                  onChange={e => setBasisDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Owner</label>
              <select
                value={ownerTitling}
                onChange={e => setOwnerTitling(e.target.value)}
                className={inputClass}
              >
                {titlingOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title Type</label>
              <select value={titleType} onChange={e => setTitleType(e.target.value)} className={inputClass}>
                {TITLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-neutral-400">{getTitleDescription(titleType)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Liquidity</label>
              <select
                value={liquidity}
                onChange={e => setLiquidity(e.target.value)}
                className={inputClass}
              >
                {LIQUIDITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cost Basis</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costBasis}
                  onChange={e => setCostBasis(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Basis Date</label>
                <input
                  type="date"
                  value={basisDate}
                  onChange={e => setBasisDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Notes <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={inputClass}
            placeholder="e.g. Trust name, TIC split percentage"
          />
        </div>
        <ModalButtons onClose={onClose} isSubmitting={isSubmitting} isEdit={!!existing} />
      </form>
    </ModalShell>
  )
}

// ─── Prerequisite banner (My Family) ──────────────────────────────────────────

function PrerequisiteFamilyBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-amber-950">
          For accurate beneficiary assignments, add your family members first.
        </p>
        <Link href="/my-family" className="mt-1 inline-block text-sm font-medium text-indigo-700 hover:underline">
          Go to My Family →
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-lg leading-none text-neutral-400 hover:text-neutral-600"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

// ─── Gap review modal ─────────────────────────────────────────────────────────

function gapItemKey(row: GapItem): string {
  return `${row.kind}:${row.id}`
}

type BeneficiaryGapRowState = {
  primaryValue: string
  primaryManual: string
  contingentValue: string
  contingentManual: string
  contingentSplitRows: Array<{
    householdPersonId: string
    pickValue: string
    manual: string
    allocationPct: string
  }> | null
}

/** Merge UI row edits with freshly built defaults so partial state never drops contingent splits or suggested primaries. */
function mergeGapRowForApply(
  fb: BeneficiaryGapRowState,
  cur: BeneficiaryGapRowState | undefined,
): BeneficiaryGapRowState {
  if (!cur) return fb
  const useCurPrimary = cur.primaryValue !== '' || cur.primaryManual.trim() !== ''
  const split =
    cur.contingentSplitRows && cur.contingentSplitRows.length > 0
      ? cur.contingentSplitRows
      : fb.contingentSplitRows
  const useCurContingentSingle =
    !split || split.length === 0
      ? cur.contingentValue !== '' || cur.contingentManual.trim() !== ''
      : false
  return {
    ...fb,
    ...cur,
    primaryValue: useCurPrimary ? cur.primaryValue : fb.primaryValue,
    primaryManual: useCurPrimary ? cur.primaryManual : fb.primaryManual,
    contingentSplitRows: split,
    contingentValue: useCurContingentSingle ? cur.contingentValue : fb.contingentValue,
    contingentManual: useCurContingentSingle ? cur.contingentManual : fb.contingentManual,
  }
}

function buildBeneficiaryGapRowsState(
  items: GapItem[],
  picklistOptions: BeneficiaryPicklistOption[],
  householdPeople: HouseholdPersonRow[],
  hasSpouse: boolean,
  person1LegalName: string | null,
  person2LegalName: string | null,
  descendantsOrdered: HouseholdPersonRow[],
): Record<string, BeneficiaryGapRowState> {
  const childrenForSplit = householdChildrenForContingentSplit(householdPeople)
  const next: Record<string, BeneficiaryGapRowState> = {}
  for (const row of items) {
    const sp = row.needsPrimary
      ? suggestPrimaryBeneficiary({
          owner: row.owner,
          hasSpouse,
          person1LegalName,
          person2LegalName,
          descendantsOrdered,
        })
      : null
    let contingentValue = ''
    let contingentManual = ''
    let contingentSplitRows: BeneficiaryGapRowState['contingentSplitRows'] = null
    if (row.needsContingent) {
      if (childrenForSplit.length >= 1) {
        const splits = contingentEvenSplitPercents(childrenForSplit.length)
        contingentSplitRows = childrenForSplit.map((c, i) => ({
          householdPersonId: c.id,
          pickValue: `hp-row:${c.id}`,
          manual: '',
          allocationPct: splits[i].toFixed(2),
        }))
      } else {
        contingentValue = ''
        contingentManual = ''
      }
    }
    next[gapItemKey(row)] = {
      primaryValue: row.needsPrimary && sp ? picklistValueForFullName(sp, picklistOptions) : '',
      primaryManual: '',
      contingentValue,
      contingentManual,
      contingentSplitRows,
    }
  }
  return next
}

function resolveBeneficiaryFromPick(
  value: string,
  manual: string,
  options: BeneficiaryPicklistOption[],
): { fullName: string; relationship: string; isGst: boolean } | null {
  if (!value) return null
  if (value === '__manual__') {
    const t = manual.trim()
    if (!t) return null
    return { fullName: t, relationship: 'Other', isGst: false }
  }
  const opt = options.find((o) => o.value === value)
  if (!opt) return null
  return { fullName: opt.fullName, relationship: opt.relationship, isGst: opt.isGst }
}

function BeneficiaryGapModal({
  items,
  picklistOptions,
  beneficiaries,
  householdPeople,
  hasSpouse,
  person1LegalName,
  person2LegalName,
  descendantsOrdered,
  onClose,
  onApplied,
}: {
  items: GapItem[]
  picklistOptions: BeneficiaryPicklistOption[]
  beneficiaries: Beneficiary[]
  householdPeople: HouseholdPersonRow[]
  hasSpouse: boolean
  person1LegalName: string | null
  person2LegalName: string | null
  descendantsOrdered: HouseholdPersonRow[]
  onClose: () => void
  onApplied: () => Promise<void>
}) {
  const [rows, setRows] = useState<Record<string, BeneficiaryGapRowState>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackRows = useMemo(
    () =>
      buildBeneficiaryGapRowsState(
        items,
        picklistOptions,
        householdPeople,
        hasSpouse,
        person1LegalName,
        person2LegalName,
        descendantsOrdered,
      ),
    [
      items,
      picklistOptions,
      householdPeople,
      hasSpouse,
      person1LegalName,
      person2LegalName,
      descendantsOrdered,
    ],
  )

  useEffect(() => {
    setRows(
      buildBeneficiaryGapRowsState(
        items,
        picklistOptions,
        householdPeople,
        hasSpouse,
        person1LegalName,
        person2LegalName,
        descendantsOrdered,
      ),
    )
  }, [items, hasSpouse, person1LegalName, person2LegalName, descendantsOrdered, picklistOptions, householdPeople])

  function getBensFor(
    working: Beneficiary[],
    kind: TitlingKind,
    itemId: string,
    type: 'primary' | 'contingent',
  ) {
    return working.filter((b) => {
      if (b.beneficiary_type !== type) return false
      if (kind === 'asset') return b.asset_id === itemId
      if (kind === 're') return b.real_estate_id === itemId
      if (kind === 'insurance') return b.insurance_policy_id === itemId
      return b.business_id === itemId
    })
  }

  function remainingPct(working: Beneficiary[], kind: TitlingKind, itemId: string, type: 'primary' | 'contingent') {
    const allocated = getBensFor(working, kind, itemId, type).reduce((s, b) => s + Number(b.allocation_pct), 0)
    return Math.max(0, 100 - allocated)
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to apply defaults.')
        return
      }

      let working = [...beneficiaries]

      for (const row of items) {
        const key = gapItemKey(row)
        const fb = fallbackRows[key]
        if (!fb) continue
        const st = mergeGapRowForApply(fb, rows[key])

        if (row.needsPrimary) {
          const resolved = resolveBeneficiaryFromPick(st.primaryValue, st.primaryManual, picklistOptions)
          if (resolved) {
            const rem = remainingPct(working, row.kind, row.id, 'primary')
            if (rem > 0.01) {
              const payload = {
                beneficiary_type: 'primary' as const,
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null as string | null,
                phone: null as string | null,
                allocation_pct: rem,
                is_gst_skip: resolved.isGst,
                updated_at: new Date().toISOString(),
              }
              const { error: insErr } = await supabase.from('asset_beneficiaries').insert({
                ...payload,
                owner_id: user.id,
                asset_id: row.kind === 'asset' ? row.id : null,
                real_estate_id: row.kind === 're' ? row.id : null,
                insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                business_id: row.kind === 'business' ? row.id : null,
              })
              if (insErr) throw insErr
              working.push({
                id: `temp-${row.id}-p`,
                asset_id: row.kind === 'asset' ? row.id : null,
                real_estate_id: row.kind === 're' ? row.id : null,
                insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                business_id: row.kind === 'business' ? row.id : null,
                beneficiary_type: 'primary',
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null,
                phone: null,
                allocation_pct: rem,
                is_gst_skip: resolved.isGst,
              })
            }
          }
        }

        if (row.needsContingent) {
          if (st.contingentSplitRows && st.contingentSplitRows.length > 0) {
            for (const cr of st.contingentSplitRows) {
              const resolved = resolveBeneficiaryFromPick(cr.pickValue, cr.manual, picklistOptions)
              if (!resolved) continue
              const already = getBensFor(working, row.kind, row.id, 'contingent').some(
                (b) => normalizeNameKey(b.full_name) === normalizeNameKey(resolved.fullName),
              )
              if (already) continue
              const pct = parseFloat(cr.allocationPct)
              if (!Number.isFinite(pct) || pct <= 0) continue
              const payload = {
                beneficiary_type: 'contingent' as const,
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null as string | null,
                phone: null as string | null,
                allocation_pct: pct,
                is_gst_skip: resolved.isGst,
                updated_at: new Date().toISOString(),
              }
              const { error: insErr } = await supabase.from('asset_beneficiaries').insert({
                ...payload,
                owner_id: user.id,
                asset_id: row.kind === 'asset' ? row.id : null,
                real_estate_id: row.kind === 're' ? row.id : null,
                insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                business_id: row.kind === 'business' ? row.id : null,
              })
              if (insErr) throw insErr
              working.push({
                id: `temp-${row.id}-c-${cr.householdPersonId}`,
                asset_id: row.kind === 'asset' ? row.id : null,
                real_estate_id: row.kind === 're' ? row.id : null,
                insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                business_id: row.kind === 'business' ? row.id : null,
                beneficiary_type: 'contingent',
                full_name: resolved.fullName,
                relationship: resolved.relationship,
                email: null,
                phone: null,
                allocation_pct: pct,
                is_gst_skip: resolved.isGst,
              })
            }
          } else {
            const resolved = resolveBeneficiaryFromPick(st.contingentValue, st.contingentManual, picklistOptions)
            if (resolved) {
              const rem = remainingPct(working, row.kind, row.id, 'contingent')
              if (rem > 0.01) {
                const payload = {
                  beneficiary_type: 'contingent' as const,
                  full_name: resolved.fullName,
                  relationship: resolved.relationship,
                  email: null as string | null,
                  phone: null as string | null,
                  allocation_pct: rem,
                  is_gst_skip: resolved.isGst,
                  updated_at: new Date().toISOString(),
                }
                const { error: insErr } = await supabase.from('asset_beneficiaries').insert({
                  ...payload,
                  owner_id: user.id,
                  asset_id: row.kind === 'asset' ? row.id : null,
                  real_estate_id: row.kind === 're' ? row.id : null,
                  insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                  business_id: row.kind === 'business' ? row.id : null,
                })
                if (insErr) throw insErr
                working.push({
                  id: `temp-${row.id}-c`,
                  asset_id: row.kind === 'asset' ? row.id : null,
                  real_estate_id: row.kind === 're' ? row.id : null,
                  insurance_policy_id: row.kind === 'insurance' ? row.id : null,
                  business_id: row.kind === 'business' ? row.id : null,
                  beneficiary_type: 'contingent',
                  full_name: resolved.fullName,
                  relationship: resolved.relationship,
                  email: null,
                  phone: null,
                  allocation_pct: rem,
                  is_gst_skip: resolved.isGst,
                })
              }
            }
          }
        }
      }

      await onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell title="Review & Apply Defaults" onClose={onClose} wide>
      <form onSubmit={handleApply} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}
        <p className="text-xs text-neutral-600">
          Only missing primary or contingent assignments are saved. Existing designations are never overwritten.
        </p>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Asset / policy</th>
                <th className="px-3 py-2">Primary</th>
                <th className="px-3 py-2">Contingent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((row) => {
                const k = gapItemKey(row)
                const st =
                  rows[k] ??
                  fallbackRows[k] ?? {
                    primaryValue: '',
                    primaryManual: '',
                    contingentValue: '',
                    contingentManual: '',
                    contingentSplitRows: null,
                  }
                const primaries = beneficiaries.filter((b) => {
                  if (b.beneficiary_type !== 'primary') return false
                  if (row.kind === 'asset') return b.asset_id === row.id
                  if (row.kind === 're') return b.real_estate_id === row.id
                  if (row.kind === 'insurance') return b.insurance_policy_id === row.id
                  return b.business_id === row.id
                })
                const contingents = beneficiaries.filter((b) => {
                  if (b.beneficiary_type !== 'contingent') return false
                  if (row.kind === 'asset') return b.asset_id === row.id
                  if (row.kind === 're') return b.real_estate_id === row.id
                  if (row.kind === 'insurance') return b.insurance_policy_id === row.id
                  return b.business_id === row.id
                })
                return (
                  <tr key={k} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-neutral-900">{row.name}</p>
                      <p className="text-xs text-neutral-400 capitalize">{row.subtitle}</p>
                    </td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      {row.needsPrimary ? (
                        <div className="space-y-1">
                          <select
                            value={st.primaryValue}
                            onChange={(e) =>
                              setRows((prev) => {
                                const cur = prev[k] ?? fallbackRows[k]!
                                return { ...prev, [k]: { ...cur, primaryValue: e.target.value } }
                              })
                            }
                            className={inputClass}
                          >
                            <option value="">Choose…</option>
                            {picklistOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                            <option value="__manual__">+ Add manually…</option>
                          </select>
                          {st.primaryValue === '__manual__' && (
                            <input
                              type="text"
                              value={st.primaryManual}
                              onChange={(e) =>
                                setRows((prev) => {
                                  const cur = prev[k] ?? fallbackRows[k]!
                                  return { ...prev, [k]: { ...cur, primaryManual: e.target.value } }
                                })
                              }
                              className={inputClass}
                              placeholder="Full name"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-700">
                          {primaries.map((b) => b.full_name).join(', ') || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[14rem]">
                      {row.needsContingent ? (
                        st.contingentSplitRows && st.contingentSplitRows.length > 0 ? (
                          <div className="space-y-2">
                            {st.contingentSplitRows.map((cr) => (
                              <div
                                key={cr.householdPersonId}
                                className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-2 space-y-1"
                              >
                                <select
                                  value={cr.pickValue}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setRows((prev) => {
                                      const cur = prev[k] ?? fallbackRows[k]!
                                      if (!cur.contingentSplitRows) return prev
                                      return {
                                        ...prev,
                                        [k]: {
                                          ...cur,
                                          contingentSplitRows: cur.contingentSplitRows.map((r) =>
                                            r.householdPersonId === cr.householdPersonId
                                              ? { ...r, pickValue: v }
                                              : r,
                                          ),
                                        },
                                      }
                                    })
                                  }}
                                  className={inputClass}
                                >
                                  <option value="">Choose…</option>
                                  {picklistOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                  <option value="__manual__">+ Add manually…</option>
                                </select>
                                {cr.pickValue === '__manual__' && (
                                  <input
                                    type="text"
                                    value={cr.manual}
                                    onChange={(e) => {
                                      const t = e.target.value
                                      setRows((prev) => {
                                        const cur = prev[k] ?? fallbackRows[k]!
                                        if (!cur.contingentSplitRows) return prev
                                        return {
                                          ...prev,
                                          [k]: {
                                            ...cur,
                                            contingentSplitRows: cur.contingentSplitRows.map((r) =>
                                              r.householdPersonId === cr.householdPersonId
                                                ? { ...r, manual: t }
                                                : r,
                                            ),
                                          },
                                        }
                                      })
                                    }}
                                    className={inputClass}
                                    placeholder="Full name"
                                  />
                                )}
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-neutral-500 shrink-0">Allocation %</label>
                                  <input
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={cr.allocationPct}
                                    onChange={(e) => {
                                      const t = e.target.value
                                      setRows((prev) => {
                                        const cur = prev[k] ?? fallbackRows[k]!
                                        if (!cur.contingentSplitRows) return prev
                                        return {
                                          ...prev,
                                          [k]: {
                                            ...cur,
                                            contingentSplitRows: cur.contingentSplitRows.map((r) =>
                                              r.householdPersonId === cr.householdPersonId
                                                ? { ...r, allocationPct: t }
                                                : r,
                                            ),
                                          },
                                        }
                                      })
                                    }}
                                    className={`${inputClass} min-w-0 flex-1`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={st.contingentValue}
                              onChange={(e) =>
                                setRows((prev) => {
                                  const cur = prev[k] ?? fallbackRows[k]!
                                  return { ...prev, [k]: { ...cur, contingentValue: e.target.value } }
                                })
                              }
                              className={inputClass}
                            >
                              <option value="">Choose…</option>
                              {picklistOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                              <option value="__manual__">+ Add manually…</option>
                            </select>
                            {st.contingentValue === '__manual__' && (
                              <input
                                type="text"
                                value={st.contingentManual}
                                onChange={(e) =>
                                  setRows((prev) => {
                                    const cur = prev[k] ?? fallbackRows[k]!
                                    return { ...prev, [k]: { ...cur, contingentManual: e.target.value } }
                                  })
                                }
                                className={inputClass}
                                placeholder="Full name"
                              />
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-sm text-neutral-700">
                          {contingents.map((b) => b.full_name).join(', ') || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Saving…' : 'Apply These Defaults'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ─── Beneficiary Modal ────────────────────────────────────────────────────────

function BeneficiaryModal({
  kind,
  id,
  name,
  existing,
  defaultType,
  allBeneficiariesForItem,
  picklistOptions,
  householdPeopleEmpty,
  onClose,
  onSave,
}: {
  kind: TitlingKind
  id: string
  name: string
  existing: Beneficiary | null
  defaultType: 'primary' | 'contingent'
  allBeneficiariesForItem: Beneficiary[]
  picklistOptions: BeneficiaryPicklistOption[]
  householdPeopleEmpty: boolean
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [beneficiaryType, setBeneficiaryType] = useState<'primary' | 'contingent'>(
    existing?.beneficiary_type ?? defaultType,
  )
  const [pickerValue, setPickerValue] = useState(() =>
    existing ? picklistValueForFullName(existing.full_name, picklistOptions) : '',
  )
  const [manualName, setManualName] = useState(existing?.full_name ?? '')
  const [manualRelationship, setManualRelationship] = useState(existing?.relationship || 'Other')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [isGstSkip, setIsGstSkip] = useState(existing?.is_gst_skip ?? false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calcRemaining = (type: 'primary' | 'contingent') => {
    const allocated = allBeneficiariesForItem
      .filter((b) => b.beneficiary_type === type)
      .reduce((s, b) => s + Number(b.allocation_pct), 0)
    return Math.max(0, 100 - allocated)
  }

  const [allocationPct, setAllocationPct] = useState(() => {
    if (existing?.allocation_pct != null) return existing.allocation_pct.toString()
    return String(calcRemaining(existing?.beneficiary_type ?? defaultType))
  })

  function applyPickerChoice(next: string) {
    setPickerValue(next)
    if (next === '' || next === '__manual__') {
      if (next === '__manual__') {
        setManualName((m) => m || existing?.full_name || '')
      }
      return
    }
    const opt = picklistOptions.find((o) => o.value === next)
    if (opt) {
      setManualName(opt.fullName)
      setManualRelationship(opt.relationship)
      setIsGstSkip(opt.isGst)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const pct = parseFloat(allocationPct)
    const remaining = calcRemaining(beneficiaryType)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Allocation must be between 1 and 100.')
      setIsSubmitting(false)
      return
    }
    if (pct > remaining + 0.01) {
      setError(`Only ${remaining.toFixed(0)}% remaining for ${beneficiaryType} beneficiaries.`)
      setIsSubmitting(false)
      return
    }

    let fullNameOut: string
    let relationshipOut: string | null

    if (pickerValue === '__manual__') {
      const t = manualName.trim()
      if (!t) {
        setError('Enter a full name or pick from the list.')
        setIsSubmitting(false)
        return
      }
      fullNameOut = t
      relationshipOut = manualRelationship.trim() || null
    } else if (pickerValue) {
      const opt = picklistOptions.find((o) => o.value === pickerValue)
      if (!opt) {
        setError('Invalid beneficiary selection.')
        setIsSubmitting(false)
        return
      }
      fullNameOut = opt.fullName
      relationshipOut = opt.relationship || null
    } else {
      setError('Choose a beneficiary or + Add manually…')
      setIsSubmitting(false)
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const payload = {
        beneficiary_type: beneficiaryType,
        full_name: fullNameOut,
        relationship: relationshipOut,
        email: email.trim() || null,
        phone: phone.trim() || null,
        allocation_pct: pct,
        is_gst_skip: isGstSkip,
        updated_at: new Date().toISOString(),
      }
      if (existing) {
        const { error } = await supabase.from('asset_beneficiaries').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('asset_beneficiaries').insert({
          ...payload,
          owner_id: user.id,
          asset_id: kind === 'asset' ? id : null,
          real_estate_id: kind === 're' ? id : null,
          insurance_policy_id: kind === 'insurance' ? id : null,
          business_id: kind === 'business' ? id : null,
        })
        if (error) throw error
      }
      await onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setIsSubmitting(false)
    }
  }

  const remaining = calcRemaining(beneficiaryType)
  const alreadyAllocated = 100 - remaining
  const showManualFields = pickerValue === '__manual__'

  return (
    <ModalShell title={`${existing ? 'Edit' : 'Add'} Beneficiary — ${name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
          <select
            value={beneficiaryType}
            onChange={(e) => {
              const v = e.target.value as 'primary' | 'contingent'
              setBeneficiaryType(v)
              setAllocationPct(String(calcRemaining(v)))
            }}
            className={inputClass}
          >
            <option value="primary">Primary</option>
            <option value="contingent">Contingent</option>
          </select>
        </div>

        {householdPeopleEmpty && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            <p>Add family members on the My Family page first for the best results.</p>
            <Link href="/my-family" className="mt-1 inline-block font-medium text-indigo-700 hover:underline">
              Go to My Family →
            </Link>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Beneficiary</label>
          <select
            value={pickerValue}
            onChange={(e) => applyPickerChoice(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {picklistOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="__manual__">+ Add manually…</option>
          </select>
        </div>

        {showManualFields && (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Jane Smith or trust / charity name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Relationship</label>
              <select
                value={manualRelationship}
                onChange={(e) => setManualRelationship(e.target.value)}
                className={inputClass}
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="gst_skip_modal"
            checked={isGstSkip}
            onChange={(e) => setIsGstSkip(e.target.checked)}
            className="rounded border-neutral-300"
          />
          <label htmlFor="gst_skip_modal" className="text-sm text-neutral-700">
            GST Skip Person (grandchild or skip generation)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Allocation (%)</label>
          <input
            type="number"
            required
            min="1"
            max={remaining}
            step="0.01"
            value={allocationPct}
            onChange={(e) => setAllocationPct(e.target.value)}
            className={inputClass}
            placeholder={remaining.toString()}
          />
          <p className="mt-1 text-xs text-neutral-400">
            {alreadyAllocated > 0
              ? `${alreadyAllocated.toFixed(0)}% already allocated — ${remaining.toFixed(0)}% remaining`
              : 'All beneficiaries of this type should total 100%.'}
          </p>
        </div>
        <ModalButtons onClose={onClose} isSubmitting={isSubmitting} isEdit={!!existing} />
      </form>
    </ModalShell>
  )
}


// ─── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  wide,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 ${
          wide ? 'max-w-4xl' : 'max-w-md'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function ModalButtons({ onClose, isSubmitting, isEdit }: { onClose: () => void; isSubmitting: boolean; isEdit: boolean }) {
  return (
    <div className="flex gap-3 pt-2 pb-1">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
      >
        {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add'}
      </button>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, message, sub, href }: { icon: string; message: string; sub: string; href: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-neutral-600">{message}</p>
      <p className="text-xs text-neutral-400 mt-1">{sub}</p>
      <a href={href} className="mt-3 text-sm text-indigo-600 hover:underline">Go there →</a>
    </div>
  )
}

// ─── Title type descriptions ──────────────────────────────────────────────────

function getTitleDescription(titleType: string): string {
  const descriptions: Record<string, string> = {
    sole:               'Owned by one person. Goes through probate unless TOD/beneficiary is named.',
    joint_wros:         'Co-owners each hold an undivided interest. Survivor inherits automatically — no probate.',
    tenants_in_common:  'Each owner holds a specific share. Their share passes through their estate/will.',
    community_property: 'Property acquired during marriage owned equally by both spouses.',
    tod_pod:            'Transfer/Payable on Death — passes directly to named beneficiary, bypasses probate.',
    trust_owned:        'Held in a trust. Distribution governed by trust terms — typically avoids probate.',
    corporate:          'Owned by a business entity (LLC, corporation, partnership).',
  }
  return descriptions[titleType] ?? ''
}
