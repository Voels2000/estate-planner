import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TIER_FEATURES } from '@/lib/tiers'

const CONSUMER_PLANS = [
  {
    id: 'financial',
    priceId: 'price_1TILBRCaljka9gJt6dr44Znq',
    name: 'Financial',
    price: 9,
    description: 'Get organized and see your full financial picture.',
    features: TIER_FEATURES[1],
    highlighted: false,
  },
  {
    id: 'retirement',
    priceId: 'price_1TILEXCaljka9gJtrHqnG3bl',
    name: 'Retirement',
    price: 19,
    description: 'Optimize your retirement with advanced planning tools.',
    features: TIER_FEATURES[2],
    highlighted: true,
  },
  {
    id: 'estate',
    priceId: 'price_1TILGOCaljka9gJtCDLiKFHp',
    name: 'Estate',
    price: 34,
    description: 'Complete estate and advanced tax planning.',
    features: TIER_FEATURES[3],
    highlighted: false,
  },
]

const ADVISOR_PLANS = [
  { name: 'Starter', price: 159, clients: '10 clients', priceId: 'price_1TAlRkCaljka9gJtL7jcTwWY' },
  { name: 'Pro', price: 299, clients: '30 clients', priceId: 'price_1TBIjWCaljka9gJt5tAXddM7' },
  { name: 'Unlimited', price: 499, clients: 'Unlimited clients', priceId: 'price_1TBIkSCaljka9gJtUqwl9reU' },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-neutral-600 text-lg">
            Start free. Upgrade as your planning needs grow.
          </p>
        </div>

        {/* Consumer Plans */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 text-center mb-8">
            For Individuals & Families
          </h2>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {CONSUMER_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white p-8 shadow-sm transition hover:shadow-md ${
                  plan.highlighted
                    ? 'border-2 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border border-neutral-200'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-sm font-medium text-white">
                    Most Popular
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-neutral-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-neutral-900">${plan.price}</span>
                    <span className="text-neutral-500 text-sm">/month</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="text-indigo-600 font-bold mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {user ? (
                <form action={`/api/stripe/checkout?plan=${plan.id}`} method="POST">
                    <button
                      type="submit"
                      className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${
                        plan.highlighted
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-neutral-900 text-white hover:bg-neutral-800'
                      }`}
                    >
                      Get started
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/signup"
                    className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${
                      plan.highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-neutral-900 text-white hover:bg-neutral-800'
                    }`}
                  >
                    Start free trial
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Advisor Plans */}
        <div className="mt-20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 text-center mb-2">
            For Financial Advisors
          </h2>
          <p className="text-center text-neutral-500 text-sm mb-8">
            Full access to all features. Pricing based on number of clients.
            Client dashboard access is always free.
          </p>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {ADVISOR_PLANS.map((plan, i) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl bg-white p-8 shadow-sm transition hover:shadow-md border ${
                  i === 1 ? 'border-2 border-neutral-900' : 'border-neutral-200'
                }`}
              >
                {i === 1 && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-3 py-0.5 text-sm font-medium text-white">
                    Most Popular
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-neutral-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{plan.clients}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-neutral-900">${plan.price}</span>
                    <span className="text-neutral-500 text-sm">/month</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {[
                    'All consumer features included',
                    plan.clients,
                    'Client dashboard access (free for clients)',
                    'Advisor portal & client management',
                    'Priority support',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {user ? (
                  <form action={`/api/stripe/checkout`} method="POST">
                    <input type="hidden" name="priceId" value={plan.priceId} />
                    <button
                      type="submit"
                      className="w-full rounded-lg px-4 py-3 text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition"
                    >
                      Get started
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/signup"
                    className="block w-full rounded-lg px-4 py-3 text-center text-sm font-sebold bg-neutral-900 text-white hover:bg-neutral-800 transition"
                  >
                    Start free trial
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-neutral-400 mt-12">
          All plans include a free 15-minute trial. No credit card required to start.
        </p>

      </div>
    </div>
  )
}
