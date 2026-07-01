/**
 * Creates v1 connection-billing Stripe objects (Phase 2 of CONNECTION_BILLING_REMETER_SPEC).
 *
 *   - Advisor  : 1 product + 1 monthly volume-tiered price (bands 1–10 / 11–50 / 51–150 / 151+)
 *   - Attorney : same bands, attorney rates
 *   - Consumer : new $19 / $49 / $79 monthly prices (financial / retirement / estate)
 *
 * Volume tiering: tiers_mode=volume + billing_scheme=tiered → ALL units bill at the band rate.
 *
 * SAFETY:
 *   - DRY-RUN by default (--commit required to write)
 *   - ENV-GUARDED: sk_test_ for --env staging, sk_live_ for --env production
 *   - IDEMPOTENT: lookup_key skip if price already exists
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-connection-pricing-stripe.ts --env staging
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-connection-pricing-stripe.ts --env staging --commit
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/setup-connection-pricing-stripe.ts --env production --commit
 */

import type Stripe from 'stripe'
import { createStripeClient } from '../lib/stripe/config'
import {
  ADVISOR_BANDS,
  ATTORNEY_BANDS,
  bandsToStripeVolumeTiers,
  CONNECTION_PRICE_LOOKUP_KEYS,
  CONNECTION_STRIPE_PRICE_ENV,
  CONSUMER_TIERS,
  CONSUMER_V1_DISPLAY_NAMES,
  CONSUMER_V1_LOOKUP_KEYS,
  CONSUMER_V1_STRIPE_PRICE_ENV,
  LEGACY_PROFESSIONAL_STRIPE_PRICE_ENV_VARS,
  STRIPE_TAX_CODE_SAAS_BUSINESS,
  STRIPE_TAX_CODE_SAAS_PERSONAL,
  type ConsumerTierKey,
} from '../lib/pricing/connectionPricing'

const ADVISOR_TIERS = bandsToStripeVolumeTiers(ADVISOR_BANDS)
const ATTORNEY_TIERS = bandsToStripeVolumeTiers(ATTORNEY_BANDS)

const CONSUMER_PRICE_SPECS = (Object.keys(CONSUMER_TIERS) as ConsumerTierKey[]).map((key) => ({
  key,
  lookupKey: CONSUMER_V1_LOOKUP_KEYS[key],
  envVar: CONSUMER_V1_STRIPE_PRICE_ENV[key],
  name: CONSUMER_V1_DISPLAY_NAMES[key],
  unit_amount: CONSUMER_TIERS[key] * 100,
}))

// SaaS tax codes imported from connectionPricing.ts (personal = consumer, business = professional).

type Args = { env: 'staging' | 'production' | null; commit: boolean; archiveOld: boolean }

function parseArgs(): Args {
  const a = process.argv.slice(2)
  const envIdx = a.indexOf('--env')
  const envRaw = envIdx >= 0 ? a[envIdx + 1] : null
  const env = envRaw === 'staging' || envRaw === 'production' ? envRaw : null
  return { env, commit: a.includes('--commit'), archiveOld: a.includes('--archive-old') }
}

function fail(m: string): never {
  console.error(`\n[FATAL] ${m}\n`)
  process.exit(1)
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

async function confirmProd(): Promise<void> {
  process.stdout.write('\n*** LIVE MODE. This writes to your PRODUCTION Stripe account. ***\n')
  process.stdout.write('Type exactly: WRITE PRODUCTION PRICES  → ')
  const answer = await new Promise<string>((res) => {
    process.stdin.resume()
    process.stdin.once('data', (d) => res(d.toString().trim()))
  })
  if (answer !== 'WRITE PRODUCTION PRICES') fail('Confirmation mismatch. Aborted.')
}

async function findPriceByLookup(stripe: Stripe, lookupKey: string) {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1, expand: ['data.product'] })
  return res.data[0] ?? null
}

async function ensureTieredPrice(
  stripe: Stripe,
  args: Args,
  opts: {
    productName: string
    lookupKey: string
    tiers: Stripe.PriceCreateParams.Tier[]
    taxCode: string
  },
) {
  const existing = await findPriceByLookup(stripe, opts.lookupKey)
  if (existing) {
    console.log(`  ✓ EXISTS  ${opts.lookupKey} → ${existing.id} (skipping; prices are immutable)`)
    return existing.id
  }

  console.log(`  + CREATE  ${opts.productName} volume-tiered price [${opts.lookupKey}]`)
  console.log(`      tax_code: ${opts.taxCode}`)
  opts.tiers.forEach((t) => {
    const band = t.up_to === 'inf' ? '151+' : `≤${t.up_to}`
    console.log(`      ${band.padEnd(6)} ${dollars(t.unit_amount as number)}/client (all units at this rate)`)
  })
  if (!args.commit) {
    console.log('      (dry run — not created)')
    return null
  }

  const product = await stripe.products.create({
    name: opts.productName,
    tax_code: opts.taxCode,
    metadata: { mwm_pricing: 'connection_v1' },
  })
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    recurring: { interval: 'month' },
    billing_scheme: 'tiered',
    tiers_mode: 'volume',
    tiers: opts.tiers,
    lookup_key: opts.lookupKey,
    metadata: { mwm_pricing: 'connection_v1' },
  })
  console.log(`      created product ${product.id} + price ${price.id}`)
  return price.id
}

