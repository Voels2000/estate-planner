# Launch Doc Consolidation + Verification Sweep — Cursor Prompts

Two prompts, run in order. Prompt 1 stops the drift (3 ephemeral docs → 1 `LAUNCH.md`).
Prompt 2 systematically checks off items against real evidence.

**Hard rule for both prompts:** do NOT read, edit, or fold anything into the durable
master docs — `MASTER_ARCHITECTURE.md`, `CALCULATION_ENGINES.md`, `DECISION_LOG.md`,
`ROADMAP.md`. They have a different lifespan. This work touches launch docs only.

---

## Checkbox vocabulary for LAUNCH.md

```
[x]  done — evidence recorded inline (command output, file:line, or attestation)
[ ]  open
```
Append exactly one tag where relevant:
```
(verify: <command or file:line>)   ← code-verifiable; box gets checked only when this passes
(attest: ____ / YYYY-MM-DD)        ← ops fact not in repo; only a human checks this, with initials+date
(B&O-blocked)                      ← cannot complete until the WA DAS/B&O ruling lands
```

The whole goal is a single status: **B&O-READY** = every box checked except
`(B&O-blocked)` items and the Gate 2 flip sequence.

---

# PROMPT 1 — Consolidate the three launch docs (de-drift)

```
Phase 0 — READ ONLY. Do not write, edit, move, or delete anything yet.

1. Locate the three ephemeral launch docs (do not assume paths):
   - git ls-files | grep -iE 'LAUNCH_CHECKLIST|LAUNCH_GATE|RELEASE_ROUTINE'
   Read each in full.

2. Build a complete inventory of every checkbox item across all three files.
   For each item report: source file, line number, current [ ]/[x] state, and the
   bucket it belongs to (A/B/C/D below).

3. Flag DUPLICATES (same item in 2+ files) and CONFLICTS (checked in one file,
   unchecked in another). I already know of at least:
   - TERMS-1 signup checkbox (CHECKLIST says shipped, GATE says open)
   - robots.txt / sitemap (GATE has it open; app/robots.ts already allows public routes)
   List every other dup/conflict you find.

4. Grep the rest of the repo for references to these three filenames so we know
   what we'll break when we archive them:
   - git grep -lE 'LAUNCH_CHECKLIST|LAUNCH_GATE|RELEASE_ROUTINE'

STOP after Phase 0. Print the inventory + dup/conflict list + reference list.
Wait for my confirmation before writing anything.

--- After I confirm, IMPLEMENT: ---

5. Create LAUNCH.md (same directory as the current launch docs) using the
   four-bucket structure in the appendix at the bottom of this prompt. Migrate
   every UNIQUE item into the correct bucket. Dedupe.

6. Resolution rule for conflicts: take the MORE-COMPLETE state ONLY if there is
   in-repo evidence for it (e.g. robots.ts confirms the robots item is done).
   If completion depends on an ops/external fact (Stripe live keys, bank, EIN,
   counsel), DO NOT check it — carry it as open with the (attest: ...) tag.
   If a conflict can't be resolved from the repo, leave it [ ] and add a
   "// CONFLICT — confirm manually" note. Never silently pick "done."

7. Fold in the known doc-drift fixes:
   - robots/sitemap item → checked, evidence: app/robots.ts:<line>
   - canonical seed path is `npm run seed:e2e` only; remove any seed-test-*.ts refs
   - replace the stale "76 migrations" count with: "(run `npx supabase db push`
     / dashboard compare before flip — count not pinned in doc)"
   - TERMS-1 → leave as (verify: ...) for Prompt 2 to resolve, do not guess

8. Carry the Gate 2 flip sequence and Gate 3/Gate 4 sections VERBATIM into
   buckets C and D. Do not reword the flip order — it's order-sensitive.

9. Archive the old docs (preserve history, reversible):
   git mv LAUNCH_CHECKLIST.md  docs/archive/LAUNCH_CHECKLIST.md
   (same for LAUNCH_GATE.md, RELEASE_ROUTINE.md — use their real paths)
   Add a one-line header to each archived file: "ARCHIVED <date> — superseded by LAUNCH.md".

10. Update every reference found in step 4 to point at LAUNCH.md.

11. Verify: `git grep -lE 'LAUNCH_CHECKLIST|LAUNCH_GATE|RELEASE_ROUTINE'` should
    return only the archived files themselves. Report the result.

12. Atomic commit:
    git commit -m "docs: consolidate launch docs into single LAUNCH.md, archive
    LAUNCH_CHECKLIST/LAUNCH_GATE/RELEASE_ROUTINE, fix robots/seed/migration drift"

Do NOT touch MASTER_ARCHITECTURE.md, CALCULATION_ENGINES.md, DECISION_LOG.md, ROADMAP.md.
Report exact file paths and line numbers for every change.
```

