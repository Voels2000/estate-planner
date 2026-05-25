# Compliance calendar

Ongoing compliance routines for My Wealth Maps (Washington WCPA, Privacy Policy commitments, and security hygiene).

**Related:** [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [LEGAL_TODO.md](./LEGAL_TODO.md) · [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) · Sprint C-6 (`lib/compliance/deleteUser.ts`)

---

## Data deletion (Sprint C-6)

Washington **WCPA** (RCW 19.255.010): respond to authenticated deletion requests within **45 days**. Privacy Policy commits to deletion within **30 days** after account close / subscription cancellation.

### Right-to-delete request received

1. Verify requestor identity (confirm email matches account)
2. Look up user ID in Supabase Admin or admin portal
3. Dry run: `npx tsx scripts/gdpr-delete-user.ts --email user@example.com --dry-run`
   OR: Admin Portal → Data & Compliance → Execute Deletion → check Dry Run
4. Review output — confirm correct household and row counts
5. Execute: `npx tsx scripts/gdpr-delete-user.ts --email user@example.com`
   OR: Admin Portal → Data & Compliance → Execute Deletion → uncheck Dry Run
6. Confirm deletion in Admin Portal → Data & Compliance → Audit Log
7. Respond to requestor within 45 days (WCPA requirement)
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

### Monthly compliance check

- [ ] Admin Portal → Data & Compliance → Scheduled Deletions
      Confirm no deletions are overdue (scheduled_for in the past, status=pending)
- [ ] Admin Portal → Data & Compliance → Audit Log
      Review last 30 days — confirm all deletions show success=true
- [ ] Run: `bash scripts/security-audit.sh` — 0 findings

---

## Weekly

- [ ] `bash scripts/audit-ux-language.sh` — 0 findings before consumer-facing copy changes ship
- [ ] Review open items in [LEGAL_TODO.md](./LEGAL_TODO.md) if pre-launch

---

## Quarterly

- [ ] Privacy Policy / ToS review — counsel if material product or data-practice changes
- [ ] Confirm `deletion_audit_log` retention policy still matches legal guidance (append-only; do not delete rows)
