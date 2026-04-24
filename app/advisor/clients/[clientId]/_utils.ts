// app/advisor/clients/[clientId]/_utils.ts
// Shared helpers for advisor client view tabs

export function getAge(birthYear: number | null, currentYear: number): number | null {
  if (!birthYear) return null
  return currentYear - birthYear
}

export function formatCurrency(val: number | null | undefined, compact = false): string {
  if (val === null || val === undefined) return '—'
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return `${val}%`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getComplexityStyle(flag: string | null) {
  switch (flag) {
    case 'low':      return { complexity: 'Low',      complexityColor: 'text-emerald-700', complexityBg: 'bg-emerald-50' }
    case 'moderate': return { complexity: 'Moderate', complexityColor: 'text-amber-700',   complexityBg: 'bg-amber-50' }
    case 'high':     return { complexity: 'High',     complexityColor: 'text-orange-700',  complexityBg: 'bg-orange-50' }
    case 'critical': return { complexity: 'Critical', complexityColor: 'text-red-700',     complexityBg: 'bg-red-50' }
    default:         return { complexity: 'Unknown',  complexityColor: 'text-slate-600',   complexityBg: 'bg-slate-100' }
  }
}

// ── Gap analysis engine ───────────────────────────────────────────────────────
// Leading practice: identifies planning gaps from available data.
// Returns array of gap objects sorted by severity.

export interface Gap {
  severity: 'critical' | 'high' | 'moderate' | 'low'
  category: string
  title: string
  detail: string
}

type HouseholdGapInput = {
  estate_complexity_score?: number | null
  has_spouse?: boolean | null
  target_stocks_pct?: number | null
  risk_tolerance?: string | null
  person1_birth_year?: number | null
  person1_ss_claiming_age?: number | null
}

type AssetGapInput = {
  value?: number | null
  type?: string | null
  account_type?: string | null
}

type RealEstateGapInput = {
  current_value?: number | null
  mortgage_balance?: number | null
  owner?: string | null
}

type BeneficiaryGapInput = {
  contingent?: boolean | null
}

type EstateDocumentGapInput = {
  document_type?: string | null
  exists?: boolean | null
}

export function computeGaps(params: {
  household: HouseholdGapInput
  assets: AssetGapInput[]
  realEstate: RealEstateGapInput[]
  beneficiaries: BeneficiaryGapInput[]
  estateDocuments: EstateDocumentGapInput[]
}): Gap[] {
  const { household, assets, realEstate, beneficiaries, estateDocuments } = params
  const gaps: Gap[] = []

  const docMap = Object.fromEntries(
    (estateDocuments ?? []).map(d => [d.document_type, d])
  )

  const totalAssets = [
    ...(assets ?? []).map(a => a.value ?? 0),
    ...(realEstate ?? []).map(r => r.current_value ?? 0),
  ].reduce((s, v) => s + v, 0)

  const totalLiabilities = [
    ...(realEstate ?? []).map(r => r.mortgage_balance ?? 0),
  ].reduce((s, v) => s + v, 0)

  const netWorth = totalAssets - totalLiabilities
  const score = household.estate_complexity_score ?? 0

  // ── Estate document gaps ──────────────────────────────────────────────────
  if (!docMap['will']?.exists) {
    gaps.push({
      severity: netWorth > 500_000 ? 'critical' : 'high',
      category: 'Estate Planning',
      title: 'No Will on File',
      detail: 'Client has not confirmed existence of a Last Will & Testament. Intestate succession risk.',
    })
  }

  if (!docMap['dpoa']?.exists) {
    gaps.push({
      severity: 'high',
      category: 'Incapacity Planning',
      title: 'No Durable Power of Attorney',
      detail: 'No DPOA confirmed. Financial decisions cannot be delegated if client becomes incapacitated.',
    })
  }

  if (!docMap['medical_poa']?.exists) {
    gaps.push({
      severity: 'high',
      category: 'Incapacity Planning',
      title: 'No Medical Power of Attorney',
      detail: 'No Medical POA on file. Healthcare decisions may be delayed or contested.',
    })
  }

  if (!docMap['advance_directive']?.exists) {
    gaps.push({
      severity: 'moderate',
      category: 'Incapacity Planning',
      title: 'No Advance Directive / Living Will',
      detail: 'No advance healthcare directive confirmed. End-of-life preferences undocumented.',
    })
  }

  // ── Trust gap (high complexity) ───────────────────────────────────────────
  if (score >= 46 && !docMap['trust']?.exists) {
    gaps.push({
      severity: 'high',
      category: 'Estate Planning',
      title: 'High Complexity — No Trust',
      detail: `Estate complexity score is ${score}. A revocable living trust is typically recommended above score 45.`,
    })
  }

  // ── Beneficiary gaps ──────────────────────────────────────────────────────
  const retirementAssets = (assets ?? []).filter(a => {
    const t = ((a as { type?: string; account_type?: string }).type ?? a.account_type ?? '').toLowerCase()
    return ['401k', 'ira', 'roth_ira', 'sep_ira', '403b', '457', 'pension'].includes(t)
  })

  if (retirementAssets.length > 0 && (beneficiaries ?? []).length === 0) {
    gaps.push({
      severity: 'critical',
      category: 'Beneficiary Designations',
      title: 'Retirement Accounts — No Beneficiaries',
      detail: `${retirementAssets.length} retirement account(s) found with no beneficiary designations on record.`,
    })
  }

  const hasPrimary = (beneficiaries ?? []).some(b => !b.contingent)
  const hasContingent = (beneficiaries ?? []).some(b => b.contingent)
  if (hasPrimary && !hasContingent && netWorth > 250_000) {
    gaps.push({
      severity: 'moderate',
      category: 'Beneficiary Designations',
      title: 'No Contingent Beneficiary',
      detail: 'Primary beneficiary named but no contingent beneficiary. Lapse risk if primary predeceases client.',
    })
  }

  // ── Titling gaps ──────────────────────────────────────────────────────────
  const soloRealEstate = (realEstate ?? []).filter(r => r.owner === 'person1' || r.owner === 'person2')
  if (household.has_spouse && soloRealEstate.length > 0) {
    gaps.push({
      severity: 'moderate',
      category: 'Asset Titling',
      title: 'Real Estate — Sole Ownership with Spouse',
      detail: `${soloRealEstate.length} property(ies) titled in one spouse's name only. Review for joint tenancy or community property alignment.`,
    })
  }

  // ── Allocation gaps ───────────────────────────────────────────────────────
  const stocks = household.target_stocks_pct ?? 0
  const tolerance = household.risk_tolerance

  if (tolerance === 'conservative' && stocks > 40) {
    gaps.push({
      severity: 'moderate',
      category: 'Investment Policy',
      title: 'Allocation Inconsistent with Risk Tolerance',
      detail: `Target allocation is ${stocks}% stocks but risk tolerance is Conservative. Review suitability.`,
    })
  }
  if (tolerance === 'aggressive' && stocks < 60) {
    gaps.push({
      severity: 'low',
      category: 'Investment Policy',
      title: 'Allocation May Be Too Conservative',
      detail: `Target allocation is ${stocks}% stocks but risk tolerance is Aggressive. Confirm strategy with client.`,
    })
  }

  // ── Social Security gap ───────────────────────────────────────────────────
  const p1Age = new Date().getFullYear() - (household.person1_birth_year ?? 0)
  if (p1Age >= 55 && !household.person1_ss_claiming_age) {
    gaps.push({
      severity: 'moderate',
      category: 'Retirement Planning',
      title: 'Social Security Claiming Age Not Set',
      detail: 'Client is within 10 years of Social Security eligibility. Claiming age strategy not documented.',
    })
  }

  // Sort: critical → high → moderate → low
  const order = { critical: 0, high: 1, moderate: 2, low: 3 }
  return gaps.sort((a, b) => order[a.severity] - order[b.severity])
}

export function severityBadge(severity: Gap['severity']) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700'
    case 'high':     return 'bg-orange-100 text-orange-700'
    case 'moderate': return 'bg-amber-100 text-amber-700'
    case 'low':      return 'bg-blue-100 text-blue-700'
  }
}

export function severityDot(severity: Gap['severity']) {
  switch (severity) {
    case 'critical': return 'bg-red-500'
    case 'high':     return 'bg-orange-500'
    case 'moderate': return 'bg-amber-400'
    case 'low':      return 'bg-blue-400'
  }
}
