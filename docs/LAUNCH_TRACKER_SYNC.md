# Launch tracker → LAUNCH.md sync

**Canonical checklist:** [LAUNCH.md](./LAUNCH.md)  
**Working UI:** [tools/launch-tracker.html](../tools/launch-tracker.html) (browser tracker for manual attestations)

The tracker is your **working surface**; `LAUNCH.md` is the **repo scoreboard** Cursor and release gates read.

---

## Daily workflow

1. **Open the tracker**
   ```bash
   npm run launch:tracker
   ```
   Then open **http://127.0.0.1:3456/launch-tracker.html** (copy from terminal output).

   **Troubleshooting:** If you see **Sign In**, you opened the Next.js app (`localhost:3000` or production) by mistake. The tracker has **no login** — it is only on port **3456** after `npm run launch:tracker`.

2. **Work through items** — check boxes, add `initials / date` on attest lines (B4 manual smokes, B5 Stripe, B6 legal, etc.).

3. **Sync to the repo** (pick one):

   **A — Script (recommended)**
   - Click **Download JSON** (or Copy JSON → save as `tools/launch-tracker-state.json`)
   - Dry-run:
     ```bash
     npm run sync:launch-tracker -- --from tools/launch-tracker-state.json --dry-run
     ```
   - Apply:
     ```bash
     npm run sync:launch-tracker -- --from tools/launch-tracker-state.json
     ```
   - Review `git diff docs/LAUNCH.md`, commit:
     ```bash
     git commit -am "docs(launch): sync tracker attestations"
     ```

   **B — Cursor paste**
   - Click **Copy text** in the tracker export panel
   - Paste into Cursor with:
     ```
     Sync my launch tracker export into docs/LAUNCH.md.
     Match each [x] id|bucket line to the corresponding checkbox using tools/launch-tracker-mapping.json.
     Apply attest stamps. Update Bucket B scoreboard. Do not check items still [ ] in the export.
     Do not touch MASTER_ARCHITECTURE, DECISION_LOG, ROADMAP, CALCULATION_ENGINES.
     ```

4. **Verify-only items** (B1 E2E, etc.) — only check in the tracker after the command actually passes; the sync script flips `[ ]` → `[x]` but does not run tests for you.

---

## What syncs automatically

| Tracker ID prefix | LAUNCH.md section |
|-------------------|-------------------|
| `b1-*` | B1 Redeploy + automated smoke |
| `b3-*` | B3 CI discipline |
| `b4-*` | B4 Manual smokes |
| `b5-*` | B5 Stripe |
| `b6-*` | B6 Legal / entity |
| `b7-exec` | B7 purge execution (only when you intentionally check LAST) |

Mapping file: [tools/launch-tracker-mapping.json](../tools/launch-tracker-mapping.json)

**Pre-checked “Verified & checked”** items in the tracker mirror what's already `[x]` in LAUNCH.md — they are not re-written by the sync script.

**Bucket A / C** are locked in the UI (B&O-blocked / flip) — update LAUNCH.md manually when those gates open.

---

## Persistence

- Tracker state: browser `localStorage` key `mwm-launch-tracker-v1`
- Optional backup: save downloaded JSON to `tools/launch-tracker-state.json` (gitignored)

Reset in the tracker clears browser state only — not `LAUNCH.md`.
