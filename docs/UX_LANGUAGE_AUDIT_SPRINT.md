# UX Language Audit — Sprint C-2b
# My Wealth Maps — Compliance language policy & surface checklist
# Purpose: Enforce "education & preparation" framing across all consumer surfaces
# Created: 2026-05-24 | Owner: Product + Engineering
# Status: Engineering complete — all `DISCLAIMER_STRINGS` surfaces wired (2026-05-24); manual surface QA ongoing

---

## Why this sprint exists

My Wealth Maps is a financial planning **preparation tool** — its purpose is to
educate users and help them arrive at professional meetings better prepared. It
is not an investment adviser, financial planner, or legal counsel.

The Investment Advisers Act of 1940 (Section 202(a)(11)) and Washington State
law define "investment advice" partly by how outputs are framed. A tool that
shows a user *what the numbers are* is in a fundamentally different legal
category from one that tells users *what to do*. This audit enforces that
distinction in every surface, every string, every CTA — not just the footer
disclaimer.

**The rule in one sentence:** Show the user what their situation looks like.
Point them to a professional for what to do about it. Never do both.

---

## Audit scope

Every consumer-facing surface in the planning app and public site. Organized by
the same section structure as CONSUMER_FLOWS.md and CONSUMER_NAV_MAP.md.

---

## Pass / Fail criteria

| Criterion | Pass | Fail |
|-----------|------|------|
| **Framing** | Informational ("your exposure is $X") | Directive ("you should do X") |
| **Outputs** | Computed from user inputs, labeled as estimates | Presented as conclusions or recommendations |
| **CTAs** | Point to advisor/attorney or ask user to explore | Instruct user to take a financial action |
| **Disclaimers** | Inline with the output they qualify | Footer-only or absent |
| **Strategies** | Described generically ("a SLAT transfers assets irrevocably") | Applied personally without counsel ("based on your estate, a SLAT is right for you") |
| **Scores/grades** | Show what was measured and what's missing | Imply the platform knows the right answer |

---

## Engineering deliverables (code)

These artifacts enforce the policy in code and CI. **Canonical policy strings:** [`lib/compliance/language-policy.ts`](../lib/compliance/language-policy.ts).

| Artifact | Purpose |
|----------|---------|
| `lib/compliance/language-policy.ts` | `DISCLAIMER_STRINGS`, `BANNED_PHRASES`, policy comments |
| `scripts/audit-ux-language.sh` | Grep pass over consumer-facing dirs; must exit 0 before merge |
| `.github/workflows/ux-language-audit.yml` | Runs audit on PRs touching consumer paths |

**Run the audit:**

```bash
bash scripts/audit-ux-language.sh
```

**Automated string pass:** 2026-05-24 — 32 initial findings → 0 after fixes.

**Inline disclaimers wired (2026-05-24):** dashboard (readiness score), `/projections`, `/monte-carlo`, `/roth`, `/allocation`, `/assess`, `/my-attorney`, `/estate-tax` (Federal Estate Tax card), `/my-estate-strategy` (below horizon table), PDF export cover (`EstatePlanPDF.tsx`), global footer (`DisclaimerBanner`, homepage `app/page.tsx`).

**Still open:** full manual walk of every checklist row below (copy review per surface, not automated grep).

---

## Surface-by-surface audit checklist

### §0 — Public site and assessment

#### `/assess` — Planning Assessment

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Score display copy | [ ] | Must read as "your self-reported readiness score" — not "your plan score" or "your grade" |
| Gap report section headers | [ ] | "Areas to explore with your advisor" — not "What you need to fix" |
| CTA after gap report | [ ] | "Discuss these gaps with a financial professional" — not "Upgrade your plan" as primary action |
| Logged-out gating copy | [ ] | "Create an account to see your full report" is fine; avoid "Your plan is incomplete" |
| Email capture CTA | [ ] | "Get your full readiness report" — not "Get your personalized plan" |

**Inline disclaimer required on score display:**
> "This score reflects your answers to a self-assessment questionnaire. It is
> not a professional evaluation of your financial or estate plan."

---

#### `/event/[slug]/assess` — Life Event Assessments (24 slugs)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Assessment result copy | [ ] | "Based on your answers, these are common areas to review" — not "Here's what you need to do" |
| CTA buttons | [ ] | "Talk to an advisor about this" / "Find an estate attorney" — not action directives |
| Urgency language | [ ] | Acceptable: "This is a time-sensitive planning area." Avoid: "You need to act now." |
| Event page hero copy | [ ] | Review all 24 slugs for any "you should" / "you need to" language in body text |

