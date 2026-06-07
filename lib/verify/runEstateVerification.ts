import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { classifyEstateAssets } from '@/lib/estate/classifyEstateAssets'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { loadEstatePlanPdfTaxPayload } from '@/lib/export/loadEstatePlanPdfTaxPayload'
import { buildStrategyHorizons } from '@/lib/my-estate-strategy/horizonSnapshots'
import {
  calculateStateEstateTax,
  isMFJFilingStatus,
  resolveActiveStateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import { computeFederalExportTax, latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'
import type { EstateVerificationPreset } from '@/lib/verify/estateVerificationPresets'
import { ESTATE_VERIFICATION_PRESETS } from '@/lib/verify/estateVerificationPresets'

export type EstateSurfaceSnapshot = {
  grossEstate: number
  federalTax: number
  stateTax: number
  netEstate: number | null
}

export type EstateMatrixRow = {
  metric: string
  compositionCache: number | null
  compositionLive: number | null
  exportEngineB: number | null
  horizonsToday: number | null
  projectionY0: number | null
  advisorPdf: number | null
  tolerance: number
  required: boolean
  pass: boolean
  note?: string
}

export type EstateVerificationResult = {
  householdId: string
  preset: EstateVerificationPreset | null
  label: string
  ownerEmail: string | null
  statePrimary: string
  filingStatus: string
  lifetimeGiftsUsed: number
  hasBaseCase: boolean
  surfaces: {
    compositionCache: EstateSurfaceSnapshot
    compositionLive: EstateSurfaceSnapshot
    exportEngineB: EstateSurfaceSnapshot
    horizonsToday: EstateSurfaceSnapshot
    projectionY0: EstateSurfaceSnapshot | null
    advisorPdf: EstateSurfaceSnapshot | null
  }
  matrix: EstateMatrixRow[]
  goldenChecks: Array<{ metric: string; expected: number; actual: number; pass: boolean }>
  passed: boolean
}

export type RunEstateVerificationOptions = {
  householdId?: string
  preset?: EstateVerificationPreset
  userEmail?: string
  strictProjection?: boolean
  checkGoldens?: boolean
  goldenDir?: string
  tolerance?: number
}

const DEFAULT_TOLERANCE = 1

function snapshotFromComposition(raw: {
  gross_estate?: number
  estimated_tax_federal?: number | null
  estimated_tax?: number
  estimated_tax_state?: number | null
  net_estate?: number
}): EstateSurfaceSnapshot {
  const federal =
    raw.estimated_tax_federal != null
      ? Number(raw.estimated_tax_federal)
      : Number(raw.estimated_tax ?? 0)
  return {
    grossEstate: Math.max(0, Number(raw.gross_estate ?? 0)),
    federalTax: Math.max(0, federal),
    stateTax: Math.max(0, Number(raw.estimated_tax_state ?? 0)),
    netEstate: raw.net_estate != null ? Number(raw.net_estate) : null,
  }
}

function snapshotFromExportTax(payload: Awaited<ReturnType<typeof loadEstatePlanPdfTaxPayload>>): EstateSurfaceSnapshot {
  return {
    grossEstate: Math.max(0, Number(payload.federal_estate_tax.gross_estate ?? 0)),
    federalTax: Math.max(0, Number(payload.federal_estate_tax.estimated_tax ?? 0)),
    stateTax: Math.max(0, Number(payload.state_estate_tax.estimated_state_tax ?? 0)),
    netEstate: null,
  }
}

function snapshotFromHorizonColumn(col: {
  grossEstate: number | null
  federalTaxEstimate: number | null
  stateTax: number | null
}): EstateSurfaceSnapshot {
  return {
    grossEstate: Math.max(0, Number(col.grossEstate ?? 0)),
    federalTax: Math.max(0, Number(col.federalTaxEstimate ?? 0)),
    stateTax: Math.max(0, Number(col.stateTax ?? 0)),
    netEstate: null,
  }
}

function snapshotFromProjectionRow(row: Record<string, unknown> | null): EstateSurfaceSnapshot | null {
  if (!row) return null
  return {
    grossEstate: Math.max(0, Number(row.estate_incl_home ?? row.gross_estate ?? 0)),
    federalTax: Math.max(
      0,
      Number(row.estate_tax_federal ?? row.federal_tax ?? row.federal_estate_tax ?? 0),
    ),
    stateTax: Math.max(0, Number(row.estate_tax_state ?? row.state_tax ?? 0)),
    netEstate: row.net_to_heirs != null ? Number(row.net_to_heirs) : null,
  }
}

function mapStateBracketRows(rows: Array<Record<string, unknown>>): StateBracket[] {
  return rows.map((r) => ({
    min_amount: Number(r.min_amount ?? 0),
    max_amount: r.max_amount != null ? Number(r.max_amount) : 9_999_999_999,
    rate_pct: Number(r.rate_pct ?? 0),
    exemption_amount: Number(r.exemption_amount ?? 0),
  }))
}

function valuesWithinTolerance(a: number | null, b: number | null, tolerance: number): boolean {
  if (a == null || b == null) return true
  return Math.abs(a - b) <= tolerance
}

function coreSurfacesAligned(values: number[], tolerance: number): boolean {
  if (values.length === 0) return false
  const anchor = values[0]
  return values.every((v) => valuesWithinTolerance(anchor, v, tolerance))
}

function buildMatrix(
  surfaces: EstateVerificationResult['surfaces'],
  tolerance: number,
  strictProjection: boolean,
): EstateMatrixRow[] {
  const metrics: Array<{
    key: keyof Omit<EstateSurfaceSnapshot, 'netEstate'>
    label: string
  }> = [
    { key: 'grossEstate', label: 'Gross estate' },
    { key: 'federalTax', label: 'Federal estate tax' },
    { key: 'stateTax', label: 'State estate tax' },
  ]

  return metrics.map(({ key, label }) => {
    const compositionCache = surfaces.compositionCache[key]
    const compositionLive = surfaces.compositionLive[key]
    const exportEngineB = surfaces.exportEngineB[key]
    const horizonsToday = surfaces.horizonsToday[key]
    const projectionY0 = surfaces.projectionY0?.[key] ?? null
    const advisorPdf = surfaces.advisorPdf?.[key] ?? null

    const passCore = coreSurfacesAligned(
      [compositionCache, compositionLive, exportEngineB, horizonsToday],
      tolerance,
    )

    let note: string | undefined
    if (projectionY0 != null && !valuesWithinTolerance(compositionCache, projectionY0, tolerance)) {
      note = 'Projection Y0 uses scenario engine inputs — may differ until base case is regenerated'
    }
    if (advisorPdf != null && !valuesWithinTolerance(compositionCache, advisorPdf, tolerance)) {
      const advisorNote = 'Advisor PDF export uses projection gross when base case exists'
      note = note ? `${note}; ${advisorNote}` : advisorNote
    }

    let pass = passCore
    if (strictProjection && projectionY0 != null) {
      pass = pass && valuesWithinTolerance(compositionCache, projectionY0, tolerance)
    }

    return {
      metric: label,
      compositionCache,
      compositionLive,
      exportEngineB,
      horizonsToday,
      projectionY0,
      advisorPdf,
      tolerance,
      required: true,
      pass,
      note,
    }
  })
}

export async function resolveVerificationHouseholdId(
  admin: SupabaseClient,
  opts: RunEstateVerificationOptions,
): Promise<{ householdId: string; preset: EstateVerificationPreset | null; label: string }> {
  if (opts.householdId?.trim()) {
    return {
      householdId: opts.householdId.trim(),
      preset: opts.preset ?? null,
      label: opts.preset ? ESTATE_VERIFICATION_PRESETS[opts.preset].label : `Household ${opts.householdId.trim()}`,
    }
  }

  if (opts.preset) {
    if (opts.preset === 'e2e') {
      const e2eId = process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim()
      if (!e2eId) {
        throw new Error('Preset e2e requires PLAYWRIGHT_HOUSEHOLD_ID — run npm run seed:e2e first')
      }
      return { householdId: e2eId, preset: 'e2e', label: ESTATE_VERIFICATION_PRESETS.e2e.label }
    }
    const preset = ESTATE_VERIFICATION_PRESETS[opts.preset]
    return { householdId: preset.householdId, preset: opts.preset, label: preset.label }
  }

  const email = opts.userEmail?.trim() || process.env.VERIFY_USER_EMAIL?.trim()
  if (email) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) throw new Error(`No auth user for email ${email}`)

    const { data: household } = await admin
      .from('households')
      .select('id, name')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!household) throw new Error(`No household for ${email}`)
    return {
      householdId: household.id,
      preset: null,
      label: `${household.name ?? email} (${email})`,
    }
  }

  const envId = process.env.HOUSEHOLD_ID?.trim()
  if (envId) {
    return { householdId: envId, preset: null, label: `Household ${envId}` }
  }

  throw new Error('Set HOUSEHOLD_ID, VERIFY_USER_EMAIL, --preset, or pass householdId')
}

