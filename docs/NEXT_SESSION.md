# NEXT_SESSION.md
# Sprint 1 — Session Start Document
# Generated: May 2026 (after Sprint 0 completion)

---

## Paste this as your FIRST MESSAGE in Cursor

> I am building My Wealth Maps, a self-guided estate and financial
> planning tool for households with $2M–$30M in assets. The engine
> is strong — we are doing UI and structural work only. Sprint 0
> is complete (dashboard conflict banner, horizons table, sidebar
> footer, Monte Carlo layout, upgrade gate personalization).
> Sprint 1 goal: separate the public site nav from the app nav,
> clean up the sidebar so it contains planning tools only, and
> fix the remaining Sprint 0 carryover items. Today's task:
> [FILL IN FROM TASK LIST BELOW].

---

## Sprint 0 — What shipped

| Task | Status | Notes |
|------|--------|-------|
| Dashboard conflict alert banner above fold | ✅ Done | |
| Severity chips on Planning Readiness Score | ✅ Done | |
| Sidebar: My Advisor + Billing → footer | ✅ Done | |
| Horizons: hero cards + comparison table | ✅ Done | |
| Horizons: tier gate on /my-estate-strategy | ✅ Done | |
| Projections: column header tooltips | ✅ Done | Full names still show abbreviated — see Task 2 |
| Monte Carlo: single-column + step stepper | ✅ Done | |
| UpgradeBanner householdContext on estate-tax | ✅ Done | |
| UpgradeBanner householdContext on my-estate-strategy | ✅ Done | |
| My Attorney still in main nav | 🔄 Sprint 1 Task 1 | Move to sidebar footer |
| "Your plan" tier badge on active group | 🔄 Sprint 1 Task 1 | |
| Full person names on projections headers | 🔄 Sprint 1 Task 2 | Check p1/p2 value from page |
| householdContext on other locked pages | 🔄 Sprint 1 Task 3 | |

---

## Sprint 1 task list — work through in order

All changes are UI and structural only.
No engine, API, or database changes required.

---

### Task 1 — Sidebar carryover: My Attorney to footer + tier badge

**Files needed:**
```
app/(dashboard)/_components/sidebar-nav.tsx
```

**Change 1 — Remove from Overview NAV_GROUPS items array:**
- `{ href: '/my-attorney', label: 'My Attorney', ... }`
- `{ href: '/settings/attorney-access', label: 'Attorney access settings', ... }`

**Change 2 — Add My Attorney to the footer section**
(alongside My Advisor and Manage Subscription added in Sprint 0).
Add this block inside the footer connections div, after My Advisor:

```jsx
{/* My Attorney — consumer only, tier 2+ */}
{(role === 'consumer' || isSuperuser) && tier >= 2 &&
  (isLockedUser ? (
    <Link href="#" tabIndex={-1} aria-disabled={true}
      className="flex items-center gap-3 rounded-lg px-3 py-2
        text-sm font-medium text-neutral-600 transition-colors
        pointer-events-none opacity-40 cursor-not-allowed">
      <span className="flex-1 truncate">⚖️ My Attorney</span>
      <span className="shrink-0 text-sm" aria-hidden>🔒</span>
    </Link>
  ) : (
    <Link href="/my-attorney"
      className={`flex items-center gap-3 rounded-lg px-3 py-2
        text-sm font-medium transition-colors ${
        activePath === '/my-attorney'
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}>
      ⚖️ My Attorney
    </Link>
  ))
}
```

**Change 3 — Add "Your plan" badge to active planning group.**
Inside the NAV_GROUPS.map() where the group header button is
rendered, add the badge between the group label and the chevron:

```jsx
{/* Your plan badge — only on unlocked non-Overview groups */}
{!groupIsLocked && group.label !== 'Overview' && (
  (group.label === 'Financial Planning' && tier === 1) ||
  (group.label === 'Retirement Planning' && tier === 2) ||
  (group.label === 'Estate Planning' && tier >= 3)
) && (
  <span className={`text-[10px] font-semibold px-1.5 py-0.5
    rounded-full mr-1 ${
    group.label === 'Financial Planning'
      ? 'bg-blue-100 text-blue-700'
      : group.label === 'Retirement Planning'
      ? 'bg-green-100 text-green-700'
      : 'bg-purple-100 text-purple-700'
  }`}>
    Your plan
  </span>
)}
```

**Do not change:** portal links, Export Estate Plan,
Import Data, Security, Sign Out, or any locked group logic.

---

### Task 2 — Projections: fix full person names in column headers

**The problem:** Headers show "AL" / "CATHI" abbreviations.
IncomeTable receives p1 and p2 as props and uses them correctly —
the issue is what value the projections page passes in.

**Files needed:**
```
app/(dashboard)/projections/page.tsx
app/(dashboard)/projections/_components/IncomeTable.tsx
```

**Fix:** In projections/page.tsx, find where IncomeTable is
called. Wrap person names with displayPersonFirstName:

```tsx
import { displayPersonFirstName } from '@/lib/display-person-name'

