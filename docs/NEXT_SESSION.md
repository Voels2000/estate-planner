# NEXT_SESSION.md
# Sprint 0 — Session 1 Start Document
# Generated: May 2026

---

## Paste this as your FIRST MESSAGE in the next Cursor / AI session

> I am building My Wealth Maps, a self-guided estate and financial planning tool for households with $2M–$30M in assets. This segment is severely underserved — over 50% have no will or plan at all. The product has a strong calculation engine. We are doing UI and widget work only — no changes to engines, APIs, or database. We have three paid tiers (Financial, Retirement, Estate). The advisor and attorney network is a core part of the model. We are on Sprint 0 — surfacing the most valuable content already built. No new features, no new infrastructure. Today's task: [FILL IN FROM TASK LIST BELOW].

---

## What we completed last session

- Full product strategy review and UX assessment
- Identified 6 key UX problems to fix in Sprint 0
- Created PRODUCT_STRATEGY.md, DECISION_LOG.md, and ROADMAP.md
- No code changes made yet — Sprint 0 is starting fresh

---

## Sprint 0 task list — work through these in order

All changes are UI only. No engine, API, or database changes required.

### Task 1 — Dashboard: conflict alert banner above the fold
**The problem:** The named conflict alerts ("4 accounts missing beneficiaries: Yukon Denali 2019...") are the most valuable content on the dashboard but require 3–4 scrolls to reach.
**The fix:** Add a compact dismissible alert banner between the greeting and the Planning Readiness Score card.
**Files you will likely need:**
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/_dashboard-client.tsx`
- `app/(dashboard)/_components/dashboard/` (all files in this folder)
- `components/dashboard/EmptyStateCard.tsx`
- `lib/dashboard/loaders.ts`

**What it should look like:**
```
⚠ 1 critical issue · 3 warnings found in your plan —
4 accounts missing beneficiaries, 22 titled in one name only.
[See details ↓]
```
- Amber background, warning icon, dismissible with X
- "See details ↓" scrolls to or anchors to the existing conflict section already on the page
- If zero conflicts: banner does not render
- Severity chips also added inline on the Planning Readiness Score card

---

### Task 2 — Dashboard: severity chips on Planning Readiness Score card
**The problem:** The score card shows 78% overall with no indication that there are active critical issues.
**The fix:** Add "1 critical · 3 warnings" chips below the category bars on the score card, linking to the conflict section.
**Files you will likely need:**
- Same files as Task 1
- The specific score card component — search for `PlanningReadinessScore` or `estate_health_scores`

---

### Task 3 — Sidebar: move advisor/attorney to footer
**The problem:** My Advisor and My Attorney appear in the primary sidebar nav, competing with planning tools.
**The fix:** Move them to the bottom of the sidebar below a divider, alongside Account & Billing.
**Files you will likely need:**
- `app/(dashboard)/_components/sidebar-nav.tsx`

**What it should look like:**
```
[divider]
👤 My advisor
⚖️ My attorney
⚙️ Account & billing
```
- Simple move — no logic changes, just position in the nav component
- "Your plan" tier badge added to the active planning group header

---

### Task 4 — Horizons page: cards → comparison table
**The problem:** Four columns repeat 8 identical labels four times. "Est. total estate tax liability" is buried at the bottom of each card.
**The fix:** Convert to a comparison table (labels left, 4 value columns). Tax liability as hero row at top.
**Files you will likely need:**
- `app/(dashboard)/my-estate-strategy/page.tsx`
- `app/(dashboard)/my-estate-strategy/_my-estate-strategy-client.tsx`
- `components/shared/StrategyHorizonTable.tsx`
- `lib/my-estate-strategy/horizonSnapshots.ts` (read only — understand data shape)

**Table structure:**
```
                    Today      10 yrs     20 yrs     At death
