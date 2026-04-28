// ─────────────────────────────────────────
// Menu: Retirement Planning > Roth Conversion
// Route: /roth
// ─────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserAccess } from "@/lib/get-user-access";
import UpgradeBanner from "@/app/(dashboard)/_components/UpgradeBanner";
import { RothClient } from "./_roth-client";
import { runRothAnalysis } from "@/lib/calculations/roth-analysis";
import { resolveDeduction } from "@/lib/tax/resolve-deduction";

export default async function RothPage() {
  const access = await getUserAccess();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (access.tier < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Roth Conversion</h1>
        <UpgradeBanner
          requiredTier={2}
          moduleName="Roth Conversion"
          valueProposition="Model Roth conversion scenarios and project long-term tax savings."
        />
      </div>
    );
  }

  // ── Fetch household and assets in parallel ──────────────────────────────
  const [{ data: hh }, { data: assetRows }, { data: stateRates }, { data: stateBrackets }] = await Promise.all([
    supabase
      .from("households")
      .select("*")
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("assets")
      .select("type, value, owner")
      .eq("owner_id", user.id),
    supabase
      .from("state_income_tax_rates")
      .select("state_code, rate_pct, tax_year")
      .order("tax_year", { ascending: false }),
    supabase
      .from("state_income_tax_brackets")
      .select("state, tax_year, filing_status, min_amount, max_amount, rate_pct")
      .order("tax_year", { ascending: false })
      .order("state", { ascending: true })
      .order("filing_status", { ascending: true })
      .order("min_amount", { ascending: true }),
  ]);

  if (!hh) {
    return (
      <div className="p-6 text-muted-foreground">
        Complete your profile to use the Roth optimizer.
      </div>
    );
  }

  // ── Get full projection rows from the projection API ───────────────────
  // Same source as Lifetime Snapshot — all income, SS, RMDs already correct
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projection`,
    {
      headers: { cookie: (await cookies()).toString() },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return (
      <div className="p-6 text-muted-foreground">
        Unable to load projection data. Please complete your profile first.
      </div>
    );
  }

  const { rows } = await res.json();

  if (!rows || rows.length === 0) {
    return (
      <div className="p-6 text-muted-foreground">
        No projection data found. Please complete your profile first.
      </div>
    );
  }

  // ── Asset classification ────────────────────────────────────────────────
  const TAX_DEFERRED_TYPES = [
    "traditional_ira",
    "traditional_401k",
    "traditional_403b",
    "401k",
    "403b",
    "ira",
    "sep_ira",
    "simple_ira",
    "457",
    "sep",
    "retirement_account",
  ]
  const ROTH_TYPES = ["roth_ira", "roth_401k", "roth_403b", "roth"];
  const TAXABLE_TYPES = [
    "brokerage",
    "taxable_brokerage",
    "savings",
    "checking",
    "money_market",
    "cash",
  ];

  const taxDeferredBalance = (assetRows ?? [])
    .filter((a) => TAX_DEFERRED_TYPES.includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const rothBalance = (assetRows ?? [])
    .filter((a) => ROTH_TYPES.includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  const taxableBalance = (assetRows ?? [])
    .filter((a) => TAXABLE_TYPES.includes(a.type))
    .reduce((s, a) => s + (a.value ?? 0), 0);

  // ── State income tax rate ───────────────────────────────────────────────
  const stateCode = hh.state_primary?.toUpperCase() ?? null;
  const stateRate = stateCode && stateRates
    ? (() => {
        const rows = stateRates
          .filter(r => r.state_code.toUpperCase() === stateCode)
          .sort((a, b) => (b.tax_year ?? 0) - (a.tax_year ?? 0))
        return rows.length > 0 ? (rows[0].rate_pct / 100) : 0
      })()
    : 0

  // ── RMD start age ───────────────────────────────────────────────────────
  const rmdStartAge = hh.person1_birth_year >= 1960 ? 75 : 73;

  // ── Standard deduction ──────────────────────────────────────────────────
  const standardDeduction = resolveDeduction(
    hh.deduction_mode,
    hh.custom_deduction_amount,
    hh.filing_status
  )

  // ── Run analysis ────────────────────────────────────────────────────────
  const result = runRothAnalysis({
    rows,
    filingStatus: hh.filing_status ?? "single",
    stateMarginalRate: stateRate,
    stateCode,
    stateIncomeTaxBrackets: (stateBrackets ?? []) as Array<{
      state: string
      tax_year: number
      filing_status: 'single' | 'mfj'
      min_amount: number
      max_amount: number | null
      rate_pct: number
    }>,
    taxDeferredBalance,
    rothBalance,
    taxableBalance,
    growthRateRetirement: (hh.growth_rate_retirement ?? 5) / 100,
    maxAnnualConversion: 500000,
    standardDeduction,
    inflationRate: (hh.inflation_rate ?? 2.5) / 100,
    person1BirthYear: hh.person1_birth_year,
    person2BirthYear: hh.has_spouse ? hh.person2_birth_year : null,
    rmdStartAge,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-2">
      <h1 className="text-2xl font-semibold">Roth optimizer</h1>
      <p className="text-sm text-muted-foreground pb-2">
        Year-by-year Roth conversion strategy to minimize lifetime federal
        and state income tax.
      </p>
      <RothClient result={result} />
    </div>
  );
}