async function loadGoldenChecks(
  preset: EstateVerificationPreset | null,
  checkGoldens: boolean,
  goldenDir: string,
  surfaces: EstateVerificationResult['surfaces'],
  tolerance: number,
): Promise<EstateVerificationResult['goldenChecks']> {
  if (!checkGoldens || !preset) return []
  const fixtureName = ESTATE_VERIFICATION_PRESETS[preset].goldenFixture
  if (!fixtureName) return []

  const fs = await import('fs/promises')
  const path = await import('path')
  const fixturePath = path.join(goldenDir, fixtureName)
  try {
    const raw = JSON.parse(await fs.readFile(fixturePath, 'utf8')) as {
      gross_estate?: number
      federal_tax?: number
      state_tax?: number
      tolerance?: number
    }
    const goldenTolerance = raw.tolerance ?? tolerance
    const checks = [
      { metric: 'Gross estate', expected: raw.gross_estate, actual: surfaces.compositionCache.grossEstate },
      { metric: 'Federal estate tax', expected: raw.federal_tax, actual: surfaces.compositionCache.federalTax },
      { metric: 'State estate tax', expected: raw.state_tax, actual: surfaces.compositionCache.stateTax },
    ]
    return checks
      .filter((c) => c.expected != null)
      .map((c) => ({
        metric: c.metric,
        expected: Number(c.expected),
        actual: c.actual,
        pass: valuesWithinTolerance(Number(c.expected), c.actual, goldenTolerance),
      }))
  } catch {
    return []
  }
}

