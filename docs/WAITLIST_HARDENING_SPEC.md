# Waitlist hardening spec — server-gated signup

**Status:** Implemented — **§10 matrix closed** on `estate-planner-staging` (2026-06-16). Prod deploy + Layer 0 already attested; flip still blocked on prod-side launch board.  
**Priority:** P0 — prod is not safe while dark without Layer 0 + server route (both in place)  
**Related:** [STAGING_PROJECT_RUNBOOK.md](./STAGING_PROJECT_RUNBOOK.md) · Move 3 (prod safe while dark) · `lib/waitlist-mode.ts` · `app/(auth)/signup/_signup-form.tsx`

---

## 1. Problem statement

Two independent bypasses let strangers create accounts on **production** while `PUBLIC_SIGNUP_OPEN=false` and reach **live** Stripe checkout:

| Bypass | Mechanism | Why app-layer gates fail |
|--------|-----------|---------------------------|
| **A. Query-param gate** | `/signup?invite=1` (any truthy `invite`, `invite_token`+`firm_id`, or `connectionToken`) skips middleware/page waitlist redirect | Params are not validated before the signup form loads |
| **B. Direct Auth API** | `POST {SUPABASE_URL}/auth/v1/signup` with the public anon key | Anon key is in the client bundle; middleware never runs |

Checkout routes (`/api/stripe/checkout`, `firm-checkout`, `attorney-checkout`) are **auth-only** — they do not check `PUBLIC_SIGNUP_OPEN`. Any authenticated user can start a live checkout session immediately after account creation.

**Post-signup invite validation is insufficient.** Firm join, advisor invite accept, and consumer-connect claim run **after** `signUp()` returns a session. The user is already authenticated and can hit billing before those run.

---

## 2. Containment strategy (three layers, ordered)

### Layer 0 — Today, manual, no code (do first)

**Production Supabase project** (`fnzvlmrqwcqwiqueevux`):

1. Dashboard → **Authentication** → **Providers** (or **Settings**)
2. **Disable new signups** / turn off “Allow new users to sign up” (exact label varies by Supabase UI version)
3. Confirm **existing users can still sign in** (david, avoels, canary-consumer)
4. Record attestation in `DECISION_LOG.md` with date

**Effect:** Neutralizes bypass A and B on prod immediately. No deploy required.

**Staging Supabase** (`cmzyxpxfyvdvbsykjvsg`): leave signups enabled until the server route is deployed and tested, then disable anon signups there too for parity (see §6).

### Layer 1 — Parallel P0 (unrelated to bypass, same sprint)

**Stripe live dashboard** (not test mode):

- Webhook endpoint: `https://www.mywealthmaps.com/api/stripe/webhook`
- Enable missing events: `checkout.session.completed`, `invoice.upcoming`
- Confirm also subscribed: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Re-run `GET /api/admin/verify-env?live=1` → `liveness.stripe: LIVE_OK`

Without `checkout.session.completed`, paid checkout does not activate subscription — silent “paid but locked out.”

**Per-environment webhooks:** Each Vercel project gets its **own** Stripe webhook endpoint and `STRIPE_WEBHOOK_SECRET` (test endpoint → staging URL; live endpoint → www). Secrets are not portable across endpoints.

### Layer 2 — Durable code fix (branch → staging → prod)

**Principle:** The anon key must **never** create accounts. All account creation goes through a **server route** that validates admission **before** `admin.auth.admin.createUser()`.

Removing bare `?invite=` truthiness in `hasSignupPageAdmissionHint` is necessary hygiene but **not sufficient** while client `signUp()` remains.

---

## 3. Target architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Browser — signup form (no supabase.auth.signUp)                 │
│  POST /api/auth/signup { email, password, fullName, role,      │
│    termsAcceptedAt, admission: { type, ...tokens } }             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server — lib/auth/signupAdmission.ts (validate admission)         │
│  • open_consumer (only if signup open)                           │
│  • beta_access | advisor_client_invite | firm_member_invite |    │
│    advisor_connect | attorney_connection | waitlist_invite       │
└────────────────────────────┬────────────────────────────────────┘
                             │ pass
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  admin.auth.admin.createUser({ email, password, user_metadata }) │
│  → handle_new_user trigger → profile + defaults                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Post-create side effects (same order as today where possible)     │
│  terms accept · firm bootstrap/join · funnel · referral · etc.   │
└─────────────────────────────────────────────────────────────────┘

