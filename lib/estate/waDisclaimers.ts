/**
 * Washington estate tax disclaimer copy — keep consumer, advisor, and PDF surfaces in sync.
 * Counsel review recommended before go-live (UPL / expectations management).
 */

/** Consumer `/estate-tax` — visible summary line. */
export const WA_ESTATE_TAX_CONSUMER_SUMMARY =
  'Planning estimate based on your current estate and Washington law effective July 1, 2026.'

/** Consumer `/estate-tax` — expandable detail (snapshot, CST execution, growth). */
export const WA_ESTATE_TAX_CONSUMER_DETAIL =
  'The "with bypass trust" figure assumes you set up and fund a credit-shelter trust — Washington doesn\'t transfer a spouse\'s exemption automatically, so this benefit isn\'t available without that planning. At Death estimates include projected growth of trust assets between spouse deaths; Today uses your current estate snapshot. Not tax or legal advice.'

/** Advisor State Tax panel — single block for sophisticated audience. */
export const WA_ESTATE_TAX_ADVISOR_PANEL =
  'At Death horizon: bypass benefit uses projected CST growth between first and second death (from your base case). Today column is snapshot on current value. WA law eff. 7/1/2026: 20% top rate, $3.0M exemption (frozen, not indexed). With-CST assumes an executed, fully-funded credit-shelter trust; funding capped at first-decedent\'s share (CP 50/50 default). No WA portability. Not tax or legal advice.'

/** Estate plan PDF footnote (WA households). */
export const WA_ESTATE_TAX_PDF_FOOTNOTE =
  'WA estate tax estimates use law effective July 1, 2026 ($3.0M exemption, 20% top rate). "With bypass trust" assumes an executed and funded credit-shelter trust; At Death figures include projected CST asset growth between spouse deaths. Washington provides no spousal portability. Estimates only — not tax or legal advice.'