async function ensureConsumerPrice(
  stripe: Stripe,
  args: Args,
  p: { lookupKey: string; name: string; unit_amount: number; taxCode: string },
) {
  const existing = await findPriceByLookup(stripe, p.lookupKey)
  if (existing) {
    if (existing.unit_amount === p.unit_amount) {
      console.log(`  ✓ EXISTS  ${p.lookupKey} → ${existing.id} (${dollars(p.unit_amount)})`)
      return existing.id
    }
    console.log(
      `  ! ${p.lookupKey} exists at ${dollars(existing.unit_amount ?? 0)}, target ${dollars(p.unit_amount)} — prices immutable; create NEW price + repoint env.`,
    )
    return existing.id
  }

  console.log(`  + CREATE  Consumer ${p.name} ${dollars(p.unit_amount)}/mo [${p.lookupKey}]`)
  console.log(`      tax_code: ${p.taxCode}`)
  if (!args.commit) {
    console.log('      (dry run — not created)')
    return null
  }

  const product = await stripe.products.create({
    name: `MWM Consumer ${p.name}`,
    tax_code: p.taxCode,
    metadata: { mwm_pricing: 'consumer_v1' },
  })
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    recurring: { interval: 'month' },
    unit_amount: p.unit_amount,
    lookup_key: p.lookupKey,
    metadata: { mwm_pricing: 'consumer_v1' },
  })
  console.log(`      created ${price.id}`)
  return price.id
}

async function archiveOldPrices(stripe: Stripe, args: Args) {
  console.log('\n-- Archive old prices (--archive-old) --')
  for (const varName of LEGACY_PROFESSIONAL_STRIPE_PRICE_ENV_VARS) {
    const id = process.env[varName]
    if (!id) {
      console.log(`  (skip ${varName}: not set in env)`)
      continue
    }
    console.log(`  ${args.commit ? 'archiving' : 'would archive'} ${varName}=${id}`)
    if (args.commit) await stripe.prices.update(id, { active: false })
  }
}

async function main() {
  const args = parseArgs()
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key) fail('STRIPE_SECRET_KEY not set.')
  if (args.env !== 'staging' && args.env !== 'production') fail('Pass --env staging|production.')

  const isLiveKey = key.startsWith('sk_live_')
  const isTestKey = key.startsWith('sk_test_')
  if (!isLiveKey && !isTestKey) fail('STRIPE_SECRET_KEY is not a recognized sk_test_/sk_live_ key.')
  if (args.env === 'production' && !isLiveKey) {
    fail('--env production requires an sk_live_ key. Refusing (key/env mismatch).')
  }
  if (args.env === 'staging' && !isTestKey) {
    fail('--env staging requires an sk_test_ key. Refusing (key/env mismatch).')
  }

  console.log('='.repeat(64))
  console.log(`CONNECTION PRICING SETUP — ${args.env.toUpperCase()} — ${args.commit ? 'COMMIT' : 'DRY RUN'}`)
  console.log(`Key: ${key.slice(0, 8)}…`)
  console.log(`Tax codes: business=${STRIPE_TAX_CODE_SAAS_BUSINESS}  personal=${STRIPE_TAX_CODE_SAAS_PERSONAL}`)
  console.log('='.repeat(64))

  if (args.env === 'production' && args.commit) await confirmProd()

  const stripe = createStripeClient(key)
  const out: Record<string, string | null> = {}

  console.log('\n-- Professional volume-tiered prices --')
  out.advisor = await ensureTieredPrice(stripe, args, {
    productName: 'MWM Advisor — per connected client',
    lookupKey: CONNECTION_PRICE_LOOKUP_KEYS.advisor,
    tiers: ADVISOR_TIERS,
    taxCode: STRIPE_TAX_CODE_SAAS_BUSINESS,
  })
  out.attorney = await ensureTieredPrice(stripe, args, {
    productName: 'MWM Attorney — per connected client',
    lookupKey: CONNECTION_PRICE_LOOKUP_KEYS.attorney,
    tiers: ATTORNEY_TIERS,
    taxCode: STRIPE_TAX_CODE_SAAS_BUSINESS,
  })

  console.log('\n-- Consumer prices ($19/$49/$79) --')
  for (const p of CONSUMER_PRICE_SPECS) {
    out[p.envVar] = await ensureConsumerPrice(stripe, args, {
      lookupKey: p.lookupKey,
      name: p.name,
      unit_amount: p.unit_amount,
      taxCode: STRIPE_TAX_CODE_SAAS_PERSONAL,
    })
  }

  if (args.archiveOld) await archiveOldPrices(stripe, args)

  console.log('\n' + '='.repeat(64))
  if (args.commit) {
    console.log('ENV VARS — paste into Vercel for this environment:')
    if (out.advisor) console.log(`${CONNECTION_STRIPE_PRICE_ENV.advisor}=${out.advisor}`)
    if (out.attorney) console.log(`${CONNECTION_STRIPE_PRICE_ENV.attorney}=${out.attorney}`)
    for (const p of CONSUMER_PRICE_SPECS) {
      if (out[p.envVar]) console.log(`${p.envVar}=${out[p.envVar]}`)
    }
  } else {
    console.log('DRY RUN complete. No Stripe objects created. Re-run with --commit to apply.')
  }
  console.log('='.repeat(64) + '\n')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
