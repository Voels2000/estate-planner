# E2E & release test plan

Maps [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) to Playwright specs and manual-only steps.
**Strategy:** Automate contracts (auth, APIs, routes, recompute signals); keep human sign-off for copy, visual math, and complex UI flows.

**Production URL:** https://mywealthmaps.com  
**Staging URL:** https://estate-planner-gules.vercel.app  
**Consumer account:** `e2e-consumer@mywealthmaps.test` (estate tier) · **Advisor:** `e2e-advisor@mywealthmaps.test` — see [E2E_TEST_RESET.md](./E2E_TEST_RESET.md) · `npm run seed:e2e`

**Sprint 15 post-cutover (2026-05-24):** Core §1–3 passed on production. **Sprint 17 (2026-06-02):** Compliance code C-2b–C-5 closed; legal + go-live ops remain. **Sprint P-1 (2026-06-02):** Perf quick wins `5c24160`; indexes applied in prod. **Sprint F-2 (2026-05-25):** Import UX `9b524aa`; automated import tests `a344032`.

**Complete suite (May 2026):** **253 tests** — [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md). Staging verification **2026-05-25** (`estate-planner-gules.vercel.app`, `--workers=1`): consumer **127 passed / 5 skipped**; advisor **45 passed**; public **57 passed / 2 skipped**; attorney requires `seed-test-attorney.ts` on target env.

**Run automated:**
```bash
npm run test:e2e:complete -- --workers=1
# Or per project:
npm run test:e2e:consumer -- --workers=1
npm run test:e2e:advisor -- --workers=1
npm run test:e2e:public
npm run test:e2e:attorney    # after seed-test-attorney.ts
npm run test:import:unit
npm run test:import:api      # localhost:3001 + tier 2+ user; F-2 migration on test DB
```

**Staging recompute:** Verified May 2026 — `consumer-core-recompute` passing (~15.5s). If tests time out after deploy, see [NEXT_SESSION.md](./NEXT_SESSION.md).

**Sprint 14 manual smoke (2026-05-23):** Core §1–7 passed; bugs logged — Admin Portal in consumer sidebar, asset form save below viewport (fix before launch).

---

## Approach: right split

| Layer | Tool | When |
|-------|------|------|
| **Living contracts** | Playwright API + UI smoke | Every deploy / CI — fast, deterministic |
| **Release smoke** | Manual checklist | Sprint 14 sign-off, post-major planning changes |
| **Regression** | Full E2E suite (**253 tests**) | Staging before launch; `--workers=1` on shared DB |

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
| 1.4 Sidebar footer (Advisor, Attorney, Subscription) | ✅ | `consumer-sidebar-navigation.spec.ts` | — |
| 1.4b Overview nav (Profile, Estate Summary only) | ✅ | `consumer-sidebar-navigation.spec.ts` | — |
| 1.4c “Your plan” badge on unlocked group | ⚠️ | — | Optional — estate-tier household |

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
| 3.1 `/profile` loads | ✅ | `dashboard.spec.ts`, `consumer-route-regression` | — |
| 3.2 Save harmless field | ✅ | `consumer-profile-save.spec.ts` | API + UI household name |
| 3.3 Dashboard still loads | ✅ | `consumer-profile-save.spec.ts` | — |

**Note:** Core §3 is **Profile save**, not “planning surfaces.” Planning routes are in §4–7 and optional §8–11.

---

## Consumer — Estate §4–7

| Section | API tests | UI tests | Manual |
|---------|-----------|----------|--------|
| **§4 Health check** | `consumer-api-writes.spec.ts` — PUT estate-health-check | — | Redirect + score **meaning** |
| **§5 My Family** | `consumer-family-crud.spec.ts` — API CRUD | `/my-family` load | Full modal UI optional |
| **§6 Titling** | `consumer-titling.spec.ts` + `consumer-titling-real-asset.spec.ts` | `/titling` load | Beneficiary % UI |
| **§7 Allocation** | `consumer-api-writes.spec.ts` — valid/invalid sum | — | Slider UX |
| **§8–11 Strategy** | `consumer-strategy-writes.spec.ts`, `consumer-trust-crud.spec.ts`, `consumer-gift-history.spec.ts` | Partial | SLAT/ILIT/DAF panels, copy labels |

