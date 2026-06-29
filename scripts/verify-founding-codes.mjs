// verify-founding-codes.mjs
// READ-ONLY pre-flight for founding-member coupons + promotion codes.
// Makes NO writes. Run this BEFORE creating any coupon/promo code.
//
// Run:
//   STRIPE_SECRET_KEY=sk_live_xxx node scripts/verify-founding-codes.mjs
// Optional account guard (recommended):
//   EXPECTED_STRIPE_ACCOUNT_ID=acct_1TAIt0ENTkKmTNa3 STRIPE_SECRET_KEY=sk_live_xxx node scripts/verify-founding-codes.mjs
//
// What it proves:
//   1. Which Stripe account + mode (LIVE/TEST) the key points at.
//   2. The active products + prices the coupons will attach to (so you can grab
//      the per-persona PRODUCT IDs needed for coupon `applies_to`).
//   3. That no founding coupon/promo code already exists (collision check).

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('FATAL: STRIPE_SECRET_KEY not set.');
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: '2026-02-25.clover' });
const EXPECTED_ACCOUNT = process.env.EXPECTED_STRIPE_ACCOUNT_ID || null;

// The promo codes we intend to create, with their caps.
const PLANNED_CODES = [
  { code: 'FOUNDINGATTORNEY', cap: 25 },
  { code: 'FOUNDINGADVISOR', cap: 25 },
  { code: 'FOUNDINGCONSUMER', cap: 10 },
];

async function main() {
  // ---- 1. Account guard ----
  console.log('\n=== ACCOUNT ===');
  const acct = await stripe.accounts.retrieve();
  const live = KEY.startsWith('sk_live_');
  console.log(`account : ${acct.id}`);
  console.log(`mode    : ${live ? 'LIVE' : 'TEST'}  (key prefix ${KEY.slice(0, 8)}…)`);
  if (EXPECTED_ACCOUNT && acct.id !== EXPECTED_ACCOUNT) {
    console.error(`FATAL: account mismatch — expected ${EXPECTED_ACCOUNT}, got ${acct.id}`);
    process.exit(2);
  }
  if (!EXPECTED_ACCOUNT) {
    console.log('note    : no EXPECTED_STRIPE_ACCOUNT_ID set — set it to hard-fail on wrong account.');
  }

  // ---- 2. Products + active prices ----
  console.log('\n=== ACTIVE PRODUCTS & PRICES (grab persona PRODUCT IDs from here) ===');
  const products = await stripe.products.list({ active: true, limit: 100 });
  if (!products.data.length) console.log('  (no active products)');
  for (const p of products.data) {
    const prices = await stripe.prices.list({ product: p.id, active: true, limit: 100 });
    console.log(`\n  ${p.name}   ${p.id}`);
    if (!prices.data.length) console.log('     (no active prices)');
    for (const pr of prices.data) {
      const amt = pr.unit_amount != null ? `$${(pr.unit_amount / 100).toFixed(2)}` : '(metered)';
      const kind = pr.recurring ? `/${pr.recurring.interval}` : ' one-time';
      console.log(`     ${pr.id}   ${amt}${kind}`);
    }
  }

  // ---- 3. Existing coupons ----
  console.log('\n=== EXISTING COUPONS ===');
  const coupons = await stripe.coupons.list({ limit: 100 });
  if (!coupons.data.length) console.log('  (none)');
  for (const c of coupons.data) {
    const off = c.percent_off != null ? `${c.percent_off}% off` : `$${(c.amount_off / 100).toFixed(2)} off`;
    const dur = c.duration === 'repeating' ? `repeating ${c.duration_in_months}mo` : c.duration;
    console.log(`  ${c.id}   ${off}   ${dur}   valid=${c.valid}`);
  }

  // ---- 4. Promotion-code collision check ----
  console.log('\n=== PROMOTION CODE COLLISION CHECK ===');
  const promos = await stripe.promotionCodes.list({ limit: 100 });
  const byCode = new Map(promos.data.map((pc) => [pc.code, pc]));
  let collision = false;
  for (const { code, cap } of PLANNED_CODES) {
    const pc = byCode.get(code);
    if (pc) {
      collision = true;
      console.log(`  ⚠  ${code} ALREADY EXISTS (${pc.id})  max=${pc.max_redemptions ?? '∞'}  used=${pc.times_redeemed}  active=${pc.active}`);
    } else {
      console.log(`  ✓  ${code} available  → will be created with cap ${cap}`);
    }
  }

  // ---- Summary ----
  console.log('\n=== SUMMARY ===');
  console.log('Planned caps: FOUNDINGATTORNEY=25, FOUNDINGADVISOR=25, FOUNDINGCONSUMER=10');
  if (collision) {
    console.log('RESULT: ⚠ one or more founding codes already exist — review before creating.');
  } else {
    console.log('RESULT: ✓ clear to create. Use the persona PRODUCT IDs above for coupon `applies_to`.');
  }
  console.log('This script made no changes. Creation steps are in GTM_FIRST_WAVE.md.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
