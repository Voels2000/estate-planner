import type { SupabaseClient } from '@supabase/supabase-js'

const EVENT_UPGRADE_COPY: Record<string, Record<2 | 3, string>> = {
  // ── Original 8 slugs ──────────────────────────────────────────────────────
  'selling-a-business': {
    2: 'You indicated a business sale. Retirement planning — Roth conversion windows, RMD timing, and withdrawal sequencing — are critical in the year of a sale. Upgrade to model these scenarios.',
    3: 'You indicated a business sale. Your estate tax exposure may have changed significantly. Upgrade to see your exact exposure and the strategies available before closing.',
  },
  'death-of-spouse': {
    2: 'After losing a spouse, Social Security survivor benefit timing and RMD rules change. Upgrade to model the impact on your retirement income.',
    3: 'After losing a spouse, portability election, retitling, and trust restructuring are urgent. Upgrade to see your current estate exposure and what needs to change.',
  },
  'serious-diagnosis': {
    2: 'With a serious diagnosis, Roth conversions and RMD planning become more urgent. Upgrade to model your options while the window is open.',
    3: 'With a serious diagnosis, trust funding, incapacity planning, and gifting timing are critical. Upgrade to see your full estate picture and what to do now.',
  },
  'receiving-inheritance': {
    2: 'An inheritance may have changed your retirement picture. Upgrade to model inherited IRA distributions and updated projections.',
    3: 'An inheritance may have pushed your estate into new tax territory. Upgrade to see your updated estate tax exposure and what changed.',
  },
  'divorce': {
    2: 'Divorce affects your retirement projections, Social Security strategy, and QDRO timing. Upgrade to model your post-divorce picture.',
    3: 'Divorce requires rebuilding your estate plan from scratch. Upgrade to see your current exposure and what needs to be restructured.',
  },
  'approaching-retirement': {
    2: 'With retirement approaching, Social Security timing, Roth conversion windows, and RMD planning are the highest-leverage decisions you have left. Upgrade to model them.',
    3: 'With retirement approaching, estate freeze strategies and gifting windows are closing. Upgrade to see your full estate picture before you stop earning.',
  },
  'large-rsu-vest': {
    2: 'A large vest may have changed your retirement projections significantly. Upgrade to model your updated income and withdrawal strategy.',
    3: 'A large vest may have pushed your estate into new tax territory. Upgrade to see your updated exposure and the gifting window available now.',
  },
  'new-child-grandchild': {
    2: 'A new family member changes your retirement income needs. Upgrade to update your projections.',
    3: 'A new family member means trust provisions, guardian designations, and beneficiary updates are needed. Upgrade to review your full estate plan.',
  },

  // ── Sprint 5 — 16 new slugs ───────────────────────────────────────────────
  'getting-married': {
    2: 'Marriage changes your Social Security filing strategy, survivor benefits, and retirement income picture. Upgrade to model your combined household projections.',
    3: 'Marriage changes asset titling, beneficiary designations, and spousal trust structures. Upgrade to see what your estate plan needs to reflect your new household.',
  },
  'remarriage-blended-family': {
    2: 'A blended family creates competing retirement income needs. Upgrade to model your updated household projections and withdrawal strategy.',
    3: 'A blended family requires careful trust structuring to protect both your spouse and children from prior relationships. Upgrade to see your current estate exposure and what needs restructuring.',
  },
  'aging-parent-needs-care': {
    2: 'Caregiving can affect your own retirement timeline and savings rate. Upgrade to model the impact on your retirement projections.',
    3: 'An aging parent\'s care needs can affect your estate through gifting limits, Medicaid lookback rules, and changes to your own plan. Upgrade to review your full picture.',
  },
  'loss-of-parent': {
    2: 'Inheriting retirement assets has specific distribution rules that affect your own retirement income. Upgrade to model inherited IRA distributions and your updated projections.',
    3: 'An inheritance from a parent may have changed your estate tax exposure. Upgrade to see your updated estate picture and what needs attention.',
  },
  'starting-a-business': {
    2: 'A new business changes your income picture and retirement funding strategy. Upgrade to model your updated projections including business income.',
    3: 'A new business creates estate planning complexity — entity structure, succession, and buy-sell agreements all affect your estate. Upgrade to see your full exposure.',
  },
  'selling-a-home': {
    2: 'A home sale may generate significant proceeds that affect your retirement projections and withdrawal sequencing. Upgrade to model the impact.',
    3: 'A home sale can affect your estate through capital gains exposure, proceeds titling, and updated asset composition. Upgrade to see your updated estate picture.',
  },
  'multi-state-real-estate': {
    2: 'Multi-state property holdings can complicate your retirement income picture. Upgrade to model rental income, planned sales, and their impact on your projections.',
    3: 'Multi-state real estate creates probate risk in every state where you own property. Upgrade to see your titling gaps and what trust structures can eliminate that exposure.',
  },
  'child-reaching-adulthood': {
    2: 'A child reaching adulthood may affect your retirement income needs and savings assumptions. Upgrade to update your projections.',
    3: 'A child reaching adulthood means trust distribution provisions, outright inheritance timing, and beneficiary designations may all need updating. Upgrade to review your estate plan.',
  },
  'disability-early-retirement': {
    2: 'Disability or early retirement changes your Social Security filing strategy, income sequencing, and withdrawal timeline significantly. Upgrade to model your updated picture.',
    3: 'Disability or early retirement increases the urgency of incapacity planning, trust funding, and estate freeze strategies while your options are still open. Upgrade to see your full exposure.',
  },
  'estate-tax-law-change': {
    2: 'Changes to estate tax law can affect your retirement account strategy and Roth conversion timing. Upgrade to model the impact on your plan.',
    3: 'The scheduled federal exemption reduction may significantly increase your estate tax exposure. Upgrade to see your current exposure and the gifting strategies available before any deadline.',
  },
  'first-time-high-net-worth': {
    2: 'Crossing $2M changes your retirement planning — Social Security strategy, Roth conversion windows, and withdrawal sequencing all matter more now. Upgrade to model your updated picture.',
    3: 'Crossing $2M means state estate taxes may already apply and trust structures that were unnecessary before are now essential. Upgrade to see your current exposure.',
  },
  'major-job-change': {
    2: 'A job change affects your retirement contributions, 401(k) rollover options, and income projections. Upgrade to model your updated retirement picture.',
    3: 'A job change may affect equity compensation, deferred compensation plans, and the assets in your estate. Upgrade to review your updated exposure.',
  },
  'five-year-plan-review': {
    2: 'A five-year review is the right time to update your retirement projections, Roth conversion modeling, and Social Security timing strategy. Upgrade to run the numbers.',
    3: 'A five-year review is the right time to update your estate tax snapshot, gifting strategy, and trust provisions. Upgrade to see where your plan stands today.',
  },
  'rmd-start-age': {
    2: 'RMDs beginning at 73 change your retirement income picture, tax exposure, and Roth conversion opportunity. Upgrade to model the full impact on your withdrawal strategy.',
    3: 'RMD age is also a key estate planning inflection point — asset distribution, trust provisions, and beneficiary designations on retirement accounts all warrant review. Upgrade to see your full picture.',
  },
  'medicare-eligibility': {
    2: 'Medicare eligibility at 65 changes your healthcare cost assumptions and may affect your retirement income sequencing. Upgrade to update your projections.',
    3: 'Medicare eligibility at 65 often coincides with early retirement — an important window for Roth conversions and estate freeze strategies before income changes. Upgrade to see your full picture.',
  },
  'social-security-timing': {
    2: 'Social Security timing is one of the highest-leverage retirement decisions you have. Upgrade to model the break-even analysis and optimal filing strategy for your household.',
    3: 'Social Security timing affects your retirement income, survivor benefits, and the assets that remain in your estate. Upgrade to model the full picture including estate implications.',
  },
}

export async function getEventUpgradeValueProp(
  supabase: SupabaseClient,
  userId: string,
  requiredTier: 2 | 3,
  fallback: string,
): Promise<string> {
  try {
    const { getUpgradeCopyVariant } = await import('@/lib/analytics/abTests')
    if ((await getUpgradeCopyVariant()) === 'generic') {
      return fallback
    }

    const { data } = await supabase
      .from('life_events')
      .select('event_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data?.event_type) return fallback
    const copy = EVENT_UPGRADE_COPY[data.event_type]?.[requiredTier]
    return copy ?? fallback
  } catch {
    return fallback
  }
}
