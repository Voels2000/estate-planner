"use client";

// ─────────────────────────────────────────
// Menu: Retirement Planning > Roth Conversion
// Route: /roth
// ─────────────────────────────────────────

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RothAnalysisResult,
  pickRothConversionDisplayContext,
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
  currentRatePct,
  projectedRmdRatePct,
  rmdRow,
}: {
  currentRatePct: number;
  projectedRmdRatePct: number;
  rmdRow: RothYearResult | null;
}) {
  const [annualConversion, setAnnualConversion] = useState(50);

  function fmtPanel(n: number): string {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${Math.round(abs)}`;
  }

  const modelFavorsConversion = projectedRmdRatePct > currentRatePct;
  const rateDiff = projectedRmdRatePct - currentRatePct;
  const conversionAmount = annualConversion * 1000;

  const taxThisYear = Math.round(conversionAmount * (currentRatePct / 100));
  const lifetimeNetBenefit = Math.round(conversionAmount * (rateDiff / 100) * 15);

  const breakeven =
    modelFavorsConversion && taxThisYear > 0
      ? new Date().getFullYear() +
        Math.round(taxThisYear / Math.max(Math.abs(lifetimeNetBenefit) / 15, 1))
      : null;

  const currentYear = new Date().getFullYear();
  const yearsUntilRmd = rmdRow ? Math.max(0, rmdRow.year - currentYear) : 0;
  const baseIraAtRmd = rmdRow ? (rmdRow.taxDeferredEnd ?? 0) : 0;
  const conversionImpact = annualConversion * 1000 * yearsUntilRmd * 1.05;
  const iraBalanceAtRmd =
    baseIraAtRmd > 0
      ? Math.max(0, Math.round((baseIraAtRmd - conversionImpact) / 1000))
      : null;

  return (
    <div className="rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-4">
      <p className="mb-3 text-xs font-medium text-[color:var(--mwm-navy)]">
        {modelFavorsConversion
          ? "What if I converted more?"
          : "What if I converted anyway? (delay looks favorable in this model)"}
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
          <p className="text-sm font-medium text-red-700">{fmtPanel(taxThisYear)}</p>
        </div>
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">
            {modelFavorsConversion ? "Lifetime savings" : "Lifetime extra cost"}
          </p>
          <p
            className={`text-sm font-medium ${
              modelFavorsConversion
                ? "text-emerald-700"
                : lifetimeNetBenefit < 0
                  ? "text-red-700"
                  : "text-[color:var(--mwm-text-secondary)]"
            }`}
          >
            {lifetimeNetBenefit > 0
              ? `+${fmtPanel(lifetimeNetBenefit)}`
              : lifetimeNetBenefit < 0
                ? fmtPanel(lifetimeNetBenefit)
                : "$0"}
          </p>
        </div>
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">Break-even year</p>
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
            {modelFavorsConversion && breakeven
              ? breakeven
              : modelFavorsConversion
                ? "—"
                : "Delay is better"}
          </p>
        </div>
        <div className="rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white px-3 py-2">
          <p className="mb-1 text-[10px] text-[color:var(--mwm-text-secondary)]">IRA at RMD age</p>
          <p className="text-sm font-medium text-[color:var(--mwm-navy)]">
            {iraBalanceAtRmd != null ? `$${iraBalanceAtRmd}K` : "—"}
          </p>
          {iraBalanceAtRmd != null && annualConversion > 0 && (
            <p className="mt-0.5 text-[10px] text-emerald-700">
              −${Math.round(conversionImpact / 1000)}K vs. no conversion
            </p>
          )}
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

  const {
    rmdRow,
    currentRatePct,
    projectedRmdRatePct,
  } = useMemo(() => pickRothConversionDisplayContext(result.rows), [result.rows]);

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
                : `Converting now at ${currentRatePct}% saves tax versus your projected ${projectedRmdRatePct}% RMD rate. The window is open.`}
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
                  {projectedRmdRatePct}%
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

          <WhatIfPanel
            currentRatePct={currentRatePct}
            projectedRmdRatePct={projectedRmdRatePct}
            rmdRow={rmdRow}
          />
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
      <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">How this calculation works</p>
        <p>
          Year-by-year income, Social Security, and RMDs come from your Lifetime Snapshot
          projection. Federal and state bracket tables and your profile deduction setting are
          applied on top of those rows.
        </p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            <span className="font-medium text-foreground">Projected RMD rate — </span>
            On the first projection year when the primary owner reaches RMD age and RMD income
            appears, we compute a combined federal + state marginal rate. That becomes the
            &ldquo;projected RMD rate&rdquo; in the insight card.
          </li>
          <li>
            <span className="font-medium text-foreground">When a conversion year is flagged — </span>
            Each year, both spouses must be at least age 60 (a simplified stand-in for 59½). The
            year&apos;s combined marginal rate needs to be below the projected RMD rate, and there must
            still be tax-deferred balance remaining.
          </li>
          <li>
            <span className="font-medium text-foreground">How much — </span>
            We estimate federal bracket headroom: room to add conversion income before reaching the
            bracket targeted at RMD age. When the projected RMD federal rate is 24% or higher, we
            fill through the top of the 22% bracket (just under the 24% threshold). The
            recommendation is the smaller of that headroom, your combined traditional IRA/401(k)
            balance, and $500,000 per year.
          </li>
          <li>
            <span className="font-medium text-foreground">Tax cost on each row — </span>
            Federal cost uses the row&apos;s marginal rate × conversion amount. State cost uses
            bracket rules when your state taxes ordinary income. Lifetime savings in the table is a
            simplified illustration (future RMD reduction vs. conversion tax), not a full tax return.
          </li>
        </ol>
        <p className="font-medium text-foreground">What this model does not include</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Per-account rules — amounts use your <em>combined</em> traditional IRA and 401(k)
            balances. Employer 401(k) plans you cannot convert yet, or a spouse&apos;s separate
            accounts, are not split out. Legally you can convert your own IRA at 59½ even if your
            spouse is younger; this tool waits until both spouses are 60+ before recommending any
            household conversion.
          </li>
          <li>
            Social Security taxation — bracket headroom uses projected income minus your deduction,
            not the full provisional-income formula used on a tax return, so gap-year rates and
            amounts can differ slightly from a CPA worksheet.
          </li>
          <li>
            IRMAA, Roth five-year clocks, paying conversion tax from IRA vs. taxable, and
            account-specific eligibility.
          </li>
          <li>
            The &ldquo;What if I converted&rdquo; slider uses a separate simplified formula; only
            the year-by-year table reflects the full engine above.
          </li>
        </ul>
        <p>
          The insight card &ldquo;current rate&rdquo; uses the first recommended conversion year
          (or your lowest pre-RMD rate), not necessarily this calendar year if you are still
          working or below the age gate.
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