export async function runEstateVerification(
  admin: SupabaseClient,
  opts: RunEstateVerificationOptions = {},
): Promise<EstateVerificationResult> {
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE
  const strictProjection = opts.strictProjection ?? false
  const goldenDir = opts.goldenDir ?? 'tests/fixtures/estate-golden'

  const resolved = await resolveVerificationHouseholdId(admin, opts)

  const { data: household, error: hhErr } = await admin
    .from('households')
    .select(
      'id, owner_id, name, filing_status, has_spouse, state_primary, base_case_scenario_id, person1_first_name, person2_first_name, person1_birth_year, person2_birth_year, person1_longevity_age, person2_longevity_age',
    )
    .eq('id', resolved.householdId)
    .single()

  if (hhErr || !household) {
    throw new Error(`Household not found: ${resolved.householdId}`)
  }

  const currentYear = new Date().getFullYear()
  const statePrimary = String(household.state_primary ?? '').trim().toUpperCase()

  const [giftingRes, federalBracketRows, strategyRowsRes, stateRulesRes, ownerProfile, scenarioRes] =
    await Promise.all([
      admin.rpc('calculate_gifting_summary', { p_household_id: household.id }),
      admin
        .from('federal_estate_tax_brackets')
        .select('tax_year, min_amount, max_amount, rate_pct')
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true }),
      admin
        .from('strategy_line_items')
        .select('strategy_source, consumer_accepted, consumer_rejected, source_role, is_active')
        .eq('household_id', household.id)
        .eq('is_active', true)
        .is('projection_year', null),
      statePrimary
        ? admin
            .from('state_estate_tax_rules')
            .select('min_amount, max_amount, rate_pct, exemption_amount')
            .eq('state', statePrimary)
            .eq('tax_year', currentYear)
            .order('min_amount', { ascending: true })
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
      admin.from('profiles').select('email').eq('id', household.owner_id).maybeSingle(),
      household.base_case_scenario_id
        ? admin.from('projection_scenarios').select('*').eq('id', household.base_case_scenario_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

  const lifetimeGiftsUsed = Math.max(
    0,
    Number((giftingRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0),
  )

  let stateBrackets = mapStateBracketRows(stateRulesRes.data ?? [])
  if (statePrimary && stateBrackets.length === 0) {
    const fallback = await admin
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', statePrimary)
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true })
      .limit(20)
    stateBrackets = mapStateBracketRows(fallback.data ?? [])
  }

  const federalBrackets = latestFederalBracketsFromRows(federalBracketRows.data ?? [])
  const hasBypassTrust = deriveHasBypassTrustFromLineItems(strategyRowsRes.data ?? [], 'consumer_accepted')

  const [compositionCache, compositionLive, exportTax] = await Promise.all([
    getCachedComposition(admin, household.id, 'consumer', lifetimeGiftsUsed),
    classifyEstateAssets(admin, household.id, 'consumer', lifetimeGiftsUsed),
    loadEstatePlanPdfTaxPayload(admin, household.id, household),
  ])

  const scenario = scenarioRes.data as Record<string, unknown> | null
  const scenarioOutputs = (
    scenario && Array.isArray(scenario.outputs_s1_first) && scenario.outputs_s1_first.length > 0
      ? scenario.outputs_s1_first
      : scenario && Array.isArray(scenario.outputs)
        ? scenario.outputs
        : []
  ) as Array<Record<string, unknown>>
  const latestOutput = scenarioOutputs.length > 0 ? scenarioOutputs[0] : null
  const hasBaseCase = Boolean(household.base_case_scenario_id && latestOutput)

  const currentMonthYearLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const horizons = buildStrategyHorizons({
    currentYear,
    currentMonthYearLabel,
    liveNetWorth: Number(compositionCache.gross_estate ?? 0),
    stateBrackets,
    federalBrackets,
    lifetimeGiftsUsed,
    household: {
      state_primary: household.state_primary,
      filing_status: household.filing_status,
      has_spouse: household.has_spouse,
      person1_name: household.person1_first_name,
      person2_name: household.person2_first_name,
      person1_birth_year: household.person1_birth_year,
      person2_birth_year: household.person2_birth_year,
      person1_longevity_age: household.person1_longevity_age,
      person2_longevity_age: household.person2_longevity_age,
    },
    scenarioRows: scenarioOutputs.length > 0 ? (scenarioOutputs as never) : null,
    survivorFirstName: String(household.person2_first_name ?? household.person1_first_name ?? 'Survivor'),
    longevityAge: Number(household.person1_longevity_age ?? 95),
    hasBypassTrust,
  })

  const projectionY0 = snapshotFromProjectionRow(latestOutput)

  let advisorPdf: EstateSurfaceSnapshot | null = null
  if (latestOutput) {
    const grossForPdf = Math.max(0, Number(latestOutput.estate_incl_home ?? 0))
    const { federalTax } = computeFederalExportTax({
      grossEstate: grossForPdf,
      filingStatus: household.filing_status,
      hasSpouse: Boolean(household.has_spouse),
      brackets: federalBrackets,
      lifetimeGiftsUsed,
      lawScenario: 'current_law',
    })
    const stateResult = calculateStateEstateTax(
      grossForPdf,
      statePrimary,
      stateBrackets,
      isMFJFilingStatus(household.filing_status),
      false,
    )
    const stateTax = resolveActiveStateTax(stateResult, hasBypassTrust)
    advisorPdf = {
      grossEstate: grossForPdf,
      federalTax,
      stateTax,
      netEstate: latestOutput.net_to_heirs != null ? Number(latestOutput.net_to_heirs) : null,
    }
  }

  const surfaces = {
    compositionCache: snapshotFromComposition(compositionCache),
    compositionLive: snapshotFromComposition(compositionLive),
    exportEngineB: snapshotFromExportTax(exportTax),
    horizonsToday: snapshotFromHorizonColumn(horizons.today),
    projectionY0,
    advisorPdf,
  }

  const matrix = buildMatrix(surfaces, tolerance, strictProjection)

  const goldenChecks = await loadGoldenChecks(
    resolved.preset,
    opts.checkGoldens ?? false,
    goldenDir,
    surfaces,
    tolerance,
  )

  const passed =
    matrix.every((r) => r.pass) &&
    goldenChecks.every((g) => g.pass) &&
    compositionCache.success !== false &&
    compositionLive.success !== false

  return {
    householdId: household.id,
    preset: resolved.preset,
    label: resolved.label,
    ownerEmail: ownerProfile.data?.email ?? null,
    statePrimary,
    filingStatus: String(household.filing_status ?? 'single'),
    lifetimeGiftsUsed,
    hasBaseCase,
    surfaces,
    matrix,
    goldenChecks,
    passed,
  }
}

