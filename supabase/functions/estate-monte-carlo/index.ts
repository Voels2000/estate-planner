// supabase/functions/estate-monte-carlo/index.ts
// Supabase Edge Function — runs estate Monte Carlo computation
// Deployed to: https://[project].supabase.co/functions/v1/estate-monte-carlo
//
// Why Edge Function not Vercel API route:
//   - Vercel serverless: 10s timeout (insufficient for 500 paths)
//   - Supabase Edge Function: 60s wall clock (sufficient)
//
// Called from: components/advisor/MonteCarloPanel.tsx
// Results stored in: monte_carlo_results table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inline the Monte Carlo engine (Edge Functions are self-contained)
// This mirrors lib/calculations/estate-monte-carlo.ts

const DEFAULT_RETURN_MEAN = 0.07
const DEFAULT_RETURN_VOL = 0.12

// Inlined from lib/calculations/stateEstateTax.ts (edge cannot import @/lib)
type StateBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

const NO_PORTABILITY_STATES = new Set([
  'WA', 'OR', 'MN', 'MA', 'ME', 'IL', 'MD', 'NJ', 'RI', 'VT', 'HI',
  'DC', 'NE', 'IA', 'KY', 'PA',
])

/** Mirror lib/calculations/stateEstateTax.ts — edge cannot import @/lib. */
function isMFJFilingStatus(filingStatus: string | null | undefined): boolean {
  const fs = (filingStatus ?? '').toLowerCase().trim()
  return (
    fs === 'mfj' ||
    fs === 'married_filing_jointly' ||
    fs === 'married filing jointly' ||
    fs === 'married_joint'
  )
}

function applyBrackets(taxableAmount: number, brackets: StateBracket[]): number {
  if (taxableAmount <= 0 || brackets.length === 0) return 0
  let tax = 0
  for (const bracket of brackets) {
    const bracketMin = bracket.min_amount
    const bracketMax = bracket.max_amount >= 9_999_999_999 ? Infinity : bracket.max_amount
    if (taxableAmount <= bracketMin) break
    const inBracket = Math.min(taxableAmount, bracketMax) - bracketMin
    if (inBracket > 0) tax += inBracket * (bracket.rate_pct / 100)
  }
  return Math.round(tax)
}

function computeStateTaxForExemption(
  grossEstate: number,
  exemption: number,
  brackets: StateBracket[],
  stateCode: string,
): { tax: number; nyCliffTriggered: boolean; taxableEstate: number } {
  if (brackets.length === 0 || grossEstate <= 0) {
    return { tax: 0, nyCliffTriggered: false, taxableEstate: 0 }
  }

  let taxableEstate: number
  let nyCliffTriggered = false

  if (stateCode === 'NY') {
    const cliffThreshold = exemption * 1.05
    if (grossEstate > cliffThreshold) {
      taxableEstate = grossEstate
      nyCliffTriggered = true
    } else {
      taxableEstate = Math.max(0, grossEstate - exemption)
    }
  } else {
    taxableEstate = Math.max(0, grossEstate - exemption)
  }

  if (taxableEstate <= 0) {
    return { tax: 0, nyCliffTriggered, taxableEstate: 0 }
  }

  let tax = applyBrackets(taxableEstate, brackets)
  if (stateCode === 'CT') {
    tax = Math.min(tax, 15_000_000)
  }

  return { tax, nyCliffTriggered, taxableEstate: Math.round(taxableEstate) }
}