### Appendix — LAUNCH.md target structure

```markdown
# LAUNCH.md — single source of truth for go-live

Status target before launch: **B&O-READY**
= every box below checked EXCEPT (B&O-blocked) items and Bucket C (flip sequence).
When the WA DAS/B&O ruling lands: resolve Bucket A, then run Bucket C in order.

## Bucket A — Blocked by the B&O / WA SaaS-DAS ruling (small, by design)
- [ ] WA SaaS / DAS sales-tax position finalized (the ruling itself) (B&O-blocked)
- [ ] Stripe Tax: collect WA sales tax at checkout — on/off decision (B&O-blocked)
- [ ] ToS tax-treatment section (§13?) — counsel pre-drafts BOTH branches now;
      one-line swap when ruling lands (B&O-blocked for final selection)

## Bucket B — Do-now, fully completable BEFORE the ruling
### B1. Redeploy + automated smoke (do first)
- [ ] Vercel redeploy of latest main (49552c8 or newer) (attest: __ / __)
- [ ] npm run release:preflight  (verify: command green)
- [ ] npm run test:e2e:go-live-profile  (verify: 17 passing)
- [ ] npm run test:e2e:security-isolation  (verify: green)
- [ ] npm run test:e2e:cross-role  (verify: green)
- [ ] npm run release:post-deploy  (verify: green)
- [ ] npm run test:e2e:prod:smoke -- --workers=1  (verify: 42 @production passing)
### B2. TERMS-1
- [ ] signup checkbox sets terms_accepted_at  (verify: signup component grep)
### B3. CI discipline
- [ ] E2E_SMOKE_IN_CI=true + staging secrets  (verify: CI yml)
- [ ] RLS_VERIFY_IN_CI=true  (verify: CI yml)
- [ ] branch protection on main: verify, e2e-smoke, rls-verify  (verify: gh api / settings)
### B4. Manual smokes (run before any DB purge)
- [ ] Prospect + Mobile (19 steps, Track 1 before Track 2)  (attest: __ / __)
- [ ] Health Score + Advisor Playbook (18 steps)  (attest: __ / __)
- [ ] PDF narrative engine (9 steps)  (attest: __ / __)
- [ ] Drip production smoke (assess → step 1 → cron steps 2/3)  (attest: __ / __)
### B5. Stripe (code wired; live config is ops-attested)
- [ ] Live keys in Vercel Production (sk_live_/pk_live_/live whsec_)  (attest via `vercel env ls`: __ / __)
- [ ] Live catalog: 6 consumer + attorney starter/growth (+advisor seats if billing at launch)  (attest: __ / __)
- [ ] Live price IDs present in env (STRIPE_PRICE_*/_ATTORNEY_*/_ADVISOR_*)  (verify: `vercel env ls` names present)
- [ ] C-4 manual walkthrough on prod: signup→checkout→active→cancel→deletion schedule  (attest: __ / __)
- [ ] One real-card live smoke, smallest tier, refund/cancel after verify  (attest: __ / __)
### B6. Legal / entity (ops-attested, ex-tax)
- [ ] Counsel sign-off ToS §10, §11  (attest: __ / __)   ← §13 is in Bucket A
- [ ] WA LLC UBI / EIN / registered agent confirmed on SOS  (attest: __ / __)
- [ ] Business bank account open  (attest: __ / __)
- [ ] B&O / DOR account registered  (attest: __ / __ — confirm w/ accountant this is OK pre-ruling)
- [ ] Email aliases security@, legal@ live (privacy@ routed)  (attest: __ / __)
### B7. Pre-flip cleanup — RUN LAST, never now
- [ ] Verify PROTECTED list in scripts/cleanup-test-accounts.ts BEFORE running purge.
      Confirm it contains: avoels, stephen.a.voels, david (and any real/seed accounts
      that must survive launch). Report the exact current PROTECTED array — do not
      assume it matches prior sessions; david's status has flip-flopped before.
      (verify: read GO_LIVE_PROTECTED + CANONICAL_PROTECTED + ROLOBE_PROTECTED_FROM_LEGACY)
- [ ] Confirm purge safety guards (verify: read cleanup-test-accounts.ts — e.g. dry-run
      default, interactive confirm without --yes, and whether a production URL / --force
      gate exists today; report file:line — do not assume from memory)
- [ ] Only then: cleanup:purge → seed:e2e → compliance SQL  (attest: __ / __)

## Bucket C — Gate 2 flip sequence (DO NOT run until B&O-READY) [verbatim from LAUNCH_GATE]
<carry the exact ordered flip steps here, unchanged>

## Bucket D — Post-go-live + ongoing [verbatim from LAUNCH_GATE Gate 3 + RELEASE_ROUTINE Gate 4]
<carry Gate 3 72h checks and the after-every-deploy routine here, unchanged>
```