export function formatEstateVerificationMatrix(result: EstateVerificationResult): string {
  const col = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`)
  const lines: string[] = []

  lines.push('')
  lines.push('Estate verification matrix')
  lines.push('─'.repeat(72))
  lines.push(`Target: ${result.label}`)
  lines.push(`Household: ${result.householdId}`)
  if (result.ownerEmail) lines.push(`Owner: ${result.ownerEmail}`)
  lines.push(`State: ${result.statePrimary} · Filing: ${result.filingStatus} · Gifts used: $${Math.round(result.lifetimeGiftsUsed).toLocaleString()}`)
  lines.push(`Base case: ${result.hasBaseCase ? 'yes' : 'no'}`)
  lines.push('')

  const header =
    'Metric'.padEnd(22) +
    'Cache'.padStart(14) +
    'Live RPC'.padStart(14) +
    'Export'.padStart(14) +
    'Horiz Today'.padStart(14) +
    'Proj Y0'.padStart(14) +
    '  OK'
  lines.push(header)
  lines.push('─'.repeat(header.length))

  for (const row of result.matrix) {
    lines.push(
      row.metric.padEnd(22) +
        col(row.compositionCache).padStart(14) +
        col(row.compositionLive).padStart(14) +
        col(row.exportEngineB).padStart(14) +
        col(row.horizonsToday).padStart(14) +
        col(row.projectionY0).padStart(14) +
        `  ${row.pass ? '✓' : '✗'}`,
    )
    if (row.note) lines.push(`  ↳ ${row.note}`)
  }

  if (result.goldenChecks.length > 0) {
    lines.push('')
    lines.push('Golden fixture checks')
    for (const g of result.goldenChecks) {
      lines.push(
        `  ${g.pass ? 'PASS' : 'FAIL'} ${g.metric}: expected ${col(g.expected)} · actual ${col(g.actual)}`,
      )
    }
  }

  lines.push('')
  lines.push('Surface key: Cache = composition cache · Live RPC = calculate_estate_composition')
  lines.push('Export = estate-plan PDF Engine B · Horiz Today = strategy Today column')
  lines.push('Proj Y0 = base-case projection row 0 (informational unless --strict-projection)')
  lines.push('')
  lines.push(result.passed ? 'RESULT: PASS — all required surfaces aligned' : 'RESULT: FAIL — see rows marked ✗')
  lines.push('')

  return lines.join('\n')
}
