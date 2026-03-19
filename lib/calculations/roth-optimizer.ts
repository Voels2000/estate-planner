// lib/calculations/roth-optimizer.ts
// Sprint 13 — Roth Optimizer Engine
// Pure math, no DB calls. All inputs passed in.

export interface RothOptimizerInputs {
  // Household
  currentYear: number;
  retirementYear: number;          // year person1 retires (stop accumulation)
  deathYear: number;               // projection horizon (e.g. currentYear + 30)
  filingStatus: "mfj" | "mfs" | "hoh" | "qw" | "single";
  state: string;                   // not used in engine v1 — reserved for state tax

  // Current balances
  taxDeferredBalance: number;      // total IRA/401k balance today
  rothBalance: number;             // total Roth balance today
  taxableBalance: number;          // brokerage/savings balance today

  // Income (ordinary, non-SS, recurring — wages, pension, rental)
  ordinaryIncome: number;          // current year base ordinary income
  ordinaryIncomeGrowthRate: number; // annual % growth of ordinary income (0-1)

  // SS income — gated by claim age logic already resolved upstream
  ssIncomePerson1: number;         // annual SS amount person1 (0 if not yet claimed)
  ssIncomePerson2: number;         // annual SS amount person2

  // Required min distributions: pass pre-calculated RMD for current year
  // Engine projects RMDs forward from taxDeferredBalance + growth
  rmdStartAge: number;             // 73 for SECURE 2.0 (or 75 if born after 1960)
  person1BirthYear: number;

  // Growth assumptions
  growthRateAccumulation: number;  // e.g. 0.07
  growthRateRetirement: number;    // e.g. 0.05
  inflationRate: number;           // e.g. 0.025

  // Tax brackets — pass current-year federal brackets (from DB or hardcoded fallback)
  federalBrackets: FederalBracket[];

  // Standard deduction for filing status (current year)
  standardDeduction: number;

  // Conversion cap: never recommend converting more than this per year (user-configurable)
  maxAnnualConversion: number;     // e.g. 500000 (effectively unlimited)
}

export interface FederalBracket {
  min: number;
  max: number | null;  // null = no cap (top bracket)
  rate: number;        // 0.10, 0.12, 0.22 …
}

export interface RothYearRow {
  year: number;
  age1: number;                    // person1 age in this year

  // Income components
  ordinaryIncome: number;
  ssIncomeTotal: number;
  rmdAmount: number;
  totalIncome: number;             // ordinary + SS taxable portion + RMD

  // Conversion recommendation
  recommendedConversion: number;   // optimal Roth conversion for this year
  conversionRationale: string;     // e.g. "Fill 22% bracket", "Pre-RMD window"

  // Tax impact
  marginalRateWithoutConversion: number;
  marginalRateWithConversion: number;
  taxWithoutConversion: number;
  taxWithConversion: number;
  incrementalTaxCost: number;      // extra tax paid this year for conversion
  futureRmdReduction: number;      // estimated reduction in future RMDs from this conversion

  // Balance evolution
  taxDeferredEnd: number;
  rothEnd: number;
  taxableEnd: number;

  // Lifetime metric (cumulative from currentYear through this year)
  cumulativeLifetimeTaxSavings: number;
}

export interface RothOptimizerResult {
  rows: RothYearRow[];
  totalLifetimeTaxSavings: number;
  totalConversions: number;
  optimalConversionWindow: { startYear: number; endYear: number } | null;
  summary: string;
}

// ─── Tax helpers ─────────────────────────────────────────────────────────────

function calcFederalTax(taxableIncome: number, brackets: FederalBracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    const top = b.max ?? Infinity;
    const slice = Math.min(taxableIncome, top) - b.min;
    if (slice <= 0) continue;
    tax += slice * b.rate;
  }
  return tax;
}

function marginalRate(taxableIncome: number, brackets: FederalBracket[]): number {
  if (taxableIncome <= 0) return brackets[0]?.rate ?? 0;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0]?.rate ?? 0;
}

// SS taxable portion: simplified tier formula
// Under $25k single / $32k MFJ: 0%; $25-34k / $32-44k: 50%; above: 85%
function ssTaxablePortion(
  ssGross: number,
  otherIncome: number,
  filingStatus: string
): number {
  if (ssGross <= 0) return 0;
  const threshold1 = filingStatus === "mfj" ? 32000 : 25000;
  const threshold2 = filingStatus === "mfj" ? 44000 : 34000;
  const provisionalIncome = otherIncome + ssGross * 0.5;
  if (provisionalIncome <= threshold1) return 0;
  if (provisionalIncome <= threshold2) {
    return Math.min(ssGross * 0.5, (provisionalIncome - threshold1) * 0.5);
  }
  return Math.min(
    ssGross * 0.85,
    ssGross * 0.5 * 0.5 + (provisionalIncome - threshold2) * 0.85
  );
}

// Inflate brackets forward by inflation rate
function inflateBrackets(
  brackets: FederalBracket[],
  inflationRate: number,
  years: number
): FederalBracket[] {
  const factor = Math.pow(1 + inflationRate, years);
  return brackets.map((b) => ({
    min: Math.round(b.min * factor),
    max: b.max != null ? Math.round(b.max * factor) : null,
    rate: b.rate,
  }));
}