**Flagged slugs for priority review** (highest legal sensitivity):
- `/event/selling-a-business` — may include tax strategy language
- `/event/large-rsu-vest` — may include securities-adjacent language
- `/event/death-of-spouse` — beneficiary/titling urgency language risk
- `/event/serious-diagnosis` — incapacity planning urgency language risk

---

### §1 — Auth and Onboarding

#### `/profile` — Your Profile

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Profile completion prompt | [ ] | "Complete your profile so the planning tools can calculate your situation" — not "so we can build your plan" |
| Required field error copy | [ ] | Neutral field labels; avoid implying the platform makes decisions based on these |
| Post-save redirect copy | [ ] | If copy says "your plan is ready" → change to "your household profile is set up" |

---

#### `/onboarding/invite-advisor` — Invite Your Advisor

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Headline | [ ] | "Connect your advisor so they can see your household data" — not "Let us connect you with an advisor" |
| Value prop copy | [ ] | Emphasize: advisor sees your data, not that the platform recommends strategies to your advisor |
| Skip copy | [ ] | "Skip for now — you can connect an advisor anytime" — no urgency language |

---

### §2 — Financial Intake (Tier 1–2)

#### `/dashboard` — Estate Summary Dashboard

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| **Greeting + readiness score** | [ ] | Score must be labeled "Planning Readiness" or "Preparation Score" — not "Plan Health" or "Plan Grade" |
| **Readiness score copy** | [ ] | "Based on the information you've entered, your planning preparation is X% complete" — not "Your plan earns a B+" |
| **Conflict alert banner** | [ ] | "4 accounts have no named beneficiary — review with your advisor or attorney" — PASS: this is gap identification, not a directive |
| **Conflict severity chips** | [ ] | Labels like "Missing beneficiary" and "No will on file" are fine. Avoid: "Critical: action required immediately" |
| **LifeEventBanner** | [ ] | "Log a life event to update your household picture" — not "We'll update your plan" |
| **StrategyRecommendationPanel** | [ ] | "Your advisor has suggested the following strategies for your review" — make clear these come from a licensed professional, not the platform |
| **MonteCarloScenarioBanner** | [ ] | "Your advisor shared a retirement scenario — review it below" — not "Your retirement projection shows…" if advisor-sourced |
| **EstateCalloutCard** | [ ] | "Based on your assets, you may have federal estate tax exposure — review with your estate attorney" — PASS pattern |
| **Setup progress section** | [ ] | "Complete your household profile" — not "Complete your plan" |
| **Empty state CTAs** | [ ] | All empty states should prompt data entry, not promise a "plan" will be built |

**Dashboard inline disclaimer (add to page, not just footer):**
> "This dashboard reflects information you've entered. It is for planning
> preparation only — not financial, tax, or legal advice. Consult qualified
> professionals before making decisions."

---

#### `/projections` — Projections

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Page headline | [ ] | "Retirement Projections" — not "Your Retirement Plan" |
| Summary cards copy | [ ] | "At your current savings rate, projected balance at age 65 is $X" — PASS |
| Chart/table labels | [ ] | "Projected" not "Expected" or "Your plan shows" |
| Empty state CTA | [ ] | "Add income and expense data to see projections" — not "Start your retirement plan" |
| `ScenariosExploreCard` CTA | [ ] | "Explore different scenarios" — not "Optimize your plan" |

**Inline disclaimer required on projection outputs:**
> "Projections are estimates based on the assumptions you entered. They are not
> guarantees of future results. Discuss your retirement strategy with a licensed
> financial professional."

---

#### `/scenarios` — Scenarios

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Page intro copy | [ ] | "Compare how different assumptions affect your projected outcomes" — PASS pattern |
| Scenario labels | [ ] | "Scenario B" / "Scenario C" — user names them; avoid "Optimistic Plan" / "Conservative Plan" as defaults |
| Save to plan CTA | [ ] | "Save this scenario as a reference point" — not "Save your plan" |
| Comparison callouts | [ ] | Show the numeric difference — don't characterize which scenario is "better" |

---

#### `/complete` — Lifetime Snapshot

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Page headline | [ ] | "Lifetime Financial Snapshot" — not "Your Financial Plan" |
| Year-by-year table | [ ] | Column headers like "Projected Balance" — not "Plan Balance" |
| Expandable group labels | [ ] | Neutral descriptive labels only |

