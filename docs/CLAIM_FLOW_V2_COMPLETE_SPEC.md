# MWM — Claim-Flow v2: Complete Spec

**Owner:** Al Voels · **For:** Cursor · **Written against:** [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) + auth design conversation (locked).  
**Depends on:** connection billing (advisor + attorney proven through raise-parity step 4). Claim v2 sits **on top** of proven billing.  
**Goal:** Replace signup-before-claim with magic-link entry, action-gated step-up to password+MFA, per-type post-claim landing, and explicit billing seed — professional goes from outreach email to claimed, exploring, and (when they act) secured in the fewest steps that still protect sensitive data.

---

## Part 1 — Authentication model (LOCKED)

Leading-practice pattern: magic link for entry, **step-up** to password+MFA before sensitive data. Supabase provides all primitives natively (magic link, password, TOTP MFA) — this is sequencing, not new infra.

### Entry

- Outreach email contains a **Supabase magic link**. One click → passwordless session created (proves email possession AND authenticates). No password, no signup form.
- Lands on the claimed portal: **attorney → `/attorney` landing; advisor → `/advisor` landing.**
- They explore freely in an **un-secured session**.

### Return (while un-secured)

- Re-entry is **another magic link** — repeatable, indefinite, never locked out (Notion-style recurring magic-link login).
- **The login page MUST prominently offer "email me a link"** for professionals who have no password yet. A returning un-secured professional must never be stranded at a password field they never created. (Explicit UI requirement.)

### Step-up to password + MFA — ACTION-GATED

- Fires at the **first moment real financial/estate data is involved**, NOT at claim.
- **Atomic:** the sensitive action does not complete until password+MFA setup completes. Both happen or neither. No half-secured account that already touched data.
- **Attorney trigger:** connecting or viewing a client (accessing client estate data).
- **Advisor trigger:** accessing or entering **their own plan data** (their own plan is itself sensitive — explicit requirement).
- Enrollment lightweight: set password + enroll a second factor (TOTP), target <30s, mobile-friendly.

### Post-setup

- Password + second factor = permanent auth. Magic link optionally retained as a convenience login factor (magic link + MFA is itself 2-factor).

### What is NOT gated

- **Claiming is free and magic-link-only.** Claim ≠ sensitive action. Worst case a wrong claim is caught by credential verification (Part 4), not by account security.
- Exploring the portal, seeing the value prop, viewing the (empty) dashboard — all un-secured-OK.

### Auth state table

