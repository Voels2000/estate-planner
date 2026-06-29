# POST_LAUNCH_REMAINING — Post-Launch & Deferred Work

**Owner:** Al Voels · **Repo:** Voels2000/estate-planner
**Last updated:** 2026-06-29

> **Naming:** [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) is the **pre-flip engineering step-off list** (items 1–9 while B&O is pending). This doc is **post-flip / deferred backlog** (P0–P3). Start with [LAUNCH_START_HERE.md](./LAUNCH_START_HERE.md) for the gate map.
**Status of launch:** Engineering pre-flip complete. Signup flip blocked only on Bucket A (WA B&O / DAS ruling), PITR propagation, and (recommended) Upstash on prod Vercel.

This document consolidates everything we scoped during the launch sequence and deliberately **did not** ship before flip — including items that were never on the go-live readiness summary. It exists so nothing parked is silently lost, and so "after launch" has explicit triggers instead of becoming an open-ended backlog.

---

## Priority legend

| Tag | Meaning | Window |
|-----|---------|--------|
| **P0-VERIFY** | May already be closed; confirm before re-listing or starting | Now (5-min checks) |
| **P1-EARLY** | Real gap with customer/regulatory exposure; do soon after flip | Weeks 1–2 post-launch |
| **P2-BACKLOG** | Genuine work, no near-term exposure; schedule deliberately | Weeks 3–8 |
| **P3-CLEANUP** | Low effort, low stakes; do opportunistically | Anytime |

---

## At-a-glance triage