function calculateStateEstateTax(
  grossEstate: number,
  stateCode: string,
  brackets: StateBracket[],
  isMFJ: boolean,
): {
  stateTax: number
  stateTaxWithCST: number
  hasPortabilityGap: boolean
} {
  const code = stateCode.toUpperCase().trim()

  if (brackets.length === 0 || grossEstate <= 0) {
    return { stateTax: 0, stateTaxWithCST: 0, hasPortabilityGap: false }
  }

  const singleExemption = brackets[0].exemption_amount ?? 0
  const hasPortabilityGap = isMFJ && NO_PORTABILITY_STATES.has(code)
  const noCst = computeStateTaxForExemption(grossEstate, singleExemption, brackets, code)
  const exemptionWithCst = hasPortabilityGap ? singleExemption * 2 : singleExemption
  const withCst = hasPortabilityGap
    ? computeStateTaxForExemption(grossEstate, exemptionWithCst, brackets, code)
    : noCst

  return {
    stateTax: noCst.tax,
    stateTaxWithCST: withCst.tax,
    hasPortabilityGap,
  }
}

function resolveActiveStateTax(
  result: { stateTax: number; stateTaxWithCST: number; hasPortabilityGap: boolean },
  hasBypassTrust: boolean,
): number {
  if (hasBypassTrust && result.hasPortabilityGap) return result.stateTaxWithCST
  return result.stateTax
}

type EstateTaxContext = {
  stateCode: string
  stateBrackets: StateBracket[]
  filingStatus: 'single' | 'mfj'
  hasBypassTrust: boolean
  federalBrackets: FederalBracket[]
}

type FederalBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
}

function computeProgressiveTaxFromBrackets(taxableBase: number, brackets: FederalBracket[]): number {
  if (taxableBase <= 0 || brackets.length === 0) return 0
  const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount)
  let tax = 0
  for (const bracket of sorted) {
    const bracketMin = bracket.min_amount
    const bracketMax =
      !Number.isFinite(bracket.max_amount) || bracket.max_amount >= 1e15
        ? Infinity
        : bracket.max_amount
    if (taxableBase <= bracketMin) break
    const taxableInBracket = Math.min(taxableBase, bracketMax) - bracketMin
    if (taxableInBracket > 0) {
      tax += taxableInBracket * (bracket.rate_pct / 100)
    }
  }
  return Math.round(tax * 100) / 100
}

function computeFederalEstateTaxInline(
  grossEstate: number,
  exemption: number,
  brackets: FederalBracket[],
  filingStatus: 'single' | 'mfj',
  lawScenario: string,
): number {
  if (grossEstate <= 0) return 0
  const effectiveExemption = lawScenario === 'no_exemption' ? 0 : exemption
  if (brackets.length === 0) {
    return Math.max(0, Math.round((grossEstate - effectiveExemption) * 0.4))
  }
  if (lawScenario === 'no_exemption') {
    return computeProgressiveTaxFromBrackets(grossEstate, brackets)
  }
  const taxBefore = computeProgressiveTaxFromBrackets(grossEstate, brackets)
  const credit = computeProgressiveTaxFromBrackets(effectiveExemption, brackets)
  void filingStatus
  return Math.max(0, Math.round((taxBefore - credit) * 100) / 100)
}

function randomNormal(mean: number, stdDev: number): number {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + stdDev * n
}

function calcEstateTax(
  estate: number,
  exemption: number,
  taxCtx: EstateTaxContext,
  lawScenario: string,
): number {
  const federalTax = computeFederalEstateTaxInline(
    estate,
    exemption,
    taxCtx.federalBrackets ?? [],
    taxCtx.filingStatus,
    lawScenario,
  )
  const isMFJ = taxCtx.filingStatus === 'mfj'
  const stateResult = calculateStateEstateTax(
    estate,
    taxCtx.stateCode,
    taxCtx.stateBrackets,
    isMFJ,
  )
  const stateTax = resolveActiveStateTax(stateResult, taxCtx.hasBypassTrust)
  return federalTax + stateTax
}

