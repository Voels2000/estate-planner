# MWM — Directory Seed & Claim System: Implementation Plan

**Owner:** Al Voels · **For:** Cursor implementation · **Last updated:** 2026-07-02
**Goal:** Seed the real WA outreach directories (built from public records), make the "your listing is live — claim it" email true, and let professionals claim + self-validate their credentials. Built 50-state-ready from row one; WA is just the first batch.

**Related:** [GTM_FIRST_WAVE.md](./GTM_FIRST_WAVE.md) · [audit-directory-state.ts](../scripts/audit-directory-state.ts)

> **Parked (next task, NOT in this plan):**
> 1. Stripe **sales-tax** wiring — staging checkout showed no tax. Cause is the per-mode gap (no registration in the sandbox) and/or checkout not passing `automatic_tax: { enabled: true }` + collecting a billing address. Configuration/wiring, not a defect.
> 2. Confirm estate-tax **engine** coverage across all 13 estate-tax states (separate from the 13-state content system, which exists). Audit when we get to it.
> Neither blocks the directory work below.

---

## Decisions locked (from this session)

| Decision | Resolution |
|----------|-----------|
| Publish model | **Publish-then-claim.** `is_verified=true` at seed = "approved to display." Listings go live immediately. |
| **All-publish vs spreadsheet gate** | **All-publish (locked 2026-06-30).** Every seed row gets `is_verified=true` on import. No per-row `verified` column in spreadsheets. Credential badge waits on `credential_verified_at` after claim + manual confirm. |
| Credential verification | Moved to **claim time** — professional supplies their own bar/CRD number (easy to confirm *with* the number; hard to find name→number, esp. WA). |
| Verified badge | Driven by new `credential_verified_at`, separate from display. Badge is the carrot; never gates the claim. |
| Claim = subscribe? | **No.** Claim is free, one action. Trial offered *after* claim, never bundled, never gated. |
| Trial timing | Claim now → trial as a **claim-triggered follow-up** (3–5 days). Soft skippable mention on claim success only. |
| Identity match | **Same-domain email** for firm domains; **exact-match** for free-mail (gmail/outlook); **light manual review** for big multi-attorney/advisor firms. |
| State scope | Directory = **all 50 states**, state as a first-class field. Estate-tax *analysis* = the 13 states with an estate tax. Importer is **state-parameterized, no WA hardcoding.** |
| Run-1 idempotency key | Natural key **(firm_name + contact_name + state)** — bar/CRD numbers are blank at seed, become the durable key once claims populate them. |

---

## Part 1 — Migration

State-agnostic; additive only. One PR.

```sql
-- advisor_directory: add national CRD + verification timestamp
alter table advisor_directory
  add column if not exists crd_number text,
  add column if not exists credential_verified_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists source text;          -- e.g. 'outreach_seed' for rollback

create unique index if not exists advisor_directory_crd_uniq
  on advisor_directory (crd_number) where crd_number is not null;

-- attorney_listings: add claim token (advisors already have it) + verification + claim stamp
alter table attorney_listings
  add column if not exists claim_token text,
  add column if not exists claim_token_created_at timestamptz,
  add column if not exists credential_verified_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists source text;

create unique index if not exists attorney_listings_claim_token_uniq
  on attorney_listings (claim_token) where claim_token is not null;
```

Notes:
- `crd_number` unique-where-not-null mirrors the existing `bar_number` idempotency on attorneys.
- `credential_verified_at` is the **only** thing that drives the verified badge. `is_verified` keeps its existing "approved to display" meaning so the public directory queries are unchanged.
- `claimed_at` is the hook the trial follow-up fires from (manual now, drip-ready later).
- `source` tags the batch so the whole seed is one-command reversible.
- Attorney credential stays jurisdiction-scoped: keep using existing `bar_number` + `states_licensed[]`. Verification = "primary bar confirmed," not all jurisdictions.

---

## Part 2 — Importer (`scripts/import-directory-seed.ts`)

