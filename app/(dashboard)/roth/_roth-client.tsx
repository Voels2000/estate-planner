"use client";

// ─────────────────────────────────────────
// Menu: Retirement Planning > Roth Conversion
// Route: /roth
// ─────────────────────────────────────────

// app/(dashboard)/roth/_roth-client.tsx
// Sprint 13 — Roth Optimizer UI

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RothAnalysisResult } from "@/lib/calculations/roth-analysis";
import { saveConsumerStrategyLineItem } from "@/lib/consumer/consumerStrategyLineItems";
import { DISCLAIMER_STRINGS } from "@/lib/compliance/language-policy";

interface Props {
  result: RothAnalysisResult;
  householdId: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(n: number) {
  return (n * 100).toFixed(0) + "%";
}

export function RothClient({ result, householdId }: Props) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<"table" | "balances">("table");
  const [savingToStrategies, setSavingToStrategies] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const displayRows = showAll ? result.rows : result.rows.slice(0, 15);
  const hasWindow = result.optimalConversionWindow != null;

  async function handleUseInTransferStrategies() {
    if (!householdId || result.totalConversions <= 0) return;
    setSavingToStrategies(true);
    setSaveError(null);
    try {
      const windowLabel = hasWindow
        ? `${result.optimalConversionWindow!.startYear}–${result.optimalConversionWindow!.endYear}`
        : 'Roth conversion plan'
      await saveConsumerStrategyLineItem(householdId, {
        strategy_source: 'roth',
        category: 'trust_exclusion',
        confidence_level: 'illustrative',
        amount: Math.round(result.totalConversions),
        scenario_name: `Roth optimizer — ${windowLabel}`,
        metadata: {
          source: 'roth_optimizer',
          total_conversions: result.totalConversions,
          total_lifetime_tax_savings: result.totalLifetimeTaxSavings,
          optimal_window: result.optimalConversionWindow,
        },
      })
      router.push('/my-estate-trust-strategy?tab=strategies&openPanel=roth')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save to Transfer Strategies')
    } finally {
      setSavingToStrategies(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Roth conversion strategy</h2>
        <p className="text-sm text-muted-foreground">{result.summary}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total conversions</p>
            <p className="text-xl font-semibold tabular-nums">{fmt(result.totalConversions)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Lifetime tax savings</p>
            <p className={`text-xl font-semibold tabular-nums ${result.totalLifetimeTaxSavings >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {fmt(result.totalLifetimeTaxSavings)}
            </p>
          </div>
          {hasWindow && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Conversion window</p>
              <p className="text-xl font-semibold">
                {result.optimalConversionWindow!.startYear}–{result.optimalConversionWindow!.endYear}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border pb-0">
        {(["table", "balances"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "table" ? "Year-by-year plan" : "Balance projection"}
          </button>
        ))}
      </div>

      {/* Year-by-year table */}
      {tab === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Age</th>
                <th className="py-2 pr-3 font-medium text-right">Income</th>
                <th className="py-2 pr-3 font-medium text-right">RMD</th>
                <th className="py-2 pr-3 font-medium text-right">Projected conversion</th>
                <th className="py-2 pr-3 font-medium text-right">Fed tax cost</th>
                <th className="py-2 pr-3 font-medium text-right">State tax cost</th>
                <th className="py-2 pr-3 font-medium text-right">Combined rate</th>
                <th className="py-2 pr-3 font-medium">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr
                  key={row.year}
                  className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                    row.recommendedConversion > 0 ? "bg-green-50 dark:bg-green-950/20" : ""
                  }`}
                >
                  <td className="py-2 pr-3 font-medium">{row.year}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.age1}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(row.totalIncome)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                    {row.rmdAmount > 0 ? fmt(row.rmdAmount) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium text-green-700 dark:text-green-400">
                    {row.recommendedConversion > 0 ? fmt(row.recommendedConversion) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {row.incrementalFederalTax > 0 ? fmt(row.incrementalFederalTax) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {row.incrementalStateTax > 0 ? fmt(row.incrementalStateTax) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                      row.combinedMarginalRate >= 0.32
                        ? "bg-red-200 text-red-900"
                        : row.combinedMarginalRate >= 0.22
                        ? "bg-amber-200 text-amber-900"
                        : "bg-green-200 text-green-900"
                    }`}>
                      {pct(row.combinedMarginalRate)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[180px]">
                    {row.conversionRationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.rows.length > 15 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-sm text-primary hover:underline"
            >
              {showAll ? "Show fewer years" : `Show all ${result.rows.length} years`}
            </button>
          )}
        </div>
      )}

      {/* Balance projection tab */}
      {tab === "balances" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Age</th>
                <th className="py-2 pr-3 font-medium text-right">Tax-deferred</th>
                <th className="py-2 pr-3 font-medium text-right">Roth</th>
                <th className="py-2 pr-3 font-medium text-right">Taxable</th>
                <th className="py-2 pr-3 font-medium text-right">Total</th>
                <th className="py-2 pr-3 font-medium text-right">Lifetime savings (cumul.)</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const total = row.taxDeferredEnd + row.rothEnd + row.taxableEnd;
                return (
                  <tr key={row.year} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-3 font-medium">{row.year}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.age1}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {fmt(row.taxDeferredEnd)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-green-600 dark:text-green-400">
                      {fmt(row.rothEnd)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {fmt(row.taxableEnd)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {fmt(total)}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums text-sm ${
                      row.cumulativeLifetimeTaxSavings >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-500"
                    }`}>
                      {fmt(row.cumulativeLifetimeTaxSavings)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {result.rows.length > 15 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-sm text-primary hover:underline"
            >
              {showAll ? "Show fewer years" : `Show all ${result.rows.length} years`}
            </button>
          )}
        </div>
      )}

      {result.totalConversions > 0 && (
        <div className="rounded-lg border border-[color:var(--mwm-navy)]/10 bg-[color:var(--mwm-navy)]/[0.02] px-4 py-4">
          <p className="mb-1 text-sm font-semibold text-[color:var(--mwm-navy)]">
            Ready to add this to your plan?
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Saves this Roth conversion scenario to your sandbox on Transfer Strategies. Review
            the impact there, then add to your plan when ready.
          </p>
          {saveError && (
            <p className="mb-2 text-xs text-red-600">{saveError}</p>
          )}
          <button
            type="button"
            onClick={() => void handleUseInTransferStrategies()}
            disabled={savingToStrategies}
            className="w-full rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--mwm-navy)]/90 disabled:opacity-50"
          >
            {savingToStrategies ? 'Saving…' : 'Use in Transfer Strategies →'}
          </button>
        </div>
      )}

      {/* Methodology note */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How this works</p>
        <p>The model compares your current marginal tax rate to the rate projected when RMDs begin. It illustrates conversion amounts up to the top of your current bracket when that rate is lower than your projected RMD rate—one approach many families discuss with a tax advisor.</p>
        <p>Tax calculations use federal and state income tax bracket tables from admin-managed rules. Income, Social Security, and RMDs are sourced from your full household projection — the same data used in your Lifetime Snapshot. Your advisor can model the tax impact of specific conversion amounts with you.</p>
        <p className="pt-1 border-t border-border/40 mt-1">
          <span className="font-medium text-foreground">5-year rule & qualified withdrawals: </span>
          Projections assume Roth withdrawals are qualified — account held 5+ years and owner age 59½ or older. Early or non-qualified withdrawals may be subject to income tax and a 10% penalty. Each conversion starts its own 5-year clock. A small number of states tax Roth conversions as ordinary income in the conversion year regardless of federal treatment — your advisor can model the tax impact of specific conversion amounts with you.
        </p>
        <p className="pt-2 mt-2 border-t border-border/40">{DISCLAIMER_STRINGS.rothConversion}</p>
      </div>
    </div>
  );
}
