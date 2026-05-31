# Score taxonomy
Last updated: 2026-05-29

This document is the authoritative list of scores and metrics in My Wealth Maps.
Before adding a new score or metric, check this file.
If something similar exists, extend it — do not add a new one.

---

## Consumer-facing scores (2 total — do not add more)

### 1. Estate readiness (0–100)
- Source: `estate_health_scores` table, `computeEstateHealthScore()`
- Label: `ESTATE_READINESS_LABEL` (`'Estate readiness'`) everywhere — no variants (not "Foundation", not "plan health")
- Six components: Documents (20), Incapacity (15), Beneficiaries (20), Titling (15), Domicile (15), Tax awareness (15)
- Benchmark: show vs. avg. American (~28) and avg. MWM user (~63) — **Sprint B**; constants are hardcoded until enough users exist to compute platform averages from `estate_health_scores` (future sprint: config table, monthly refresh)
- Surfaces: Consumer dashboard (States 2+3), /health-check completion, /my-estate-strategy, consumer PDF export
- NOT shown: Advisor complexity score, letter grade, raw completeness %

### 2. Planning Readiness Assessment (0–100, pre-account)
- Source: `assessment_results` table
- Label: "Planning Readiness Assessment"
- Three pillars: Financial, Retirement, Estate
- Surfaces: /assess, /event/[slug]/assess, AssessmentHistoryWidget
- Superseded by Estate readiness once user creates an account and enters data
- Never show both simultaneously

---

## Advisor-only scores (never consumer-facing)

### Estate Complexity Score (0–20)
- Source: `households.estate_complexity_score`, `generate_estate_recommendations` RPC
- Label: "Complexity" on advisor client overview
- Purpose: Advisor triage — how much work does this household require?
- Surfaces: Advisor OverviewTab, MeetingPrepTab complexity badge, attorney portal `EstatePlanningDashboard`

### Estate Completeness (0–100 + letter grade)
- Source: `calculate_estate_completeness` RPC
- Purpose: Attorney intake triage, advisor completeness tracking
- Consumer surfaces: **RETIRED** — removed in Sprint A score rationalization
- Advisor surfaces: `EstatePlanningDashboard` (attorney portal only), advisor PDF `CompletenessSection`
- Do NOT add this back to consumer views — Estate readiness serves the same purpose

---

## Internal gates (never labeled as "scores" to users)

### Retirement unlock gate
- Threshold: 5 of 7 checklist items complete (internal — not shown to users)
- Display: "X of Y steps complete" or checklist with checkmarks
- Never display: percentage, score label, or the threshold number

### Execution checklist
- Display: "X of Y items complete"
- Never display: percentage or score label

---

## Banned labels (do not use in consumer-facing strings)
- "plan health" or "plan health score" → use "Estate readiness"
- "Foundation score" → use "Estate readiness"
- "Grade F/D/C/B/A" → remove from consumer views
- Any percentage that implies a grade or judgment without context

---

## How to add a new metric
1. Check this file first — does something similar exist?
2. If yes: extend it, don't add a new one
3. If no: add it here with source, label, surfaces, and who sees it
4. Consumer-facing additions require product review — the goal is 2 scores, not 3
