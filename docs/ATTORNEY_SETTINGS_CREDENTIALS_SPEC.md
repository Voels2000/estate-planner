# Attorney settings — credentials and practice section

Target: `/attorney/settings` (Firm settings page). New section below existing
firm/contact fields. Data model is already live on staging per #230 — this is UI
only, no further migration needed for the four fields below.

## Decision: bar number is optional; practice profile gates paid consumers

Only 2 of 18 seeded attorneys (Macey-Cushman, Flaggert) have a parseable bar number
today. Making bar number required to save settings, or required to fully "activate" a
listing, would block the other 16 from completing their profile at all — and there's
no verification step behind it anyway (self-attested per #212). **Bar number stays
optional for saving settings.**

**Practice & credentials profile is required before paid consumer connections:**

| Situation | Practice profile required? |
|-----------|---------------------------|
| First free client (connection billing on, billable qty stays 0) | No |
| Second+ client (attorney connection billing applies) | **Yes** |
| Consumer with their own paid subscription (`active` / `trialing` / `canceling`) | **Yes** |
| Saving `/attorney/settings` | No — all fields optional except validation (enum, array shape) |

Required fields for the paid-consumer gate (all four):

- `states_licensed[]` — at least one state
- `specializations[]` — at least one practice area from the fixed checklist
- `credentials[]` — at least one tag
- `fee_structure` — one of the fixed enum values

Implementation: `lib/attorney/attorneyListingPracticeProfile.ts` · wired into
`accept-request`, `grant-access`, `accept-invite`, and intake complete.

If you want a harder incentive later (e.g. "verified" badge in `/find-attorney` once
bar number + at least one state is filled), that's a separate, additive feature — not
a blocker for shipping this UI.

## Fields

| Field | DB column | Source today | UI type | Save | Paid-consumer gate |
|---|---|---|---|---|---|
| Bar number | `bar_number` | Seed (2/18) or self-attest | Text input, single value | Optional | No |
| States licensed | `states_licensed[]` | Claim API only today (1 row: Bryce Mackay) | Multi-select / chip input | Optional | **Required** |
| Practice areas | `specializations[]` | Regex-tagged on import (13/14 attorneys have *something*, but crude) | Checklist (see below) | Optional | **Required** |
| Credentials | `credentials[]` | Regex-tagged on import (sparse — ACTEC, LL.M. where notes matched) | Tag input, freeform + suggestions | Optional | **Required** |
| Fee structure | `fee_structure` | Freeform text today ("hourly") | Select, fixed enum | Optional | **Required** |

## Practice areas checklist (confirmed)

Fixed list (stored as slugs):

- `estate-planning` — Estate planning
- `trusts` — Trusts
- `probate` — Probate
- `tax-planning` — Tax planning
- `business-succession` — Business succession
- `elder-law` — Elder law

**Overwrite on save:** saving the checklist replaces `specializations[]` (does not merge
with regex seed tags). First visit may show legacy regex tags pre-checked where they map
to a slug; attorney can correct and save.

## Fee structure enum (confirmed)

| Value | Label |
|-------|-------|
| `hourly` | Hourly |
| `flat-fee` | Flat fee |
| `hybrid` | Hybrid |
| `consultation` | Consultation-based |

Legacy freeform values map on read/save (`hourly`, `flat fee`, etc.). Unmapped legacy
values show as unset until the attorney picks an enum option.

## Credentials — freeform tag input

Unlike practice areas, credential types are open-ended (WSBA, CFP, JD, LL.M., ACTEC,
AEP, and others not yet seen). Tag input with autocomplete against credentials already
seen in the dataset, plus free entry for anything new — not a fixed checklist.

## Not addressed here

- `/find-attorney` filter behavior — it already filters on `specializations` and
  `states_licensed`; this UI just gives attorneys a way to populate what the filter
  already reads. No filter-side changes needed.
- Advisor settings equivalent (CRD number, same pattern) — separate pass if wanted.
- Any "verified" badge or directory ranking tied to completeness — explicitly out of
  scope unless added as a follow-up.

## Known gap — directory quality (backlog, not billing)

**Confirmed scope (2026-07-02):** Do **not** tighten the paid-consumer gate to include
the first free connection. Billing integrity is satisfied as shipped.

**Residual gap:** An attorney who never grows past their one free client and never
connects a consumer on their own paid subscription can stay permanently **ungated** —
their `/find-attorney` listing may remain live and discoverable with empty
`specializations`, `states_licensed`, and `credentials`. That is a **directory-quality**
problem, not a billing-integrity problem.

**Follow-up (lighter touch, not urgent):** Dismissible nudge in `/attorney/settings`
(and/or portal dashboard) for claimed listings with incomplete practice profile —
separate from the existing paid-connection completeness banner. Optional later:
soft ranking or “profile incomplete” indicator on `/find-attorney` (out of scope for
v1). Tracked in [ROADMAP.md](./ROADMAP.md) backlog.
