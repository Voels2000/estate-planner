# My Wealth Maps — Multi-State Privacy & Terms Draft

**Status:** DRAFT for attorney redline · not legal advice · prepared as a leading-practice baseline
**Scope:** U.S.-only service (consumers, financial advisors, estate attorneys) · primary nexus: Washington State
**How to use this:** Parts 1–3 are drop-in draft language. Part 4 is the open-questions list your counsel must resolve before launch. Bracketed `[COUNSEL: …]` and `[CONFIRM: …]` tags mark every judgment call so nothing gets adopted silently.

> I am not a lawyer and this is not legal advice. This is a structured starting point built from the current statutory landscape (20 states with comprehensive consumer privacy laws in effect as of 2026) so that the billable redline starts from a strong draft instead of a blank page.

---

## Part 0 — The compliance strategy in one page

**Model chosen: unified policy, anchored to the strictest standard, rights extended to all U.S. residents, with thin state-specific addenda.**

Three competing models exist:

1. **State-by-state** — a separate notice/flow per state. Maximum precision, maximum operational drag, highest error rate. Rejected.
2. **Lowest common denominator** — comply only where legally forced by threshold. Cheapest today, but brittle: thresholds get crossed as you grow, and it's a poor trust signal for a HNW estate-planning audience. Rejected as the primary posture.
3. **Highest common denominator (recommended)** — one policy built to California's CCPA/CPRA plus the Virginia-model rights, granted to every U.S. resident, with addenda only where a state compels specific wording. This is what mature SaaS companies run.

**Why this fits My Wealth Maps specifically**

- Your audience is high-net-worth households trusting you with sensitive financial and family data. Over-compliance is a feature, not a cost.
- You are B2B2C across three personas in (potentially) all 50 states. Residency-gating privacy rights would mean detecting and segmenting every user — expensive and fragile. Extending rights to all U.S. residents removes that burden entirely.
- You are pre-launch and almost certainly **below the applicability thresholds** of most state laws today (typically 100,000 residents, or 25,000 + 50% of revenue from selling data). Building to standard now is cheaper than retrofitting after you cross a threshold mid-growth, and a few state laws (e.g., Texas, Nebraska, Rhode Island) have very low or effectively no thresholds. `[COUNSEL: confirm which, if any, state laws apply by threshold today; the recommendation is to comply voluntarily regardless.]`

**The "Washington WCPA" correction (important)**

Your current Privacy Policy §4/§7, the admin UI, the SQL migration comment, and the compliance calendar all attribute consumer privacy rights to the "Washington WCPA." WCPA = RCW 19.86, the **Consumer Protection Act** (a general unfair/deceptive-practices statute). It is **not** a privacy-rights law, and **Washington has no comprehensive consumer privacy law** in effect. The access/delete/correct/port/opt-out rights you list come from *other* states. Recommended fixes:

- Reframe the rights section as applying to **all U.S. residents** (not "Washington residents," not "WCPA").
- **Keep** your genuinely Washington-specific obligations, which are real and statute-backed:
  - **RCW 19.316** — subscription auto-renewal disclosures (your §5.2 is solid; keep it).
  - **RCW 19.255.010** — data-breach notification (your Privacy Policy §10 is correct; keep it).
  - **Washington My Health My Data Act (MHMD)** — applies *only* if you collect "consumer health data." See Part 4, Q1 — this is your single highest-risk open question.
- Stop citing **WCPA** and **MHMD** as the "legal basis" for general data processing (current §4). They are not GDPR-style "legal basis" statutes. Replace with a plain purposes-of-processing section (drafted below).

**The four structural moves this draft makes**

1. Replace WA-scoped rights with a single all-U.S.-residents rights section, anchored to CCPA + Virginia model.
2. Add the **appeals process** (60-day response + AG-complaint path) — required by Virginia-model states and currently missing.
3. Add a **California addendum** (Notice at Collection, Do Not Sell/Share, authorized agents, sensitive-data limits) and a compact **state-rights matrix**.
4. Recognize a **universal opt-out mechanism** (Global Privacy Control) — required in CA, CO, CT, TX and spreading — plus add **Sentry** as a subprocessor and add **consent/notice** to the assessment email-capture flow.

---

## Part 1 — Draft Privacy Policy (unified, multi-state)

> Replace the existing `lib/legal/privacy-policy-sections.ts` content with the structure below once redlined. Keep your existing strong sections (breach §10, security §9, "we do not sell" commitments) — they are carried forward here with light edits.