| # | Item | Tag | Already on readiness doc? |
|---|------|-----|---------------------------|
| 1 | Input-validation hardening on estate-data write paths (6F) | **P1-EARLY** | No |
| 2 | WA My Health My Data Act — "consumer health data" counsel question | **P1-EARLY** | No |
| 3 | GRAT/Roth household-alert copy — confirm counsel coverage | **P0-VERIFY** | Partial (copy review logged, scope unclear) |
| 4 | `consumer_tier` reset on `subscription.deleted` — product decision | **P1-EARLY** | No |
| 5 | Webhook idempotency + Option B auto-retry (two-phase) | **P1-EARLY** | Yes (§11) |
| 6 | Deferred compliance-trigger register + 6 other counsel questions | **P2-BACKLOG** | No |
| 7 | Bundle-splitting (Sprint G) + query narrowing (Sprint H) | **P2-BACKLOG** | No |
| 8 | CI test-parallelization PR (#155/#156) finish | **P2-BACKLOG** | Yes (§11) |
| 9 | Accessibility pass + uptime/status page | **P2-BACKLOG** | Yes (§11) |
| 10 | Advisor/attorney prod canary credentials provisioning | **P0-VERIFY** | No (likely closed) |
| 11 | `.gitignore` audit txt files + remove unused deps | **P3-CLEANUP** | No |
| 12 | Drop typo RPC `generate_estate_recommendaions` | **P3-CLEANUP** | Yes (§11) |
| 13 | Counsel ToS/privacy sign-off at first-state nexus | **P2-BACKLOG** | Yes (§8/§11) |

---

## P1-EARLY — do within weeks 1–2

### 1. Input-validation hardening on estate-data write paths *(Sprint E, item 6F)*

**What it is.** During the Sprint E dead-code sweep we deleted four orphaned Zod schemas
(`lib/validations/{assets,income,expenses,household}.ts`) that modeled a *superseded* data
shape (jsonb `details` model, prototype enums) the live write paths never adopted. We
deferred building **real** validation rather than resurrecting stale code.

**The gap.** The live consumer write paths validate **presence only** (`if (!body.x)`).
There is no type, range, or enum enforcement on data that feeds the WA estate-tax engine,
the Monte Carlo projection, and the composition calcs. Bad-shaped input can reach the
engines today.

**Why it was deferred (and why that was correct).** Input validation guards *new* writes,
not resting data — so adding it post-launch carries **no migration risk** to existing users.
It is also better built *after* launch, when real user input reveals the true variety of
valid shapes; building it pre-launch against test fixtures risks rejecting valid live input
(the exact failure the drift check found in the old schemas). This is **definite** post-launch
work, not "only if an issue appears."

**Scope — build fresh against current truth, one atomic PR per route.** Each PR is a behavior
change (stricter 400s) and needs both good-input AND bad-input tests. **Do NOT start from
`lib/validations/*`** (deleted; modeled the wrong shape). The current-truth map is in
DECISION_LOG (logged 2026-06-19, Sprint E 6f):

| Entity | Write path | Validate against (current truth) |
|--------|-----------|-----------------------------------|
| Assets | `/api/consumer/assets` | Flat columns (`type, name, value, institution, cost_basis, liquidity, titling, is_ilit, situs_*, estate_inclusion_status`) — NOT jsonb `details`. `type` against `asset_types` ref (`CANONICAL_ASSET_TYPES`, 20+ values); `ref_liquidity_types`; `ref_titling_types`. |
| Income | `buildIncomeRow` / `/api/consumer/income` | `source, amount, start_year, end_year, name, ss_person, start_month, end_month, annual_growth_rate`. `source` against `income_types` ref incl. `GROWABLE_INCOME_SOURCES` (`self_employment, equity_awards, business`) + `employment`. |
| Expenses | `buildExpenseRow` / `/api/consumer/expenses` | `category, amount, start_year, end_year, name, owner, start_month, end_month`. `category` against `expense_types` ref. |
| Filing status | (shared) | Enum reality is `mfj` / `mfs` / `hoh` / `qw` — NOT the long-form strings. |

**Priority rationale.** P1 because it's a real correctness exposure on the inputs to your
core engines, but it carries zero migration risk and no customer is blocked, so it's
early-post-launch rather than a flip gate.

---

### 2. WA My Health My Data Act — "consumer health data" determination *(open counsel question)*

**What it is.** The highest-risk unresolved item from the deferred counsel packet. Question:
do any of our fields — **advance directive, healthcare proxy, incapacity / long-term-care
planning** — constitute "consumer health data" under Washington's My Health My Data Act
(MHMD)?

**Why it matters.** MHMD has teeth (consent, a dedicated privacy notice, geofencing rules,
a private right of action). If any estate-planning field is deemed consumer health data,
our current privacy posture is insufficient and would need specific remediation.

**Status.** Drafted position: unresolved — flagged as the single highest-risk item in the
register. Needs an actual legal determination, not a self-assessment.

**Priority rationale.** P1 (regulatory, WA is your launch state, private right of action).
Not a hard flip gate because pre-launch volume is near zero, but it should be answered
before consumer traffic builds — pair it with the counsel pass you're already running for
Bucket A / ToS.

---

### 3. GRAT/Roth household-alert copy — confirm counsel coverage *(P0-VERIFY leaning P1)*

**What it is.** Two new consumer household alerts — **GRAT opportunity** and **Roth
opportunity** — were ported into `evaluateEstateAlerts` in PR #51 (~2026-06-19) from a
never-wired Sprint-70 spec, with fact-not-advice copy. Their copy was explicitly gated on
counsel review **before reaching consumer-facing production** (LAUNCH B6 / PRE_FLIP), the
same review pass as the privacy policy.

**The thing to verify.** The readiness summary shows "Household-alert copy — Counsel review
passed (2026-06-19)" — but that's the same date #51 was in flight. **Confirm the GRAT and
Roth alerts specifically were in the scope of the review that passed**, not just the original
four (ILIT, gifting, large-no-trust, no-base-case). The gate is **consumer launch**, not
staging — #51 was allowed onto staging uncleared.

**Watch-out for whoever checks.** The Roth trigger fires partly on a "low-income year"
signal. By design the copy must **not** assert the low-income-year fact (that edges toward
advice — "this is a good year for you to convert"). The alert fires on the signal but the
language only names general income-sensitivity and redirects to a professional. Confirm the
shipped copy held that line.

**Priority rationale.** P0-VERIFY first (it may be done). If the two alerts were *not* in the
cleared scope, it becomes a **consumer-launch blocker** until cleared.

---

### 4. `consumer_tier` reset on `subscription.deleted` — product decision

**What it is.** When a consumer subscription is deleted, we currently do **not** reset
`consumer_tier`. We flagged this during the Basil webhook hardening and deferred it as a
deliberate **product decision**, not a bug.

**Why deferring is safe.** We confirmed every access gate pairs a tier check with a status
check — there are **no tier-only gates**. So a stale `consumer_tier` on a deleted
subscription does not grant access, because the status check fails independently. The
question is purely product/data-hygiene: do we want the tier field to reflect "what they
last had" or reset to a baseline on cancellation?

**Priority rationale.** P1 only because it's an open decision sitting in billing code and
worth closing deliberately; there's no active exposure given the paired gates.

---

### 5. Webhook idempotency + Option B auto-retry *(two-phase; already on §11)*

**What it is.** Option A shipped pre-launch (PR #32 / #34): webhook failures now fire Sentry
alerts, but Stripe still gets 200 on processing failures → **manual resend** is the recovery
path. Option B (return 500 → Stripe auto-retries → transient failures self-heal) is the
post-launch work, and it is **strictly two-phase**: idempotency FIRST, retry SECOND. Never
the reverse — retry on a non-idempotent handler double-fires side effects.

**Why it's queued, not done.** Retry is only safe once the handler is idempotent. Today there
is no `event.id` dedup and no transaction around the handler. The full plan is in
`docs/WEBHOOK_IDEMPOTENCY_RETRY_PLAN.md`.

**Phase 1 — idempotency (≈2–3 days).** Add a `stripe_webhook_events` dedup table keyed on
Stripe `event.id` (`event_id, event_type, status [processing|processed], timestamps`), with
RLS + coverage gate. Claim the event at handler start: if `processed` → 200 + skip; if new →
insert `processing`, run handler, mark `processed` only on full success. Plus per-side-effect
guards for the non-idempotent writes:

| Side effect | Re-run damage | Phase 1 fix |
|-------------|---------------|-------------|
| `trackTierUpgrade` | Duplicate `funnel_events` rows | **Already fixed** in PR #34 (now fires only on successful write) — confirm dedup still wanted |
| `scheduleDeletionOnSubscriptionCancelled` | Duplicate pending `deletion_schedule` rows (no unique constraint) — **compliance impact** | Check-before-insert OR partial unique index on pending `user_id` |
| `cancelPendingDeletionOnReactivation` | Low — `update where status='pending'` | Already safe |
| `sendConsumerRenewalReminder` | Possible duplicate email | Leave on 200 in Phase 2; metadata guard is partial |

Also handle: stuck `processing` rows (crash after claim → TTL reclaim or explicit `failed`),
and persistent-failure retry storms (acceptable if idempotency holds; Option A already alerts).

**Phase 2 — auto-retry (≈0.5–1 day).** Critical Supabase-write paths throw → existing 500
path → Stripe retries. `invoice.upcoming` stays 200. Add missing error checks before throwing.

**Priority rationale.** P1-EARLY. The deferral is safe *conditional on* (a) you act on Sentry
alerts and (b) "after launch" means soon, not someday — manual-remediation fragility compounds
as volume grows. Target weeks 1–2 once real billing traffic exists.

---

## P2-BACKLOG — schedule deliberately (weeks 3–8)

### 6. Deferred compliance-trigger register + remaining counsel questions

**What it is.** A parked register (status: PARKED — do not implement from it) covering two
things: (a) multi-state privacy-law threshold tripwires so you revisit *before* a law begins
to bind you, and (b) drafted positions on open counsel questions. As a pre-launch small
business you are below the numeric thresholds of every comprehensive state privacy law, and
the two no-threshold "doing-business" states (Texas, Nebraska) exempt small businesses — so
this is genuinely future work, but it needs alarms so "some time from now" has a trigger.

**Open counsel questions (drafted positions already taken; counsel blesses or adjusts):**

| # | Question | Current position |
|---|----------|------------------|
| 1 | Is `deletion_audit_log` an acceptable §6 retention exception, or pseudonymize? | Named exception (drafted) |
| 2 | Advisor/attorney activation drips — transactional onboarding or marketing-consent? | Transactional; unsubscribe still offered |
| 3 | Soft dismissible terms banner adequate, or hard re-acceptance gate for material changes? | Soft banner routine; hard gate only for material changes |
| 4 | 45-day manual portability fulfillment acceptable? | Yes, via request intake + manual SOP |
| 5 | WA MHMD consumer-health-data question | **Unresolved — see item 2 above (promoted to P1)** |
| 6 | Any GLBA entity/data exemption? | Likely no (software, not a financial institution) |
| 7 | Embedded 18+/US representation sufficient, or build `age_attested_at`? | Embedded representation; column deferred |

**Priority rationale.** P2 because you're below all thresholds today; the one urgent piece
(MHMD, #5) is promoted to P1 as item 2. Track per-state resident/customer counts so the
threshold alarms can actually fire.

---

### 7. Performance: bundle-splitting (Sprint G) + query narrowing (Sprint H)

**What it is.** Two perf workstreams logged in ROADMAP and explicitly deferred post-launch.
Sprint G is treemap-driven bundle-splitting (tooling already in place: `knip` +
`@next/bundle-analyzer`, `npm run analyze`). Sprint H is query narrowing. Neither is started.

**Priority rationale.** P2 — no correctness or customer exposure; pure optimization. Drive
Sprint G off the actual bundle treemap once you have real usage, not speculatively.

---

### 8. CI test-parallelization PR (#155/#156)

**What it is.** A parked "make the tests run faster" branch that splits one big e2e job into
parallel jobs, plus an auth-retry soak (`getWithAuthRetry`/`postWithAuthRetry`, PR #156). The
red checks on that branch are the unfinished parallelization scaffolding, **not** launch code
— your launch shipped green on the old single job separately.

**Load-bearing check before you forget it.** Confirm `main`'s `e2e-smoke` still runs the **old
single job**, not the new parallel version. If #155's parallelization is already merged to main
but its fix isn't, your CI gate could be quietly flaky. If neither is merged, it's fully parked
and harmless. The "post-push isolation job green" box is the one to chase — same "did it run, or
did it skip?" question that recurred all launch.

**Priority rationale.** P2 — optional speed upgrade, safe to leave parked, but verify the
main-branch CI-gate question above (1-minute check).

---

### 9. Accessibility pass + uptime/status page

Full accessibility audit and a public uptime/status page. Both logged in §11 as post-launch.
P2 — no current exposure; do when you have breathing room.

---

### 13. Counsel ToS/privacy sign-off at first-state nexus

ToS §10/§11 counsel sign-off and privacy redline were deferred to first-state nexus
(engineering drafts are live; `/privacy` is published). `terms_version` is deferred
post-launch (`terms_accepted_at` is already set at signup). P2 — tied to when you establish
nexus; sequence with your accountant on WA B&O registration. **Note:** ToS §13 (tax-treatment
branch) is separately blocked on the Bucket A ruling and is a flip gate, not post-launch.

---

## P0-VERIFY — confirm before re-listing or starting

### 10. Advisor/attorney prod canary credentials *(likely already closed)*

We deferred four advisor/attorney role-setup failures during a prod smoke run as a tracked
provisioning follow-up (missing real prod canary creds, not a code defect). This **looks
resolved** in the most recent session: `PLAYWRIGHT_ADVISOR_*` / `PLAYWRIGHT_ADVISOR_EMPTY_*`
prod canary credentials were added to `.env.test.production` and role canaries were reseeded
on prod (`fnzvl…`), after which the isolation specs executed with correct canary identities
(including the `a77f5342` fix to the advisor IDOR probe target). **Confirm closed**; if so,
remove from this list.

---

## P3-CLEANUP — opportunistic, low stakes

### 11. `.gitignore` + unused deps

- Add `audit-results.txt` and `audit-summary.txt` to `.gitignore` (recurring unstaged-file
  nag across multiple commits).
- Remove unused deps `react-hook-form` + `@hookform/resolvers` (zero source usage).
  **Re-grep immediately before uninstall** (`rg "react-hook-form|@hookform/resolvers" --type ts`);
  if clean, drop them — if any ambiguity, leave them (two unused deps cost nothing; a wrong
  uninstall costs a build break). `zod` stays — it's live in `app/api/rmd/route.ts` and
  `lib/api/schemas/householdAccess.ts`.

### 12. Drop typo RPC `generate_estate_recommendaions`

Misspelled orphan RPC. Logged in §11. Confirm nothing calls it, then drop. P3.

---

## Notes on what is NOT in this document

- **Flip gates** (Bucket A / WA B&O ruling, PITR propagation, Upstash, `PUBLIC_SIGNUP_OPEN=true`
  + fresh-email prod signup smoke) live in the go-live readiness summary, not here — those
  block flip, this document is post-flip.
- **New-venture exploration** (legal-tech attorney-tier deepening, hunting/fishing marketplace)
  is product strategy, not launch debt — tracked separately.
