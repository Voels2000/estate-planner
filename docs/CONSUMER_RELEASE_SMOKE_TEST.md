# Consumer release smoke test (manual)

Use this after a production or staging deploy when consumer write paths, estate health recompute, trust UI, or planning-topic copy changed (Sessions 100–116).

**Time:** ~20–30 minutes for the full checklist · ~10 minutes for the **Core** section only.

**Who:** A real test account (not a paying client). Estate tier recommended so all sections apply.

---

## Before you start

| Item | Notes |
|------|--------|
| Browser | Chrome or Safari, logged out to start |
| Account | Consumer with an existing household and some assets already entered |
| Tier | **Estate (tier 3)** for My Family + Titling; **Retirement (tier 2)+** for Allocation |
| Baseline | Open **Dashboard** and note **Estate Readiness Score** (0–100) and any **Action Items** |

**Pass criteria for “recompute worked”:** Within ~10 seconds of a successful save, refresh Dashboard — score, gaps, or action items should **change or stay consistent** (not silently stale). If nothing ever updates after multiple saves, flag for engineering (check `RECOMPUTE_SECRET` / `NEXT_PUBLIC_APP_URL` in Vercel).

---

## Core (~10 min) — run every deploy

### 1. Login and dashboard

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 1.1 | Go to `/login`, sign in | Redirects to `/dashboard` | ☐ |
| 1.2 | Dashboard loads | Greeting (“Good morning/afternoon/evening”), **Estate Readiness Score** shows a number 0–100 | ☐ |
| 1.3 | Scroll dashboard | **Net Worth** section visible; disclaimer at bottom | ☐ |

### 2. Financial save (consumer API + recompute)

Pick **one** module you already use (Assets is simplest).

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 2.1 | Go to **Assets** (`/assets`) | Page loads, list or empty state | ☐ |
| 2.2 | **Add** a small test asset (e.g. “Smoke Test CD”, $10,000) or **edit** an existing value | Save succeeds, no red error banner | ☐ |
| 2.3 | Row appears / updates in the table without a full page error | ☐ |
| 2.4 | Return to **Dashboard**, hard refresh (⌘⇧R / Ctrl+Shift+R) | Net worth and/or readiness score reflect the change (or action items update) | ☐ |

**Optional repeat:** Edit one row on **Income** or **Expenses** — same expectations.

### 3. Profile save

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 3.1 | Go to **Profile** (`/profile`) | Form loads with your household data | ☐ |
| 3.2 | Change a harmless field (e.g. note or retirement age), **Save** | Success, no error | ☐ |
| 3.3 | Refresh Dashboard | Still loads; no 500 | ☐ |

---

## Estate planning (~10 min) — new consumer API paths

### 4. Estate health check

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 4.1 | Go to `/health-check` (or complete flow if prompted) | Five yes/no questions | ☐ |
| 4.2 | Answer all questions, submit **See My Estate Readiness Score →** | Redirects to Dashboard | ☐ |
| 4.3 | Dashboard | Score or document-related gaps update vs baseline | ☐ |

### 5. My Family (tier 3)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 5.1 | Go to **My Family** (`/my-family`) | Page loads | ☐ |
| 5.2 | **Add family member** — name + relationship, save | Modal closes, person appears in list | ☐ |
| 5.3 | **Edit** that person (e.g. toggle “Include as beneficiary”), save | List updates | ☐ |
| 5.4 | **Delete** the test person, confirm | Removed from list | ☐ |
| 5.5 | Dashboard refresh | No errors; beneficiary-related messaging may update | ☐ |

### 6. Titling & beneficiaries (tier 3)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 6.1 | Go to **Titling & Beneficiaries** (`/titling`) | Assets / real estate / insurance sections load | ☐ |
| 6.2 | **Set Title** on an asset (or RE / life policy): change title type, titling, save | Modal closes; card reflects new title | ☐ |
| 6.3 | On an item with **Add beneficiary**, add a **primary** beneficiary at 100% | Saves, beneficiary shows on card | ☐ |
| 6.4 | Refresh page (F5) | Title + beneficiary still there | ☐ |
| 6.5 | **Edit** allocation % or **Delete** the test beneficiary | Saves without error | ☐ |
| 6.6 | Dashboard refresh | Readiness score or titling/beneficiary gaps may change | ☐ |