### 1. Introduction & Scope
My Wealth Maps ("My Wealth Maps," "we," "us") provides estate-planning software to U.S. residents. This Privacy Policy explains what personal data we collect, how we use it, who we share it with, and the rights you have. It applies to consumers, financial advisors, and estate attorneys using the Service.

We extend the privacy rights described in Section 7 to **all United States residents**, regardless of whether your state of residence has a law requiring them. Where a specific state mandates additional disclosures or rights, those are set out in the state-specific addenda at the end of this Policy.

`[CONFIRM: effective date and version number to match your terms-acceptance/versioning system.]`

### 2. Information We Collect
- **Information you provide:** account details (name, email), household and beneficiary information, asset and estate-planning inputs, and content you enter to use the Service.
- **From advisors/attorneys:** where a professional invites or collaborates with a household, we process the data necessary to provide that collaboration.
- **Automatic collection:** device and usage information (browser type, operating system, IP address) and cookies/similar technologies used for session management and preferences. We do **not** use advertising cookies or third-party tracking pixels.
- **Payment information:** processed by Stripe; we do not receive or store your full card details.

`[COUNSEL: confirm whether any field collected constitutes "sensitive data" under state law — e.g., precise geolocation, or any health-related field such as an advance directive, healthcare proxy, or incapacity/long-term-care input. If yes, opt-in consent and the MHMD analysis in Part 4 apply.]`

### 3. How We Use Your Information
We use personal data to: provide and operate the Service; perform estate-tax and planning calculations; enable advisor/attorney collaboration you authorize; process payments and manage subscriptions; communicate with you (including service messages and, with your consent, marketing); maintain security and prevent fraud; and comply with law. We do **not** use your data to train AI models.

### 4. Purposes & Basis for Processing
We process personal data to deliver the Service you request, to meet our legal obligations, to protect the Service and our users, and — for marketing communications only — based on your consent, which you may withdraw at any time.

> Replaces the prior "Legal Basis (WCPA/MHMD)" framing, which mischaracterized those statutes.

### 5. How We Share Information — Service Providers (Subprocessors)
We share data only with vendors that process it on our behalf under a Data Processing Agreement:

| Provider | Purpose | Data location |
|---|---|---|
| Supabase | Database & authentication | United States |
| Vercel | Application hosting | United States |
| Stripe | Payment processing (does not receive financial-planning data) | United States |
| Resend | Transactional & marketing email delivery | `[CONFIRM]` |
| **Sentry** | **Error monitoring (errors only; no tracing, replay, or PII — `sendDefaultPii: false`)** | `[CONFIRM]` |

We do **not** sell your personal information, share it with advertisers, or disclose it for cross-context behavioral advertising.

`[COUNSEL: confirm DPAs are executed with each, and that the "we do not sell/share" statement holds under each state's broad statutory definition of "sale"/"share."]`

### 6. Data Retention & Deletion
We retain personal data while your account is active. If you delete your account, we delete your personal data within 30 days, except where law requires retention (e.g., billing records for 7 years per IRS requirements). Upon termination, data is deleted within 30 days consistent with this Policy.

### 7. Your Privacy Rights (All U.S. Residents)
We provide every U.S. resident the following rights, subject to verification of identity:
- **Access / Know** — what personal data we process about you.
- **Correction** — fix inaccurate personal data.
- **Deletion** — delete your personal data.
- **Portability** — receive your data in a structured, machine-readable format.
- **Opt-out of sale and of targeted advertising** — though we do not sell data or use it for targeted advertising.
- **Opt-out of profiling** that produces legal or similarly significant effects. `[CONFIRM: the Service does not perform such profiling; if true, state so.]`
- **Withdraw consent** to marketing at any time.
- **Appeal** a denial of any request (see Section 8).

**How to exercise:** submit a request in-app (Settings → Security → Privacy Rights) or email privacy@mywealthmaps.com. We respond within **45 days** and may extend once by an additional 45 days where reasonably necessary, with notice to you. You will receive a confirmation email with a reference ID. We will not charge you for up to two requests per 12-month period.

**Authorized agents:** you may use an authorized agent to submit a request. We may require the agent to provide proof of authorization and may require you to verify your identity directly. `[COUNSEL: California-specific agent rules; confirm intake handles agent designation.]`

**Sensitive data:** where we process any sensitive data, we do so only with your opt-in consent and you may withdraw that consent. `[COUNSEL: tie to the Part 4, Q1 outcome.]`

