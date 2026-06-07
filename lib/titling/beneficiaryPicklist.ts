import { displayPersonFirstName } from '@/lib/display-person-name'
import type { BeneficiaryPicklistOption, HouseholdPersonRow } from './titlingEntityTypes'

export function normalizeNameKey(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function familyGroupLocal(rel: string): 'spouse' | 'children' | 'grandchildren' | 'other' {
  const r = rel.toLowerCase()
  if (/\b(spouse|husband|wife|partner)\b/.test(r)) return 'spouse'
  if (/grand|grandchild|grandson|granddaughter/.test(r)) return 'grandchildren'
  if (/\b(son|daughter|child|children|kid|stepchild|step-son|step-daughter)\b/.test(r)) return 'children'
  return 'other'
}

function isDescendantRelationship(rel: string): boolean {
  const g = familyGroupLocal(rel)
  return g === 'children' || g === 'grandchildren'
}

function descendantSort(a: HouseholdPersonRow, b: HouseholdPersonRow): number {
  const da = a.date_of_birth ? Date.parse(a.date_of_birth) : NaN
  const db = b.date_of_birth ? Date.parse(b.date_of_birth) : NaN
  const ta = Number.isFinite(da) ? da : Infinity
  const tb = Number.isFinite(db) ? db : Infinity
  if (ta !== tb) return ta - tb
  return a.full_name.localeCompare(b.full_name)
}

export function orderedDescendants(people: HouseholdPersonRow[]): HouseholdPersonRow[] {
  return people.filter((p) => isDescendantRelationship(p.relationship)).sort(descendantSort)
}

export function buildBeneficiaryPicklist(
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

export function suggestPrimaryBeneficiary(params: {
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

export function relationshipMatchesChildVariantsForContingentSplit(rel: string | null | undefined): boolean {
  const r = (rel ?? '').toLowerCase()
  return (
    (r.includes('child') && !r.includes('grandchild')) ||
    (r.includes('son') && !r.includes('grandson')) ||
    (r.includes('daughter') && !r.includes('granddaughter'))
  )
}

export function householdChildrenForContingentSplit(people: HouseholdPersonRow[]): HouseholdPersonRow[] {
  return people.filter((p) => relationshipMatchesChildVariantsForContingentSplit(p.relationship)).sort(descendantSort)
}

export function contingentEvenSplitPercents(n: number): number[] {
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

export function picklistValueForFullName(
  fullName: string | null | undefined,
  options: BeneficiaryPicklistOption[],
): string {
  if (!fullName?.trim()) return ''
  const key = normalizeNameKey(fullName)
  const hit = options.find((o) => normalizeNameKey(o.fullName) === key)
  return hit?.value ?? '__manual__'
}