### 7. Asset allocation (tier 2+)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 7.1 | Go to **Asset Allocation** (`/allocation`) | Charts / sliders load | ☐ |
| 7.2 | Set stocks + bonds + cash = **100%**, save target mix | “Saved” or success state; no validation error | ☐ |
| 7.3 | Try saving **≠ 100%** | Error or disabled save (should not persist invalid mix) | ☐ |

---

## Optional (~5 min) — if you use these features

### 8. My Estate Strategy / base case

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 8.1 | Go to **My Estate Strategy** | Page loads | ☐ |
| 8.2 | If offered, **generate** or refresh base case | Completes without error; horizons/charts populate | ☐ |
| 8.3 | **Scenarios** (`/scenarios`) — adjust B or C, wait for chart, click **Save** on a column | “Saved” feedback; no error toast | ☐ |

### 9. Advisor recommendation (if linked to an advisor)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 9.1 | Dashboard — **strategy recommendation** panel | Visible if advisor assigned | ☐ |
| 9.2 | **Accept** or **Decline** one item | UI updates after refresh; no console errors | ☐ |

### 10. Gifting, Strategies & Trusts (tier 3)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 10.1 | Go to **Gifting, Strategies & Trusts** (sidebar) | Opens with **Trusts & Documents** tab (or switch to it) | ☐ |
| 10.2 | **Trusts & Documents** — **+ Add Trust**, save a test trust | Trust appears in table; no error | ☐ |
| 10.3 | **Edit** and **Delete** the test trust | Updates / removes; dashboard refresh OK | ☐ |
| 10.4 | Visit `/trust-will` | Redirects to `/my-estate-trust-strategy?tab=trusts` | ☐ |
| 10.5 | **Common planning topics** sections show prevalence labels (not “High Priority”) | Educational disclaimer visible | ☐ |
| 10.6 | Save a **named** gifting scenario (Gifting tab) | Appears in saved list | ☐ |
| 10.7 | **Remove** only that named scenario | Others remain | ☐ |

### 11. Estate Summary planning topics (tier 1+ with estate data)

| Step | Action | Expected | Pass? |
|------|--------|----------|-------|
| 11.1 | Dashboard → expand **Estate Summary** | **Common planning topics** (not “Planning Gaps”) if topics exist | ☐ |
| 11.2 | Group headers use educational labels | No red “High Priority” headers | ☐ |

---

## Quick regression (navigation only)

Open each URL while logged in; expect a real page (not 404), main heading visible:

| Page | URL | Pass? |
|------|-----|-------|
| Dashboard | `/dashboard` | ☐ |
| Assets | `/assets` | ☐ |
| Liabilities | `/liabilities` | ☐ |
| Income | `/income` | ☐ |
| Expenses | `/expenses` | ☐ |
| Real estate | `/real-estate` | ☐ |
| Projections | `/projections` | ☐ |
| Profile | `/profile` | ☐ |
| Scenarios | `/scenarios` | ☐ |
| Titling | `/titling` | ☐ |
| Gifting, Strategies & Trusts | `/my-estate-trust-strategy?tab=trusts` | ☐ |
| Trust redirect | `/trust-will` → trust tab | ☐ |

---

## Sign-off

| Field | Value |
|-------|--------|
| Tester name | |
| Date | |
| Environment | ☐ Production ☐ Staging ☐ Local |
| Deploy / commit (if known) | |
| **Core** (sections 1–3) | ☐ Pass ☐ Fail |
| **Estate planning** (sections 4–7) | ☐ Pass ☐ Fail ☐ Skipped (tier) |
| **Optional** (8–11) | ☐ Pass ☐ Fail ☐ N/A |
| Issues found | |

---

## What to report when something fails

1. **URL** and what you clicked  
2. **Exact error message** (screenshot helps)  
3. Whether it happens **after refresh** or only before  
4. Browser (Chrome/Safari) and mobile vs desktop  
5. For save failures: open browser **Network** tab, find the failing request (`/api/consumer/...`), note **status code** (401, 403, 500)

---

## Related automated tests

Engineers can run `npm run test:e2e:consumer` with `.env.test` (see `playwright.config.ts`). That covers login, dashboard UI, and a subset of consumer APIs — **not** a substitute for this manual pass on a real account.
