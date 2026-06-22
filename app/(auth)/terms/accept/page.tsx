import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TermsClient } from '../_terms-client'
import { createStripeClient } from '@/lib/stripe/config'
import { activateConsumerProfileFromSubscription } from '@/lib/stripe/activateConsumerSubscription'
import { resolveCheckoutSubscription } from '@/lib/stripe/checkoutSubscription'
import { resolveStripeCustomerId } from '@/lib/stripe/stripeIds'

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
        const stripeCustomerId = resolveStripeCustomerId(session.customer)
        const sub = await resolveCheckoutSubscription(stripe, session)

        if (!stripeCustomerId) {
          console.error('Terms accept — no customer id on checkout session')
        } else if (!sub) {
          if (session.mode === 'subscription') {
            console.error(
              'Terms accept — subscription mode but no subscription resolved, skipping activation',
            )
          }
        } else {
          const { error } = await activateConsumerProfileFromSubscription(
            admin,
            user.id,
            sub,
            stripeCustomerId,
          )
          if (error) {
            console.error('Terms accept profile update error:', error.message)
          }
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