---

#### `/allocation` — Asset Allocation (Tier 2)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Current allocation display | [ ] | "Your current allocation across connected accounts" — PASS |
| **Target allocation** | [ ] | If the platform suggests or displays a "target" allocation: **REMOVE or REDESIGN** — suggesting a target allocation is securities advice. Replace with: "Enter your personal target allocation set by your advisor" |
| Allocation comparison | [ ] | If comparing current vs a suggested target: remove suggested target; show current vs user-entered target only |
| Copy near allocation data | [ ] | Remove any language like "your portfolio is X% aggressive" that implies a judgment |

**⚠️ High priority:** Any platform-generated allocation recommendation is the clearest investment advice trigger in the product. The allocation page must show *what the user has*, not *what they should have*, unless the target comes from the user or their advisor.

---

#### `/monte-carlo` — Monte Carlo Simulations (Tier 2)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Success rate display | [ ] | "In X% of simulated scenarios, this portfolio reached your stated goal" — PASS |
| Result characterization | [ ] | Do NOT say "your plan has a 62% chance of success" — say "62% of scenarios reached the target you entered" |
| Threshold language | [ ] | Do NOT say "financial planners typically target 80%+" — this implies a recommendation |
| Below-threshold copy | [ ] | Do NOT say "your plan needs improvement" or "you should increase savings" — say "Fewer scenarios reached your target. You may want to discuss this with your advisor." |
| Advisor-shared scenarios | [ ] | "Your advisor shared a Monte Carlo scenario. Review the assumptions below." — clear attribution to advisor |
| **Monte Carlo UI string pass (Sprint 17)** | [x] | `MonteCarloAssumptionsPanel.tsx` — "Scenarios Reaching Goal (%)"; `lib/monte-carlo.ts` — scenario/goal framing; `/monte-carlo` upgrade banner |

**Inline disclaimer required:**
> "Monte Carlo results show a range of possible outcomes based on your inputs.
> They are not a prediction of future performance. Discuss these results with a
> licensed financial professional."

---

#### `/roth` — Roth Conversion (Tier 2)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Conversion amount display | [ ] | "Converting $X would add approximately $Y to your estimated tax bill in [year]" — PASS |
| Conversion window copy | [ ] | "The window between retirement and RMD age is a common time to explore conversions" — acceptable educational framing |
| Recommendation copy | [ ] | Do NOT say "Converting now is optimal" or "You should convert before [date]" |
| Best-year callout | [ ] | If any "best year to convert" highlight exists: reframe as "Year with lowest estimated marginal rate based on your inputs" |
| CTA | [ ] | "Discuss Roth conversion timing with your tax advisor" — not "Start converting now" |

---

#### `/rmd` — RMD Calculator (Tier 2)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| RMD amount display | [ ] | "Your estimated RMD for [year] based on current balances is $X" — PASS |
| RMD start age copy | [ ] | "Based on your birth year, your RMD start age is 75 (IRS rules effective 2033)" — PASS |
| Instructional copy | [ ] | "The IRS requires minimum distributions from certain retirement accounts beginning at age X" — PASS: stating law is education |
| Action copy | [ ] | Do NOT say "you need to withdraw $X by December 31" — say "the IRS requires distributions by December 31 each year once you reach RMD age" |

---

#### `/social-security` — Social Security (Tier 2)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Benefit display | [ ] | "Estimated benefit at age X based on your inputs" — PASS |
| Claiming age comparison | [ ] | Show the break-even math without declaring an optimal claiming age |
| "Best age to claim" language | [ ] | **REMOVE** any copy declaring an optimal claiming age — replace with "Break-even age for delayed claiming based on your inputs: X" |
| Spousal benefit copy | [ ] | Educational framing: "Spousal benefits are available if..." — not "You should claim spousal benefits" |

---

### §3 — Estate Planning Surfaces (Tier 3)

#### `/estate-tax` — Estate Tax Snapshot

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Exposure display | [ ] | "Based on your current balance sheet, your estimated federal estate tax exposure is $X" — PASS |
| State estate tax copy | [ ] | Same pattern — estimated, based on inputs, state-specific |
| Exemption remaining | [ ] | "Remaining federal exemption: $X" — PASS |
| Alert copy | [ ] | "Your gross estate may exceed the federal exemption — this is worth reviewing with an estate attorney" — PASS |
| TCJA sunset note | [ ] | "Current exemptions are scheduled to change after 2025 under current law" — factual, PASS |
| **Do not include** | [ ] | Any copy suggesting specific strategies to reduce the tax ("a SLAT could reduce this by $X") — that belongs in Strategies tab, framed as education |

