# E2E & release test plan

Maps [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) to Playwright specs and manual-only steps.
**Strategy:** Automate contracts (auth, APIs, routes, recompute signals); keep human sign-off for copy, visual math, and complex UI flows.

**Production URL:** https://mywealthmaps.com  
**Staging URL:** https://estate-planner-gules.vercel.app  
**Consumer account:** `david@rolobe.resend.app` (estate tier) · **Advisor:** `advisor2@rolobe.resend.app`

**Sprint 15 post-cutover (2026-05-24):** Core §1–3 passed on production. **Sprint 17 (2026-06-02):** Compliance code C-2b–C-5 closed on `main`. Remaining before open signups: [LEGAL_TODO.md](./LEGAL_TODO.md), C-4 manual Stripe walkthrough, go-live day Supabase Auth + `PUBLIC_SIGNUP_OPEN=true` + Core §1–3 smoke with fresh email (signup → confirm → login).

**Run automated:**
```bash
dotenv -e .env.test -- npx playwright test --project=consumer
dotenv -e .env.test -- npx playwright test --project=advisor
dotenv -e .env.test -- npx playwright test --project=public
```

**Staging recompute:** Verified May 2026 — `consumer-core-recompute` passing (~15.5s). If tests time out after deploy, see [NEXT_SESSION.md](./NEXT_SESSION.md).

**Sprint 14 manual smoke (2026-05-23):** Core §1–7 passed; bugs logged — Admin Portal in consumer sidebar, asset form save below viewport (fix before launch).

---

## Approach: right split

| Layer | Tool | When |
|-------|------|------|
| **Living contracts** | Playwright API + UI smoke | Every deploy / CI — fast, deterministic |
| **Release smoke** | Manual checklist | Sprint 14 sign-off, post-major planning changes |
| **Regression** | Full E2E suite (51+ tests) | Staging before launch; re-run after fixes |

Do **not** duplicate API coverage with slow UI tests. Prefer `request` fixture tests for CRUD; UI tests for login shell, one end-to-end save path, and tier gates.

---

## Consumer — Core §1–3 (manual doc)

### §1 Login and dashboard

| Step | Automatable? | Existing coverage | Net-new (recommended) |
|------|--------------|-------------------|------------------------|
| 1.1 Login → `/dashboard` | ✅ | `helpers/consumer.setup.ts` (used by all consumer specs) | Optional: assert redirect in `dashboard.spec.ts` from cold start |
| 1.2 Greeting + readiness 0–100 | ⚠️ Partial | `dashboard.spec.ts` — greeting; estate section OR fallback | Assert numeric score regex when household complete |
| 1.2b Conflict banner | ❌ Manual | — | Only if test household has conflicts |
| 1.3 Net worth + estate summary | ⚠️ Partial | Net worth visible | Estate summary dollar amounts — manual |
| 1.4 Sidebar footer (Advisor, Attorney, Subscription) | ✅ | — | `getByRole('link', { name: /My Advisor/ })` etc. |
| 1.4b Overview nav (Profile, Estate Summary only) | ✅ | — | Assert Find Advisor **not** in Overview group |
| 1.4c “Your plan” badge on unlocked group | ⚠️ | — | Assert badge visible for estate-tier household |

### §2 Financial save + recompute

| Step | Automatable? | Existing coverage | Net-new (recommended) |
|------|--------------|-------------------|------------------------|
| 2.1 `/assets` loads | ✅ | `dashboard.spec.ts` — assets heading | — |
| 2.2–2.3 Add/edit asset, no error | ⚠️ API ✅ UI ❌ | `consumer-financial-writes.spec.ts` — POST/PATCH/DELETE assets | **One UI test:** add “Smoke Test CD”, assert row; or poll `estate_health_scores.computed_at` after POST (pattern from `consumer-gift-history.spec.ts`) |
| 2.4 Dashboard reflects change | ✅ | `consumer-core-recompute.spec.ts` | Asset POST → `computed_at` poll (15s) → dashboard net worth or readiness > 0 |
| Optional income/expenses | ✅ API | Same file — income/expenses routes | Skip UI unless regression |

### §3 Profile save

| Step | Automatable? | Existing coverage | Net-new (recommended) |
|------|--------------|-------------------|------------------------|
| 3.1 `/profile` loads | ✅ | `dashboard.spec.ts` | — |
| 3.2 Save harmless field | ⚠️ | — | PATCH profile API test or UI fill + save |
| 3.3 Dashboard still loads | ✅ | `page.goto('/dashboard')` not 500 | — |

