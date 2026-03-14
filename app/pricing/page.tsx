import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const PLANS = [
  {
    id: 'consumer',
    name: 'Consumer',
    price: 19,
    description: 'For individuals planning their own estate.',
    features: [
      'Estate & retirement projections',
      'Asset tracking',
      'Up to 2 household members',
      'Export to PDF',
    ],
  },
  {
    id: 'advisor',
    name: 'Advisor',
    price: 49,
    description: 'For financial advisors and professionals.',
    features: [
      'Everything in Consumer',
      'Unlimited household members',
      'Client management',
      'Priority support',
    ],
    highlighted: true,
  },
] as const

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-14">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
            Simple pricing
          </h1>
          <p className="mt-2 text-neutral-600">
            Choose the plan that fits your needs.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border bg-white p-8 shadow-sm transition hover:shadow-md ${
                plan.highlighted
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-neutral-200'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-sm font-medium text-white">
                  Popular
                </span>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-neutral-900">
                  {plan.name}
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  {plan.description}
                </p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-neutral-900">
                    ${plan.price}
                  </span>
                  <span className="text-neutral-500">/month</span>
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-neutral-700"
                  >
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              {user ? (
                <form action={`/api/stripe/checkout?plan=${plan.id}`} method="POST">
                  <button
                    type="submit"
                    className={`w-full rounded-lg px-4 py-3 text-sm font-medium transition ${
                      plan.highlighted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-neutral-900 text-white hover:bg-neutral-800'
                    }`}
                  >
                    Subscribe
                  </button>
                </form>
              ) : (
                <Link
                  href="/login?redirect=/pricing"
                  className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition ${
                    plan.highlighted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  Sign in to subscribe
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
