import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildAllAttorneyEventReferralUrls } from '@/lib/events/referral'
import { getAttorneyReferralStats } from '@/lib/attorney/attorneyReferralStats'
import { AttorneyMarketingKit } from '@/components/attorney/AttorneyMarketingKit'

export default async function AttorneyMarketingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: listing } = await supabase
    .from('attorney_listings')
    .select('id, referral_code')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!listing?.referral_code) {
    return (
      <div className="max-w-2xl py-6">
        <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]">Marketing</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Your directory listing needs a referral code before life-event links are available.{' '}
          <Link href="/attorney/settings" className="text-[color:var(--mwm-navy)] underline">
            Complete firm settings
          </Link>{' '}
          or claim your listing if you have not yet.
        </p>
      </div>
    )
  }

  const eventReferralUrls = buildAllAttorneyEventReferralUrls(listing.referral_code)
  const stats = await getAttorneyReferralStats(supabase, listing.id)

  return (
    <AttorneyMarketingKit
      referralCode={listing.referral_code}
      eventReferralUrls={eventReferralUrls}
      initialStats={stats}
    />
  )
}
