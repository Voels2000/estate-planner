import type { SupabaseClient } from '@supabase/supabase-js'

const EVENT_UPGRADE_COPY: Record<string, Record<2 | 3, string>> = {
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
  divorce: {
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
}

export async function getEventUpgradeValueProp(
  supabase: SupabaseClient,
  userId: string,
  requiredTier: 2 | 3,
  fallback: string,
): Promise<string> {
  try {
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
