# MWM — Claim-Flow v2 Discovery Audit

**Owner:** Al Voels · **Type:** READ-ONLY discovery (2026-07-01) · **Input to:** claim-flow v2 spec  
**Audited against:** `staging` @ PR #201 merge (`41a36581`)

---

## Current claim flow, step by step

### A. Directory outreach claim — `/claim/[token]` (attorney + advisor)

| Step | What happens | Code |
|------|----------------|------|
| 1 | User opens outreach link `/claim/{claim_token}` | `app/claim/[token]/page.tsx` |
| 2 | Server resolves token → listing row | `lib/directory/resolveClaimToken.ts` — `attorney_listings.claim_token` then `advisor_directory.claim_token`; **no expiry check** (invalid token → 404 only) |
| 3 | Page loads preview; if `profile_id` set and ≠ user → “Already claimed” | `_directory-claim-client.tsx` L90–104 |
| 4 | **Signup gate:** form disabled until logged in; links to `/login?redirectTo=/claim/{token}` or `/signup?redirectTo=…` | `_directory-claim-client.tsx` L46–47, L154–168, L290 |
| 5 | Logged-in user submits → `POST /api/directory/claim` | `_directory-claim-client.tsx` L61–75 |
| 6 | API requires auth (`401` if no session) | `app/api/directory/claim/route.ts` L35–37 |
| 7 | Identity: `verifyClaimIdentity(user.email, listing.email, website)` — exact email, firm-domain match, or free-mail block | `lib/directory/claimIdentity.ts` |
| 8 | Role gate: attorney listing requires `profile.role === 'attorney'` **or** `is_attorney`; advisor requires `role === 'advisor'` | `route.ts` L66–78 |
| 9 | Writes listing: `profile_id`, `claimed_at` (if null), contact fields; attorney also `bar_number`, `states_licensed` | `route.ts` L86–113 |
| 10 | Attorney only: `profiles.is_attorney = true` (**not** `attorney_tier`, **not** `client_limit` / `billing_floor`) | `route.ts` L120 |
| 11 | Post-claim landing: attorney → `/attorney/requests?claimed=true`; advisor → `/advisor?claimed=true` | `_directory-claim-client.tsx` L49–52, L134–136 |

**Signup gate (core v2 change point):** Claim **cannot complete** without an auth session. The UI blocks submit when `!isLoggedIn`; the API returns `401 Sign in to claim your listing.` There is no “approved but unauthenticated” intermediate state.

### B. Consumer-initiated claim — `/claim-listing/[token]` (legacy connection-request path)

| Step | What happens | Code |
|------|----------------|------|
| 1 | Token is `connection_requests.claim_token` (not directory `claim_token`) | `app/claim-listing/[token]/page.tsx` L17–21 |
| 2 | Requires `status === 'pending'` else `/claim-listing/invalid` | L24–26 |
| 3 | **Auth gate:** unauthenticated → `/login?claim={token}&next=/claim-listing/{token}` | L43–45 |
| 4 | Role: `profile.role === 'advisor'` **or** `is_attorney` | L54–56 |
| 5 | If listing unclaimed: sets `profile_id` on listing (minimal — no `claimed_at`, no credential fields) | L64–68 |
| 6 | Creates `consumer_requested` row (`advisor_clients` or `ensureAttorneyClientRequestRow`) | L72–95 |
| 7 | Marks `connection_requests.status = 'accepted'` | L98–101 |
| 8 | Redirect: attorney → `/attorney/requests?claimed=true`; advisor → `/advisor?claimed=true` | L127 |

**Note:** This path is distinct from `/claim/[token]`. Directory outreach uses `/claim/`; consumer directory “request connect” stores a separate `claim_token` on `connection_requests` (`app/api/attorney-directory/request-connect/route.ts` L82).

---

## Signup gate — precise location

| Gate | Location | Behavior |
|------|----------|----------|
| UI | `_directory-claim-client.tsx` L154–168, L290 | Submit disabled; CTA to login/signup with `redirectTo` back to claim URL |
| API | `/api/directory/claim` L35–37 | `401` without session |
| Claim-listing | `claim-listing/[token]/page.tsx` L43–45 | Server redirect to login before any write |