**High-value automations (Sprint 14+ complete suite):**
1. ~~`consumer-core-recompute.spec.ts`~~ — POST asset → poll `computed_at` → dashboard assertion.
2. ~~`consumer-routes-estate-tier.spec.ts`~~ — Estate-tier routes without upgrade banner; `/trust-will` redirect.
3. ~~`consumer-profile-save.spec.ts`~~ — PATCH profile + UI household name save.
4. ~~`consumer-sidebar-navigation.spec.ts`~~ — Sidebar/footer contract (smoke §1.4).
5. ~~`consumer-route-regression.spec.ts`~~ — Full nav map route loads.
6. ~~`consumer-ui-asset-save.spec.ts`~~ — UI add asset on `/assets`.
7. ~~`public-routes.spec.ts`~~ — Marketing + all event slugs.
8. ~~`public-referral-track.spec.ts`~~ — Referral track API.
9. ~~`attorney-portal.spec.ts`~~ — Attorney project + setup.
10. See [PLAYWRIGHT_E2E.md](./PLAYWRIGHT_E2E.md) for full spec index.

---

## Consumer — Import (Sprint F-1 + F-2)

| Layer | Command / doc | Coverage |
|-------|----------------|----------|
| **Unit** | `npm run test:import:unit` | Header row detection, Excel `sheet_names`, alias matching (`tests/unit/import-parse.spec.ts`) |
| **API** | `npm run test:import:api` | Preamble parse, broker aliases, inline edit commit, duplicate 409/skip, `ingestion_job_id` traceability (`tests/e2e/consumer/consumer-import.spec.ts`) |
| **Manual** | [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) I.1–I.9 | Tier gate, templates, full UI path; I.5–I.9 optional when API suite green |

**Prereqs:** F-2 migration on test DB; `.env.test` with tier 2+ consumer; optional `SUPABASE_SERVICE_ROLE_KEY` for API cleanup.

---

## Consumer — Acquisition A–G

**Status:** Passed manual staging (Sprint 13).

| Section | Automate? | Suggestion |
|---------|-----------|------------|
| A–D Referral + signup | ⚠️ Partial | `public-referral-track.spec.ts` (API + event load); `auth-signup-attribution.spec.ts` (sessionStorage); full signup→Supabase still manual |
| E Drip sequence | ✅ | `scripts/verify-drip-sequence.ts` — `drip_step_1/2/3_sent_at` vs schedule; `npm run verify:drip` |
| F Life-event on connect | ❌ | Two-role manual or scripted Supabase + advisor UI |
| G Event slugs 200 | ✅ | `public-routes.spec.ts` — all `EVENT_SLUGS` + spot-check assess pages |

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

| Project | Tests | Purpose | Gate |
|---------|------:|---------|------|
| `consumer-setup` + `consumer` | 137 | APIs, routes, sidebar, profile, UI saves | Required on PR (`--workers=1` on staging) |
| `advisor-setup` + `advisor` | 45 | Client workspace, RMD, newsletter kit | Required on PR |
| `public` | 59 | Marketing + all event slugs + referral API | Required on PR |
| `attorney-setup` + `attorney` | 2 | Attorney portal (after seed) | Optional / nightly |
| `consumer-tier1` | 3 | Upgrade banners (optional env) | Optional |
| `import-unit` | 7 | Import parse/header/alias | On import changes |
| `test:import:api` | — | Import commit/duplicate/traceability | Before F-2 deploy |
| Manual Core 1–3 + Estate 4–7 | — | Release sign-off | Pre-launch checklist |

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
