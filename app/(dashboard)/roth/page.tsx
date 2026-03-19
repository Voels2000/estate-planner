// app/(dashboard)/roth/page.tsx
// Sprint 13 — Roth Optimizer page (server component)

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RothClient } from "./_roth-client";
import { runRothOptimizer, FederalBracket } from "@/lib/calculations/roth-optimizer";

// 2024 federal brackets — same defaults as API route
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
  return { mfj: 29200, mfs: 14600, hoh: 21900, qw: 29200, single: 14600 }[fs] ?? 14600;
}

export default async function RothPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: hh }, { data: incomeRows }, { data: assetRows }] = await Promise.all([
    supabase.from("households").select("*").eq("owner_id", user.id).single(),
    supabase.from("income").select("source, amount, ss_person, start_year, end_year").eq("owner_id", user.id),
    supabase.from("assets").select("type, value, owner").eq("owner_id", user.id),
  ]);

  if (!hh) {
    return (
      <div className="p-6 text-muted-foreground">
        Complete your profile to use the Roth optimizer.
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  const taxDeferredBalance = (assetRows ?? [])
    .filter((a) => ["traditional_ira","401k","403b","sep_ira","simple_ira"].includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const rothBalance = (assetRows ?? [])
    .filter((a) => ["roth_ira","roth_401k"].includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const taxableBalance = (assetRows ?? [])
    .filter((a) => ["brokerage","savings","checking","money_market"].includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const ordinaryIncome = (incomeRows ?? [])
    .filter((r) => r.source !== "social_security")
    .filter((r) => currentYear >= (r.start_year ?? 1900) && currentYear <= (r.end_year ?? 9999))
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const ssRows = (incomeRows ?? []).filter(
    (r) => r.source === "social_security" && currentYear >= (r.start_year ?? 1900)
  );
  const ssIncomePerson1 = ssRows.filter((r) => r.ss_person === hh.person1_name).reduce((s, r) => s + r.amount, 0);
  const ssIncomePerson2 = ssRows.filter((r) => r.ss_person === hh.person2_name).reduce((s, r) => s + r.amount, 0);

  const filingStatus = hh.filing_status ?? "single";
  const retirementYear = hh.retirement_year ?? (hh.person1_birth_year + 65);
  const rmdStartAge = hh.person1_birth_year >= 1960 ? 75 : 73;

  const result = runRothOptimizer({
    currentYear,
    retirementYear,
    deathYear: currentYear + 30,
    filingStatus,
    state: hh.state_primary ?? "",
    taxDeferredBalance,
    rothBalance,
    taxableBalance,
    ordinaryIncome,
    ordinaryIncomeGrowthRate: 0.02,
    ssIncomePerson1,
    ssIncomePerson2,
    rmdStartAge,
    person1BirthYear: hh.person1_birth_year,
    growthRateAccumulation: hh.growth_rate_accumulation ?? 0.07,
    growthRateRetirement: hh.growth_rate_retirement ?? 0.05,
    inflationRate: hh.inflation_rate ?? 0.025,
    federalBrackets: getBrackets(filingStatus),
    standardDeduction: getStandardDeduction(filingStatus),
    maxAnnualConversion: 500000,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-2">
      <h1 className="text-2xl font-semibold">Roth optimizer</h1>
      <p className="text-sm text-muted-foreground pb-2">
        Year-by-year Roth conversion strategy to minimize lifetime federal income tax.
      </p>
      <RothClient result={result} />
    </div>
  );
}