─── Estate size ──────────────────────────────────────────────
Gross estate        $9.3M      $19.3M     $40.1M     $53.5M
Lifetime gifts      $512K      $512K      $512K      $512K
Federal exemption   $29.5M     $29.5M     $29.5M     $29.5M
─── Tax exposure ──────────────────────────────────────────────
Federal tax est.    $0         $0         $4.3M      $9.6M
State tax est.      $905K      $2.9M      $7.0M      $9.7M
EST. TOTAL TAX      $905K      $2.9M      $11.3M     $19.3M  ← hero row
─── Inside estate ─────────────────────────────────────────────
Inside estate       $9.3M      $19.3M     $40.1M     $53.5M
Headroom            $20.2M     $10.2M     —          —
```
- Keep the 4 summary hero cards at the top (Today / 10yr / 20yr / Death) showing only the total tax liability number
- Keep "Actual Estate" vs "What-if Advisor Recommendations" toggle
- Keep "Estate Plan Completeness" section at bottom

---

### Task 5 — Projections table: decode column headers
**The problem:** "AL SS," "CATHI RMD," "JOINT/OTHER" are opaque abbreviations.
**The fix:** Replace with full names and add tooltips.
**Files you will likely need:**
- `app/(dashboard)/projections/page.tsx`
- `app/(dashboard)/projections/_components/` (all files)
- `lib/projections/types.ts`

**Column header mapping:**
```
AL EARNED     → [Person 1 name] · Earned income
AL SS         → [Person 1 name] · Social Security
AL RMD        → [Person 1 name] · RMD
AL OTHER      → [Person 1 name] · Other income
CATHI EARNED  → [Person 2 name] · Earned income
(same pattern for all CATHI columns)
JOINT/OTHER   → Joint / Other
TOTAL         → Total income
```
- Use household `person1_name` and `person2_name` from profile — these are already in the data
- Add a `<title>` tooltip on each header explaining what the column contains

---

### Task 6 — Monte Carlo: single-column layout
**The problem:** Split-screen with empty chart placeholder on the right wastes half the screen. Step tabs look like pagination.
**The fix:** Single-column input wizard, chart appears below after simulation runs.
**Files you will likely need:**
- `app/(dashboard)/monte-carlo/page.tsx`
- Any Monte Carlo client component — search for `MonteCarloSimulations` or `monte-carlo`

**Layout change:**
```
BEFORE: [Input form left] [Empty chart placeholder right]
AFTER:  [Input wizard — full width, steps clearly labeled 1/2/3/4]
        [Chart appears here after Simulate is clicked]
```
- Keep the pre-fill banner ("16 pulled from profile · 1 estimated · 1 need your input") — this is excellent UX, do not change it
- Change step tabs from pagination style to a clear progress indicator (Step 1 of 4)

---

### Task 7 — Upgrade gates: inject household data into copy
**The problem:** Locked tier pages show generic upgrade messaging.
**The fix:** Use household data already loaded on the page to personalize the upgrade copy.
**Files you will likely need:**
- `app/(dashboard)/estate-tax/page.tsx` (example — apply pattern to all tier-3 locked pages)
- `app/(dashboard)/my-estate-strategy/page.tsx`
- `components/` — search for `UpgradeBanner`
- `lib/estate/profileGate.ts`

**Copy pattern:**
```
BEFORE: "Upgrade to see your estate tax snapshot"
AFTER:  "Your gross estate is approximately $9.3M.
         Washington has a state estate tax with no portability —
         your estate may owe state tax today.
         Upgrade to see the full breakdown."
```
- Use `grossEstate`, `state_primary`, and `consumer_tier` — already available at page load
- Different copy for each event: estate tax page uses estate/state data, retirement pages use age/income data

---

## Key decisions that apply to ALL Sprint 0 work

1. **UI only** — no changes to calculation engines, APIs, or database
2. **Complexity stays** — do not simplify or hide any existing functionality
3. **No new pages** — all changes are to existing components
4. **Data is already there** — every piece of data needed for these fixes is already loaded on the page; no new API calls required
5. **The engine is strong** — if something looks wrong in the numbers, it's a display issue not a calculation issue

---

## Files to upload at the START of the next session

Upload these from your repository before starting each task. You do not need all of them at once — load per task as listed above.

**For Tasks 1 + 2 (Dashboard):**
```
app/(dashboard)/dashboard/page.tsx
app/(dashboard)/_dashboard-client.tsx
app/(dashboard)/_components/dashboard/  ← entire folder
lib/dashboard/loaders.ts
lib/dashboard/mappers.ts
```

**For Task 3 (Sidebar):**
```
app/(dashboard)/_components/sidebar-nav.tsx
```

**For Task 4 (Horizons):**
```
app/(dashboard)/my-estate-strategy/page.tsx
app/(dashboard)/my-estate-strategy/_my-estate-strategy-client.tsx
components/shared/StrategyHorizonTable.tsx
```

**For Task 5 (Projections):**
```
app/(dashboard)/projections/page.tsx
app/(dashboard)/projections/_components/  ← entire folder
lib/projections/types.ts
```

**For Task 6 (Monte Carlo):**
```
app/(dashboard)/monte-carlo/page.tsx
← search codebase for MonteCarloSimulations component
```

**For Task 7 (Upgrade gates):**
```
← search codebase for UpgradeBanner component
app/(dashboard)/estate-tax/page.tsx
lib/estate/profileGate.ts
```

---

## How to end each coding session

Ask: "Summarize what we completed today and update the NEXT_SESSION.md with the remaining Sprint 0 tasks and any new file paths we discovered."

Copy the response into a new NEXT_SESSION.md and commit it to your repo alongside any code changes.

---

## Success criteria — Sprint 0 is done when:

- [ ] Conflict alert banner visible on dashboard without scrolling
- [ ] Severity chips on Planning Readiness Score card
- [ ] Advisor/attorney links in sidebar footer
- [ ] Horizons page shows comparison table with tax liability as hero row
- [ ] Projections table shows full person names in column headers
- [ ] Monte Carlo is single-column with chart below
- [ ] Upgrade gate copy uses household data (gross estate, state)