**Inline disclaimer wired (2026-05-24):** under Federal Estate Tax card in `_estate-tax-client.tsx` — `DISCLAIMER_STRINGS.estateTax`.

---

#### `/my-estate-strategy` — Estate Value and Tax Horizons

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Horizon table headers | [ ] | "Projected Estate Value" and "Estimated Tax" — not "Your plan shows" |
| Actual vs What-if labels | [ ] | "Current trajectory" vs "With strategies" — acceptable if strategies are user-entered, not platform-suggested |
| Hero tax cards | [ ] | Show the number with a label — avoid characterizing it as "high," "concerning," or "needs attention" |
| Comparison table | [ ] | Neutral column headers — no value judgments |
| Amber banner (missing inputs) | [ ] | "Some projections require additional profile data. Complete your profile for full estimates." — PASS |
| Strategy line impact | [ ] | "With strategies you've entered, estimated exposure changes to $X" — PASS (user-entered) |

**Inline disclaimer wired (2026-05-24):** below horizon table in `_my-estate-strategy-client.tsx` — `DISCLAIMER_STRINGS.estateStrategy`.

---

#### `/my-family` — My Family (Tier 3)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Page intro | [ ] | "Enter household members to improve the accuracy of estate planning calculations" — PASS |
| Family member prompts | [ ] | Neutral data collection only — no advisory language |

---

#### `/titling` — Titling & Beneficiaries (Tier 3)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Missing beneficiary alerts | [ ] | "These accounts have no named beneficiary on file" — PASS (gap identification) |
| Titling gap copy | [ ] | "These assets appear to be titled personally — review with your attorney whether trust titling is appropriate for your situation" — PASS (defers to professional) |
| Action prompts | [ ] | "Update this in your account or with your advisor/attorney" — not "You must retitle this" |

---

#### `/incapacity-planning` — Incapacity Planning (Tier 3)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Document checklist | [ ] | "Common incapacity planning documents include..." — educational framing, PASS |
| Missing document alerts | [ ] | "No healthcare directive on file — review with your estate attorney" — PASS |
| Do not include | [ ] | Any specific legal advice about what documents to execute or in what order |

---

#### `/domicile-analysis` — Domicile Analysis (Tier 3)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| State comparison display | [ ] | Show tax numbers per state — neutral, user decides |
| "Best state" copy | [ ] | **REMOVE** any language declaring an optimal domicile — replace with "States with no estate tax as of [year]: [list]" |
| Recommendation copy | [ ] | Do NOT say "Moving to [State] could save you $X" — say "In [State], your estimated estate tax would be $X based on current law" |
| CTA | [ ] | "Discuss domicile options with your estate attorney and tax advisor" — PASS |

---

### §4 — Gifting, Strategies & Trusts (`/my-estate-trust-strategy`)

This page is the highest regulatory risk surface. Every tab requires careful review.

---

#### Tab: Annual Gifting (`?tab=gifting`)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Lifetime exemption meter | [ ] | "Lifetime exemption used: $X of $Y" — PASS |
| Annual cap warnings | [ ] | "This recipient has received gifts exceeding the annual exclusion ($18,000)" — PASS (statement of fact/law) |
| Over-limit amber copy | [ ] | "Gifts above this amount use your lifetime exemption — review with your tax advisor" — PASS |
| "Save to my plan" CTA | [ ] | "Record this gifting activity" — not "Add to your estate plan" |
| Prior taxable gifts copy | [ ] | "Taxable gifts reported on Form 709 are tracked here" — PASS (factual) |

---

#### Tab: Charitable Giving (`?tab=charitable`)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Summary card labels | [ ] | "Total donated this year," "Estimated tax deductible amount" — PASS |
| QCD eligibility banner | [ ] | "You may be eligible for Qualified Charitable Distributions based on your age and account type — discuss with your tax advisor" — PASS |
| `buildPersonalizedCharitableTopics` output | [ ] | **HIGH RISK:** These are personalized to the household. Review every topic string. They must describe strategies, not recommend them. |
| Charitable topic framing | [ ] | "A Donor-Advised Fund allows you to..." — PASS. "Given your income, a DAF would benefit you" — FAIL |
| Deduction detail copy | [ ] | "Estimated deductible amount based on AGI limits" — PASS |
| AGI limit explanation | [ ] | "The IRS limits cash donation deductions to 60% of AGI" — factual, PASS |
| "Save to my plan" CTA | [ ] | "Record this charitable giving strategy" — not "Add to your plan to reduce taxes" |

