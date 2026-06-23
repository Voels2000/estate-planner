import { createStripeClient } from '@/lib/stripe/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  const stripe = createStripeClient(key)

  const ids = [
    'price_1ThKuWENTkKmTNa3YI866TqT', // Financial monthly
    'price_1ThKxmENTkKmTNa3FGUvSs2k', // Financial annual
  ]

  const results: Array<{
    id: string
    found: boolean
    active?: boolean
    error?: string
  }> = []

  for (const id of ids) {
    try {
      const p = await stripe.prices.retrieve(id)
      results.push({ id, found: true, active: p.active })
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      results.push({ id, found: false, error: err.code ?? err.message })
    }
  }

  return Response.json({
    key_last4: key.length >= 4 ? key.slice(-4) : null,
    key_prefix: key.length >= 12 ? key.slice(0, 12) : null,
    key_mode: key.startsWith('sk_test_')
      ? 'test'
      : key.startsWith('sk_live_')
        ? 'live'
        : 'unknown',
    results,
  })
}
