// lib/calculations/roth-optimizer.ts
// Sprint 13 — Roth Optimizer Engine
// Pure math, no DB calls. All inputs passed in.

export interface RothOptimizerInputs {
  // Household
  currentYear: number;
  person1RetirementYear: number;   // year person1 stops working
  person2RetirementYear: number;   // year person2 stops working (use 9999 if no spouse)
  deathYear: number;               // projection horizon (e.g. currentYear + 30)
  filingStatus: "mfj" | "mfs" | "hoh" | "qw" | "single";
  state: string;

  // Current balances
  taxDeferredBalance: number;
  rothBalance: number;
  taxableBalance: number;

  // Income — current-year amounts per person, engine grows them while working
  person1Income: number;
  person2Income: number;
  ordinaryIncomeGrowthRate: number;

  // SS income
  ssIncomePerson1: number;
  ssIncomePerson2: number;

  // RMD
  rmdStartAge: number;
  person1BirthYear: number;
  person2BirthYear: number;        // 0 if no spouse

  // Growth assumptions
  growthRateAccumulation: number;
  growthRateRetirement: number;
  inflationRate: number;

  // Tax
  federalBrackets: FederalBracket[];
  standardDeduction: number;
  maxAnnualConversion: number;
}

export interface FederalBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface RothYearRow {
  year: number;
  age1: number;
  age2: number | null;
  person1Income: number;
  person2Income: number;
  ssIncomeTotal: number;
  rmdAmount: number;
  totalIncome: number;
  recommendedConversion: number;
  conversionRationale: string;
  marginalRateWithoutConversion: number;
  marginalRateWithConversion: number;
  taxWithoutConversion: number;
  taxWithConversion: number;
  incrementalTaxCost: number;
  futureRmdReduction: number;
  taxDeferredEnd: number;
  rothEnd: number;
  taxableEnd: number;
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

function ssTaxablePortion(ssGross: number, otherIncome: number, filingStatus: string): number {
  if (ssGross <= 0) return 0;
  const t1 = filingStatus === "mfj" ? 32000 : 25000;
  const t2 = filingStatus === "mfj" ? 44000 : 34000;
  const provisional = otherIncome + ssGross * 0.5;
  if (provisional <= t1) return 0;
  if (provisional <= t2) return Math.min(ssGross * 0.5, (provisional - t1) * 0.5);
  return Math.min(ssGross * 0.85, ssGross * 0.5 * 0.5 + (provisional - t2) * 0.85);
}

function inflateBrackets(brackets: FederalBracket[], rate: number, years: number): FederalBracket[] {
  const f = Math.pow(1 + rate, years);
  return brackets.map((b) => ({
    min: Math.round(b.min * f),
    max: b.max != null ? Math.round(b.max * f) : null,
    rate: b.rate,
  }));
}

function rmdFactor(age: number): number {
  const t: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5,  95: 8.9,
  };
  return t[age] ?? (age < 72 ? 999 : 7.0);
}

// Both people must be 60+ (conservative proxy for 59.5) before conversions recommended
function bothOver59Half(year: number, p1Birth: number, p2Birth: number): boolean {
  const age1 = year - p1Birth;
  const age2 = p2Birth > 0 ? year - p2Birth : 60;
  return age1 >= 60 && age2 >= 60;
}

