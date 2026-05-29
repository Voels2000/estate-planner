import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AttorneyBillingClient } from './_attorney-billing-client'

export default async function AttorneyBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; canceled?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams

  const { data: profile } = await supabase
    .from('profiles')
    .select('attorney_tier')
    .eq('id', user.id)
    .single()

  const tier = profile?.attorney_tier ?? 0

  const plans = [
    {
      id: 0,
      name: 'Free',
      price: '$0',
      features: [
        'Read-only client access (up to 3 clients visible)',
        'Document vault upload/download',
        'Basic client list',
      ],
    },
    {
      id: 1,
      planKey: 'starter' as const,
      name: 'Attorney Starter',
      price: '$99/mo',
      features: [
        'Up to 15 client households',
        'Document vault + gap alerts',
        'Intake summary PDF export',
        'Multi-client document health dashboard',
      ],
      envKey: 'STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY',
    },
    {
      id: 2,
      planKey: 'growth' as const,
      name: 'Attorney Growth',
      price: '$249/mo',
      features: [
        'Up to 50 client households',
        'PDF branding on intake exports',
        'Bulk client management',
        'Everything in Starter',
      ],
      envKey: 'STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY',
    },
  ]

  return (
    <AttorneyBillingClient
      currentTier={tier}
      plans={plans}
      checkoutSuccess={sp.checkout === 'success'}
      canceled={sp.canceled === 'true'}
    />
  )
}