---

# PROMPT 2 — Verification sweep (check off what's actually done)

```
Goal: drive LAUNCH.md to B&O-READY. Walk Bucket B in the order below. For each
item: if it's (verify: ...), RUN the check and only then flip [ ]→[x] with the
evidence recorded inline. If it's (attest: ...), DO NOT auto-check — leave it for
me, but tell me exactly what to confirm. Never check a box without evidence.

Order (do not reorder — purge must stay last):

1. B2 TERMS-1:
   - Find the signup form component (grep for 'signup' / 'terms_accepted_at').
   - Confirm the checkbox writes terms_accepted_at on submit. Report file:line.
   - If confirmed → check the box, evidence = file:line. If not → leave open, tell me what's missing.

2. B3 CI discipline:
   - Open the CI workflow file(s) (.github/workflows/*). Confirm E2E_SMOKE_IN_CI
     and RLS_VERIFY_IN_CI are set true and the jobs exist. Report file:line each.
   - For branch protection: run `gh api repos/:owner/:repo/branches/main/protection`
     if gh is authed; confirm required checks = verify, e2e-smoke, rls-verify.
     If gh isn't available, mark (attest: ...) and tell me to check GitHub settings.

3. B5 Stripe — split verify vs attest:
   - VERIFY (repo/env): run `vercel env ls` (or read the documented env contract)
     and confirm the STRIPE_PRICE_* / _ATTORNEY_* / _ADVISOR_* var NAMES exist in
     Production. Confirm lib/billing/stripePrices.ts references them. Report findings.
   - ATTEST (cannot verify from repo): live keys actually populated, live catalog
     built in Stripe dashboard, C-4 walkthrough done, real-card smoke done.
     For each, print a one-line "Confirm: ____" for me. Do not check these.
   NOTE: the prior status summary said live Stripe config was the LARGEST open gap.
   Do not assume it's done — make me attest each line explicitly.

4. B1 Redeploy + automated smoke:
   - These require a live deploy and prod URL. Print the exact commands in order.
     Run any that are safe to run locally (release:preflight, the go-live-profile /
     security-isolation / cross-role e2e suites). Report pass/fail counts.
   - The prod-only ones (post-deploy, prod:smoke) — run if PLAYWRIGHT_BASE_URL is
     set, else mark (attest: ...) and give me the command.

5. B4 Manual smokes: these are human walkthroughs — print the checklist step counts
   and mark each (attest: __ / __). Do not check.

6. B6 Legal/entity: all (attest: ...). Print a confirm line for each. Do not check.
   Flag the B&O/DOR-registration line: note it MAY be doable pre-ruling but I should
   confirm sequencing with my accountant.

7. B7 purge: DO NOT run. Leave all three B7 boxes open. First sub-item only:
   - Read scripts/cleanup-test-accounts.ts and print the full effective PROTECTED list
     (GO_LIVE_PROTECTED + CANONICAL_PROTECTED + ROLOBE_PROTECTED_FROM_LEGACY).
   - Note any ambiguity (e.g. david@gmail.com vs david@rolobe.resend.app — both may
     appear; only the latter is deleted via --rolobe, not --purge-unprotected).
   - Report whether a production URL / --force refuse guard exists in the live script
     (do not assume — grep the file).
   Add a note on the purge line: "run only immediately before Gate 2, after all B4
   manual smokes pass and PROTECTED re-verified, to avoid re-seeding test junk."

After the sweep:
- Print a B&O-READY scoreboard: X of Y Bucket-B boxes checked; list every remaining
  open item grouped by (verify-still-failing) vs (attest-needed-from-Al).
- Update LAUNCH.md with all verified checks + evidence.
- Atomic commit: "docs(launch): verification sweep — check verified items, evidence inline"

Do NOT touch MASTER_ARCHITECTURE.md, CALCULATION_ENGINES.md, DECISION_LOG.md, ROADMAP.md.
Do NOT check any (attest) box. Do NOT run B7 purge.
```