// In the JSX:
<IncomeTable
  projections={projections}
  p1={displayPersonFirstName(
    household?.person1_name, 'You'
  )}
  p2={household?.has_spouse
    ? displayPersonFirstName(
        household?.person2_name, 'Spouse'
      )
    : null
  }
/>
```

If displayPersonFirstName is already imported on this page,
do not add a duplicate import. If p1/p2 are computed
elsewhere in the file (e.g. in a variable), update that
variable instead of the JSX call.

Goal: headers read "Alan · Earned Income" not "AL EARNED".
The tooltips from Sprint 0 remain unchanged.

---

### Task 3 — UpgradeBanner: householdContext on remaining locked pages

**Files needed (upload 2–3 at a time):**
```
app/(dashboard)/social-security/page.tsx
app/(dashboard)/roth/page.tsx
app/(dashboard)/rmd/page.tsx
app/(dashboard)/complete/page.tsx
app/(dashboard)/my-family/page.tsx
app/(dashboard)/titling/page.tsx
app/(dashboard)/incapacity-planning/page.tsx
app/(dashboard)/domicile-analysis/page.tsx
```

**Pattern for each page:**

Each page already loads household data before the tier check.
Add householdContext to the existing UpgradeBanner call only —
do not add new data fetching.

For tier-2 retirement pages:
```tsx
<UpgradeBanner
  requiredTier={2}
  moduleName="[keep existing]"
  valueProposition="[keep existing]"
  householdContext={{
    grossEstate: null,
    statePrimary: householdRow?.state_primary ?? null,
    firstName: null,
  }}
/>
```

For tier-3 estate pages:
```tsx
<UpgradeBanner
  requiredTier={3}
  moduleName="[keep existing]"
  valueProposition="[keep existing]"
  householdContext={{
    grossEstate: composition?.gross_estate ?? null,
    statePrimary: householdRow?.state_primary ?? null,
    firstName: null,
  }}