### 8. Appeals
If we decline to act on a request, we will tell you why within the response window and explain how to appeal. To appeal, reply to your confirmation email or email privacy@mywealthmaps.com with your reference ID. **We will respond to an appeal in writing within 60 days.** If we deny your appeal, we will provide a method to submit a complaint to your state Attorney General. This appeals process is available to all U.S. residents.

> Fills the documented gap: schema allowed `status: 'denied'` with no policy/SOP language. Add a denial-reason + appeal-instructions template to the confirmation/decision emails and a `status: 'appealed'` path in the SOP.

### 9. Data Security
Encryption in transit (TLS 1.2+); encryption at rest (AES-256 via Supabase); row-level security; email verification; optional two-factor authentication; short-lived tokens. No method is perfectly secure, but we maintain administrative, technical, and physical safeguards appropriate to the sensitivity of the data.

### 10. Data Breach Notification
In the event of a data breach affecting your personal information, we will notify you within 30 days of discovery, as required by Washington RCW 19.255.010. If the breach affects more than 500 Washington residents, we will also notify the Washington Attorney General. We will additionally comply with the breach-notification laws of your state of residence. `[COUNSEL: all 50 states have breach-notice laws with varying timelines; confirm the catch-all language is sufficient or whether to enumerate.]`

### 11. Cookies & Tracking
We use cookies/similar technologies for session management and preferences only. We do not use advertising cookies or third-party tracking pixels. We honor recognized **universal opt-out / browser privacy signals (e.g., Global Privacy Control)** as a valid opt-out of sale/sharing where applicable. `[COUNSEL/ENG: confirm GPC detection is implemented or scheduled — required in CA, CO, CT, TX.]`

### 12. Children's Privacy
The Service is intended only for adults 18 and older. We do not knowingly collect personal information from anyone under 18. If we learn we have collected such data, we will delete it. `[Resolves the prior under-13 vs. 18+ eligibility mismatch by aligning the children's section with the 18+ ToS eligibility.]`

### 13. Changes to This Policy
We will post changes here and update the version/effective date; material changes will be communicated as required by law.

### 14. Contact
privacy@mywealthmaps.com · `[CONFIRM mailing address]`

---

## Part 2 — State-Specific Addenda

> Append after the main policy. These exist only because specific states compel specific wording; the substantive rights are already granted to everyone in Section 7.

### Addendum A — California (CCPA/CPRA)
- **Notice at Collection:** the categories of personal information we collect and the purposes are described in Sections 2–3. We do not sell or share personal information.
- **"Do Not Sell or Share My Personal Information" / "Limit the Use of My Sensitive Personal Information":** we do not sell or share personal information or use sensitive personal information beyond providing the Service; California residents may still exercise the opt-out via Section 7 and via GPC.
- **Categories disclosure (12-month):** `[COUNSEL: insert the CCPA category table — identifiers, commercial info, internet activity, etc. — mapped to collection/use/disclosure.]`
- **Authorized agents & Shine the Light:** addressed in Section 7. `[COUNSEL: add Shine-the-Light (Cal. Civ. Code §1798.83) statement.]`
- **Non-discrimination:** we will not discriminate against you for exercising your rights.

### Addendum B — Colorado, Connecticut, Oregon, Texas, and other Virginia-model states
Residents of these states have the access, correction, deletion, portability, opt-out (sale/targeted advertising/profiling), and appeal rights in Sections 7–8. We honor universal opt-out mechanisms. Sensitive data is processed only with opt-in consent.

### Addendum C — Minors (13–17)
Where applicable state law requires consent before processing the data of consumers aged 13–17 for targeted advertising or sale, we do not engage in such processing. (The Service is 18+; this addendum is protective only.)

### Addendum D — Washington (state-specific, non-privacy-law obligations)
- **Auto-renewal (RCW 19.316):** see Terms of Service §5.2 and the pre-checkout/pricing disclosures.
- **Breach notification (RCW 19.255.010):** see Section 10.
- **My Health My Data Act:** `[COUNSEL: include a dedicated Consumer Health Data section ONLY if Part 4, Q1 concludes you collect "consumer health data." If so, MHMD requires a separate Consumer Health Data Privacy Policy, opt-in consent for collection, and a separate written authorization to share — and carries a private right of action.]`

