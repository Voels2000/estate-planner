# Billing Disclosures — Sprint C-4
# My Wealth Maps — Washington auto-renewal + FTC negative option compliance
# Created: 2026-05-24 | Owner: Product + Ops
# Status: **Code complete (`462bda9`) — manual Stripe verify + legal review remain**

---

## Why this sprint exists

Sprint C-2b (UX language audit) is complete (`788aa08`). Sprint C-5 (Privacy Policy + Terms) is code-complete (`2e1dff3`, `695a860`). The remaining **compliance gates** before opening public signups are **legal review** ([LEGAL_TODO.md](./LEGAL_TODO.md)) and **Stripe Dashboard configuration** plus a manual walkthrough of signup → paid checkout with this checklist open.

**Do not flip `PUBLIC_SIGNUP_OPEN=true` until every checkbox below is verified on production (or production-mode Stripe test).**

---

## Go-live gate order

| Step | Sprint | Status |
|------|--------|--------|
| UX language audit (investment-advice framing) | C-2b | ✅ Complete (`788aa08`) |
| RLS + auth/security | C-3 | ✅ Complete (`236890c`, `56a4407`) |
| Billing disclosures (auto-renewal, cancel, receipts) | C-4 | ✅ Code complete (`462bda9`) — Stripe Dashboard + walkthrough remain |
| Privacy Policy + Terms of Service | C-5 | ✅ Code complete (`2e1dff3`, `695a860`) — [LEGAL_TODO.md](./LEGAL_TODO.md) remains |
| Open public signups | Sprint 17 | ☐ Go-live day after legal + manual verify |

---

## Checklist — Washington automatic renewal (RCW 19.316)

Before purchase completes, the consumer must see **clearly and conspicuously**:

- [ ] **Renewal amount** — exact recurring charge (e.g. `$X/month` or `$X/year`) for the selected tier
- [ ] **Renewal frequency** — billing interval (monthly / annual)
- [ ] **Cancellation method** — how to cancel before the next renewal (self-serve path, not phone-only)

**Surfaces to verify:**

| Surface | File / config | Notes |
|---------|---------------|-------|
| Pre-checkout copy | `app/billing/_billing-client.tsx` | Tier cards should show price + interval; add auto-renewal disclosure block before Subscribe |
| Stripe Checkout | Stripe Dashboard → Checkout settings | Subscription terms, consent checkbox if enabled |
| Stripe Customer Portal | Stripe Dashboard → Billing → Customer portal | Cancel subscription enabled; no "contact us to cancel" as only path |
| Terms / checkout email | Post-purchase comms | Renewal terms referenced where applicable |

---

## Checklist — FTC Negative Option Rule

- [ ] **Click-to-cancel is self-serve** — consumer can cancel from account/billing without calling or emailing support
- [ ] **No "call to cancel"** — support phone/email may be offered for help, but must not be required to stop renewal
- [ ] **Cancel path tested** — signed-in user → `/billing` → Manage subscription (Stripe portal) → cancel → confirm subscription status updates in app

**Key routes:**

- `app/billing/page.tsx` + `_billing-client.tsx` — plan selection, Manage subscription button
- `app/api/stripe/portal/route.ts` — Customer Portal session
- `app/api/stripe/webhook/route.ts` — `customer.subscription.deleted` / status sync

---

## Checklist — Stripe receipts

- [ ] **Stripe configured to send receipts** — Dashboard → Settings → Customer emails → successful payments
- [ ] **Receipt shows renewal amount before charge** — upcoming invoice / subscription receipt includes recurring price and interval
- [ ] **Test receipt received** — complete one test subscription; confirm email shows correct names match `/billing` tier cards

---

## Manual walkthrough (signup → paid)

Run once on **production** (or production Stripe keys on preview) with this doc open:

1. [ ] `/signup` (or invite bypass while waitlist on) → create account
2. [ ] `/billing` → select tier → confirm **renewal amount, frequency, cancellation method** visible **before** redirect to Stripe Checkout
3. [ ] Complete Stripe Checkout (test card if test mode)
4. [ ] Confirm receipt email — renewal amount and interval correct
5. [ ] `/billing` → **Manage subscription** → cancel in portal — no phone required
6. [ ] Confirm webhook updates `subscription_status` / tier access in app

**Related smoke:** [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) — add billing row after C-4 ships.

---

## Engineering touchpoints (if copy/code changes needed)

| Artifact | Purpose |
|----------|---------|
| `app/billing/_billing-client.tsx` | Pre-checkout disclosure copy |
| `app/api/stripe/checkout/route.ts` | Checkout session creation |
| `app/api/stripe/portal/route.ts` | Self-serve cancel entry |
| `app/api/stripe/webhook/route.ts` | Subscription lifecycle sync |
| Stripe Dashboard | Receipts, portal settings, subscription
 policy |

---

## ToS / Privacy Policy — Sprint C-5 shipped (legal review required)

Full legal pages live at `/privacy` and `/terms` (`lib/legal/privacy-policy-sections.ts`, `lib/legal/terms-of-service-sections.ts`). Post-checkout dynamic accept remains at `/terms/accept` (`app_config.terms_sections`).

| Required topic | Status | Notes |
|----------------|--------|-------|
| Subscription price and billing frequency | ✅ In `/terms` | Counsel review §6 |
| Auto-renewal terms | ✅ In `/terms` + pre-checkout copy | RCW 19.316 referenced |
| Cancellation procedure (self-serve) | ✅ In `/terms` + `/billing` cancel | Stripe portal wired |
| Refund policy | ✅ In `/terms` | Counsel review |
| Washington RCW 19.316 compliance statement | ✅ In `/terms` + pricing | Counsel review |
| Privacy Policy (WCPA) | ✅ `/privacy` | Replace TODO placeholders per [LEGAL_TODO.md](./LEGAL_TODO.md) |
| Counsel sign-off | ☐ Pending | ToS §10 (disclaimers), §11 (liability cap), §13 (arbitration) |

**Action:** Complete [LEGAL_TODO.md](./LEGAL_TODO.md) before go-live. Sync `/terms/accept` dynamic sections with `/terms` after legal review if needed.

---

## Completion criteria

Sprint C-4 **code** is done when manual verify passes:

- [ ] All RCW 19.316 checkboxes verified on production checkout path
- [ ] All FTC negative-option checkboxes verified (self-serve cancel works)
- [ ] Stripe receipt test passed with renewal amount shown
- [ ] Manual walkthrough signed off
- [ ] [LEGAL_TODO.md](./LEGAL_TODO.md) complete + counsel sign-off
- [ ] LAUNCH_CHECKLIST updated — go-live flip executed per sequence
- [ ] Then and only then: Supabase Auth ON → `PUBLIC_SIGNUP_OPEN=true` ([LAUNCH_CHECKLIST § Opening signups](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip))

---

## Related docs

| Doc | Relationship |
|-----|-------------|
| [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md) | C-2b complete — separate from billing disclosures |
| [LEGAL_TODO.md](./LEGAL_TODO.md) | C-5 legal gate — placeholders, counsel, email aliases |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Go-live gate; legal + C-4 manual verify before open signups |
| [NEXT_SESSION.md](./NEXT_SESSION.md) | Sprint 17 handoff |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Consumer billing contract |
| [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) | `/billing` journey |

---

*Sprint C-4 code complete 2026-06-02 (`462bda9`). Manual Stripe verify + [LEGAL_TODO.md](./LEGAL_TODO.md) required before `PUBLIC_SIGNUP_OPEN=true`.*
