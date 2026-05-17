# NEXT_SESSION.md
# Sprint 1 — Session 1 Start Document
# Generated: May 2026 (after Sprint 0 completion)

---

## Paste this as your FIRST MESSAGE in the next Cursor / AI session

> I am building My Wealth Maps, a self-guided estate and financial planning tool for households with $2M–$30M in assets. This segment is severely underserved — over 50% have no will or plan at all. The product has a strong calculation engine. We are on **Sprint 1** — public/app separation and $2M–$30M segment positioning. Sprint 0 in-app UI fixes are complete (see carryover notes below for two small gaps). Today's task: [FILL IN FROM TASK LIST BELOW — start with Task 1 or the carryover you choose].

---

## Sprint 0 — completed summary

Sprint 0 goal was to surface the most valuable content already built. **All seven tasks were implemented** (UI only — no engine, API, or database changes). Code is in the working tree; commit when ready.

| Task | Status | What shipped |
|------|--------|--------------|
| **1** Dashboard conflict banner | ✅ Done | Dismissible banner between intro and assessment widget; links to `#estate-conflicts`; red/amber by severity |
| **2** Severity chips | ✅ Done | Chips in `DashboardIntroSection` (critical / warnings / “See issues below”) — note: not inside `AssessmentHistoryWidget` score card |
| **3** Sidebar footer | ⚠️ Partial | **My Advisor** + **Manage Subscription** moved to footer; **My Attorney** still in main nav (Sprint 1 item); **“Your plan” tier badge** not added |
| **4** Horizons comparison table | ✅ Done | Hero tax-liability cards + comparison table in `_my-estate-strategy-client.tsx`; generate CTA below table |
| **5** Projections headers | ⚠️ Partial | `title` tooltips on `IncomeTable.tsx` headers; headers still `{p1} Earned` / `{p1} SS` — not full “Name · Earned income” labels yet |
| **6** Monte Carlo layout | ✅ Done | Single-column stack; labeled step stepper; empty chart placeholder removed |
| **7** Upgrade gates | ✅ Done (core) | `householdContext` on `UpgradeBanner`; wired on `estate-tax` and `my-estate-strategy` tier gates; other locked pages unchanged |

### Files changed in Sprint 0

```
app/(dashboard)/_dashboard-client.tsx
app/(dashboard)/_components/dashboard/DashboardIntroSection.tsx
app/(dashboard)/_components/sidebar-nav.tsx
app/(dashboard)/my-estate-strategy/_my-estate-strategy-client.tsx
app/(dashboard)/my-estate-strategy/page.tsx
app/(dashboard)/projections/_components/IncomeTable.tsx
app/(dashboard)/monte-carlo/_monte-carlo-client.tsx
app/(dashboard)/_components/UpgradeBanner.tsx
app/(dashboard)/estate-tax/page.tsx
```

### Sprint 0 carryover (optional quick wins before Sprint 1)

- [ ] Move **My Attorney** to sidebar footer (with My Advisor) — `sidebar-nav.tsx`
- [ ] Add **“Your plan”** tier badge on active planning group in sidebar — `sidebar-nav.tsx`
- [ ] Projections: full header labels (`{person1_name} · Earned income`) — `IncomeTable.tsx` + parent that passes `p1`/`p2`
- [ ] Extend `householdContext` on `UpgradeBanner` to other tier-locked pages (monte-carlo, roth, titling, etc.)

### Sprint 0 success criteria (verify manually)

- [x] Conflict alert banner visible on dashboard without scrolling (when conflicts exist)
- [x] Severity chips visible when conflicts exist
- [x] My Advisor in sidebar footer
- [ ] My Attorney in sidebar footer
- [x] Horizons comparison table with tax liability hero row
- [~] Projections headers clarified (tooltips yes; full names no)
- [x] Monte Carlo single-column with results below wizard
- [x] Upgrade gate personalized copy on estate-tax + my-estate-strategy

---

## Sprint 1 task list — work in priority order

**Goal:** Two distinct nav experiences. All copy reflects $2M–$30M segment. See [ROADMAP.md](./ROADMAP.md) for full checklist.

### Task 1 — Public layout + top nav (start here)

**The problem:** Public site and planning app share chrome; visitors see a 30-item sidebar mental model.

**The fix:** Separate public layout — top nav only, no sidebar.