Claim does **not** create an auth user inline. Signup is a **prerequisite**, not bundled into claim.

---

## What a completed claim writes

### `/api/directory/claim` — attorney

| Table / column | Written? |
|----------------|----------|
| `attorney_listings.profile_id` | ✅ |
| `attorney_listings.claimed_at` | ✅ (preserves existing if set) |
| `attorney_listings.is_verified` | ❌ (unchanged — seed sets `true`) |
| `attorney_listings.credential_verified_at` | ❌ |
| `attorney_listings.client_limit` / `billing_floor` | ❌ |
| `profiles.is_attorney` | ✅ `true` |
| `profiles.attorney_tier` | ❌ |
| `profiles.role` | ❌ (must already be `attorney` at API gate) |

### `/api/directory/claim` — advisor

| Table / column | Written? |
|----------------|----------|
| `advisor_directory.profile_id`, `claimed_at`, contact fields | ✅ |
| `profiles.role` | ❌ (must already be `advisor`) |
| `firms` / `firm_members` | ❌ (firm created at **signup** via `bootstrapAdvisorFirm` in `lib/auth/completeSignup.ts` L42–97, not at claim) |

---

## Reusable token infrastructure

| Primitive | Generation | Validation | Expiry | Single-use |
|-----------|------------|------------|--------|------------|
| Directory `claim_token` | `randomBytes(24).base64url` on seed (`scripts/import-directory-seed.ts` L146–148) | `resolveDirectoryClaimToken` equality lookup | **NOT FOUND** — no `claim_token_expires_at`; stale link works until token rotated | Reusable until claimed (`profile_id` set) |
| `connection_requests.claim_token` | Set on consumer request-connect | `claim-listing/[token]` lookup | **NOT FOUND** on column | Consumed when request → `accepted` |
| `attorney_clients.invite_token` | `generateInviteToken()` | `/api/attorney/accept-invite`, `/attorney-invite/[token]` | `invite_expires_at` via `tokenExpiresAt()` | Row updated to `accepted` |
| `advisor_clients.invite_token` | Same pattern | `/api/invite/accept`, `/invite/[token]` | `invite_expires_at` | Same |
| Supabase magic link | `generateLink({ type: 'magiclink' })` in scripts only | `lib/verify/authSession.ts` | Supabase default | **NOT FOUND** in product consumer/pro claim flows |

**Email possession:** Invite/claim tokens prove possession only if sent to the listing/invite email and the recipient clicks the link. Directory claim additionally requires **logged-in email** to pass `verifyClaimIdentity`.

**Magic-link login in product:** **NOT FOUND** for claim or professional onboarding. Password signup/login only on claim surfaces.

---

## Attorney vs advisor branch points

| Branch | Attorney | Advisor |
|--------|----------|---------|
| Claim URL | `/claim/{claim_token}` (shared) | Same |
| API role gate | `is_attorney` or `role=attorney` | `role=advisor` |
| Credential fields | `bar_number`, `bar_state` | `crd_number` |
| Profile write | `is_attorney=true` | None at claim |
| Firm bootstrap | N/A (solo listing-scoped) | At signup (`completeSignup.bootstrapAdvisorFirm`), not claim |
| Post-claim portal | `/attorney/requests?claimed=true` | `/advisor?claimed=true` |
| Connection billing model | Listing-scoped; 1 free client; `client_limit`/`billing_floor` on `attorney_listings` | Firm-scoped; Path A free own-plan (`advisorBillingGate.ts`); pay at first client connect |
| Billing seed on claim | **None** — defaults `client_limit ?? 1` at gate eval (`attorneyConnectionBilling.ts` L103) | **None** — firm `client_limit` null until checkout/raise |
| Unclaimed listing connect | `listing_unclaimed` 403 on all connect APIs | N/A (advisor uses profile id as advisor_id) |

### Attorney claim → can 1st client connect?