function optimalConversion(
  taxableBase: number,
  taxDeferred: number,
  projectedRmdRate: number,
  brackets: FederalBracket[],
  sd: number,
  maxConversion: number
): { amount: number; rationale: string } {
  const currentRate = marginalRate(taxableBase, brackets);
  const targetRate = Math.min(projectedRmdRate, currentRate + 0.01);

  let headroom = 0;
  for (const b of brackets) {
    if (b.rate > targetRate) break;
    if (b.max == null) { headroom = maxConversion; break; }
    const ceiling = b.max - sd;
    if (ceiling > taxableBase) headroom = Math.max(headroom, ceiling - taxableBase);
  }

  if (headroom <= 0) return { amount: 0, rationale: "Already at or above target bracket" };

  const amount = Math.min(headroom, taxDeferred, maxConversion);
  return {
    amount: Math.round(amount),
    rationale: `Fill ${Math.round(targetRate * 100)}% bracket — projected RMD rate ${Math.round(projectedRmdRate * 100)}%`,
  };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function runRothOptimizer(inputs: RothOptimizerInputs): RothOptimizerResult {
  const {
    currentYear, deathYear,
    person1RetirementYear, person2RetirementYear,
    filingStatus, person1BirthYear, person2BirthYear,
    rmdStartAge,
    taxDeferredBalance: initTaxDeferred,
    rothBalance: initRoth,
    taxableBalance: initTaxable,
    person1Income: initP1, person2Income: initP2,
    ordinaryIncomeGrowthRate,
    ssIncomePerson1, ssIncomePerson2,
    growthRateAccumulation, growthRateRetirement,
    inflationRate, federalBrackets, standardDeduction,
    maxAnnualConversion,
  } = inputs;

  const lastRetirementYear = Math.max(person1RetirementYear, person2RetirementYear);

  let taxDeferred = initTaxDeferred;
  let roth = initRoth;
  let taxable = initTaxable;
  let cumulativeLifetimeTaxSavings = 0;
  const rows: RothYearRow[] = [];

  // Pre-pass: find peak RMD marginal rate without conversions
  let peakRmdMarginalRate = 0.22;
  {
    let td = initTaxDeferred;
    for (let y = currentYear; y <= deathYear; y++) {
      const age1 = y - person1BirthYear;
      const yearsOut = y - currentYear;
      const isRetired = y >= lastRetirementYear;
      const growth = isRetired ? growthRateRetirement : growthRateAccumulation;
      if (age1 >= rmdStartAge && td > 0) {
        const projBrackets = inflateBrackets(federalBrackets, inflationRate, yearsOut);
        const projSD = standardDeduction * Math.pow(1 + inflationRate, yearsOut);
        const rmd = td / rmdFactor(age1);
        const p1 = y < person1RetirementYear ? initP1 * Math.pow(1 + ordinaryIncomeGrowthRate, yearsOut) : 0;
        const p2 = y < person2RetirementYear ? initP2 * Math.pow(1 + ordinaryIncomeGrowthRate, yearsOut) : 0;
        const ssGross = ssIncomePerson1 + ssIncomePerson2;
        const ssTax = ssTaxablePortion(ssGross, p1 + p2 + rmd, filingStatus);
        const taxableIncome = Math.max(0, p1 + p2 + ssTax + rmd - projSD);
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
    const age2 = person2BirthYear > 0 ? year - person2BirthYear : null;
    const isRetired = year >= lastRetirementYear;
    const growth = isRetired ? growthRateRetirement : growthRateAccumulation;

    const brackets = inflateBrackets(federalBrackets, inflationRate, yearsOut);
    const sd = standardDeduction * Math.pow(1 + inflationRate, yearsOut);

    // Income — zero after each person's own retirement year
    const p1inc = year < person1RetirementYear
      ? initP1 * Math.pow(1 + ordinaryIncomeGrowthRate, yearsOut) : 0;
    const p2inc = year < person2RetirementYear
      ? initP2 * Math.pow(1 + ordinaryIncomeGrowthRate, yearsOut) : 0;
    const ordinaryTotal = p1inc + p2inc;
    const ssGross = ssIncomePerson1 + ssIncomePerson2;

    // RMD
    let rmdAmount = 0;
    if (age1 >= rmdStartAge && taxDeferred > 0) {
      rmdAmount = taxDeferred / rmdFactor(age1);
    }

    const ssTaxable = ssTaxablePortion(ssGross, ordinaryTotal + rmdAmount, filingStatus);
    const totalIncome = ordinaryTotal + ssGross + rmdAmount;
    const taxableBase = Math.max(0, ordinaryTotal + ssTaxable + rmdAmount - sd);

    const taxWithout = calcFederalTax(taxableBase, brackets);
    const marginalWithout = marginalRate(taxableBase, brackets);

    // 59.5 guard
    const eligible = bothOver59Half(year, person1BirthYear, person2BirthYear);
    let conv = 0;
    let rationale = "";

    if (!eligible) {
      rationale = age2 !== null
        ? `Deferred — person2 is ${age2}, under 60`
        : `Deferred — person1 is ${age1}, under 60`;
    } else if (taxDeferred <= 0) {
      rationale = "No tax-deferred balance remaining";
    } else {
      const res = optimalConversion(taxableBase, taxDeferred, peakRmdMarginalRate, brackets, sd, maxAnnualConversion);
      conv = res.amount;
      rationale = res.rationale;
    }

    const taxableIncomeConv = Math.max(0, taxableBase + conv);
    const taxWith = calcFederalTax(taxableIncomeConv, brackets);
    const marginalWith = marginalRate(taxableIncomeConv, brackets);
    const incrementalTax = taxWith - taxWithout;

    const futureGrowthFactor = Math.pow(1 + growthRateRetirement, 10);
    const futureRmdReduction = age1 >= rmdStartAge - 10
      ? (conv * futureGrowthFactor) / rmdFactor(Math.min(age1 + 10, 95)) : 0;

    const yearSavings = futureRmdReduction * peakRmdMarginalRate - incrementalTax;
    cumulativeLifetimeTaxSavings += yearSavings;

    const taxDeferredEnd = Math.max(0, taxDeferred - rmdAmount - conv) * (1 + growth);
    const rothEnd = (roth + conv) * (1 + growth);
    const taxableEnd = Math.max(0, taxable - incrementalTax) * (1 + growth);

    rows.push({
      year, age1, age2,
      person1Income: Math.round(p1inc),
      person2Income: Math.round(p2inc),
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

    taxDeferred = taxDeferredEnd;
    roth = rothEnd;
    taxable = taxableEnd;
  }

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

  const summary = totalConversions > 0
    ? `Converting $${(totalConversions / 1000).toFixed(0)}k over ${windowStart}–${windowEnd} is estimated to save $${(totalSavings / 1000).toFixed(0)}k in lifetime federal taxes by reducing future RMDs.`
    : "No conversions recommended — current tax bracket exceeds projected RMD rate.";

  return {
    rows,
    totalLifetimeTaxSavings: Math.round(totalSavings),
    totalConversions: Math.round(totalConversions),
    optimalConversionWindow: windowStart && windowEnd ? { startYear: windowStart, endYear: windowEnd } : null,
    summary,
  };
}
