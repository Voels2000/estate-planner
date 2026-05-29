# SPRINT — Inline Profile Prompts
# My Wealth Maps
# Status: Shipped · 2026-05-27

**Goal:** Surface the fields removed from the slim profile (SS claiming ages, PIA, retirement ages,
longevity ages, tax deduction method) exactly where they're needed, with no navigation away from the
page the user is already on.

**Constraint:** No new API routes. No new DB columns. All saves go through the existing
`PATCH /api/consumer/profile` endpoint. Prompts are soft (never a gate) — users can use the page
without filling them in; the prompt disappears once the field is set.

---

## Shared pattern — `ProfileFieldPrompt`

All inline prompts use one shared component. Build this first; the two page integrations follow.

### `components/profile/ProfileFieldPrompt.tsx`

```tsx
// Shared inline prompt card used on /social-security and /scenarios.
// Renders a gold-bordered card with a title, optional description, one or more
// labeled inputs, a Save button, and a dismiss link.
//
// On save: PATCHes /api/consumer/profile with the provided fields only.
// On success: calls onSaved() so the parent re-fetches or router.refresh().
// On dismiss: sets localStorage key `mwm_prompt_dismissed_{promptKey}` so the
//   card does not reappear this session. Reappears if the user returns without
//   the field set (localStorage is session-level context, not permanent hide).
```

**Props:**

| Prop | Type | Notes |
|------|------|-------|
| `promptKey` | `string` | Unique key — `'ss_person1'`, `'ss_person2'`, `'scenarios_planning'` |
| `title` | `string` | Bold heading in card |
| `description` | `string` | One sentence explaining why this field improves the output |
| `fields` | `ProfileFieldDef[]` | See below |
| `onSaved` | `() => void` | Called after successful PATCH — parent calls `router.refresh()` |
| `className` | `string?` | Optional layout class |

**`ProfileFieldDef`:**

```ts
type ProfileFieldDef = {
  name: string           // household column name — matches PATCH /api/consumer/profile payload key
  label: string
  type: 'number' | 'select'
  placeholder?: string
  helpText?: string
  options?: { value: string; label: string }[]  // for select fields
  min?: number
  max?: number
}
```

**Save behavior:**

```ts
// Builds payload from only the fields in this prompt — does not send unrelated fields.
// Uses the same PATCH /api/consumer/profile endpoint as the profile page.
// buildHouseholdPayload pass-through preserves all other household fields (confirmed pattern
// in lib/profile/buildHouseholdPayload.ts — sending partial payload is safe).

const payload = Object.fromEntries(
  fields.map(f => [f.name, localState[f.name]])
)
await fetch('/api/consumer/profile', { method: 'PATCH', body: JSON.stringify(payload) })
```

**Visual spec:**

- Card: `border border-[#C9A84C]/40 rounded-lg p-4 bg-amber-50/30` — matches the gold accent system
- Left border accent: `border-l-4 border-l-[#C9A84C]` — matches `ProfileSectionHeader`
- Title: `text-sm font-semibold text-[#0F1B3C]`
- Description: `text-sm text-gray-600 mt-1`
- Inputs: standard form inputs matching existing profile field style
- Save button: `variant="default"` small — same button variant as other inline saves in the app
- Dismiss: `text-xs text-gray-400 underline cursor-pointer mt-2` — "Remind me later"

**Dismiss logic (client only, no DB):**

```ts
// On dismiss:
sessionStorage.setItem(`mwm_prompt_dismissed_${promptKey}`, '1')

// On render:
const dismissed = sessionStorage.getItem(`mwm_prompt_dismissed_${promptKey}`) === '1'
if (dismissed) return null
```

Using `sessionStorage` (not `localStorage`) means the prompt reappears on next visit if the field
is still empty — intentional, since the user may want to look up their PIA before entering it.

---

## Page 1 — `/social-security`

### What's missing

