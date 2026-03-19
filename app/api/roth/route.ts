// app/api/roth/route.ts
// Sprint 13 — fetches DB data, calls runRothOptimizer, returns rows

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runRothOptimizer, FederalBracket } from "@/lib/calculations/roth-optimizer";

// Hardcoded 2024 federal brackets as fallback — engine inflates these forward
const DEFAULT_BRACKETS_MFJ: FederalBracket[] = [
  { min: 0,       max: 23200,  rate: 0.10 },
  { min: 23200,   max: 94300,  rate: 0.12 },
  { min: 94300,   max: 201050, rate: 0.22 },
  { min: 201050,  max: 383900, rate: 0.24 },
  { min: 383900,  max: 487450, rate: 0.32 },
  { min: 487450,  max: 731200, rate: 0.35 },
  { min: 731200,  max: null,   rate: 0.37 },
];
const DEFAULT_BRACKETS_SINGLE: FederalBracket[] = [
  { min: 0,       max: 11600,  rate: 0.10 },
  { min: 11600,   max: 47150,  rate: 0.12 },
  { min: 47150,   max: 100525, rate: 0.22 },
  { min: 100525,  max: 191950, rate: 0.24 },
  { min: 191950,  max: 243725, rate: 0.32 },
  { min: 243725,  max: 609350, rate: 0.35 },
  { min: 609350,  max: null,   rate: 0.37 },
];

function getBrackets(filingStatus: string): FederalBracket[] {
  return filingStatus === "mfj" || filingStatus === "qw"
    ? DEFAULT_BRACKETS_MFJ
    : DEFAULT_BRACKETS_SINGLE;
}

function getStandardDeduction(filingStatus: string): number {
  const map: Record<string, number> = {
    mfj: 29200,
    mfs: 14600,
    hoh: 21900,
    qw: 29200,
    single: 14600,
  };
  return map[filingStatus] ?? 14600;
}

export async function GET() {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch household
  const { data: hh, error: hhError } = await supabase
    .from("households")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (hhError || !hh) {
    return NextResponse.json({ error: "No household found" }, { status: 404 });
  }

  // Fetch income rows
  const { data: incomeRows } = await supabase
    .from("income")
    .select("source, amount, ss_person, start_year, end_year, inflation_adjust")
    .eq("owner_id", user.id);

  // Fetch assets (tax-deferred and Roth)
  const { data: assetRows } = await supabase
    .from("assets")
    .select("type, value, owner")
    .eq("owner_id", user.id);

  const currentYear = new Date().getFullYear();

  // Classify assets
  const taxDeferredTypes = ["traditional_ira", "401k", "403b", "sep_ira", "simple_ira"];
  const rothTypes = ["roth_ira", "roth_401k"];
  const taxableTypes = ["brokerage", "savings", "checking", "money_market"];

  const taxDeferredBalance = (assetRows ?? [])
    .filter((a) => taxDeferredTypes.includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const rothBalance = (assetRows ?? [])
    .filter((a) => rothTypes.includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const taxableBalance = (assetRows ?? [])
    .filter((a) => taxableTypes.includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  // Ordinary income (non-SS, active this year)
  const ssTypes = ["social_security"];
  const ordinaryIncome = (incomeRows ?? [])
    .filter((r) => !ssTypes.includes(r.source))
    .filter((r) => {
      const start = r.start_year ?? 1900;
      const end = r.end_year ?? 9999;
      return currentYear >= start && currentYear <= end;
    })
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // SS income — active this year, by person
  const ssRows = (incomeRows ?? []).filter(
    (r) => ssTypes.includes(r.source) && currentYear >= (r.start_year ?? 1900)
  );
  const ssIncomePerson1 = ssRows
    .filter((r) => r.ss_person === hh.person1_name)
    .reduce((s, r) => s + r.amount, 0);
  const ssIncomePerson2 = ssRows
    .filter((r) => r.ss_person === hh.person2_name)
    .reduce((s, r) => s + r.amount, 0);

  // Retirement year estimate: use person1 birth year + 65 if not in household
  const retirementYear = hh.retirement_year ?? (hh.person1_birth_year + 65);

  // Death year / projection horizon: 30 years out
  const deathYear = currentYear + 30;

  // RMD start age: SECURE 2.0 — 73 for born 1951-1959, 75 for born 1960+
  const rmdStartAge = hh.person1_birth_year >= 1960 ? 75 : 73;

  const filingStatus = hh.filing_status ?? "single";
  const brackets = getBrackets(filingStatus);
  const standardDeduction = getStandardDeduction(filingStatus);

  const result = runRothOptimizer({
    currentYear,
    retirementYear,
    deathYear,
    filingStatus,
    state: hh.state_primary ?? "",
    taxDeferredBalance,
    rothBalance,
    taxableBalance,
    ordinaryIncome,
    ordinaryIncomeGrowthRate: 0.02,  // flat 2% wage growth assumption
    ssIncomePerson1,
    ssIncomePerson2,
    rmdStartAge,
    person1BirthYear: hh.person1_birth_year,
    growthRateAccumulation: hh.growth_rate_accumulation ?? 0.07,
    growthRateRetirement: hh.growth_rate_retirement ?? 0.05,
    inflationRate: hh.inflation_rate ?? 0.025,
    federalBrackets: brackets,
    standardDeduction,
    maxAnnualConversion: 500000,
  });

  return NextResponse.json(result);
}