### State Rights Matrix (internal reference — not necessarily published)
| Right | CA | VA-model (CO/CT/TX/OR/etc.) | Other states / all US |
|---|---|---|---|
| Access / Know | ✓ | ✓ | ✓ (extended) |
| Correct | ✓ | ✓ | ✓ (extended) |
| Delete | ✓ | ✓ | ✓ (extended) |
| Portability | ✓ | ✓ | ✓ (extended) |
| Opt-out of sale/share | ✓ | ✓ | ✓ (extended) |
| Opt-out targeted ads | ✓ | ✓ | ✓ (extended) |
| Opt-out profiling | ✓ | ✓ | ✓ (extended) |
| Appeal | (complaint path) | ✓ (60-day) | ✓ (extended) |
| Authorized agent | ✓ | varies | offered to all |
| Universal opt-out (GPC) | ✓ | ✓ (most) | honored for all |

---

## Part 3 — Terms of Service: targeted redlines

Only the sections that the multi-state question touches. Everything else stands.

### §3 Eligibility / Residency
**Current:** "You must be at least 18 years old and a United States resident… By using the Service, you represent that you meet these requirements."

**Recommended:** keep the embedded representation, and — per your DECISION_LOG — treat the dedicated residency attestation (checkbox + `us_residency_attested_at`, PR #59) as a counsel decision. If counsel wants belt-and-suspenders, add to signup:
> ☐ I am at least 18 years old and a United States resident.

…recording timestamp/version alongside ToS acceptance. The `/not-available` page language is good as-is.

### §5.2 Automatic Renewal — keep, with multi-state note
RCW 19.316 language is strong. Several other states (e.g., California ARL, and others) have auto-renewal statutes with overlapping but stricter mechanics (e.g., easy online cancellation, click-to-cancel). Your "cancel anytime from account settings, no fees, 7-day reminder" posture is already at or above most. `[COUNSEL: confirm the renewal-reminder cadence and cancellation flow satisfy California's ARL and the FTC click-to-cancel/negative-option rule as currently in force.]`

### §7 Data
Keep "We will not sell your data, use it to train AI models, or share it with third parties except as described in our Privacy Policy." Ensure consistency with the subprocessor table (Sentry now listed).

### §14 Termination / Deletion
Keep 30-day deletion cross-reference to the Privacy Policy. Consistent — no change needed.

---

## Part 4 — Open legal questions for counsel (ranked by exposure)

1. **MHMD / consumer health data (highest).** Does any field — advance directive, healthcare power of attorney, incapacity planning, long-term-care input, anything health-adjacent — qualify as "consumer health data" under Washington's My Health My Data Act? If yes, MHMD requires a **separate Consumer Health Data Privacy Policy, opt-in consent to collect, and a distinct written authorization to share**, and it carries a **private right of action** (unusual and high-risk). This is the single most important question and is currently unaddressed; §4 cites MHMD without implementing it.
2. **GLBA/sector exemption.** Does My Wealth Maps fall under any entity- or data-level exemption (GLBA, etc.)? Most comprehensive state laws exempt GLBA-regulated data. Likely *not* applicable (you're software, not a financial institution), but confirm — it changes scope materially.
3. **Threshold applicability today.** Which state laws, if any, legally apply at current scale? Recommendation stands either way (comply voluntarily), but this sets the floor and informs DPIA/assessment obligations (CO/CT/CA require data-protection assessments for certain processing).
4. **"Sale"/"Share" under broad statutory definitions.** Confirm the "we do not sell/share" statement holds — several states define "sale" broadly (any disclosure for value), and analytics/error-monitoring vendors can implicate it. Sentry is errors-only with `sendDefaultPii:false`, which helps.
5. **Universal opt-out (GPC) implementation.** Required in CA, CO, CT, TX. Is detection built or scheduled? Policy §11 now asserts you honor it — make the assertion true before publishing.
6. **Assessment email-capture consent.** The `/event/[slug]/assess` capture block has no Privacy Policy link or marketing-consent notice, but feeds a drip sequence. Add a notice + link (and a checkbox if counsel wants explicit consent) to match Privacy Policy §3's consent basis.
7. **Self-service portability.** Portability is promised but fulfilled manually (admin JSON export). Acceptable within the 45-day window; confirm the manual SOP reliably meets the timeline, or build the self-service export.
8. **California addenda completeness.** CCPA category table, Shine the Light, and ADMT/automated-decision regulations (now in force) — confirm none apply or insert required language.
9. **Multi-state breach catch-all.** Confirm the §10 catch-all is sufficient vs. enumerating per-state timelines.
10. **(Separate track) WA SaaS sales tax.** Unrelated to privacy but still your most exposed unresolved item per prior notes — the DOR ruling before the first WA subscriber payment. Flagged here only so it doesn't fall off the launch checklist.