**Files you will likely need:**
- `app/(marketing)/` or `app/(public)/` route group — search for existing public pages (`/`, `/education`, `/pricing`)
- `app/layout.tsx` and any shared header components
- New or existing `PublicNav.tsx` (create if missing)

**Public top nav items:** Education · Assessment · Find Advisor · Find Attorney · Pricing · Log in · Get started

---

### Task 2 — Remove public links from app sidebar

**The problem:** Paid subscribers still see Education Guide, Planning Assessment, Find an Advisor, Find an Attorney in the planning sidebar.

**The fix:** Delete or comment out those entries from `sidebar-nav.tsx` (or `ConsumerNav` if split). Keep planning groups only.

**Files:**
- `app/(dashboard)/_components/sidebar-nav.tsx`
- `docs/CONSUMER_NAV_MAP.md` (update after change)

---

### Task 3 — Sidebar footer: My Attorney + Account & Billing

**The problem:** Sprint 0 moved My Advisor and Billing to footer; My Attorney and a unified “Account & billing” label remain incomplete.

**The fix:** Footer row: 👤 My Advisor · ⚖️ My Attorney · 💳 Account & billing (or Manage Subscription). Match lock/active patterns from existing footer links.

**Files:**
- `app/(dashboard)/_components/sidebar-nav.tsx`

---

### Task 4 — Homepage + public copy for $2M–$30M segment

**The problem:** Hero and marketing copy still read mass-market.

**The fix:** Rewrite homepage hero, subhead, and key CTAs for business owners, RE accumulators, executives. Remove “simple,” “teaser,” LegalZoom comparisons. See [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) and [DECISION_LOG.md](./DECISION_LOG.md).

**Files:**
- Public homepage — search `app/(marketing)` or `app/page.tsx`
- `/pricing` page

---

### Task 5 — Pricing page: position against professional fees

**Copy direction:** “Less than one hour with an estate attorney per month” — not consumer-tool price comparison.

---

### Task 6 — In-app copy audit (sample pass)

**The problem:** Residual “teaser,” “rule-of-thumb,” “illustrative mix” language violates segment positioning.

**The fix:** Grep-driven pass on dashboard, projections, strategy panels. Replace with confident, professional tone per DECISION_LOG.

**High-traffic files:**
- `app/(dashboard)/dashboard/`
- `app/(dashboard)/my-estate-trust-strategy/_client.tsx`
- `components/consumer/ConsumerStrategyPanel.tsx`

---

### Task 7 — Assessment conversion (if assess route exists)

- Score visible without login; full breakdown gates account creation
- Assessment score carries through signup; plan selector maps to three tiers
- Optional: “Email me my full checklist” on results

**Files:** Search `/assess`, `assessment`, `Planning Assessment` routes.

---

## Key decisions that apply to Sprint 1

1. **Public nav and app nav are separate** — no planning links on public site; no public links in app sidebar ([DECISION_LOG.md](./DECISION_LOG.md))
2. **Complexity stays in** — do not dumb down transfer strategy forms; add guided context instead
3. **Advisor/attorney are distribution partners** — “Invite your advisor” becomes primary onboarding (Sprint 1 Task 7+ in roadmap)
4. **Document every route/tier change** — [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md), [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md), [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md)

---

## Files to load at the START of Sprint 1

**Public / marketing shell:**
```
app/layout.tsx
app/page.tsx  (or marketing route group)
← search: PublicNav, SiteHeader, (marketing)
```

**App sidebar (Tasks 2 + 3):**
```
app/(dashboard)/_components/sidebar-nav.tsx
docs/CONSUMER_NAV_MAP.md
```

**Strategy / copy context:**
```
docs/PRODUCT_STRATEGY.md
docs/DECISION_LOG.md
docs/ROADMAP.md
```

---

## How to end each coding session

Ask: "Summarize what we completed today and update NEXT_SESSION.md with remaining Sprint 1 tasks and any new file paths we discovered."

Commit `NEXT_SESSION.md` with code changes. Update [ROADMAP.md](./ROADMAP.md) checkboxes for completed items.

---

## Success criteria — Sprint 1 is done when:

- [ ] Zero public-site links in app sidebar
- [ ] Zero planning-app links in public top nav
- [ ] Public layout uses top nav only (no sidebar)
- [ ] Homepage and pricing reflect $2M–$30M segment
- [ ] Sidebar footer: My Advisor · My Attorney · Account & billing
- [ ] Assessment → account creation funnel measurable (baseline)
