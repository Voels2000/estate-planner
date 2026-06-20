# Compliance calendar

Ongoing compliance routines for My Wealth Maps (Privacy Policy commitments, Washington-specific statutes, and security hygiene).

**Related:** [LAUNCH.md](./archive/LAUNCH_CHECKLIST.md) · [LAUNCH.md](./LAUNCH.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · Sprint C-6/C-7 (`deleteUser`, compliance cron)

**Status:** C-6 + C-7 fully live in production (2026-05-25). Migrations `20260625120000`, `20260625170000` applied.

## Compliance infrastructure (live)

| What | How | Status |
|------|-----|--------|
| 30-day post-cancellation deletion | Stripe webhook → `deletion_schedule` → 2am cron | ✅ Live |
| Plan-change guard | Webhook + cron double-check | ✅ Live |
| Deletion audit trail | `deletion_audit_log` append-only | ✅ Live |
| Admin deletion UI | `/admin` → Data & Compliance | ✅ Live |
| Daily compliance check | 8am cron → `avoels@comcast.net` if issues | ✅ Live |
| Privacy rights requests | In-app form + 45-day SLA tracking | ✅ Live |
| Email infrastructure | `hello@`, `noreply@`, `privacy@` → Comcast (Resend verified) | ✅ Live |
| Migrations | **102** in `supabase/migrations/` (excl. VERIFY script); through `20260630110000`; prod synced `20260605100000` + repair `11a867d` | ✅ Clean |

**Cron manual test:** Always `https://www.mywealthmaps.com/api/cron/...` — apex redirect strips `Authorization`.

---

## Data deletion (Sprint C-6)

Privacy Policy grants deletion and other privacy rights to all **U.S. residents**; respond to authenticated requests within **45 days**. Privacy Policy commits to deletion within **30 days** after account close / subscription cancellation. Washington **RCW 19.255.010** governs breach notification (see Privacy Policy §10); **RCW 19.316** governs auto-renewal disclosures (see ToS §5.2).

### Right-to-delete SOP (updated)

1. Verify requestor identity (confirm email matches account)
2. Look up user: Admin Portal → Data & Compliance → Execute Deletion → enter email → **Look up**
   (or Scheduled Deletions / Privacy Requests → **Execute →**)
   Fallback: Supabase Auth dashboard or `npm run verify:deletion` after delete
3. Dry run: `npx tsx scripts/gdpr-delete-user.ts --email user@example.com --dry-run`
   OR: Admin Portal → Execute Deletion → check **Dry run** → **Preview deletion**
4. Review output — confirm correct household and row counts
5. Execute: `npx tsx scripts/gdpr-delete-user.ts --email user@example.com`
   OR: Admin Portal → Execute Deletion → uncheck Dry Run → **Execute permanent deletion**
6. **Verify deletion**: `npm run verify:deletion -- --email user@example.com`
   Must show PASS before responding to the user
7. Confirm deletion in Admin Portal → Data & Compliance → Audit Log
8. Respond to requestor within 45 days (Privacy Policy commitment)
   Response template: "Your request to delete personal data has been processed.
   All personal data associated with your account has been permanently deleted."

### Automated 30-day post-cancellation deletion

Handled automatically:

- Stripe `customer.subscription.deleted` webhook → schedules deletion in
  `deletion_schedule` table for 30 days from cancellation date
- Daily cron at 2am UTC (`/api/cron/process-deletions`) executes due deletions
- If user resubscribes before 30 days: `customer.subscription.updated` webhook
  cancels the pending scheduled deletion automatically
- All executions logged to `deletion_audit_log` — view in Admin Portal

**Plan-change guard (consumer → advisor upgrade):** webhook skips scheduling when another active/trialing Stripe subscription exists on the same customer, or when profile role is `advisor` / `financial_advisor` / `attorney` / `admin`. Cron re-verifies before execution and cancels overdue schedules if role or subscription changed.

## Automated (no action needed unless email arrives)

| Check | Frequency | Alert condition |
|-------|-----------|-----------------|
| Overdue deletions | Daily 8am UTC | Any pending deletion past due date |
| Deletion failures | Daily 8am UTC | Any failure in last 7 days |
| Privacy requests approaching deadline | Daily 8am UTC | Any request due within 7 days |
| Ops tasks due/overdue | Daily 8am UTC | Any `ops_tasks` due within 7 days |
| Cron health failures / stale | Daily 8am UTC | `cron_health` error or not run in 26h |
| Post-deploy verify failure | Daily 9am UTC | Voels gate fails → immediate email |
| Monthly compliance summary | 1st of month | Always — review and file |

Cron: `GET /api/cron/compliance-reminders` → emails `COMPLIANCE_EMAIL` (`avoels@comcast.net`) when action needed (or monthly summary on the 1st). All-clear days send **no email**.

**Ops task calendar:** Seeded in `ops_tasks` table (migration `20260610120000`). Track and complete at `/admin` → **Ops Home**. Weekly/monthly/quarterly/annual items from this doc are now system-tracked with due dates and email alerts.

## On alert email received

1. Open Admin Portal → Data & Compliance
2. Address the specific issue described
3. Reply to yourself confirming resolution (creates email paper trail)

## Privacy request SOP (all U.S. residents)

1. User submits via `/settings/security` → Privacy Rights OR emails privacy@mywealthmaps.com
2. If email: Admin → Data & Compliance → Privacy Requests → **Add request**
3. System sends confirmation email to user with reference ID and 45-day deadline
4. Admin works the request within 45 days:
   - Deletion: use Execute Deletion flow
   - Access: export household data from Supabase for that `household_id`
   - Correction: update via admin client or direct Supabase edit
   - Portability: JSON export of all user data
   - Opt-out: confirm no data sale (already true — document in response)
5. Mark request **completed** or **denied** in Admin Portal → Privacy Requests
   - **Denied:** system emails appeal instructions automatically; user may reply to appeal
   - **Appealed:** reopen review; respond to appeal within **60 days** per Privacy Policy §8
6. Send completion confirmation to user when fulfilled

### Monthly compliance check (manual backup)

- [ ] Admin Portal → Data & Compliance → confirm no overdue scheduled deletions
- [ ] Admin Portal → Data & Compliance → Audit Log — last 30 days success=true
- [ ] Run: `bash scripts/security-audit.sh` — 0 findings
- [ ] Check for soft-deleted Auth users still in system:
  ```sql
  SELECT id, email, deleted_at FROM auth.users
  WHERE deleted_at IS NOT NULL;
  ```
  If rows found: confirm FK constraints resolved, then hard-delete.
  Soft-deleted users have scrambled emails but records still exist.

---

## Weekly

- [ ] `bash scripts/audit-ux-language.sh` — 0 findings before consumer-facing copy changes ship
- [ ] Review open items in [LAUNCH.md](./LAUNCH.md) if pre-launch

---

## Quarterly

- [ ] Privacy Policy / ToS review — counsel if material product or data-practice changes
- [ ] Confirm `deletion_audit_log` retention policy still matches legal guidance (append-only; do not delete rows)