**Dry-run by default. Ref-guarded. Reads the two spreadsheets. State-parameterized. No WA hardcoding.**

### Invocation
```bash
# Default paths (gitignored — drop spreadsheets here after downloading from planning thread):
#   data/directory-seed/MWM_Attorney_Directory_Seed.xlsx
#   data/directory-seed/MWM_Advisor_Directory_Seed.xlsx

# staging dry-run (default — prints, writes nothing)
SUPABASE_DB_REF=cmzyxpxfyvdvbsykjvsg SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/import-directory-seed.ts \
    --attorneys ./data/directory-seed/MWM_Attorney_Directory_Seed.xlsx \
    --advisors  ./data/directory-seed/MWM_Advisor_Directory_Seed.xlsx

# commit (only after dry-run reviewed)
  ...same... --commit
```

### Behavior
1. **Ref guard** — refuse unless `SUPABASE_DB_REF` ∈ {staging, prod} and `SUPABASE_URL` contains it. Staging first, always.
2. **Parse** both spreadsheets (openpyxl/xlsx). Skip title/source/legend/total rows; ingest only data rows.
3. **State coverage assertion (the "all states covered" check, run as part of the dry run):**
   - Every row must resolve a `state`. If a sheet lacks an explicit state column, require a `--state WA` flag and stamp it; **never silently default to WA.**
   - Print a **per-state breakdown** before writing: `WA: 14 attorneys, 8 advisors` etc. This is the verification output — you eyeball that the states are what you expect and nothing is mis-stamped.
   - Fail the run if any row's state is empty/unrecognized.
4. **Map** spreadsheet columns → table columns:
   - Attorneys → `contact_name, firm_name, city, state, website/email, phone, specializations[]/credentials[]` (from Credentials/Notes), `bar_number` left **null** (claim-time), `is_active=true`, `is_verified=true`, `profile_id=null`, `submitted_by=null`, `source='outreach_seed'`, generate `claim_token`.
   - Advisors → `contact_name, firm_name, city, state, website (adv_link), email, credentials[]/specializations[]`, `crd_number` **null** (claim-time), `is_active=true`, `is_verified=true`, `profile_id=null`, `source='outreach_seed'`, generate `claim_token`. Let existing `referral_code` trigger fire.
5. **Idempotent upsert** on natural key `(lower(firm_name), lower(contact_name), state)` for run 1. Re-running updates, never duplicates. Once `bar_number`/`crd_number` populate via claims, prefer those as the key.
6. **Token generation** — cryptographically random `claim_token`, set `claim_token_created_at=now()`. These are what the outreach emails link to.
7. **Dry-run output** — per-state breakdown, insert/update counts, and the first few mapped rows (emails/phones masked), then `No changes written (dry run). Re-run with --commit.`
8. **Rollback** — document the one-liner: `delete from <table> where source='outreach_seed' and claimed_at is null;` (never delete claimed rows).

### Guardrails
- Leave the E2E fixtures (`e2eatt01`, `e2eadv01`) untouched — the natural key won't collide. (Decide separately whether to purge them on staging.)
- **All-publish:** every seed row gets `is_verified=true` immediately. Public-records facts display without credential badge until claim + `credential_verified_at`.

---

## Part 3 — Claim flow spec (`/claim/[token]`)

**One shared engine, branched by `type` (attorney | advisor). Free claim, never gated on credential number.**

> **Send-blocker:** Do not send any "claim it" outreach until this path ships alongside the importer. Importer alone makes "it's live" true; claim makes the CTA true.

### Shared skeleton (build once)
1. Token resolves to exactly one seeded row (attorney or advisor). Invalid/expired token → friendly error + "request a link" path.
2. **Identity:** confirm via email. Domain-match against the seeded email/website domain for firm domains; exact-match for free-mail; queue for **light manual review** if the firm is multi-professional (big-firm rows).
3. **Claim screen shows the listing as seeded** and makes the editable fields prominent — lead with "here's how you appear; update anything," because *correcting* converts better than *activating*.
4. On submit: set `profile_id`, stamp `claimed_at`, send **notify-you-on-claim**, show success state with a **soft, skippable trial mention** (a link, not a gate, not a checkout).
5. Credential number is **optional at claim** — "add it now or later." Supplying it sets nothing verified yet; it queues your confirm, which sets `credential_verified_at` → badge appears.

