# NEXT_SESSION.md — session handoff

**Last updated:** 2026-07-02 (attorney settings practice profile PR → staging)

---

## Start here

**Attorney settings practice profile:** `[~]` PR → **`staging`** — `/attorney/settings` practice section + paid-consumer gate (2nd billable client or consumer paid sub; first free client exempt). Spec: [ATTORNEY_SETTINGS_CREDENTIALS_SPEC.md](./ATTORNEY_SETTINGS_CREDENTIALS_SPEC.md).

**Attorney connection billing:** ✅ **Closed** — step-4 spine proven.

**Claim v2:** ✅ **Closed on staging** (#206–#213). **Promotion PR #215** open (`staging` → `main`).

**GTM WA first wave (in progress):** WA seed committed (#230 credentials column + re-import). Next: sender test `--commit`, compliance sign-off.

---

## Current state (2026-07-02)

| Area | Status |
|------|--------|
| Attorney settings practice profile | `[~]` | PR → staging — UI + gate + docs |
| Section A pricing (#216–#218) | ✅ On staging |
| Section C copy (#220) | ✅ On staging |
| Outreach sender (#221) | ✅ Merged |
| WA directory seed (#230) | ✅ Import + `credentials[]` on staging |
| Sender test `--commit` | `[~]` |
| Compliance sign-off (outreach copy) | `[ ]` |
| Prod connection billing flip | 🚫 After promotion — [PRE_FLIP_CHECKLIST.md](./PRE_FLIP_CHECKLIST.md) |

---

## Handoff (fresh chat)

**Proven on staging:** connection billing, claim v2, directory seed importer, attorney portal connection-billing UX (#229).

**Next:** merge attorney practice-profile PR → staging smoke (`/attorney/settings`, accept-request gate on 2nd client). GTM: outreach test send. Backlog: dismissible directory-profile nudge for ungated incomplete listings.

---

## Paste block (first message in Cursor)

> My Wealth Maps — attorney **practice profile** PR on staging (settings UI + paid-consumer gate). Smoke `/attorney/settings` save + requests accept on 2nd client. GTM: outreach `--commit` test send when ready. Promotion #215 when staging green.

---

## Canonical docs

| Doc | Role |
|-----|------|
| [ATTORNEY_SETTINGS_CREDENTIALS_SPEC.md](./ATTORNEY_SETTINGS_CREDENTIALS_SPEC.md) | Practice profile fields + paid-consumer gate |
| [GTM_FIRST_WAVE.md](./GTM_FIRST_WAVE.md) | First-wave outreach |
| [DECISION_LOG.md](./DECISION_LOG.md) | Settled decisions |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Staging-first branch flow |

---

## Standing rules

- Feature PRs → **`staging`** first; promote `staging` → `main` only when green.
- Do not run staging integration tests against live URL until code is on **`staging`**.