| State | Has password? | Return path | Can do |
|-------|--------------|-------------|--------|
| Explored, no action | No | Magic link (repeatable) | Explore, claim; NOT touch data |
| Attempted action, bailed on setup | No | Magic link | Same as above (action didn't complete) |
| Completed step-up | Yes + MFA | Password + 2FA (or magic link + 2FA) | Everything |

---

## Part 2 — The claim flow, end to end (v2)

### Current (from audit)

- `/claim/[token]` requires login/signup before submit (UI disables form, API 401). This is the friction v2 removes.
- Claim writes `profile_id`, `claimed_at`, listing fields; attorney sets `is_attorney=true` only (no `attorney_tier`, no billing seed).
- Advisor firm created at **signup** (`completeSignup.bootstrapAdvisorFirm`), NOT at claim.
- Post-claim landing: attorney → `/attorney/requests?claimed=true`; advisor → `/advisor?claimed=true`.

### v2 flow

1. Outreach email → magic link (`?token=` carries claim context).
2. Click → Supabase session created (passwordless). No signup gate.
3. Claim completes automatically on authenticated arrival (email matches the seeded listing's target, or token binds to the listing): write `profile_id`, `claimed_at`, `is_attorney`/advisor role.
4. **Explicit billing seed at claim** (Part 3) — not the `?? 1` default.
5. Land on the per-type portal, un-secured, exploring.
6. First data action → step-up (Part 1) → action completes.

### Removing the signup gate

- `/claim/[token]` must accept a **magic-link-authenticated** session as sufficient to claim — no password/full-signup required at claim.
- The 401/form-disable path is replaced by: authenticated (via magic link) → claim proceeds; not authenticated → send magic link.

### v2 post-claim landing (update from audit)

- Attorney → `/attorney` (or `/attorney?claimed=true`), not requests-first.
- Advisor → `/advisor` (or `/advisor?claimed=true`).

---

## Part 3 — Claim → billing seam (per type; explicit seed)

The billing we built already flips `listing_unclaimed` on claim and defaults `client_limit ?? 1`. v2 makes the seed **explicit and per-type.**

### Attorney claim

- Seed on claim: `attorney_listings.client_limit = 1`, `billing_floor = 0`, `reset_count = 0`. (Written, not defaulted.)
- Result: claimed attorney can connect **1 free client** immediately (composes with free-client offset). No subscription until the 2nd client.
- `is_attorney = true` (already set). Do NOT set a paid `attorney_tier` (tiers retired for feature-gating; connection billing drives everything).

### Advisor claim

- **Auto-create the firm at claim** — run the equivalent of `bootstrapAdvisorFirm` (`lib/auth/completeSignup.ts`) so the advisor lands **firm-ready** (Path A free own-plan + able to invite sub-advisors + connect clients).
- Seed firm connection-billing state: `client_limit`/`billing_floor` defaults consistent with Path A (free own-plan, 0 billable households until first client connect).
- Result: claimed advisor lands in complete Path A state — free own-plan, free team formation, pay at first client connect. No bounce to billing.
- **Reason auto-create is safe:** billing meters connected clients, not advisors/seats — firm-at-claim has no cost implication (Phase 5 decoupling).

### Both

- Un-secured professional can reach the free tier (view portal) but **step-up gates the first data touch** (attorney connect/view client; advisor enter own plan), per Part 1.

---

## Part 4 — Credential verification (separate axis from account security)

Account security (password/MFA) protects the **account**. Credential verification (WSBA/CRD) verifies **professional identity** — drives the verified badge and gates public-facing / client-connection legitimacy.

- **Where:** collected at or before the first client-connection action (alongside or near step-up, but conceptually separate). Professional supplies WSBA (attorney) / CRD (advisor).
- **Blocking vs badge:** credential **gates the verified badge and public display**, and is **required before connecting a client**; does NOT block claiming or exploring.
- **Verification method:** confirm-with-number; same-domain firm email = higher trust; free-mail = exact match; big firms = light review (`lib/directory/claimIdentity.ts`).
- Today `is_verified=true` at seed = "approved to display." `credential_verified_at` drives the verified badge. Claim sets `credential_verified_at` when professional supplies a confirmed credential.

---

## Part 5 — Two-URL cleanup (LOCKED after code review)

Audit found two families. **Code review confirms:**

| URL | Token source | Who receives link | Purpose |
|-----|--------------|-------------------|---------|
| `/claim/[token]` | `attorney_listings.claim_token` / `advisor_directory.claim_token` | Professional (outreach seed) | Directory outreach claim — runs `verifyClaimIdentity`, sets `claimed_at` |
| `/claim-listing/[token]` | `connection_requests.claim_token` | **Professional** (listing email) | Consumer **request-connect** response — email from `request-connect` APIs (`claimUrl = /claim-listing/{token}`) |

**Not a consumer path.** Both URLs are professional-facing. The collision is **naming** (`claim-listing` sounds like listing claim) plus **behavior drift**: `/claim-listing/` skips `verifyClaimIdentity` and `claimed_at` while still setting `profile_id` and creating `consumer_requested` rows.

### v2 requirements

1. **Rename or document** `/claim-listing/` → e.g. `/respond-request/[token]` (or equivalent) so it is not confused with directory outreach `/claim/`.
2. **Unify identity hygiene:** professional listing claim paths must run `verifyClaimIdentity` (or equivalent) before `profile_id` is set — including consumer-initiated respond flow.
3. **Directory outreach** uses `/claim/[token]` exclusively for seed/outreach magic-link claim.

---

## Part 6 — Build plan

| # | Work | Key files / primitives |
|---|------|------------------------|
| 1 | Discovery confirmations | This spec + audit; Part 5 locked above |
| 2 | Magic-link claim entry | `signInWithOtp` / Supabase magic link; `/claim/[token]`; `POST /api/directory/claim` |
| 3 | Login "email me a link" | `app/(auth)/login/_login-form.tsx` |
| 4 | Per-type claim seed | `app/api/directory/claim/route.ts` — attorney listing cols; `bootstrapAdvisorFirm` at claim |
| 5 | Action-gated step-up | Extend `lib/security/privilegedMfaPolicy.ts`; `mfa-enroll` / `mfa-challenge`; gate attorney client view + advisor own-plan paths |
| 6 | Credential verification | WSBA/CRD at first client connect; `credential_verified_at` |
| 7 | Two-URL rename + identity | `claim-listing` → respond route; shared identity check |
| 8 | Tests + staging walk | See staging walk below |

### Code readiness (2026-07-01)

| Primitive | Status |
|-----------|--------|
| Supabase magic link | **Scripts/E2E only** (`lib/verify/authSession.ts`, `seed-e2e-lib.ts`) — **not product login/claim** |
| TOTP MFA enroll/challenge | **Built** — `app/(auth)/mfa-enroll/page.tsx`, `mfa-challenge/page.tsx` |
| Privileged MFA policy | **Built** — `lib/security/privilegedMfaPolicy.ts` (`REQUIRE_PRIVILEGED_MFA`) |
| Claim identity | **Built** — `lib/directory/claimIdentity.ts` |
| Attorney billing seed helpers | **Built** — connection billing on `attorney_listings` |
| Advisor firm bootstrap | **Built at signup** — `completeSignup.bootstrapAdvisorFirm` — **move to claim** |

---

## Staging walk (v2)

1. Seed a directory listing with claim token. Generate outreach magic link.
2. Click → authenticated passwordless → claimed → land on portal (attorney/advisor), un-secured.
3. Verify billing seed: attorney `client_limit=1/floor=0`; advisor firm created, Path A state.
4. Leave, return via magic link → back in, still un-secured.
5. Attempt first data action → step-up (password+MFA) → complete → action proceeds.
6. Attorney: connect 1st client free (post-security). Advisor: enter own plan (post-security).
7. Credential: supply WSBA/CRD → `credential_verified_at` set → verified badge.
8. Confirm un-secured session could NOT touch data before step-up.

---

## Out of scope / carry-forward

- Prod cutover (flag flips, checkout repoint, `automatic_tax`, Stripe prod prices).
- Outreach copy reconciliation (P0, editorial) — before any send.
- Attorney connection billing UI smoke (optional; API contract proven).

---

## Definition of done

Staging: professional goes outreach email → one-click magic-link claim → portal → explores un-secured → returns via magic link freely → on first data action required to set password+MFA (atomic) → then acts; attorney lands with 1 free client, advisor lands firm-ready in Path A; credential verification gates verified badge and client connection; professional claim uses verified URL path; no un-secured session touches sensitive data.

**Related:** [CLAIM_FLOW_V2_DISCOVERY_AUDIT.md](./CLAIM_FLOW_V2_DISCOVERY_AUDIT.md) · [DIRECTORY_SEED_CLAIM_PLAN.md](./DIRECTORY_SEED_CLAIM_PLAN.md)
