import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ATTORNEY_TIER_LIMITS } from '@/lib/attorney/attorneyTierLimits'

export default async function AttorneyBillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('attorney_tier, full_name')
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
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/attorney" className="text-sm text-neutral-400 hover:text-neutral-600">
        ← Back to portal
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 mt-4">Attorney Plans</h1>
      <p className="text-sm text-neutral-500 mt-1">
        Current plan:{' '}
        <strong>{ATTORNEY_TIER_LIMITS[tier]?.label ?? 'Free'}</strong>
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-5 ${
              tier === plan.id ? 'border-blue-400 bg-blue-50/50' : 'border-neutral-200 bg-white'
            }`}
          >
            <h2 className="font-semibold text-neutral-900">{plan.name}</h2>
            <p className="text-lg font-bold text-neutral-800 mt-1">{plan.price}</p>
            <ul className="mt-4 space-y-2 text-xs text-neutral-600">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {plan.id > tier && plan.envKey && (
              <p className="mt-4 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
                TODO: Set {plan.envKey} in Stripe — contact support to activate checkout.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