**Note:** Core §3 is **Profile save**, not “planning surfaces.” Planning routes are in §4–7 and optional §8–11.

---

## Consumer — Estate §4–7

| Section | API tests | UI tests | Manual |
|---------|-----------|----------|--------|
| **§4 Health check** | `consumer-api-writes.spec.ts` — PUT estate-health-check | — | Redirect + score **meaning** |
| **§5 My Family** | — | — | Full CRUD modal flow |
| **§6 Titling** | `consumer-titling.spec.ts` — API smoke | — | Beneficiary % UI |
| **§7 Allocation** | `consumer-api-writes.spec.ts` — valid/invalid sum | — | Slider UX |
| **§8–11 Strategy** | `consumer-strategy-writes.spec.ts`, `consumer-trust-crud.spec.ts`, `consumer-gift-history.spec.ts` | Partial | SLAT/ILIT/DAF panels, copy labels |

**High-value automations to add in Sprint 14:**
1. ~~`consumer-core-recompute.spec.ts`~~ — **Shipped:** POST asset → poll `computed_at` → dashboard assertion.
2. `consumer-routes-estate-tier.spec.ts` — GET `/my-family`, `/titling`, `/allocation`, `/my-estate-strategy` → 200, no UpgradeBanner for tier-3 storage state.
3. `consumer-profile-save.spec.ts` — PATCH profile field via API or minimal UI.

---

## Consumer — Acquisition A–G

**Status:** Passed manual staging (Sprint 13).

| Section | Automate? | Suggestion |
|---------|-----------|------------|
| A–D Referral + signup | ⚠️ Partial | `public.spec.ts` event 200; API tests for `POST /api/referral/track`; signup attribution needs new spec + disposable email |
| E Drip step 1 | ❌ | Resend inbox or Supabase `drip_step_1_sent_at` query script |
| F Life-event on connect | ❌ | Two-role manual or scripted Supabase + advisor UI |
| G Event slugs 200 | ✅ | Extend `public.spec.ts` — loop 24 slugs |

---

## Advisor — automated test plan

### Already covered

| Area | Spec |
|------|------|
| Login / session | `helpers/advisor.setup.ts` |
| Dashboard + client list | `advisor/overview.spec.ts` |
| Client tabs (Strategy, Tax, Estate, Documents) | `overview.spec.ts`, `strategy-tax-estate.spec.ts`, `regression.spec.ts` |
| Presets API/UI | `advisor-presets.spec.ts` |
| Strategy recommendation | `advisor-strategy-recommendation.spec.ts` |
| Analytics / domicile | `analytics-alerts-domicile.spec.ts` |

### Gaps vs launch needs

| Scenario | Priority | Approach |
|----------|----------|----------|
| Newsletter kit `?ref=` links render | P2 | UI: `/advisor` → Newsletter Kit section contains `/event/` + `?ref=` |
| Retirement tab RMD age by birth year | P1 | UI on Michael Johnson client: born 1960 → copy contains **75** not only 73 |
| Accept connection + life-event banner | P2 | Manual (F) or seed + API accept-request |
| Referral clicks for advisor listing | P2 | API `POST /api/referral/track` with `test-advisor` code |
| Attorney portal parity | P3 | Mirror advisor kit test on `/attorney` with `?aref=` |

---

## Recommended CI matrix

| Project | Purpose | Gate |
|---------|---------|------|
| `consumer-setup` + `consumer` | Consumer APIs + dashboard | Required on PR |
| `advisor-setup` + `advisor` | Advisor client views | Required on PR |
| `public` | Public/event routes | Required on PR |
| Manual Core 1–3 + Estate 4–7 | Release sign-off | Sprint 14 checklist |

---

## Manual-only (do not force automation)

- Correctness of **computed dollar amounts** (not just presence of numbers)
- Empty-state CTA lists (TIER2 vs TIER3) — snapshot tests possible but brittle
- Marketing **copy** accuracy (e.g. RMD 72–75 range on event page)
- Drip emails 2–3 schedule and inbox content
- Cross-role flows (consumer connects → advisor sees life event)

---

## Related docs

- [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) — human checklist
- [CONSUMER_FLOWS.md §7](./CONSUMER_FLOWS.md#7-e2e-map-living-contracts) — spec index
- [NEXT_SESSION.md](./NEXT_SESSION.md) — Sprint 14 task + test accounts
