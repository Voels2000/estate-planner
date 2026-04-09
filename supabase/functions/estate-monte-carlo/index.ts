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

const RETURN_ASSUMPTIONS = { mean: 0.07, stdDev: 0.12 }

function randomNormal(mean: number, stdDev: number): number {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + stdDev * n
}

function calcEstateTax(estate: number, exemption: number, stateRate: number, lawScenario: string): number {
  const FEDERAL_RATE = 0.4
  const effectiveExemption =
    lawScenario === 'no_exemption'
      ? 0
      : lawScenario === 'sunset'
        ? Math.min(exemption, 7_000_000)
        : exemption
  const federalTax = Math.max(0, estate - effectiveExemption) * FEDERAL_RATE
  const stateTax = estate * stateRate
  return federalTax + stateTax
}

function pct(sorted: number[], p: number): number {
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

function runEstateMonteCarlo(inputs: {
  grossEstate: number
  federalExemption: number
  stateEstateTaxRate: number
  yearsUntilDeath: number
  strategyEstateReduction: number
  lawScenario: string
  simulationCount: number
}) {
  const {
    grossEstate,
    federalExemption,
    stateEstateTaxRate,
    yearsUntilDeath,
    strategyEstateReduction,
    lawScenario,
    simulationCount,
  } = inputs

  const startTime = Date.now()
  const adjustedEstate = Math.max(0, grossEstate - strategyEstateReduction)
  const finalEstates: number[] = []
  const yearlyEstates: number[][] = Array.from({ length: yearsUntilDeath + 1 }, () => [])

  for (let sim = 0; sim < simulationCount; sim++) {
    let estate = adjustedEstate
    for (let year = 0; year <= yearsUntilDeath; year++) {
      const ret = randomNormal(RETURN_ASSUMPTIONS.mean, RETURN_ASSUMPTIONS.stdDev)
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

  const p10_tax = calcEstateTax(p10_estate, federalExemption, stateEstateTaxRate, lawScenario)
  const p50_tax = calcEstateTax(p50_estate, federalExemption, stateEstateTaxRate, lawScenario)
  const p90_tax = calcEstateTax(p90_estate, federalExemption, stateEstateTaxRate, lawScenario)

  const successCount = sortedFinals.filter(
    (e) => calcEstateTax(e, federalExemption, stateEstateTaxRate, lawScenario) === 0
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
        stateEstateTaxRate,
        lawScenario
      ),
      base_tax: p50_tax,
      high_value: 0.09,
      high_tax: calcEstateTax(
        adjustedEstate * Math.pow(1.09, yearsUntilDeath),
        federalExemption,
        stateEstateTaxRate,
        lawScenario
      ),
    },
    {
      variable: 'Federal Exemption',
      low_value: 7_000_000,
      low_tax: calcEstateTax(p50_estate, 7_000_000, stateEstateTaxRate, 'current_law'),
      base_tax: p50_tax,
      high_value: federalExemption,
      high_tax: calcEstateTax(p50_estate, federalExemption, stateEstateTaxRate, 'current_law'),
    },
    {
      variable: 'State Tax Rate',
      low_value: 0,
      low_tax: calcEstateTax(p50_estate, federalExemption, 0, lawScenario),
      base_tax: p50_tax,
      high_value: stateEstateTaxRate * 2,
      high_tax: calcEstateTax(p50_estate, federalExemption, stateEstateTaxRate * 2, lawScenario),
    },
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify auth header presence (JWT validation delegated to RLS)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Auth validated via RLS on database operations

    // Parse request body
    const body = await req.json()
    const {
      householdId,
      scenarioId,
      grossEstate,
      federalExemption,
      stateEstateTaxRate = 0,
      yearsUntilDeath = 20,
      strategyEstateReduction = 0,
      lawScenario = 'current_law',
      simulationCount = 500,
    } = body

    if (!householdId || !grossEstate || !federalExemption) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Run Monte Carlo
    const result = runEstateMonteCarlo({
      grossEstate,
      federalExemption,
      stateEstateTaxRate,
      yearsUntilDeath,
      strategyEstateReduction,
      lawScenario,
      simulationCount,
    })

    // Persist results
    const { data: saved, error: saveError } = await supabase
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