/>
```

If composition is not loaded on a page, pass null for grossEstate.
UpgradeBanner handles null gracefully and falls back to the
generic valueProposition.

---

### Task 4 — Public site nav separation (Sprint 1 core task)

**The problem:** Education Guide, Planning Assessment, Find an
Advisor, Find an Attorney appear in the authenticated app
sidebar. They belong on a public marketing layout with a
top nav, not in the planning app.

**Files needed — search and upload what exists:**
```
app/(dashboard)/_components/sidebar-nav.tsx
app/(dashboard)/layout.tsx
app/layout.tsx
app/page.tsx
```

Also search for any of these — upload if they exist:
```
app/(marketing)/layout.tsx
app/(public)/layout.tsx
app/education/page.tsx  OR  app/(dashboard)/education/page.tsx
app/assess/page.tsx     OR  app/(dashboard)/assess/page.tsx
```

Understanding the current route group structure is essential
before writing any code. Check whether /education, /assess,
/find-advisor, /find-attorney are inside the (dashboard)
route group or outside it.

**Changes:**

Step 1 — Remove from sidebar Overview NAV_GROUPS items:
```
{ href: '/', label: 'Home', icon: '🏠' }
{ href: '/education', label: 'Education Guide', icon: '📚' }
{ href: '/assess', label: 'Planning Assessment', icon: '🔍' }
{ href: '/find-advisor', label: 'Find an Advisor', icon: '🤝' }
{ href: '/find-attorney', label: 'Find an Attorney', icon: '⚖️' }
```

Step 2 — Move public routes outside the (dashboard) route
group if they are currently inside it, so they use a
different layout (no sidebar).

Step 3 — Create a simple public top nav for the marketing
pages. This does not need to be complex:

```tsx
// app/(public)/layout.tsx  or  app/(marketing)/layout.tsx
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <nav className="mx-auto flex max-w-7xl items-center
          justify-between px-4 py-3">
          <div className="text-base font-bold text-neutral-900">
            My Wealth Maps
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <a href="/education"
              className="px-3 py-1.5 text-sm text-neutral-600
                hover:text-neutral-900 rounded-lg
                hover:bg-neutral-100 transition-colors">
              Education
            </a>
            <a href="/assess"
              className="px-3 py-1.5 text-sm text-neutral-600
                hover:text-neutral-900 rounded-lg
                hover:bg-neutral-100 transition-colors">
              Assessment
            </a>
            <a href="/find-advisor"
              className="px-3 py-1.5 text-sm text-neutral-600
                hover:text-neutral-900 rounded-lg
                hover:bg-neutral-100 transition-colors">
              Find an advisor
            </a>
            <a href="/find-attorney"
              className="px-3 py-1.5 text-sm text-neutral-600
                hover:text-neutral-900 rounded-lg
                hover:bg-neutral-100 transition-colors">
              Find an attorney
            </a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/login"
              className="px-3 py-1.5 text-sm text-neutral-600
                hover:text-neutral-900 rounded-lg border
                border-neutral-200 hover:bg-neutral-50
                transition-colors">
              Log in
            </a>
            <a href="/login"
              className="px-3 py-1.5 text-sm font-medium
                text-white bg-indigo-600 hover:bg-indigo-700
                rounded-lg transition-colors">
              Get started
            </a>
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

Step 4 — Confirm the Overview group in the sidebar now
contains only:
- Profile (`/profile`)
- Estate Summary (`/dashboard`)

**Critical:** Do not delete or modify the actual page
components at /education, /assess, /find-advisor,
/find-attorney. Only change which layout wraps them.

---

## Files to upload per task

**Task 1:** `sidebar-nav.tsx`

**Task 2:** `projections/page.tsx` + `IncomeTable.tsx`

**Task 3:** Upload 2–3 locked pages at a time

**Task 4:** `sidebar-nav.tsx` + `layout.tsx` files +
any public route page files found in search

---

## Sprint 1 success criteria

- [ ] My Attorney in sidebar footer, not Overview group
- [ ] Attorney access settings removed from sidebar entirely
- [ ] "Your plan" badge on the active planning group header
- [ ] Projections headers show full first names with tooltips
- [ ] UpgradeBanner personalized on all remaining locked pages
- [ ] Education, Assessment, Find Advisor, Find Attorney
      removed from app sidebar
- [ ] Public routes still render correctly with their own
      layout (no sidebar, simple top nav)
- [ ] Overview group contains only Profile + Estate Summary
- [ ] Sidebar footer: My Advisor · My Attorney (tier 2+) ·
      Manage Subscription · Sign Out

---

## How to end each session

Ask: "Summarize what we completed today and update
NEXT_SESSION.md with remaining Sprint 1 tasks and
any new file paths discovered."

Commit the updated NEXT_SESSION.md alongside code changes.