The Social Security calculator needs `ss_claiming_age_1` / `ss_claiming_age_2` and `pia_1` /
`pia_2` to produce meaningful output. Without them, the projection either uses defaults or shows
nothing useful. These were removed from the slim profile form.

### Where to render

**File:** `app/(dashboard)/social-security/page.tsx` (server) + `_social-security-client.tsx` (client)

In the server page, alongside the existing `loadSocialSecurityData` call, check:

```ts
const needsSsPerson1 = !household.ss_claiming_age_1 || !household.pia_1
const needsSsPerson2 = hasSpouse && (!household.ss_claiming_age_2 || !household.pia_2)
```

Pass `needsSsPerson1` and `needsSsPerson2` as props to the client component.

### Prompt placement

Render **above** the main Social Security content area, not inside it. One card per person
when data is missing. If both are missing, stack them (person 1 above person 2).

```tsx
// In _social-security-client.tsx, before the main SS content:

{needsSsPerson1 && (
  <ProfileFieldPrompt
    promptKey="ss_person1"
    title={`${person1Name}'s Social Security details`}
    description="Add your expected claiming age and estimated benefit to see a personalized Social Security projection."
    fields={SS_FIELDS_PERSON_1}
    onSaved={() => router.refresh()}
  />
)}

{needsSsPerson2 && (
  <ProfileFieldPrompt
    promptKey="ss_person2"
    title={`${person2Name}'s Social Security details`}
    description="Add their claiming age and estimated benefit to include both Social Security incomes in the projection."
    fields={SS_FIELDS_PERSON_2}
    onSaved={() => router.refresh()}
  />
)}
```

### Field definitions

```ts
const SS_FIELDS_PERSON_1: ProfileFieldDef[] = [
  {
    name: 'ss_claiming_age_1',
    label: 'Planned claiming age',
    type: 'number',
    placeholder: '62–70',
    min: 62,
    max: 70,
    helpText: 'Age at which you plan to start Social Security benefits.',
  },
  {
    name: 'pia_1',
    label: 'Estimated monthly benefit (PIA)',
    type: 'number',
    placeholder: 'e.g. 2800',
    helpText: 'Your Primary Insurance Amount at full retirement age. Find this at ssa.gov/myaccount.',
  },
]

const SS_FIELDS_PERSON_2: ProfileFieldDef[] = [
  {
    name: 'ss_claiming_age_2',
    label: 'Planned claiming age',
    type: 'number',
    placeholder: '62–70',
    min: 62,
    max: 70,
  },
  {
    name: 'pia_2',
    label: 'Estimated monthly benefit (PIA)',
    type: 'number',
    placeholder: 'e.g. 2800',
    helpText: 'Find this at ssa.gov/myaccount.',
  },
]
```

### What happens after save

`router.refresh()` re-runs `loadSocialSecurityData` with the newly saved values. The prompt
disappears because `needsSsPerson1` / `needsSsPerson2` will be false on the next server render.
No additional wiring needed — the SS calculator already reads these fields from the household.

### Acceptance criteria

- [x] `/social-security` renders without prompt when `ss_claiming_age_1` and `pia_1` are set
- [x] Prompt appears above SS content when either field is missing
- [x] Save PATCHes `/api/consumer/profile` — fields are persisted
- [x] Prompt disappears after save (router.refresh re-renders server component with new data)
- [x] "Remind me later" dismisses for the session; reappears on next visit if fields still empty
- [x] With spouse: person 2 prompt appears only when `has_spouse` is true and person 2 fields missing
- [x] SS calculator output updates immediately after save (no second navigation required)
- [x] `consumer-profile-save.spec.ts` — PATCH with only `ss_claiming_age_1` + `pia_1`
      confirms partial payload is accepted and other household fields are unchanged

---

## Page 2 — `/scenarios`

### What's missing

The Scenarios projection engine consumes `retirement_age_1` / `retirement_age_2`,
`longevity_age_1` / `longevity_age_2`, and `deduction_mode` / `custom_deduction_amount`.
These were removed from the slim profile. Without them, the projection uses engine defaults —
the output is valid but not personalized to the user's situation.

Note: growth assumptions (`growth_rate_accumulation`, `growth_rate_retirement`, `inflation_rate`)
already live on Scenarios via `PATCH /api/consumer/growth-assumptions` — those are not touched
by this change. The inline prompt covers only the household fields that moved out of the profile.

### Where to render

**File:** `app/(dashboard)/scenarios/page.tsx` (server) + scenarios client component

In the server page, alongside `loadProjectionData`, check:

```ts
const needsRetirementAges = !household.retirement_age_1
const needsLongevityAges = !household.longevity_age_1
const needsDeduction = !household.deduction_mode
  // null/unset only — 'standard' is a valid explicit choice; do not re-prompt
