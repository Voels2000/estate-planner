// app/api/roth/route.ts
// Sprint 13 — fetches DB data, calls runRothOptimizer, returns rows

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runRothOptimizer, FederalBracket } from "@/lib/calculations/roth-optimizer";

const BRACKETS_MFJ: FederalBracket[] = [
  { min: 0,       max: 23200,  rate: 0.10 },
  { min: 23200,   max: 94300,  rate: 0.12 },
  { min: 94300,   max: 201050, rate: 0.22 },
  { min: 201050,  max: 383900, rate: 0.24 },
  { min: 383900,  max: 487450, rate: 0.32 },
  { min: 487450,  max: 731200, rate: 0.35 },
  { min: 731200,  max: null,   rate: 0.37 },
];
const BRACKETS_SINGLE: FederalBracket[] = [
  { min: 0,       max: 11600,  rate: 0.10 },
  { min: 11600,   max: 47150,  rate: 0.12 },
  { min: 47150,   max: 100525, rate: 0.22 },
  { min: 100525,  max: 191950, rate: 0.24 },
  { min: 191950,  max: 243725, rate: 0.32 },
  { min: 243725,  max: 609350, rate: 0.35 },
  { min: 609350,  max: null,   rate: 0.37 },
];

function getBrackets(fs: string): FederalBracket[] {
  return fs === "mfj" || fs === "qw" ? BRACKETS_MFJ : BRACKETS_SINGLE;
}

function getStandardDeduction(fs: string): number {
  return ({ mfj: 29200, mfs: 14600, hoh: 21900, qw: 29200, single: 14600 } as Record<string, number>)[fs] ?? 14600;
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: hh, error: hhError } = await supabase
    .from("households")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (hhError || !hh) {
    return NextResponse.json({ error: "No household found" }, { status: 404 });
  }

  const { data: incomeRows } = await supabase
    .from("income")
    .select("source, amount, ss_person, start_year, end_year")
    .eq("owner_id", user.id);

  const { data: assetRows } = await supabase
    .from("assets")
    .select("type, value, owner")
    .eq("owner_id", user.id);

  const currentYear = new Date().getFullYear();

  // Retirement years — calculated from birth_year + retirement_age
  const person1RetirementYear = hh.person1_birth_year + (hh.person1_retirement_age ?? 65);
  const person2RetirementYear = hh.has_spouse
    ? hh.person2_birth_year + (hh.person2_retirement_age ?? 65)
    : 9999;

  // Asset classification
  const taxDeferredBalance = (assetRows ?? [])
    .filter((a) => ["traditional_ira","401k","403b","sep_ira","simple_ira"].includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const rothBalance = (assetRows ?? [])
    .filter((a) => ["roth_ira","roth_401k"].includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const taxableBalance = (assetRows ?? [])
    .filter((a) => ["brokerage","savings","checking","money_market"].includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  // Ordinary income active this year, split by person
  const activeOrdinary = (incomeRows ?? []).filter(
    (r) => r.source !== "social_security" &&
      currentYear >= (r.start_year ?? 1900) &&
      currentYear <= (r.end_year ?? 9999)
  );

  const person1Income = activeOrdinary
    .filter((r) => !r.ss_person || r.ss_person === hh.person1_name)
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const person2Income = hh.has_spouse
    ? activeOrdinary
        .filter((r) => r.ss_person === hh.person2_name)
        .reduce((s, r) => s + (r.amount ?? 0), 0)
    : 0;

  // SS income
  const ssRows = (incomeRows ?? []).filter(
    (r) => r.source === "social_security" && currentYear >= (r.start_year ?? 1900)
  );
  const ssIncomePerson1 = ssRows
    .filter((r) => r.ss_person === hh.person1_name)
    .reduce((s, r) => s + r.amount, 0);
  const ssIncomePerson2 = ssRows
    .filter((r) => r.ss_person === hh.person2_name)
    .reduce((s, r) => s + r.amount, 0);

  const filingStatus = hh.filing_status ?? "single";
  const rmdStartAge = hh.person1_birth_year >= 1960 ? 75 : 73;

  const result = runRothOptimizer({
    currentYear,
    person1RetirementYear,
    person2RetirementYear,
    deathYear: currentYear + 30,
    filingStatus,
    state: hh.state_primary ?? "",
    taxDeferredBalance,
    rothBalance,
    taxableBalance,
    person1Income,
    person2Income,
    ordinaryIncomeGrowthRate: 0.02,
    ssIncomePerson1,
    ssIncomePerson2,
    rmdStartAge,
    person1BirthYear: hh.person1_birth_year,
    person2BirthYear: hh.has_spouse ? (hh.person2_birth_year ?? 0) : 0,
    growthRateAccumulation: hh.growth_rate_accumulation ?? 0.07,
    growthRateRetirement: hh.growth_rate_retirement ?? 0.05,
    inflationRate: hh.inflation_rate ?? 0.025,
    federalBrackets: getBrackets(filingStatus),
    standardDeduction: getStandardDeduction(filingStatus),
    maxAnnualConversion: 500000,
  });

  return NextResponse.json(result);
}