---

#### Tab: Transfer Strategies (`?tab=strategies`) — **Highest Risk Tab**

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| **Strategy pills intro copy** | [ ] | "Learn about transfer strategies commonly used in estate planning" — not "Strategies recommended for your situation" |
| **GRAT panel** | [ ] | Must describe what a GRAT is, how it works, what it's typically used for — not personalize to the user's §7520 rate without advisor |
| **SLAT panel** | [ ] | Same — educational description + "Ask your advisor about this" CTA |
| **ILIT panel** | [ ] | Same pattern |
| **CRT panel** | [ ] | Same pattern |
| **CLAT panel** | [ ] | Same pattern |
| **DAF panel** | [ ] | Same pattern (lower risk — charitable, not securities) |
| **Roth Conversion pill** | [ ] | "Learn how Roth conversions work in estate planning context" — link to `/roth` for calculations |
| **Liquidity panel** | [ ] | "Liquidity planning addresses having accessible assets to cover estate costs" — educational, PASS |
| **"About this strategy" card copy** | [ ] | Must be generic description, not personalized assessment |
| **"Ask your advisor about this →"** | [ ] | This CTA is the correct pattern — keep it as the primary CTA on every strategy panel |
| **Advisor Recommended Strategies block** | [ ] | "Your advisor has recommended the following strategies for your review" — attribution to licensed advisor is critical |
| **Accept/reject copy** | [ ] | "Add to my household picture" (accept) / "Decline" (reject) — not "Apply to my plan" |
| **StrategyHorizonTable** | [ ] | If strategy impact is shown: "With this strategy recorded, estimated estate value changes to $X" — make clear it's a calculation, not a guarantee |

**⚠️ Priority strings to audit in `ConsumerStrategyPanel.tsx` and `lib/estate/planningTopicPresentation.ts`:**

Any string that uses:
- "for your situation" / "for your estate" → replace with "in situations like this" or just remove
- "we recommend" / "consider" / "you should" → replace with "commonly used when" / "ask your advisor whether"
- "could save you $X" → replace with "in this scenario, estimated exposure changes by $X"
- "optimal" / "best" → remove entirely

---

#### Tab: Trusts & Documents (`?tab=trusts`)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Summary strip | [ ] | "Estimated Taxable Estate: $X | Federal Exemption Remaining: $Y | Headroom Before Federal Tax: $Z" — PASS |
| Trust list | [ ] | User-entered data display — PASS |
| "~Est. Tax Saved" column | [ ] | Label must say "Estimated" and include a note: "Based on trust type and assets entered — not a legal determination." |
| Educational planning topics | [ ] | `lib/estate/planningTopicPresentation.ts` — review all topic strings for personalization vs. generic education |
| Pour-Over Will topic | [ ] | "A Pour-Over Will directs assets into your trust at death" — PASS (definition) |
| Business Succession Trust topic | [ ] | Same — describe, don't prescribe |
| Common planning topics intro | [ ] | "Common estate planning documents and their purposes" — not "What you need" |
| CTA on each topic | [ ] | "Ask your estate attorney whether [topic] is appropriate for your situation" — this is the correct pattern |

---

#### `/print` — Export Estate Plan

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Document title | [x] | "Estate Planning Preparation Report" — not "Your Estate Plan" — **wired 2026-05-24** |
| PDF cover page | [x] | `DISCLAIMER_STRINGS.pdfCover` on page 1 before household data — **wired 2026-05-24** |
| Attorney summary variant | [x] | "Prepared by [User] to share with their estate attorney" — **wired 2026-05-24** (`prepared_by_name` from API) |
| Section headers in PDF | [x] | "Your household's current picture" — **wired 2026-05-24** (checklist section) |

**Required PDF disclaimer (page 1, attorney summary variant):**
> "This document was prepared by the account holder using My Wealth Maps, a
> financial planning preparation tool. It reflects information entered by the
> user and is intended to support a conversation with qualified legal and
> financial professionals. It is not legal or financial advice and does not
> constitute an estate plan."

---