function pct(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

function runEstateMonteCarlo(inputs: {
  grossEstate: number
  federalExemption: number
  federalBrackets?: FederalBracket[]
  stateCode: string
  stateBrackets: StateBracket[]
  filingStatus: 'single' | 'mfj'
  hasBypassTrust: boolean
  yearsUntilDeath: number
  strategyEstateReduction: number
  lawScenario: string
  simulationCount: number
  returnMeanPct?: number
  volatilityPct?: number
}) {
  const {
    grossEstate,
    federalExemption,
    federalBrackets = [],
    stateCode,
    stateBrackets,
    filingStatus,
    hasBypassTrust,
    yearsUntilDeath,
    strategyEstateReduction,
    lawScenario,
    simulationCount,
    returnMeanPct,
    volatilityPct,
  } = inputs

  const taxCtx: EstateTaxContext = {
    stateCode,
    stateBrackets,
    filingStatus,
    hasBypassTrust,
    federalBrackets,
  }

  const returnMean = (returnMeanPct ?? 7) / 100
  const returnVol = (volatilityPct ?? 12) / 100

  const startTime = Date.now()
  const adjustedEstate = Math.max(0, grossEstate - strategyEstateReduction)
  const finalEstates: number[] = []
  const yearlyEstates: number[][] = Array.from({ length: yearsUntilDeath + 1 }, () => [])

  for (let sim = 0; sim < simulationCount; sim++) {
    let estate = adjustedEstate
    for (let year = 0; year <= yearsUntilDeath; year++) {
      const ret = randomNormal(returnMean, returnVol)
      estate = Math.max(0, estate * (1 + ret))
      yearlyEstates[year].push(estate)
    }
    finalEstates.push(estate)
  }

  const sortedFinals = [...finalEstates].sort((a, b) => a - b)
  const p10_estate = pct(sortedFinals, 10)
  const p25_estate = pct(sortedFinals, 25)
  const p50_estate = pct(sortedFinals, 50)
  const p75_estate = pct(sortedFinals, 75)
  const p90_estate = pct(sortedFinals, 90)

  const p10_tax = calcEstateTax(p10_estate, federalExemption, taxCtx, lawScenario)
  const p50_tax = calcEstateTax(p50_estate, federalExemption, taxCtx, lawScenario)
  const p90_tax = calcEstateTax(p90_estate, federalExemption, taxCtx, lawScenario)

  const successCount = sortedFinals.filter(
    (e) => calcEstateTax(e, federalExemption, taxCtx, lawScenario) === 0,
  ).length
  const success_rate = Math.round((successCount / simulationCount) * 100)
  const median_net_to_heirs = p50_estate - p50_tax

  const currentYear = new Date().getFullYear()
  const fan_chart_data = yearlyEstates.map((yearArr, i) => {
    const sorted = [...yearArr].sort((a, b) => a - b)
    return {
      year: currentYear + i,
      p10: Math.round(pct(sorted, 10)),
      p25: Math.round(pct(sorted, 25)),
      p50: Math.round(pct(sorted, 50)),
      p75: Math.round(pct(sorted, 75)),
      p90: Math.round(pct(sorted, 90)),
    }
  })

  // 3-variable sensitivity matrix
  const sensitivity_matrix = [
    {
      variable: 'Growth Rate',
      low_value: 0.05,
      low_tax: calcEstateTax(
        adjustedEstate * Math.pow(1.05, yearsUntilDeath),
        federalExemption,
        taxCtx,
        lawScenario,
      ),
      base_tax: p50_tax,
      high_value: 0.09,
      high_tax: calcEstateTax(
        adjustedEstate * Math.pow(1.09, yearsUntilDeath),
        federalExemption,
        taxCtx,
        lawScenario,
      ),
    },
    {
      variable: 'Federal Exemption',
      low_value: 0,
      low_tax: calcEstateTax(p50_estate, 0, taxCtx, 'no_exemption'),
      base_tax: p50_tax,
      high_value: federalExemption,
      high_tax: calcEstateTax(p50_estate, federalExemption, taxCtx, 'current_law'),
    },
    // State tax sensitivity removed — engine B brackets make flat-rate sweep meaningless; add scenario comparison in MC sprint
  ]

  return {
    p10_estate: Math.round(p10_estate),
    p25_estate: Math.round(p25_estate),
    p50_estate: Math.round(p50_estate),
    p75_estate: Math.round(p75_estate),
    p90_estate: Math.round(p90_estate),
    p10_tax: Math.round(p10_tax),
    p50_tax: Math.round(p50_tax),
    p90_tax: Math.round(p90_tax),
    success_rate,
    median_net_to_heirs: Math.round(median_net_to_heirs),
    fan_chart_data,
    sensitivity_matrix,
    run_duration_ms: Date.now() - startTime,
  }
}

// ── Edge Function Handler ─────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body = await req.json()
    const {
      householdId,
      scenarioId,
      grossEstate,
      federalExemption,
      stateCode = '',
      stateBrackets = [],
      federalBrackets: federalBracketsBody = [],
      filingStatus = 'single',
      hasBypassTrust = false,
      yearsUntilDeath = 20,
      strategyEstateReduction = 0,
      lawScenario = 'current_law',
      simulationCount = 500,
      assumptions,
    } = body

    if (!householdId || !grossEstate || !federalExemption) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: household, error: householdError } = await userClient
      .from('households')
      .select('owner_id')
      .eq('id', householdId)
      .maybeSingle()

    if (householdError || !household) {
      return new Response(JSON.stringify({ error: 'Household not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isOwner = household.owner_id === user.id
    let isAdvisor = false

    if (!isOwner) {
      const { data: link } = await userClient
        .from('advisor_clients')
        .select('id')
        .eq('advisor_id', user.id)
        .eq('client_id', household.owner_id)
        .in('status', ['active', 'accepted'])
        .maybeSingle()

      isAdvisor = Boolean(link)
    }

    if (!isOwner && !isAdvisor) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let federalBrackets = federalBracketsBody as FederalBracket[]
    if (!federalBrackets.length) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      const { data: bracketRows } = await adminClient
        .from('federal_estate_tax_brackets')
        .select('tax_year, min_amount, max_amount, rate_pct')
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true })
      const latestYear = Math.max(...(bracketRows ?? []).map((b) => Number(b.tax_year ?? 0)), 0)
      federalBrackets =
        latestYear > 0
          ? (bracketRows ?? [])
              .filter((b) => Number(b.tax_year) === latestYear)
              .map((b) => ({
                min_amount: Number(b.min_amount ?? 0),
                max_amount: Number(b.max_amount ?? 0),
                rate_pct: Number(b.rate_pct ?? 0),
              }))
          : []
    }

    // Run Monte Carlo
    const result = runEstateMonteCarlo({
      grossEstate,
      federalExemption,
      federalBrackets,
      stateCode,
      stateBrackets,
      filingStatus: isMFJFilingStatus(filingStatus) ? 'mfj' : 'single',
      hasBypassTrust: Boolean(hasBypassTrust),
      yearsUntilDeath,
      strategyEstateReduction,
      lawScenario,
      simulationCount,
      returnMeanPct: assumptions?.returnMeanPct,
      volatilityPct: assumptions?.volatilityPct,
    })

    // Persist results (service role only after caller access verified above)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: saved, error: saveError } = await adminClient
      .from('monte_carlo_results')
      .insert({
        household_id: householdId,
        scenario_id: scenarioId ?? null,
        simulation_count: simulationCount,
        law_scenario: lawScenario,
        p10_estate: result.p10_estate,
        p25_estate: result.p25_estate,
        p50_estate: result.p50_estate,
        p75_estate: result.p75_estate,
        p90_estate: result.p90_estate,
        p10_tax: result.p10_tax,
        p50_tax: result.p50_tax,
        p90_tax: result.p90_tax,
        success_rate: result.success_rate,
        median_net_to_heirs: result.median_net_to_heirs,
        fan_chart_data: result.fan_chart_data,
        sensitivity_matrix: result.sensitivity_matrix,
        run_duration_ms: result.run_duration_ms,
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('Failed to save Monte Carlo results:', saveError)
    }

    return new Response(JSON.stringify({ ...result, resultId: saved?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Estate Monte Carlo error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