Supabase Auth: "Allow new signups" = OFF on prod (and staging after parity test)
```

---

## 4. Admission types — validation before `createUser`

All validations use **service role** (`createAdminClient()`). Email on the request must match invite row email where applicable (case-insensitive).

| Admission `type` | When allowed | Pre-create validation |
|------------------|--------------|------------------------|
| `open_consumer` | `PUBLIC_SIGNUP_OPEN=true` **or** `NEXT_PUBLIC_SIGNUP_OPEN=true` on host | No token; role must be `consumer` unless product later opens advisor self-serve |
| `open_advisor` | Signup open + explicit product decision | Optional post-flip; default **deny** at flip |
| `open_attorney` | Signup open + explicit product decision | Optional post-flip; default **deny** at flip |
| `beta_access` | Waitlist on | `access` param matches `BETA_SIGNUP_TOKEN` (constant-time compare) |
| `waitlist_invite` | Waitlist on | Email exists in `email_captures` with `invited_at` set (from admin waitlist invite) |
| `advisor_client_invite` | Any | `advisor_clients.invite_token` = token, `status = 'pending'`, not expired, `invited_email` = signup email |
| `firm_member_invite` | Any | `firm_members.invite_token` + `firm_id`, `status = 'pending'`, `invited_email` = signup email |
| `advisor_connect` | Any | `advisor_clients.invite_token` = connect token, `status = 'consumer_requested'`, not expired, email match (same rules as `claim-consumer-invite`) |
| `attorney_connection` | Any | `attorney_clients.id` = connectionToken UUID, row exists, listing email matches signup email, attorney has no existing profile for listing (`attorney_listings.profile_id` null) |

**Remove** unvalidated middleware bypasses in `hasSignupPageAdmissionHint`:

- Delete: `searchParams.get('invite')` truthiness
- Delete: `invite_token` + `firm_id` presence without server validation
- Delete: `connectionToken` presence without server validation

Middleware may still allow `/signup` to **render** when the page has a well-formed admission payload, but the **only** gate that matters is server validation on `POST /api/auth/signup`.

**Page-level redirect:** Keep `isWaitlistMode` redirect to `/waitlist` for bare `/signup` with no admission. Optional: allow page load when query contains `access`, `invite`, `invite_token`, `connect`, `connectionToken`, `email` — form still cannot succeed without server validation.

---

## 5. API contract — `POST /api/auth/signup`

**Route:** `app/api/auth/signup/route.ts`  
**Auth:** None (public); rate-limit by IP (existing `simpleRateLimit` or new limiter).

### Request body

```ts
{
  email: string
  password: string
  fullName: string
  role: 'consumer' | 'advisor' | 'attorney'
  termsAcceptedAt: string // ISO; server rejects if missing/invalid
  admission: {
    type: SignupAdmissionType
    // type-specific:
    access?: string           // beta_access
    inviteToken?: string        // advisor_client_invite (advisor→client)
    firmInviteToken?: string
    firmId?: string
    connectToken?: string       // advisor_connect (consumer→advisor)
    connectionId?: string       // attorney_connection (attorney_clients.id)
    intakeToken?: string        // optional; validate if present
  }
  // Referral context (optional, same as today)
  referralCode?: string
  referralSlug?: string
  attorneyReferralCode?: string
  attorneyReferralSlug?: string
  betaLabel?: string
}
```

### Response

- **201:** `{ userId, session? }` — if prod uses email confirmation, return `{ needsEmailConfirmation: true }` without session; mirror current prod behavior
- **400:** validation / bad admission
- **403:** admission denied (waitlist closed, invalid token)
- **409:** email already exists
- **429:** rate limited

### Server steps (ordered)

1. Parse + sanitize input; enforce password min length (8+ consumer/invite; 10+ advisor/attorney)
2. `validateSignupAdmission(admission, { email, role, hostname })` → pass or 403
3. `admin.auth.admin.createUser({ email, password, email_confirm: <per-env policy>, user_metadata: { full_name, role, terms_accepted_at } })`
4. Run post-create pipeline (extract from current `_signup-form.tsx`):
   - Terms accept API logic (inline or internal call)
   - Advisor firm bootstrap (owner, no firm invite)
   - Firm join (if firm invite admission)
   - Referral attribution + funnel `account_created`
   - `notify-referral-signup` when applicable
5. Return session via `admin.auth.admin.generateLink` or sign-in flow — **prefer** matching today: if email confirm off (staging/local), establish session; if on (prod), confirm-email path

**Launch flip (`open_consumer`):** `PUBLIC_SIGNUP_OPEN=true` makes `open_consumer` the public front door. Supabase anon signups stay **off**. `resolveEmailConfirmForCreateUser` sets `email_confirm: false` for `open_consumer` on prod marketing (and by default on staging) so accounts are not usable until email verification. Staging E2E may set `SIGNUP_SKIP_EMAIL_CONFIRM=true` only in Preview env — never Production.

**Do not** call `supabase.auth.signUp()` from client after this ships.

---

## 6. Supabase dashboard sequencing

| Phase | Prod (`fnzvl…`) | Staging (`cmzyx…`) |
|-------|-----------------|---------------------|
| **Now** | Disable new signups | Keep enabled for dev until server route on staging |
| **After server route on staging** | Still disabled | Disable new signups; all signup via `POST /api/auth/signup` |
| **After server route on prod** | Still disabled | Still disabled |
| **At flip (`PUBLIC_SIGNUP_OPEN=true`)** | Still disabled — open signup = server admits `open_consumer` | Same |

**Permanent policy:** Anon signup stays off in both projects. “Opening signup” is an **application flag**, not re-enabling Supabase public signup.

**Admin/service operations unchanged:** `admin.auth.admin.createUser` in seed scripts, waitlist tooling, and the new signup route continue to work with service role.

---

## 7. Launch flip — `PUBLIC_SIGNUP_OPEN=true`

When production sets `PUBLIC_SIGNUP_OPEN=true` and redeploys:

1. Marketing CTAs route to `/signup` (existing `getSignupHref` behavior)
2. Bare `/signup` loads consumer signup form (middleware/page waitlist off)
3. `POST /api/auth/signup` with `admission: { type: 'open_consumer' }` accepts consumer signups
4. Supabase **still** has public signups disabled — direct anon API remains dead
5. Invite/beta/firm/advisor/attorney admission types continue to work via token validation

**Role self-selection at open signup:** Default flip behavior: only `open_consumer`. Advisor/attorney self-serve remains token-gated unless explicitly extended.

---

## 8. Client changes

| File | Change |
|------|--------|
| `app/(auth)/signup/_signup-form.tsx` | Replace `supabase.auth.signUp()` with `fetch('/api/auth/signup', …)`; map query params → `admission` object |
| `lib/supabase/client.ts` | No change; remove any remaining client `signUp` usage in app |
| `lib/waitlist-mode.ts` | Tighten bypass helpers; document that admission is server-only |
| `middleware.ts` | Optional: only cosmetic `/signup` access; do not rely on middleware for security |
| `tests/unit/waitlist-mode.spec.ts` | Update bypass tests — no unvalidated `invite=1` |
| `tests/e2e/public/*.spec.ts` | Tests that used `?invite=1` for page reachability → use staging with signup open, beta token, or `POST /api/auth/signup` fixture |

---

## 9. Post-signup side effects — migration checklist

Extract from `_signup-form.tsx` into `lib/auth/completeSignup.ts` (or similar) so server route and future tests share one path:

- [ ] `/api/terms/accept` equivalent
- [ ] Advisor firm bootstrap (new advisor owner, no firm invite)
- [ ] `POST /api/firm/join` logic inlined or called with internal auth
- [ ] Funnel `account_created` + beta label properties
- [ ] Profile referral_code / attorney_referral_code updates
- [ ] `/api/advisor/notify-referral-signup`
- [ ] `/api/advisor/claim-consumer-invite` for connect flow
- [ ] Redirect hints returned to client (`next`: `/invite/{token}`, `/advisor/connect/{token}`, confirm-email, etc.)

---

## 10. Testing matrix (staging project)

### §10 attestation — closed (2026-06-16)

**Surface:** `https://estate-planner-staging.vercel.app` · staging Supabase `cmzyxpxfyvdvbsykjvsg` · Vercel project `estate-planner-staging` (Move 1 complete).

| Probe | Scenario | Expected | Result (2026-06-16) |
|-------|----------|----------|----------------------|
| **7** | Anon `POST …/auth/v1/signup` | **422** `signup_disabled` | **PASS** |
| **1** | Bright `open_consumer` (`delivered@resend.dev`) | **201** + `needsEmailConfirmation: true`, no cookie | **PASS** |
| **2** | Invalid beta token | **403** | **PASS** |
| **4** | Valid beta token | **201** + session cookie | **PASS** |
| **5** | Short password | **400** | **PASS** |
| **8** | Checkout without session | **401** | **PASS** |

**Gate:** signup-hardening §10 **closed** on deployed staging artifact (`PUBLIC_SIGNUP_OPEN=true`, anon signups off, service role + Resend working).

**Remaining before flip:** prod-side blockers unchanged — real-card Stripe · PITR · error monitoring · live webhook events — [PRE_FLIP_CHECKLIST.md §A](./PRE_FLIP_CHECKLIST.md) · [LAUNCH.md](./LAUNCH.md) Bucket B.

**Notes:** `delivered@resend.dev` row exists on staging (re-probe needs fresh email). `staging.mywealthmaps.com` CNAME not wired yet — use `estate-planner-staging.vercel.app`.

<details>
<summary>§10 parked history (Preview-as-staging, 2026-06-16 earlier)</summary>

Parked **hosted Probe 1** while `estate-planner` Preview scope fought env confusion (`NEXT_PUBLIC_SUPABASE_ANON` typo, missing `SUPABASE_SERVICE_ROLE_KEY` on Preview). Resolved by dedicated staging Vercel project per [STAGING_PROJECT_RUNBOOK.md](./STAGING_PROJECT_RUNBOOK.md).

</details>

---

**Prerequisite:** Disable anon signups on **staging** Supabase **before** running this matrix (mirror prod Layer 0). Otherwise you cannot prove the server route is the only creation path.

### Admission × signup-open × email-confirm (unit: `signupPolicy.spec.ts`)

| Admission | `PUBLIC_SIGNUP_OPEN` | Token | Expected admission | `email_confirm` | Session |
|-----------|---------------------|-------|-------------------|-----------------|---------|
| `open_consumer` | false | — | 403 | — | — |
| `open_consumer` | true | — | ok | **false** (verify email) | no until confirm |
| `open_consumer` | true + `SIGNUP_SKIP_EMAIL_CONFIRM=true` | — | ok | true | yes (E2E only) |
| `beta_access` | false | valid | ok | true | yes |
| `beta_access` | false | invalid | 403 | — | — |
| `firm_member_invite` | false | valid + email match | ok | true | yes |
| `advisor_client_invite` | false | wrong email | 403 | — | — |

### Password policy (`lib/auth/signupPolicy.ts`)

| Admission | Min length |
|-----------|------------|
| `open_consumer` | **8** |
| invite/token types | **6** (legacy) |

### Rate limit (`lib/api/simpleRateLimit.ts` + `clientIp`)

- Key: `signup:{clientIp}` — reads `x-forwarded-for` first hop, then `x-real-ip`
- **10/min/IP** — abuse dampening, not a hard cap: in-memory per serverless instance unless Upstash env set
- Documented in route header comment

### Service-role side effects (`completeSignup.ts`)

- Firm join runs **only** when `admission.type === 'firm_member_invite'` (tokens re-validated against DB + email)
- Advisor firm bootstrap runs **only** for `beta_access`, `waitlist_invite`, `advisor_connect`, `open_advisor` — never `open_consumer`
- `redirectTo` sanitized: must start with `/`, not `//` or `://`

### Staging bright-state smoke (manual)

```bash
# 1. Staging: PUBLIC_SIGNUP_OPEN=true, anon signups OFF
# 2. Expect 201 + needsEmailConfirmation (no session cookie):
curl -sS -X POST https://<staging>/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"bright-test@example.com","password":"longenough","fullName":"Bright Test","role":"consumer","termsAcceptedAt":"2026-06-15T00:00:00.000Z","admission":{"type":"open_consumer"}}'
```

### Legacy integration rows

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `POST /api/auth/signup` open_consumer while waitlist on | 403 |
| 2 | `POST /api/auth/signup` with invalid beta token | 403 |
| 3 | Valid beta token + test card checkout | Staging DB row; test Stripe session |
| 4 | Valid firm invite token + email match | User created; firm join completed |
| 5 | Advisor client invite (`/invite/{token}` flow) | User created; email must match |
| 6 | `advisor_connect` token | User created; advisor role; connect claim |
| 7 | Direct `auth/v1/signup` with anon key | Rejected by Supabase (signups disabled) |
| 8 | `POST /api/stripe/checkout` without session | 401 |
| 9 | After (1) fails, no new `auth.users` row in prod | Manual spot-check on prod after Layer 0 |

**Unit tests:** `lib/auth/signupAdmission.spec.ts` — matrix of admission types with mocked admin client.

**E2E:** Update `auth-signup-attribution.spec.ts` and accessibility signup spec to use valid admission on staging.

---

## 11. Implementation order for Cursor

1. **Do not** merge band-aid-only `hasSignupPageAdmissionHint` trim without server route
2. Add `lib/auth/signupAdmission.ts` + tests
3. Add `lib/auth/completeSignup.ts` (extract side effects)
4. Add `POST /api/auth/signup`
5. Switch `_signup-form.tsx` to server route
6. Tighten `waitlist-mode.ts` + middleware (cosmetic only)
7. Update unit/E2E tests
8. Deploy to **staging** Vercel project; disable staging anon signups; run §10 matrix
9. Deploy to **prod** (anon signups already off from Layer 0)
10. Verify prod: fresh visitor → waitlist; direct auth signup → rejected; existing users → login + checkout OK

---

## 12. Explicit non-goals / anti-patterns

- **Do not** re-enable Supabase public signup on prod at flip
- **Do not** add `PUBLIC_SIGNUP_OPEN` checks only on checkout routes (too late; auth already exists)
- **Do not** validate invite tokens only in middleware without server route
- **Do not** share `ADMIN_VERIFY_TOKEN` between staging and prod projects
- **Do not** rely on `estate-planner-gules.vercel.app` as staging — use dedicated staging Vercel project per launch plan Move 1

---

## 13. Env / infra reminders (from launch audit)

- Set all **11** `STRIPE_PRICE_*` explicitly on staging (avoid `stripePrices.ts` legacy fallbacks masking missing vars)
- Staging webhook: new test-mode endpoint → staging URL → unique `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_DB_URL` / `PLAYWRIGHT_*` stay out of Vercel

---

## 14. References

- `app/(auth)/signup/_signup-form.tsx` — current client signUp + side effects
- `lib/waitlist-mode.ts` — waitlist + bypass helpers
- `app/api/firm/join/route.ts` — firm invite validation (post-auth today)
- `app/invite/[token]/page.tsx` — advisor client invite validation (pre-signup display)
- `app/api/advisor/claim-consumer-invite/route.ts` — connect token rules
- `lib/admin/waitlistInvite.ts` — beta link generation
- Launch plan: `MWM_LAUNCH_PLAN.md` Move 3 step 8–9, Move 4 step 14
