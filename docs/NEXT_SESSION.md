# NEXT_SESSION.md — session handoff

**Last updated:** 2026-06-27

---

## Start here

**Working list:** [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) — step off items one-by-one while B&O ruling is pending.

**Blocked on external:** WA B&O / DAS ruling (Bucket A) — do **not** set `PUBLIC_SIGNUP_OPEN=true` until cleared.

**Deferred to first-state nexus:** counsel ToS §10/§11 + privacy policy redline (not active pre-flip work).

---

## Current state (2026-06-27)

| Area | Status |
|------|--------|
| Tier-restructure prod cutover steps 0–5 | ✅ Complete |
| Real-card live smoke + C-4 billing | ✅ Al / 2026-06-27 |
| Prod SMTP (signup confirm) | ✅ Resend 200 |
| Track 2 prod smoke (#170) | ✅ Merged `63df4fa8` · 31 passed · 3 skips |
| `avoels@outlook.com` | ✅ Reset — tier 1, no household, ready for login re-walk |
| B&O ruling | ⏳ Waiting |
| Flip (`PUBLIC_SIGNUP_OPEN=true`) | 🚫 Blocked on B&O |

---

## Paste block (first message in Cursor)

> My Wealth Maps — **pre-flip prep, B&O-blocked.** Tier-restructure cutover **steps 0–5 done** (real-card smoke + C-4 + SMTP). **#170** prod smoke fixes on `main` (`63df4fa8`). **`avoels@outlook.com`** reset to tier 1 for manual onboarding re-walk — no fresh signup needed.
>
> **Work from:** [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) — next up: `release:post-deploy`, prod smoke re-bank, PITR, email/drip smokes, billing edge paths.
>
> **Not active:** counsel (first-state nexus) · fresh-email signup validation · flip until B&O clears.
>
> **Canonical:** [LAUNCH.md](./LAUNCH.md) · [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md) · [pre-billing-run-sheet.md](./pre-billing-run-sheet.md)

---

## Canonical docs

| Doc | Role |
|-----|------|
| [LAUNCH.md](./LAUNCH.md) | Single source of truth / Bucket A–C |
| [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md) | Consolidated hard vs should-clear |
| [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) | **Ordered step-off list** |
| [pre-billing-run-sheet.md](./pre-billing-run-sheet.md) | Gates A/B + billing attestation |
| [prod-smoke-canary-runbook.md](./prod-smoke-canary-runbook.md) | Prod canary + isolation |
| [ROADMAP.md](./ROADMAP.md) | Shipped history |

---

## Standing rules

1. Calculation / tax work → read [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) first.
2. CST strings → import from `lib/constants/strategyTypes.ts`.
3. Prod writes → never CI; `--confirm` scripts only with `.env.projects.local`.
4. Migrations → per-environment pairing ([DEPLOYMENT.md](./DEPLOYMENT.md)).
