# NEXT_SESSION.md — session handoff

**Last updated:** 2026-06-29

---

## Start here

**Pre-flip engineering:** [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) — PITR propagation + Upstash + B&O block the flip.

**GTM while waiting:** [LAUNCH_START_HERE.md](./LAUNCH_START_HERE.md) — advisor/attorney outreach unblocked now; consumer pilots gated on MHMD + GRAT/Roth.

**Blocked on external:** WA B&O / DAS ruling (Bucket A) — do **not** set `PUBLIC_SIGNUP_OPEN=true` until cleared.

**Deferred to first-state nexus:** counsel ToS §10/§11 + privacy policy redline (not active pre-flip work).

---

## Current state (2026-06-29)

| Area | Status |
|------|--------|
| Tier-restructure prod cutover steps 0–5 | ✅ Complete |
| Prod smoke + post-deploy attestation | ✅ 34/34 · Voels 8/8 (2026-06-27) |
| Pre-flip verify items 5–8 | ✅ Scripts + #182/#183 on main |
| Onboarding re-walk (`avoels@outlook.com`) | ✅ Wizard + checkout (2026-06-29) |
| MC edge + MFJ fix | ✅ Deployed staging + prod |
| `public` RPC `search_path` | ✅ #184/#185 · main `91ef60e5` |
| PITR | 🔄 Enabled + Small plan · propagating — `npm run check:pitr-prod` |
| Upstash Redis (prod) | ⬜ Not set |
| B&O ruling | ⏳ Waiting |
| Flip (`PUBLIC_SIGNUP_OPEN=true`) | 🚫 Blocked on B&O |

---

## Paste block (first message in Cursor)

> My Wealth Maps — **pre-flip prep, B&O-blocked.** Cutover **0–5 done** · prod smoke **34/34** · items **5–8 attested** · onboarding re-walk **done** · MC edge + **search_path migration** on main (`91ef60e5`).
>
> **Open before flip:** PITR propagation (`check:pitr-prod`) · Upstash on prod · B&O ruling.
>
> **Work from:** [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md)
>
> **Not active:** counsel (first-state nexus) · fresh-email signup until AT-FLIP.
>
> **Canonical:** [LAUNCH.md](./LAUNCH.md) · [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md)

---

## Canonical docs

| Doc | Role |
|-----|------|
| [LAUNCH.md](./LAUNCH.md) | Single source of truth / Bucket A–C |
| [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md) | Consolidated hard vs should-clear |
| [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) | **Ordered pre-flip step-off list** |
| [LAUNCH_START_HERE.md](./LAUNCH_START_HERE.md) | Gate map + GTM / post-flip doc index |
| [GTM_FIRST_WAVE.md](./GTM_FIRST_WAVE.md) | First-wave outreach + founding-member pilots |
| [POST_LAUNCH_REMAINING.md](./POST_LAUNCH_REMAINING.md) | Post-flip deferred backlog (P0–P3) |
| [MHMD_COMPLIANCE_DELTA.md](./MHMD_COMPLIANCE_DELTA.md) | WA MHMD compliance (conditional on counsel) |
| [pre-billing-run-sheet.md](./pre-billing-run-sheet.md) | Gates A/B + billing attestation |
| [prod-smoke-canary-runbook.md](./prod-smoke-canary-runbook.md) | Prod canary + isolation |
| [ROADMAP.md](./ROADMAP.md) | Shipped history |

---

## Standing rules

1. Calculation / tax work → read [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) first.
2. CST strings → import from `lib/constants/strategyTypes.ts`.
3. Prod writes → never CI; `--confirm` scripts only with `.env.projects.local`.
4. Migrations → per-environment pairing ([DEPLOYMENT.md](./DEPLOYMENT.md)).
