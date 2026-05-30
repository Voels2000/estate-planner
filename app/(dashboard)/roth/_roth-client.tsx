"use client";

// ─────────────────────────────────────────
// Menu: Retirement Planning > Roth Conversion
// Route: /roth
// ─────────────────────────────────────────

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RothAnalysisResult,
  type RothYearResult,
} from "@/lib/calculations/roth-analysis";
import { saveConsumerStrategyLineItem } from "@/lib/consumer/consumerStrategyLineItems";
import { DISCLAIMER_STRINGS } from "@/lib/compliance/language-policy";

interface Props {
  result: RothAnalysisResult;
  householdId: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function WhatIfPanel({
  rows,
  currentRatePct,
}: {
  rows: RothYearResult[];
  currentRatePct: number;
}) {
  const [annualConversion, setAnnualConversion] = useState(50);

  const taxThisYear = Math.round(annualConversion * (currentRatePct / 100));
  const rmdRow = rows.find((r) => r.rmdAmount > 0);
  const projectedRmdPct = rmdRow
    ? Math.round((rmdRow.combinedMarginalRate ?? currentRatePct / 100) * 100)
    : currentRatePct;
  const rateDiff = Math.max(0, projectedRmdPct - currentRatePct);
  const lifetimeSavings = Math.round(annualConversion * (rateDiff / 100) * 15);
  const breakeven =
    lifetimeSavings > 0
      ? new Date().getFullYear() +
        Math.round(taxThisYear / Math.max(lifetimeSavings / 15, 1))
      : null;
  const iraBalanceAtRmd = rmdRow
    ? Math.round((rmdRow.taxDeferredEnd ?? 0) / 1000)
    : null;

  return (
    <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-4">
      <p className="mb-3 text-xs font-medium text-[color:var(--mwm-navy)]">
        What if I converted anyway?
      </p>

      <div className="mb-3 flex items-center gap-3">
        <span className="w-28 flex-shrink-0 text-xs text-[color:var(--mwm-text-secondary)]">
          Annual conversion
        </span>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          value={annualConversion}
          onChange={(e) => setAnnualConversion(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-14 text-right text-sm font-medium text-[color:var(--mwm-navy)]">
          ${annualConversion}K
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">Tax this year</p>
          <p className="text-sm font-medium text-red-700">${taxThisYear}K</p>
        </div>
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">
            Lifetime savings
          </p>
          <p
            className={`text-sm font-medium ${
              lifetimeSavings > 0 ? "text-emerald-700" : "text-[color:var(--mwm-text-secondary)]"
            }`}
          >
            {lifetimeSavings > 0 ? `$${lifetimeSavings}K` : "$0"}
          </p>
        </div>
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">Break-even year</p>
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">{breakeven ?? "—"}</p>
        </div>
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">IRA at RMD age</p>
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
            {iraBalanceAtRmd != null ? `$${iraBalanceAtRmd}K` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RothClient({ result, householdId }: Props) {
  const router = useRouter();
  const [savingToStrategies, setSavingToStrategies] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasWindow = result.optimalConversionWindow != null;
  const windowStart = result.optimalConversionWindow?.startYear;
  const windowEnd = result.optimalConversionWindow?.endYear;

  const currentRate = result.rows[0]?.combinedMarginalRate ?? 0.22;
  const currentRatePct = Math.round(currentRate * 100);

  const rmdRow = result.rows.find((r) => r.rmdAmount > 0);
  const projectedRmdRate = rmdRow
    ? Math.round((rmdRow.combinedMarginalRate ?? currentRate) * 100)
    : currentRatePct;

  const noConversionRecommended = result.totalConversions === 0;

  const groupedRows = useMemo(() => {
    const groups: { label: string; rows: RothYearResult[] }[] = [];
    let currentGroup: { label: string; rows: RothYearResult[] } | null = null;

    for (const row of result.rows) {
      const label = row.conversionRationale || "Other";
      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, rows: [] };
        groups.push(currentGroup);
      }
      currentGroup.rows.push(row);
    }
    return groups;
  }, [result.rows]);

  async function handleUseInTransferStrategies() {
    if (!householdId || result.totalConversions <= 0) return;
    setSavingToStrategies(true);
    setSaveError(null);
    try {
      const windowLabel = hasWindow
        ? `${result.optimalConversionWindow!.startYear}–${result.optimalConversionWindow!.endYear}`
        : "Roth conversion plan";
      await saveConsumerStrategyLineItem(householdId, {
        strategy_source: "roth",
        category: "trust_exclusion",
        confidence_level: "illustrative",
        amount: Math.round(result.totalConversions),
        scenario_name: `Roth optimizer — ${windowLabel}`,
        metadata: {
          source: "roth_optimizer",
          total_conversions: result.totalConversions,
          total_lifetime_tax_savings: result.totalLifetimeTaxSavings,
          optimal_window: result.optimalConversionWindow,
        },
      });
      router.push("/my-estate-trust-strategy?tab=strategies&openPanel=roth");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save to Transfer Strategies");
    } finally {
      setSavingToStrategies(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-4">
          <p className="mb-1 text-xs text-[color:var(--mwm-text-secondary)]">
            Total conversions recommended
          </p>
          <p className="text-xl font-medium text-[color:var(--mwm-navy)]">
            {fmt(result.totalConversions)}
          </p>
          <p className="mt-1 text-xs text-[color:var(--mwm-text-secondary)]">
            {result.totalConversions > 0 && windowStart && windowEnd
              ? `Years ${windowStart}–${windowEnd}`
              : "No action needed this year"}
          </p>
        </div>
        <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-4">
          <p className="mb-1 text-xs text-[color:var(--mwm-text-secondary)]">
            Estimated lifetime tax savings
          </p>
          <p
            className={`text-xl font-medium ${
              result.totalLifetimeTaxSavings > 0
                ? "text-emerald-700"
                : "text-[color:var(--mwm-text-primary)]"
            }`}
          >
            {fmt(result.totalLifetimeTaxSavings)}
          </p>
          <p className="mt-1 text-xs text-[color:var(--mwm-text-secondary)]">
            {result.totalLifetimeTaxSavings > 0 ? "Projected savings" : "Convert to unlock savings"}
          </p>
        </div>
      </div>

      {/* Insight card */}
      <div className="mb-4 rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-[color:var(--mwm-navy)]">
              {noConversionRecommended
                ? "Why no conversion is recommended"
                : "Your conversion opportunity"}
            </p>
            <p className="mb-4 text-xs leading-relaxed text-[color:var(--mwm-text-secondary)]">
              {noConversionRecommended
                ? "Your current tax rate equals your projected RMD rate. Converting now would pay tax at the same rate you'd pay later — no advantage today."
                : `Converting now at ${currentRatePct}% saves tax versus your projected ${projectedRmdRate}% RMD rate. The window is open.`}
            </p>

            <div className="mb-4 flex items-center gap-3 rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] px-4 py-3">
              <div className="flex-1 text-center">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-[color:var(--mwm-text-secondary)]">
                  Current rate
                </p>
                <p className="text-xl font-medium text-[color:var(--mwm-navy)]">{currentRatePct}%</p>
                <p className="text-[10px] text-[color:var(--mwm-text-secondary)]">
                  {new Date().getFullYear()} marginal
                </p>
              </div>
              <div className="text-lg text-[color:var(--mwm-text-secondary)]">
                {noConversionRecommended ? "=" : "<"}
              </div>
              <div className="flex-1 text-center">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-[color:var(--mwm-text-secondary)]">
                  Projected RMD rate
                </p>
                <p className="text-xl font-medium text-[color:var(--mwm-navy)]">
                  {projectedRmdRate}%
                </p>
                <p className="text-[10px] text-[color:var(--mwm-text-secondary)]">At RMD age</p>
              </div>
            </div>

            {noConversionRecommended && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[color:var(--mwm-text-secondary)]">
                  What would trigger a recommendation
                </p>
                <ul className="space-y-1.5">
                  {[
                    "IRA balance grows enough that RMDs push you into a higher bracket",
                    "Tax rates rise when current provisions expire",
                    "Income drops in an early retirement year, creating a low-rate window",
                  ].map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-2 text-xs text-[color:var(--mwm-text-secondary)]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <WhatIfPanel rows={result.rows} currentRatePct={currentRatePct} />
        </div>
      </div>

      {/* Balance projection — always visible above the grouped table */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">Balance projection</p>
          <div className="flex items-center gap-3 text-xs text-[color:var(--mwm-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" />
              Tax-deferred (IRA)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-3 rounded-sm bg-emerald-500"
                style={{ borderStyle: "dashed", borderWidth: "1px" }}
              />
              Roth
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-amber-400" />
              Taxable
            </span>
          </div>
        </div>
        <div className="overflow-x-auto rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--mwm-border)] bg-[var(--mwm-bg-muted)] text-left text-xs uppercase tracking-wide text-[color:var(--mwm-text-secondary)]">
                <th className="px-3 py-2 font-medium">Year</th>
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 text-right font-medium">Tax-deferred</th>
                <th className="px-3 py-2 text-right font-medium">Roth</th>
                <th className="px-3 py-2 text-right font-medium">Taxable</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Lifetime savings (cumul.)</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const total = row.taxDeferredEnd + row.rothEnd + row.taxableEnd;
                return (
                  <tr
                    key={`balance-${row.year}`}
                    className="border-b border-[color:var(--mwm-border)]/50 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-medium">{row.year}</td>
                    <td className="px-3 py-2 text-[color:var(--mwm-text-secondary)]">{row.age1}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {fmt(row.taxDeferredEnd)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmt(row.rothEnd)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {fmt(row.taxableEnd)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(total)}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums text-sm ${
                        row.cumulativeLifetimeTaxSavings >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500"
                      }`}
                    >
                      {fmt(row.cumulativeLifetimeTaxSavings)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Year-by-year grouped table */}
      <div className="overflow-hidden rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)]">
        {groupedRows.map((group) => (
          <div key={`${group.label}-${group.rows[0]?.year}`}>
            <div className="border-b border-[color:var(--mwm-border)] bg-[var(--mwm-bg-muted)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--mwm-text-secondary)]">
              {group.label} ({group.rows[0]?.year}–{group.rows[group.rows.length - 1]?.year})
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-[color:var(--mwm-border)] bg-[var(--mwm-bg-muted)]">
                    <th className="px-3 py-2 text-left font-medium text-[color:var(--mwm-text-secondary)]">
                      Year · Age
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)]">
                      Income
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)]">
                      RMD
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)]">
                      Conversion
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)]">
                      Fed tax cost
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)]">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr
                      key={row.year}
                      className={[
                        "border-b border-[color:var(--mwm-border)] last:border-b-0",
                        row.recommendedConversion > 0 ? "bg-emerald-50" : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2 font-medium text-[color:var(--mwm-text-primary)]">
                        {row.year}
                        <span className="ml-1 font-normal text-[color:var(--mwm-text-secondary)]">
                          · {row.age1}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--mwm-text-primary)]">
                        {fmt(row.totalIncome)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                        {row.rmdAmount > 0 ? fmt(row.rmdAmount) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">
                        {row.recommendedConversion > 0 ? fmt(row.recommendedConversion) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-700">
                        {row.incrementalFederalTax > 0 ? fmt(row.incrementalFederalTax) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            (row.combinedMarginalRate ?? 0) >= 0.24
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-50 text-blue-800"
                          }`}
                        >
                          {Math.round((row.combinedMarginalRate ?? 0) * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {result.totalConversions > 0 && (
        <div className="rounded-lg border border-[color:var(--mwm-navy)]/10 bg-[color:var(--mwm-navy)]/[0.02] px-4 py-4">
          <p className="mb-1 text-sm font-semibold text-[color:var(--mwm-navy)]">
            Ready to add this to your plan?
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Saves this Roth conversion scenario to your sandbox on Transfer Strategies. Review the
            impact there, then add to your plan when ready.
          </p>
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
          <button
            type="button"
            onClick={() => void handleUseInTransferStrategies()}
            disabled={savingToStrategies}
            className="w-full rounded-lg bg-[color:var(--mwm-navy)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--mwm-navy)]/90 disabled:opacity-50"
          >
            {savingToStrategies ? "Saving…" : "Use in Transfer Strategies →"}
          </button>
        </div>
      )}

      {/* Methodology note */}
      <div className="space-y-1 rounded-lg border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">How this works</p>
        <p>
          The model compares your current marginal tax rate to the rate projected when RMDs begin.
          It illustrates conversion amounts up to the top of your current bracket when that rate is
          lower than your projected RMD rate—one approach many families discuss with a tax advisor.
        </p>
        <p>
          Tax calculations use federal and state income tax bracket tables from admin-managed rules.
          Income, Social Security, and RMDs are sourced from your full household projection — the
          same data used in your Lifetime Snapshot. Your advisor can model the tax impact of
          specific conversion amounts with you.
        </p>
        <p className="mt-1 border-t border-border/40 pt-1">
          <span className="font-medium text-foreground">5-year rule & qualified withdrawals: </span>
          Projections assume Roth withdrawals are qualified — account held 5+ years and owner age
          59½ or older. Early or non-qualified withdrawals may be subject to income tax and a 10%
          penalty. Each conversion starts its own 5-year clock. A small number of states tax Roth
          conversions as ordinary income in the conversion year regardless of federal treatment —
          your advisor can model the tax impact of specific conversion amounts with you.
        </p>
        <p className="mt-2 border-t border-border/40 pt-2">{DISCLAIMER_STRINGS.rothConversion}</p>
      </div>
    </div>
  );
}