### Differs by type (same screen, branched surface)

| Aspect | Attorney | Advisor |
|--------|----------|---------|
| Value framing (top line) | Referral channel — "here's how households find and are routed to you" | The tool — "what running a client through the platform does for your book" |
| Credential field | **Primary bar state + bar number**, with "add another jurisdiction" (multi-state aware: Riffkin WA+NY+AK, Symmes WA+CO). Verify = primary bar confirmed. | **One national CRD** (FINRA). Single value verifies nationally. |
| Type-specific edit fields | `specializations[]`, `states_licensed[]`, `serves_remote`, `languages[]` | `is_fiduciary`, `minimum_assets`, `fee_structure`, `adv_link` |
| Identity review likelihood | Lower — list skews solo/boutique (unambiguous domain match) | **Higher** — big/acquired firms (LNW, Occidental satellite, Pure/Kaufman-Kampe); handle "claiming a firm listing as a named individual" cleanly |
| Post-claim trial pitch | Lower-key; a claimed-never-trialing attorney is still a valid referral endpoint | Leans into the founding trial — the tool *is* the relationship; keep working a claim-without-trial |

### Verification confirm (your side)
- Claim notification includes the supplied bar/CRD number → you do the easy **confirm-with-the-number** lookup (WSBA / FINRA BrokerCheck) → flip `credential_verified_at`. Badge renders from that timestamp.
- Hard-to-verify states don't stall anything: the claim already succeeded; only the badge waits.

---

## Build order

1. **Migration** (Part 1) — additive, state-agnostic.
2. **Importer** (Part 2) — dry-run on **staging**, review the **per-state breakdown** (this is the "all states covered" confirmation), then `--commit` staging, then prod.
3. **Claim flow** (Part 3) — **send-blocker** for any "claim it" email. Importer makes "it's live" true; the claim path makes "claim it in five minutes" true. Ship both before outreach.
4. **Then unpark:** Stripe sales-tax wiring (sandbox registration + `automatic_tax` + address), and the engine 13-state coverage audit.

### Pre-flight before implementation

- [x] Publish model: **all-publish** (locked 2026-06-30)
- [x] **Handoff:** spreadsheets in `data/directory-seed/` (gitignored; never commit PII)
- [x] **Fix in source file before import** — **Al signed off 2026-07-02; applied to gitignored XLSX:**
  - **Perkins Coie** → `Sarah B. Bowman` · `(206) 359-6195` · `sarah.bowman@ashurstperkins.com` · HIGH
  - **DWT** → `James A. Flaggert` (kept) · `(206) 757-8044` · `jimflaggert@dwt.com` · HIGH
  - **Occidental Bellevue** → `John Wilbourne` · Bellevue · `(866) 520-4985` · occidentalasset.com/seattle
  - **LNW** → `Brandon Smith, JD, LL.M.` (Option A — Director, Estate Planning) · HIGH
  - **Pure Mercer Island** → `Rachel Füss, CFP®` · `(206) 710-9309` · MEDIUM
- [x] Staging dry-run reviewed 2026-07-02: **WA: 14 attorneys, 8 advisors** — would insert 1 attorney (Sarah B. Bowman), update 13 attorneys, insert 8 advisors
- [ ] Staging `--commit` after dry-run sign-off
- [ ] Outreach send-tracking migration applied on staging (`20260802120000_directory_outreach_send_tracking.sql`) before sender `--commit`
- [x] Claim flow live before any "claim it" email sends (#206–#213 on staging)

### Route naming

- **`/claim/[token]`** — professional outreach claim (this plan). Resolves seeded `claim_token` on directory row.
- **`/claim-listing/[token]`** — existing consumer connection-request claim. Different concept; do not merge paths.
