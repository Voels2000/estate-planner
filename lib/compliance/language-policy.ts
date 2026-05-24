/**
 * LANGUAGE POLICY — My Wealth Maps
 * Sprint C-2b | Created: 2026-05-24
 *
 * This platform is a financial planning PREPARATION TOOL.
 * It is not a registered investment adviser, financial planner, or legal counsel.
 * Nothing it produces constitutes financial, tax, investment, or legal advice.
 *
 * ─── ALWAYS ───────────────────────────────────────────────────────────────────
 * • Frame outputs as calculations from user-entered inputs
 * • Label projections as estimates: "projected," "estimated," "based on inputs"
 * • Point CTAs to professional advisors/attorneys for decisions
 * • Include inline disclaimers near financial outputs (see DISCLAIMER_STRINGS below)
 * • Attribute advisor recommendations to the licensed advisor, not the platform
 * • Use "household data" or "household picture" — not "your plan"
 *
 * ─── NEVER ────────────────────────────────────────────────────────────────────
 * • Tell users what they "should" do with money or assets
 * • Declare an "optimal" strategy, allocation, or timing
 * • Present platform-generated outputs as professional advice
 * • Show a platform-generated target allocation (only user- or advisor-entered)
 * • Say "your plan" when you mean "your household data"
 * • Characterize a score as good/bad without a disclaimer
 * • Say "we recommend" or "based on your profile, we suggest"
 *
 * ─── LEGAL BASIS ──────────────────────────────────────────────────────────────
 * Investment Advisers Act of 1940, Section 202(a)(11): advice about securities
 * for compensation triggers IA registration. Platform avoids this by:
 *   1. Showing calculations, not directives
 *   2. Pointing all decisions to licensed professionals
 *   3. Never generating or suggesting a target securities allocation
 *   4. Keeping advisor recommendations attributable to the licensed advisor
 */

export const DISCLAIMER_STRINGS = {
  /** Use on /dashboard, inline near the readiness score */
  dashboard:
    "This dashboard reflects information you've entered. It is for planning preparation only — not financial, tax, or legal advice. Consult qualified professionals before making decisions.",

  /** Use on /projections, /complete, /scenarios near any output numbers */
  projections:
    "Projections are estimates based on the assumptions you entered. They are not guarantees of future results. Discuss your retirement strategy with a licensed financial professional.",

  /** Use on /monte-carlo near probability outputs */
  monteCarlo:
    "Monte Carlo results show a range of possible outcomes based on your inputs. They are not a prediction of future performance. Discuss these results with a licensed financial professional.",

  /** Use on /roth near conversion outputs */
  rothConversion:
    "Roth conversion estimates are based on the tax assumptions you entered. Discuss conversion timing and amounts with a licensed tax professional.",

  /** Use on /estate-tax near exposure numbers */
  estateTax:
    "Estate tax estimates are based on the asset values and assumptions you've entered. They are not a legal determination of your tax liability. Consult an estate attorney for your actual exposure.",

  /** Use on /my-estate-strategy near horizon table */
  estateStrategy:
    "Horizon projections are estimates based on your current household data. Actual estate values and taxes will depend on future asset growth, law changes, and professional determinations.",

  /** Use on /my-estate-trust-strategy?tab=strategies near strategy panels */
  strategies:
    "These strategies are described for educational purposes. Whether any strategy is appropriate for your situation requires professional legal and tax advice.",

  /** Use on /allocation if a comparison is shown */
  allocation:
    "Asset allocation information reflects accounts you've connected or entered. This is not investment advice. Discuss your allocation with a licensed financial adviser.",

  /** Page 1 of /print PDF output */
  pdfCover:
    "This document was prepared by the account holder using My Wealth Maps, a financial planning preparation tool. It reflects information entered by the user and is intended to support a conversation with qualified legal and financial professionals. It is not legal or financial advice and does not constitute an estate plan.",

  /** Use on /assess and /event/[slug]/assess near score display */
  assessment:
    "This score reflects your answers to a self-assessment questionnaire. It is not a professional evaluation of your financial or estate plan.",

  /** Footer — replace or supplement existing footer disclaimer */
  footer:
    "My Wealth Maps provides financial planning preparation tools for educational purposes only. Nothing on this platform constitutes financial, investment, tax, or legal advice. Always consult a qualified financial advisor, CPA, or estate attorney before making decisions about your finances or estate plan. My Wealth Maps is not a registered investment adviser.",

  /** Attorney connection surfaces */
  attorneyRelationship:
    "Connecting an attorney through My Wealth Maps does not create an attorney-client relationship.",
} as const

export type DisclaimerKey = keyof typeof DISCLAIMER_STRINGS

/**
 * Banned phrase patterns — do not use these in consumer-facing strings.
 * This list is also used by the audit grep script (scripts/audit-ux-language.sh).
 */
export const BANNED_PHRASES = [
  'plan health',
  'plan grade',
  'plan score',
  'your plan is',
  'we recommend',
  'you should',
  'you need to',
  'action required',
  'optimize your',
  'improve your plan',
  'earns a',
  'based on your profile, we suggest',
  'optimal',
  'for your situation',
  'for your estate',
  'could save you',
  'best state',
  'best year to',
  'you must',
  'act now',
] as const
