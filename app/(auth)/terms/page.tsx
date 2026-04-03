import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'
import { TermsClient } from './_terms-client'

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; session_id?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { returnTo, session_id } = await searchParams
  const safePath = returnTo?.startsWith('/') ? returnTo : '/dashboard'

  // If we have a Stripe session_id, verify payment and update profile immediately
  // This handles the race condition where webhook hasn't fired yet
  if (session_id) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-02-24.acacia',
      })
      const session = await stripe.checkout.sessions.retrieve(session_id)

      if (session.status === 'complete' && session.payment_status === 'paid') {
        const admin = createAdminClient()
        const subId = session.subscription as string | null
        let renewalIso: string | null = null
        let stripeSubId: string | null = null

        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          stripeSubId = sub.id
          renewalIso = new Date(sub.current_period_end * 1000).toISOString()
        }

        await admin
          .from('profiles')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer as string,
            ...(stripeSubId ? { stripe_subscription_id: stripeSubId } : {}),
            ...(renewalIso ? { subscription_renewal_date: renewalIso } : {}),
          })
          .eq('id', user.id)
      }
    } catch (err) {
      console.error('Stripe session verification error:', err)
      // Non-fatal — continue to show T&C regardless
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .single()

  // Already accepted — skip straight to destination
  if (profile?.terms_accepted_at) redirect(safePath)

  return <TermsClient returnTo={safePath} />
}
