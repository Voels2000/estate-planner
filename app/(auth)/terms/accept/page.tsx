import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'
import { TermsClient } from '../_terms-client'
import { getTierFromPriceId } from '@/lib/billing/stripePrices'
import { createStripeClient } from '@/lib/stripe/config'
import { subscriptionPeriodEndIso } from '@/lib/stripe/subscriptionPeriod'

export default async function TermsAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; session_id?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { returnTo, session_id } = await searchParams
  const safePath = returnTo?.startsWith('/') ? returnTo : '/dashboard'

  if (session_id) {
    try {
      const stripe = createStripeClient(process.env.STRIPE_SECRET_KEY!)
      const session = await stripe.checkout.sessions.retrieve(session_id)

      const checkoutComplete =
        session.status === 'complete' &&
        (session.payment_status === 'paid' ||
          session.payment_status === 'no_payment_required')

      if (checkoutComplete) {
        const admin = createAdminClient()
        const subId = session.subscription as string | null
        let renewalIso: string | null = null
        let priceId: string | null = null
        let consumerTier: number | null = null
        let subscriptionStatus: Stripe.Subscription.Status = 'active'
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          subscriptionStatus = sub.status
          renewalIso = subscriptionPeriodEndIso(sub)
          priceId = sub.items.data[0]?.price.id ?? null
          consumerTier = priceId ? getTierFromPriceId(priceId) : null
        }

        const { error } = await admin
          .from('profiles')
          .update({
            subscription_status: subscriptionStatus,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subId,
            subscription_plan: priceId,
            ...(consumerTier ? { consumer_tier: consumerTier } : {}),
            ...(renewalIso ? { subscription_period_end: renewalIso } : {}),
          })
          .eq('id', user.id)

        if (error) {
          console.error('Terms accept profile update error:', error.message)
        }
      }
    } catch (err) {
      console.error('Stripe session verification error:', err instanceof Error ? err.message : err)
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .single()

  if (profile?.terms_accepted_at) redirect(safePath)

  return <TermsClient returnTo={safePath} />
}
