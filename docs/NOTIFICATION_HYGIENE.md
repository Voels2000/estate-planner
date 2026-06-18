# Notification hygiene

How pipeline notifications are routed. The goal is one authoritative notifier per
event, so the same PR/merge/deploy doesn't email us from three systems at once.

## Rule

- **Failures notify, successes don't.** A green deploy or passing CI run is confirmation
  you'll see on the PR anyway; a failed deploy or failed CI run is a call to action.
  Email is reserved for the latter.
- **One notifier per event.** GitHub owns PR/merge events, Vercel owns deploy status,
  Sentry owns runtime errors. Don't let a tool notify about an event another tool already
  owns (e.g. Sentry emailing about releases — GitHub/Vercel already cover that).
- **Errors from every system stay on.** Silencing applies only to success/status echoes,
  never to error or failure alerts.

## Where the levers live

These are account/dashboard settings, not repo config — there is nothing to change in
workflow YAML unless a workflow adds a notify step (see below). Exact menu paths drift;
the lever is what matters.

- **GitHub** — account Settings → Notifications → Actions. Set to failed workflows only.
  This is the highest-volume source: `ci.yml` runs on every PR to `staging` and `main`,
  so "email on completion" means mail on every green push. Repo watch level can also be
  narrowed (Participating / Issues+PRs only) if the repo floods.
- **Vercel** — per project (`estate-planner` and `estate-planner-staging`), Settings →
  Notifications. Deployment-failed on, deployment-succeeded off.
- **Sentry** — Settings → Alerts and Settings → Integrations. Keep issue/error alerts
  (first-seen, regression, spike). Turn off release/deploy-triggered notifications — those
  echo events GitHub and Vercel already report. Keep release *tracking* (it tags which
  release an error came from); only the release *email* is the echo.

## Keep-list — do NOT silence these

A future "too many emails" cleanup must not sweep these into the off pile. They are the
tripwires that matter, most of all heading into and just after launch:

- Sentry error / issue alerts (new issue, regression, spike)
- Vercel deployment-failed
- GitHub failed-workflow notifications

If notification volume becomes a problem again, the fix for the items above is *tuning*
(alert thresholds, issue grouping, per-DSN rate limits), never muting.

## Verify after any change

1. Push a trivial commit to a PR → no email on green CI.
2. Cause or wait for a real failure → still get the email on red.

Step 2 is the actual safety check: silencing successes is only correct if failures
definitely still reach you. Confirm the failure path before trusting the change.

## Future-proofing

The workflows (`ci.yml`, `e2e-smoke.yml`, `rls-verify.yml`, `staging-keepalive.yml`)
currently have no notify steps, so there is no repo-side change to make. If one is ever
added, gate it on failure from the start so it never emails on green:

```yaml
- name: Notify on failure
  if: failure()
  run: # slack curl, etc.
```