// RMD factor — IRS Uniform Lifetime Table (simplified lookup)
// Real table seeded in DB; this approximation covers engine self-tests
function rmdFactor(age: number): number {
  const table: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  };
  return table[age] ?? (age < 72 ? 999 : 7.0); // pre-RMD age: huge factor = ~0 RMD
}

// ─── Optimal conversion amount for a single year ─────────────────────────────
// Strategy: fill the bracket just below the "rmdHurdle" rate if possible,
// otherwise fill the current marginal bracket.
// Never convert into a bracket higher than the projected RMD rate + 2pp buffer.

function optimalConversion(
  ordinaryIncomeTaxable: number,
  taxDeferredBalance: number,
  rmdThisYear: number,
  projectedRmdRate: number,         // marginal rate when RMDs will hit
  brackets: FederalBracket[],
  standardDeduction: number,
  maxConversion: number
): { amount: number; rationale: string } {
  const agi = ordinaryIncomeTaxable + rmdThisYear;
  const taxableBase = Math.max(0, agi - standardDeduction);
  const currentRate = marginalRate(taxableBase, brackets);

  // Find top bracket we're willing to fill (not above projectedRmdRate)
  const targetRate = Math.min(projectedRmdRate, currentRate + 0.01);

  // Find how much headroom exists up to top of target bracket
  let headroom = 0;
  for (const b of brackets) {
    if (b.rate > targetRate) break;
    if (b.max == null) {
      headroom = Math.max(0, maxConversion);
      break;
    }
    const top = b.max - standardDeduction; // bracket ceiling in AGI terms
    if (top > taxableBase) {
      headroom = Math.max(0, top - taxableBase);
    }
  }

  if (headroom <= 0) {
    return { amount: 0, rationale: "Already at or above target bracket" };
  }

  const amount = Math.min(headroom, taxDeferredBalance, maxConversion);
  const rationale =
    rmdThisYear === 0
      ? `Pre-RMD window — fill ${Math.round(targetRate * 100)}% bracket`
      : `Fill ${Math.round(targetRate * 100)}% bracket while RMDs are low`;

  return { amount: Math.round(amount), rationale };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function runRothOptimizer(inputs: RothOptimizerInputs): RothOptimizerResult {
  const {
    currentYear,
    deathYear,
    retirementYear,
    filingStatus,
    person1BirthYear,
    rmdStartAge,
    taxDeferredBalance: initTaxDeferred,
    rothBalance: initRoth,
    taxableBalance: initTaxable,
    ordinaryIncome: initOrdinary,
    ordinaryIncomeGrowthRate,
    ssIncomePerson1,
    ssIncomePerson2,
    growthRateAccumulation,
    growthRateRetirement,
    inflationRate,
    federalBrackets,
    standardDeduction,
    maxAnnualConversion,
  } = inputs;

  const rows: RothYearRow[] = [];

  let taxDeferred = initTaxDeferred;
  let roth = initRoth;
  let taxable = initTaxable;
  let cumulativeLifetimeTaxSavings = 0;

  // Project two scenarios in parallel: with vs without conversions
  // "without" scenario tracks tax-deferred balance to compute future RMD tax hit
  let taxDeferredNoConvert = initTaxDeferred;

  // Estimate future RMD rate: run a quick forward pass on tax-deferred balance
  // to find the marginal rate when RMDs start. Used to determine conversion target.
  let peakRmdMarginalRate = 0.22; // default fallback
  {
    let td = initTaxDeferred;
    for (let y = currentYear; y <= deathYear; y++) {
      const age = y - person1BirthYear;
      const isRetired = y >= retirementYear;
      const growth = isRetired ? growthRateRetirement : growthRateAccumulation;
      const yearsOut = y - currentYear;
      const projBrackets = inflateBrackets(federalBrackets, inflationRate, yearsOut);
      const projSD = standardDeduction * Math.pow(1 + inflationRate, yearsOut);

      if (age >= rmdStartAge) {
        const rmd = td / rmdFactor(age);
        const projOrdinary =
          initOrdinary * Math.pow(1 + ordinaryIncomeGrowthRate, Math.min(yearsOut, retirementYear - currentYear));
        const ssGross = ssIncomePerson1 + ssIncomePerson2;
        const ssTax = ssTaxablePortion(ssGross, projOrdinary + rmd, filingStatus);
        const taxableIncome = Math.max(0, projOrdinary + ssTax + rmd - projSD);
        peakRmdMarginalRate = marginalRate(taxableIncome, projBrackets);
        break;
      }
      td = td * (1 + growth);
    }
  }

  // Main year loop
  for (let year = currentYear; year <= deathYear; year++) {
    const yearsOut = year - currentYear;
    const age1 = year - person1BirthYear;
    const isRetired = year >= retirementYear;
    const growth = isRetired ? growthRateRetirement : growthRateAccumulation;

    // Inflate brackets and standard deduction
    const brackets = inflateBrackets(federalBrackets, inflationRate, yearsOut);
    const sd = standardDeduction * Math.pow(1 + inflationRate, yearsOut);

    // Project income this year
    const yearsWorked = Math.min(yearsOut, retirementYear - currentYear);
    const ordinary = isRetired
      ? 0
      : initOrdinary * Math.pow(1 + ordinaryIncomeGrowthRate, yearsOut);
    const ssGross = ssIncomePerson1 + ssIncomePerson2;

    // RMD this year
    let rmdAmount = 0;
    if (age1 >= rmdStartAge && taxDeferred > 0) {
      rmdAmount = taxDeferred / rmdFactor(age1);
    }

    // SS taxable
    const ssTaxable = ssTaxablePortion(ssGross, ordinary + rmdAmount, filingStatus);
    const totalIncome = ordinary + ssGross + rmdAmount;

    // Taxable income WITHOUT conversion
    const taxableIncomeBase = Math.max(0, ordinary + ssTaxable + rmdAmount - sd);
    const taxWithout = calcFederalTax(taxableIncomeBase, brackets);
    const marginalWithout = marginalRate(taxableIncomeBase, brackets);

    // Optimal conversion
    const { amount: conv, rationale } = optimalConversion(
      ordinary + ssTaxable,
      taxDeferred,
      rmdAmount,
      peakRmdMarginalRate,
      brackets,
      sd,
      maxAnnualConversion
    );

    // Taxable income WITH conversion
    const taxableIncomeConv = Math.max(0, taxableIncomeBase + conv);
    const taxWith = calcFederalTax(taxableIncomeConv, brackets);
    const marginalWith = marginalRate(taxableIncomeConv, brackets);
    const incrementalTax = taxWith - taxWithout;

    // Future RMD reduction: converting $X from tax-deferred reduces future RMDs
    // Rough estimate: reduction in RMDs over next 10 years at projected growth
    const futureGrowthFactor = Math.pow(1 + growthRateRetirement, 10);
    const futureRmdReduction =
      age1 >= rmdStartAge - 10
        ? (conv * futureGrowthFactor) / rmdFactor(Math.min(age1 + 10, 95))
        : 0;

    // Lifetime savings estimate: tax saved on future RMDs minus incremental cost now
    const projectedRmdTaxSaved = futureRmdReduction * peakRmdMarginalRate;
    const yearSavings = projectedRmdTaxSaved - incrementalTax;

    cumulativeLifetimeTaxSavings += yearSavings;

    // Update balances (apply conversion + growth)
    const taxDeferredAfterRmd = Math.max(0, taxDeferred - rmdAmount);
    const taxDeferredAfterConv = Math.max(0, taxDeferredAfterRmd - conv);
    const taxDeferredEnd = taxDeferredAfterConv * (1 + growth);
    const rothEnd = (roth + conv) * (1 + growth);
    const taxableEnd = Math.max(0, taxable - incrementalTax) * (1 + growth);

    rows.push({
      year,
      age1,
      ordinaryIncome: Math.round(ordinary),
      ssIncomeTotal: Math.round(ssGross),
      rmdAmount: Math.round(rmdAmount),
      totalIncome: Math.round(totalIncome),
      recommendedConversion: conv,
      conversionRationale: rationale,
      marginalRateWithoutConversion: marginalWithout,
      marginalRateWithConversion: marginalWith,
      taxWithoutConversion: Math.round(taxWithout),
      taxWithConversion: Math.round(taxWith),
      incrementalTaxCost: Math.round(incrementalTax),
      futureRmdReduction: Math.round(futureRmdReduction),
      taxDeferredEnd: Math.round(taxDeferredEnd),
      rothEnd: Math.round(rothEnd),
      taxableEnd: Math.round(taxableEnd),
      cumulativeLifetimeTaxSavings: Math.round(cumulativeLifetimeTaxSavings),
    });

    // Advance balances
    taxDeferred = taxDeferredEnd;
    roth = rothEnd;
    taxable = taxableEnd;
  }

  // Find optimal conversion window (consecutive years with positive yearSavings)
  let windowStart: number | null = null;
  let windowEnd: number | null = null;
  for (const row of rows) {
    if (row.recommendedConversion > 0) {
      if (windowStart === null) windowStart = row.year;
      windowEnd = row.year;
    }
  }

  const totalConversions = rows.reduce((s, r) => s + r.recommendedConversion, 0);
  const totalSavings = rows[rows.length - 1]?.cumulativeLifetimeTaxSavings ?? 0;

  const summary =
    totalConversions > 0
      ? `Converting $${(totalConversions / 1000).toFixed(0)}k over ${windowStart}–${windowEnd} is estimated to save $${(totalSavings / 1000).toFixed(0)}k in lifetime federal taxes by reducing future RMDs.`
      : "No conversions recommended — current tax bracket exceeds projected RMD rate.";

  return {
    rows,
    totalLifetimeTaxSavings: Math.round(totalSavings),
    totalConversions: Math.round(totalConversions),
    optimalConversionWindow:
      windowStart && windowEnd
        ? { startYear: windowStart, endYear: windowEnd }
        : null,
    summary,
  };
}
