import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { displayPersonFirstName } from '@/lib/display-person-name'

function calcFRA(birthYear: number): number {
  if (birthYear <= 1954) return 66
  if (birthYear >= 1960) return 67
  return 66 + ((birthYear - 1954) * 2) / 12
}

function calcMonthlyBenefit(pia: number, claimAge: number, fra: number): number {
  const monthsDiff = Math.round((claimAge - fra) * 12)
  if (monthsDiff >= 0) {
    return pia * (1 + monthsDiff * (2 / 300))
  }
  const earlyMonths = -monthsDiff
  if (earlyMonths <= 36) {
    return pia * (1 - earlyMonths * (5 / 900))
  }
  return pia * (1 - 36 * (5 / 900) - (earlyMonths - 36) * (5 / 1200))
}

function calcLifetimeTotal(
  monthlyAtClaim: number,
  claimAge: number,
  longevityAge: number,
  cola: number
): number {
  let total = 0
  let benefit = monthlyAtClaim
  const years = longevityAge - claimAge
  for (let y = 0; y < years; y++) {
    total += benefit * 12
    benefit *= 1 + cola
  }
  return Math.round(total)
}

function calcCumulativeByAge(
  monthlyAtClaim: number,
  claimAge: number,
  longevityAge: number,
  cola: number
): { age: number; cumulative: number }[] {
  const result: { age: number; cumulative: number }[] = []
  let cumulative = 0
  let benefit = monthlyAtClaim
  for (let age = 62; age <= longevityAge; age++) {
    if (age >= claimAge) {
      cumulative += benefit * 12
      benefit *= 1 + cola
    }
    result.push({ age, cumulative: Math.round(cumulative) })
  }
  return result
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: household, error: hhError } = await supabase
      .from('households')
      .select('*')
      .eq('owner_id', user.id)
      .single()

    if (hhError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
    }

    const p1BirthYear = household.person1_birth_year      ?? 1960
    const p1PIA       = household.person1_ss_pia ?? household.person1_ss_benefit_67 ?? 0
    const p1ClaimAge  = household.person1_ss_claiming_age ?? 67
    const p1Longevity = household.person1_longevity_age   ?? 90
    const p1Name      = household.person1_first_name ?? displayPersonFirstName(household.person1_name, 'Person 1')

    const p2BirthYear = household.person2_birth_year      ?? null
    const p2PIA       = household.person2_ss_pia ?? household.person2_ss_benefit_67 ?? 0
    const p2ClaimAge  = household.person2_ss_claiming_age ?? 67
    const p2Longevity = household.person2_longevity_age   ?? 90
    const p2Name      = household.person2_first_name ?? displayPersonFirstName(household.person2_name, 'Person 2')
    const hasSpouse   = !!p2BirthYear && p2PIA > 0

    const cola = (household.inflation_rate ?? 2.5) / 100
    const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70]

    const p1FRA = calcFRA(p1BirthYear)
    const p1Scenarios = CLAIM_AGES.map(age => {
      const monthly  = calcMonthlyBenefit(p1PIA, age, p1FRA)
      const annual   = Math.round(monthly * 12)
      const lifetime = calcLifetimeTotal(monthly, age, p1Longevity, cola)
      const cumulativeByAge = calcCumulativeByAge(monthly, age, p1Longevity, cola)
      return { age, monthly: Math.round(monthly), annual, lifetime, cumulativeByAge }
    })

    const p1Elected     = p1Scenarios.find(s => s.age === p1ClaimAge)        ?? p1Scenarios[5]
    const p1FRAScenario = p1Scenarios.find(s => s.age === Math.round(p1FRA)) ?? p1Scenarios[5]

    let p2Data = null
    if (hasSpouse) {
      const p2FRA = calcFRA(p2BirthYear!)
      const p2Scenarios = CLAIM_AGES.map(age => {
        const monthly  = calcMonthlyBenefit(p2PIA, age, p2FRA)
        const annual   = Math.round(monthly * 12)
        const lifetime = calcLifetimeTotal(monthly, age, p2Longevity, cola)
        const cumulativeByAge = calcCumulativeByAge(monthly, age, p2Longevity, cola)
        return { age, monthly: Math.round(monthly), annual, lifetime, cumulativeByAge }
      })

      const p2Elected     = p2Scenarios.find(s => s.age === p2ClaimAge)          ?? p2Scenarios[5]
      const p2FRAScenario = p2Scenarios.find(s => s.age === Math.round(p2FRA))   ?? p2Scenarios[5]
      const spousalBenefit  = Math.round(p1PIA * 0.5)
      const spousalApplies  = spousalBenefit > p2Elected.monthly
      const survivorBenefit = Math.max(p1Elected.monthly, p2Elected.monthly)

      p2Data = {
        name: p2Name,
        birthYear: p2BirthYear,
        fra: Math.round(calcFRA(p2BirthYear!) * 10) / 10,
        pia: p2PIA,
        electedAge: p2ClaimAge,
        electedMonthly: p2Elected.monthly,
        scenarios: p2Scenarios,
        spousalBenefit,
        spousalApplies,
        survivorBenefit,
        deltaVsFRA: p2Elected.lifetime - p2FRAScenario.lifetime,
      }
    }

    const p1Delta    = p1Elected.lifetime - p1FRAScenario.lifetime
    const p1DeltaFmt = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(Math.abs(p1Delta))
    const p1Direction = p1Delta >= 0 ? 'adds' : 'costs'

    let recommendation = `${p1Name}'s strategy of claiming at age ${p1ClaimAge} ${p1Direction} approximately ${p1DeltaFmt} in lifetime benefits compared to claiming at FRA (age ${Math.round(p1FRA)}), assuming longevity to age ${p1Longevity} with ${(cola * 100).toFixed(1)}% COLA.`

    if (hasSpouse && p2Data) {
      const survivorNote = p1ClaimAge >= 70
        ? ` Delaying to 70 also maximizes the survivor benefit for ${p2Data.name} at $${p2Data.survivorBenefit.toLocaleString()}/mo if ${p1Name} predeceases.`
        : ` The survivor benefit for ${p2Data.name} would be $${p2Data.survivorBenefit.toLocaleString()}/mo based on current elected ages.`
      recommendation += survivorNote
    }

    return NextResponse.json({
      person1: {
        name: p1Name,
        birthYear: p1BirthYear,
        fra: Math.round(p1FRA * 10) / 10,
        pia: p1PIA,
        electedAge: p1ClaimAge,
        electedMonthly: p1Elected.monthly,
        scenarios: p1Scenarios,
        deltaVsFRA: p1Delta,
      },
      person2: p2Data,
      cola: cola * 100,
      recommendation,
    })

  } catch (err) {
    console.error('SS route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}