### §5 — Advisor and Attorney Network Surfaces

#### `/my-advisor` — My Advisor

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Connection status copy | [ ] | "Your advisor can view your household data and share scenarios with you" — PASS |
| Disconnect copy | [ ] | "Remove [Name]'s access to your household data" — PASS |
| Advisor referral copy | [ ] | "Find a financial advisor in our directory" — not "We'll match you with an advisor" |

---

#### `/my-attorney` — My Attorney (Tier 2+)

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Attorney access copy | [ ] | "Your attorney can view a summary of your estate planning data" — PASS |
| Attorney referral copy | [ ] | "Find an estate attorney in our directory" — not "We'll connect you with an attorney" |
| Legal relationship disclaimer | [ ] | Must be visible: "Connecting an attorney through My Wealth Maps does not create an attorney-client relationship." |

---

#### `/find-advisor`, `/find-attorney` — Directories

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Directory intro copy | [ ] | "Find a financial advisor or estate attorney to work with" — PASS |
| Listing copy | [ ] | Professional bio, credentials, contact — no "recommended for you" framing |
| `?ref=` / `?aref=` attribution | [ ] | Attribution is tracking only — no "recommended by My Wealth Maps" copy anywhere |

---

### §6 — Global / Cross-Cutting Items

#### Disclaimers

| Item | Check | Finding / Required change |
|------|-------|--------------------------|
| Footer disclaimer | [x] | `DISCLAIMER_STRINGS.footer` in `DisclaimerBanner` + homepage — **wired 2026-05-24** |
| Inline disclaimers | [x] | Required surfaces wired — projection, Monte Carlo, Roth, estate tax, allocation, strategy panels, dashboard, assess, PDF cover — **2026-05-24** |
| Dashboard disclaimer | [x] | Inline on readiness score — **2026-05-24** |
| PDF disclaimer | [x] | Per `/print` section — **2026-05-24** |
| Assessment disclaimer | [x] | Per `/assess` section — **2026-05-24** |

**Minimum required footer text:**
> "My Wealth Maps provides financial planning preparation tools for educational
> purposes only. Nothing on this platform constitutes financial, investment,
> tax, or legal advice. Always consult a qualified financial advisor, CPA, or
> estate attorney before making decisions about your finances or estate plan.
> My Wealth Maps is not a registered investment adviser."

---

#### Scoring and grading language (global)

Any "score," "grade," or "rating" in the product must be:
1. Labeled as a "preparation score" or "completion percentage" — not a quality grade
2. Described as reflecting data entered — not a professional assessment
3. Accompanied by an inline note about what it measures

**Find and replace pass — search codebase for:**
```
"plan health"
"plan grade"
"plan score"  
"your plan is"
"we recommend"
"you should"
"you need to"
"action required"
"optimize your"
"improve your plan"
"earns a"
"rated"
"based on your profile, we suggest"
```

---

#### Empty state CTAs (global)

Empty states that prompt action are fine. Audit for framing:

| Current pattern | Required change |
|----------------|-----------------|
| "Start your estate plan" | "Set up your household profile to unlock estate planning tools" |
| "Build your retirement plan" | "Add retirement accounts to see projections" |
| "Complete your plan" | "Add more information for more accurate estimates" |
| "Your plan is incomplete" | "Your household profile has missing data" |

---

## Implementation plan

### Phase 1 — String audit (3 days)
**Owner:** Engineering + Product  
**Method:** Grep/search codebase for all flagged strings (list above). Log each instance in a tracking sheet with: file path, line number, current string, proposed replacement, risk level.

Files to prioritize:
- `components/consumer/ConsumerStrategyPanel.tsx`
- `lib/estate/planningTopicPresentation.ts`
- `lib/planning/planningEmptyState.ts`
- `components/dashboard/*`
- `app/(dashboard)/monte-carlo/*`
- `app/(dashboard)/allocation/*`
- `app/(dashboard)/social-security/*`
- `app/(dashboard)/domicile-analysis/*`
- `lib/events/content.ts` and `lib/events/content-sprint5.ts` (24 event pages)
- PDF export templates (`/api/export-estate-plan`)

---

### Phase 2 — High-risk fixes (2 days)
**Owner:** Engineering  
**Scope:** Fix all FAIL items from the audit. Priority order:

1. Asset allocation — remove any platform-suggested target allocation
2. Monte Carlo — `MonteCarloAssumptionsPanel.tsx` + `lib/monte-carlo.ts` insight strings (Sprint 17); remove "plan success rate" / "you should increase savings" language
3. Transfer Strategies tab — remove all personalized "for your situation" framing from strategy panels
4. Social Security — remove "optimal claiming age" declarations
5. Domicile Analysis — remove "best state" recommendations
6. `buildPersonalizedCharitableTopics` — audit every personalized string

---

### Phase 3 — Add inline disclaimers (1 day)
**Owner:** Engineering  
Required inline disclaimers to add (per §2–§3 above):
- Dashboard
- `/projections`, `/complete`, `/scenarios`
- `/monte-carlo`
- `/roth`
- `/estate-tax`
- `/my-estate-strategy`
- `/my-estate-trust-strategy` (strategies tab)
- PDF export

---

### Phase 4 — QA sign-off (1 day)
**Owner:** Product  
Walk every surface in the audit checklist and mark each item Pass or Fail.
Zero open FAIL items before merging.

---

### Phase 5 — Doc update
**Owner:** Product  
- Update `docs/CONSUMER_FLOWS.md` — note inline disclaimer locations
- Add "UX language audit passed [date]" to `docs/LAUNCH_CHECKLIST.md`
- Update `docs/NEXT_SESSION.md` with audit completion status
- Archive this doc with pass/fail results filled in

---

## Definitions for the codebase

Add these to a shared `lib/compliance/language-policy.ts` as comments or
exported constants so engineers have a reference while building new features.

**Implemented:** see [`lib/compliance/language-policy.ts`](../lib/compliance/language-policy.ts) (committed 2026-05-24).

```ts
/**
 * LANGUAGE POLICY — My Wealth Maps
 *
 * This platform is an educational planning preparation tool.
 * It is not an investment adviser, financial planner, or legal counsel.
 *
 * ALWAYS:
 * - Frame outputs as calculations based on user-entered inputs
 * - Label projections as estimates ("projected," "estimated," "based on inputs")
 * - Point CTAs to professional advisors and attorneys for decisions
 * - Include inline disclaimers near financial outputs
 * - Attribute advisor recommendations to the licensed advisor, not the platform
 *
 * NEVER:
 * - Tell users what they "should" do with money or assets
 * - Declare an "optimal" strategy, allocation, or timing
 * - Present platform-generated outputs as professional advice
 * - Say "your plan" when you mean "your household data"
 * - Show a target allocation the platform generated (vs. user- or advisor-entered)
 * - Characterize a score or result as good/bad without a disclaimer
 */
```

---

## Completion criteria

This sprint is done when:

- [ ] All items in every surface checklist are marked Pass (manual QA walk)
- [x] Zero instances of flagged strings remain in the codebase (grep confirms) — **2026-05-24**
- [x] All required inline disclaimers are live in code (`DISCLAIMER_STRINGS` surfaces wired) — **2026-05-24**
- [x] Footer disclaimer updated to final version — **2026-05-24**
- [x] PDF export disclaimer added — **2026-05-24**
- [x] `lib/compliance/language-policy.ts` committed — **2026-05-24**
- [x] This doc committed to `docs/` — **2026-05-24**
- [x] Entry added to `LAUNCH_CHECKLIST.md` — **2026-05-24**

---

## Related docs

| Doc | Relationship |
|-----|-------------|
| [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) | Source of truth for all consumer surfaces audited here |
| [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) | Route and tier reference |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Go-live gates; legal + C-4 manual verify before open signups |
| [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) | C-4 manual Stripe verify (code complete) |
| [LEGAL_TODO.md](./LEGAL_TODO.md) | C-5 legal gate |
| [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) | Add spot-check of disclaimer presence to smoke test §1–3 |
| [UPDATE_CHECKLIST.md](./UPDATE_CHECKLIST.md) | Follow doc sync process when strings change |
| [`lib/compliance/language-policy.ts`](../lib/compliance/language-policy.ts) | Canonical disclaimer strings and banned phrases |
| [`scripts/audit-ux-language.sh`](../scripts/audit-ux-language.sh) | Automated grep audit (run before consumer copy PRs) |

---

*Sprint C-2b created 2026-05-24. Owner: Product + Engineering.  
C-2b engineering complete (`788aa08`). Compliance code C-2b–C-5 closed on `main`. **Remaining signup gates (non-code):** [LEGAL_TODO.md](./LEGAL_TODO.md) + C-4 manual verify — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md).*