```

The deduction check is intentionally loose: `standard` is a valid default, so only prompt if
`deduction_mode` is null/unset. Users on standard deduction who never looked at this field don't
need to be interrupted.

Pass `needsRetirementAges`, `needsLongevityAges`, `needsDeduction` as props to the client.

### Prompt placement

Render **above** the scenarios planning content, below the `PlanningSurfaceNav`. Use a single
combined card (not three separate cards) — grouping the planning fields reduces visual noise.

```tsx
// In scenarios client component, before the main scenarios content:

{(needsRetirementAges || needsLongevityAges || needsDeduction) && (
  <ProfileFieldPrompt
    promptKey="scenarios_planning"
    title="Personalize your projection"
    description="These inputs help tailor the Base Case projection to your timeline. You can refine them anytime."
    fields={buildScenariosFields(needsRetirementAges, needsLongevityAges, needsDeduction, hasSpouse, deductionMode)}
    onSaved={() => router.refresh()}
  />
)}
```

### Field definitions

```ts
function buildScenariosFields(
  needsRetirement: boolean,
  needsLongevity: boolean,
  needsDeduction: boolean,
  hasSpouse: boolean,
  currentDeductionMode: string | null
): ProfileFieldDef[] {
  const fields: ProfileFieldDef[] = []

  if (needsRetirement) {
    fields.push({
      name: 'retirement_age_1',
      label: 'Your planned retirement age',
      type: 'number',
      placeholder: 'e.g. 65',
      min: 50,
      max: 80,
    })
    if (hasSpouse) {
      fields.push({
        name: 'retirement_age_2',
        label: "Spouse / partner's planned retirement age",
        type: 'number',
        placeholder: 'e.g. 63',
        min: 50,
        max: 80,
      })
    }
  }

  if (needsLongevity) {
    fields.push({
      name: 'longevity_age_1',
      label: 'Planning horizon age (you)',
      type: 'number',
      placeholder: 'e.g. 90',
      min: 70,
      max: 100,
      helpText: 'Age through which the projection models your plan. Often 90–95 for conservative planning.',
    })
    if (hasSpouse) {
      fields.push({
        name: 'longevity_age_2',
        label: 'Planning horizon age (spouse / partner)',
        type: 'number',
        placeholder: 'e.g. 92',
        min: 70,
        max: 100,
      })
    }
  }

  if (needsDeduction) {
    fields.push({
      name: 'deduction_mode',
      label: 'Federal income tax deduction method',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard deduction' },
        { value: 'itemized', label: 'Itemize deductions' },
        { value: 'custom', label: 'Custom amount' },
      ],
      helpText: 'Used in the income tax projection. Most households use standard; itemize if you have significant mortgage interest, state taxes, or charitable gifts.',
    })
    // Note: custom_deduction_amount is a follow-on field that appears when
    // deduction_mode === 'custom'. Handle this with local state in ProfileFieldPrompt:
    // when the select changes to 'custom', append a number input for the custom amount.
    // This matches the existing profile page behavior for this field pair.
  }

  return fields
}
```

**Custom deduction follow-on input:** `ProfileFieldPrompt` needs one small addition to handle the
`deduction_mode` → `custom_deduction_amount` conditional. When a `select` field named
`deduction_mode` changes to `'custom'`, append a number input for `custom_deduction_amount` to the
rendered field list. This is the only conditional field in either prompt; handle it inside
`ProfileFieldPrompt` with a local check rather than making the field definitions dynamic:

```tsx
// Inside ProfileFieldPrompt, after rendering all fields:
{localState['deduction_mode'] === 'custom' && (
  <div>
    <label>Custom annual deduction amount</label>
    <input
      type="number"
      value={localState['custom_deduction_amount'] ?? ''}
      onChange={e => setLocalState(s => ({ ...s, custom_deduction_amount: e.target.value }))}
      placeholder="e.g. 45000"
    />
  </div>
)}
```

### What happens after save

`router.refresh()` re-runs `loadProjectionData` with the new household fields. The Base Case
projection re-runs with the updated retirement/longevity ages. The prompt disappears because the
missing-field checks will be false on the next server render.

The growth assumption inputs (`PATCH /api/consumer/growth-assumptions`) are already on the
Scenarios page — this prompt only handles the household fields that moved out of the slim profile.
These two save paths are independent and don't interfere.

### Acceptance criteria

- [x] `/scenarios` renders without prompt when `retirement_age_1`, `longevity_age_1`, and
      `deduction_mode` are all set
- [x] Prompt appears above scenarios content when any of the three are missing
- [x] Only missing fields are shown — users who have set retirement ages but not longevity ages
      see only the longevity fields
- [x] `deduction_mode` select renders all three options; `custom_deduction_amount` input appears
      when 'custom' is selected
- [x] Save PATCHes `/api/consumer/profile` with only the prompt's fields — other household fields
      unchanged (partial payload pattern)
- [x] Prompt disappears after save; projection re-runs with new values
- [x] With spouse: spouse retirement and longevity fields appear only when `has_spouse` is true
- [x] "Remind me later" dismisses for the session; reappears next visit if fields still unset
- [x] `consumer-profile-save.spec.ts` — PATCH with only `retirement_age_1` +
      `longevity_age_1` confirms partial payload accepted and other fields unchanged

---

## Implementation order

| Step | Work |
|------|------|
| 1 | Build `ProfileFieldPrompt` component — shared, tested in isolation |
| 2 | Wire `/social-security` prompt — simpler (two people, same two fields each) |
| 3 | Wire `/scenarios` prompt — more fields, conditional deduction follow-on |
| 4 | Add partial-payload PATCH cases to `consumer-profile-save.spec.ts` |

The `custom_deduction_amount` conditional in step 3 is the only non-trivial UI logic. Build it
last, after the simpler prompts are confirmed working.

---

## What this does not change

- `PATCH /api/consumer/profile` — no changes to the endpoint or its payload shape
- `lib/profile/buildHouseholdPayload.ts` — pass-through behavior already preserves fields not
  sent in the payload; no change needed
- `isMinimumViableProfile` — minimum profile definition is unchanged (name, birth year, state,
  filing status). These deferred fields are enhancements, not requirements.
- `/profile` page — the slim profile form is unchanged; the deferred fields stay deferred
- The projection engine — reads these household fields already; no engine changes
- `loadSocialSecurityData` and `loadProjectionData` — no changes to loaders
- Tier gates — both pages are already Tier 2; no gate changes

---

## Docs to update after merge

Per `UPDATE_CHECKLIST.md`:

- [x] `CONSUMER_FLOWS.md` — add inline prompt pattern to social-security and scenarios flow entries
- [x] `MASTER_ARCHITECTURE.md` — note `ProfileFieldPrompt` shared component; note deferred-field
      pattern for slim profile follow-on
- [x] `ROADMAP.md` — add sprint entry
- [x] `SCHEMA_CHANGELOG.md` — session entry (no schema change; component + wiring only)