After claim: `profile_id` set → gate allows connects. With `CONNECTION_BILLING_ENABLED` and no subscription: first connect is free (`connected < limit`, default limit 1). **No tier/subscription block at claim.** Unclaimed listing was the blocker before claim.

### Advisor claim → Path A?

Fresh advisor with firm from signup: `shouldRedirectAdvisorToBilling` exempts own-plan paths (`ADVISOR_OWN_PLAN_PATH_PREFIXES`). Client roster (`/advisor`) still gated on firm subscription when flag ON. Claim does not seed firm billing state.

### Firm-invite relax (sub-advisors before paying)

Wired for **firm_member** invites at signup (`joinFirmFromInvite` in `completeSignup.ts`). **NOT** auto-wired by directory claim alone — requires `invite_token` + `firm_id` signup admission.

---

## Signup-deferral blockers

| Assumption | Where | Blocker for v2 “claim without account” |
|------------|-------|----------------------------------------|
| `profile_id` on listing | All connect gates, attorney layout, billing context | Need pre-account claim state keyed by email/token |
| `auth.uid()` for RLS | Consumer/professional data access | Unclaimed professional has no RLS principal |
| Billing owner | `attorney_listings.profile_id` → `profiles.subscription_status` | Subscription attaches to profile, not listing email |
| Attorney portal | `getAccessContext().isAttorney` + listing by `profile_id` | No portal without auth profile |
| Claim API | Requires session + role match | Must split “approve email” from “create/link account” |

**Pre-account state:** **NOT FOUND.** No `approved_email` or pending-claim table. Only `profile_id` null vs set on listing.

**Link later account to claim:** **NOT FOUND** as automated flow. Identity match at claim time is live-session email vs listing email (`verifyClaimIdentity`). v2 could reuse that check on magic-link click, then bind on first signup with matching email.

**Credential verification:** Optional at claim UI (`bar_number` / `crd_number` fields); does **not** block claim. `credential_verified_at` not set by claim API. Badge is manual/post-claim.

---

## Connection to outreach + directory

| Question | Finding |
|----------|---------|
| Seed rows have `claim_token`? | ✅ `scripts/import-directory-seed.ts` sets `claim_token` + `claim_token_created_at` |
| Outreach link format | `/claim/{claim_token}` (importer logs tokens; see `DIRECTORY_SEED_CLAIM_PLAN.md`) |
| Identity logic built? | ✅ `lib/directory/claimIdentity.ts` — domain / exact / free-mail block |
| Unclaimed → connect gated? | ✅ `evaluateAttorneyConnectionBillingGate` → `listing_unclaimed` when `!profile_id` (`attorneyConnectionBilling.ts` L93–94) |

---

## Surprises / bugs (not fixed)

1. **Two claim URL families:** `/claim/` (directory outreach) vs `/claim-listing/` (professional **respond to consumer request-connect** — not a consumer path; see [CLAIM_FLOW_V2_COMPLETE_SPEC.md](./CLAIM_FLOW_V2_COMPLETE_SPEC.md) Part 5). Naming collision + `/claim-listing/` skips `verifyClaimIdentity`.
2. **Claim-listing** does not set `claimed_at` or run `verifyClaimIdentity` — weaker than `/api/directory/claim`.
3. **No claim token expiry** on directory tokens (invite tokens do expire).
4. **Attorney signup role:** Directory claim requires attorney account already; outreach must use attorney signup with `redirectTo`, not consumer signup.
5. **`grant-access` consumer API** has gate-aware hook (`useConsumerGrantAttorneyAccess`) but **no production UI** calls it (legacy dashboard directory removed); find-attorney uses `request-connect` → attorney accepts on requests page.
6. **Billing state not seeded at claim** — first-connection behavior relies on gate defaults (`client_limit ?? 1`), not explicit `client_limit=1, billing_floor=0` write at claim.

---

## Out of scope (this audit)

- v2 UX design
- Code changes (except this document)
- Connection billing math (documented elsewhere; attorney parity #201 on staging)
