const { useState, useEffect, useMemo } = React;

const C = {
  bg: "#eceff3",
  panel: "#ffffff",
  ink: "#161a21",
  sub: "#5b6573",
  line: "#dbe1e8",
  ready: "#0f6b5c",
  readySoft: "#e3f1ed",
  wait: "#b3781b",
  waitSoft: "#f6ecd9",
  flip: "#3b4a8c",
  flipSoft: "#e8eaf5",
  danger: "#9a3b2f",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const STORAGE_KEY = "mwm-launch-tracker-v3";

const SECTIONS = [
  {
    id: "done",
    title: "Verified & checked",
    note: "Shipped on main or attested. Synced from docs/LAUNCH.md (2026-06-14 B3 E2E/RLS CI).",
    accent: C.ready,
    items: [
      { id: "robots", label: "robots.ts + sitemap allow public routes", cmd: "app/robots.ts:5-37", type: "done" },
      { id: "terms1", label: "TERMS-1 — signup writes terms_accepted_at", cmd: "_signup-form.tsx:64-101", type: "done", flag: "terms_version still set later on confirm — raise at counsel §10/§11" },
      { id: "b1-redeploy", label: "Redeploy Vercel with latest main", type: "done", attest: true },
      { id: "b1-preflight", label: "release:preflight green", cmd: "npm run release:preflight", type: "done" },
      { id: "b1-golive", label: "go-live-profile (17/17)", cmd: "npm run test:e2e:go-live-profile", type: "done" },
      { id: "b1-seciso", label: "security-isolation (10/10)", cmd: "npm run test:e2e:security-isolation", type: "done" },
      { id: "b1-xrole", label: "cross-role green", cmd: "npm run test:e2e:cross-role", type: "done" },
      { id: "b1-postdeploy", label: "post-deploy green (Voels + RLS)", cmd: "npm run release:post-deploy", type: "done", attest: true },
      { id: "b1-prodsmoke", label: "prod canary smoke", cmd: "npm run test:e2e:prod:smoke -- --workers=1", type: "done", attest: true },
      { id: "b7-protected", label: "PROTECTED list incl. canary-consumer@mywealthmaps.com", cmd: "cleanup-test-accounts.ts:70-97", type: "done" },
      { id: "b7-guard", label: "Prod-ref purge guard (refuses prod without --force)", cmd: "cleanup-test-accounts.ts:35-55", type: "done" },
      { id: "b7-prod-cleanup", label: "One-time prod cleanup executed", type: "done", attest: true },
      { id: "b5-verifier", label: "Admin env verifier route + manifest (PRs #3/#5)", cmd: "/api/admin/verify-env", type: "done" },
      { id: "b5-throwguard", label: "Production consumer price throw-guard (PR #4)", cmd: "lib/billing/stripePrices.ts:99-110", type: "done" },
      { id: "b5-seatbelt", label: "Silent test-price runtime seatbelt (code — live ?live=1 still pending)", type: "done" },
      { id: "b3-branch", label: "Branch protection on main: verify + e2e-smoke + rls-verify + PR", type: "done", attest: true },
      { id: "b3-no-prod-secrets", label: "No production credentials in GitHub Actions", type: "done", attest: true },
      { id: "b3-local", label: "Local release discipline adopted", type: "done", attest: true },
      { id: "b3-twodb", label: "Two-DB split live (Preview→staging, Prod→prod)", type: "done", attest: true },
      { id: "b3-keepalive", label: "Staging keep-alive workflow green in Actions", type: "done", attest: true },
      { id: "b3-e2e-ci", label: "E2E/RLS PR workflows (staging-only GitHub secrets)", cmd: "PR #8 merged; vars + 8 secrets", type: "done", attest: true },
      { id: "b8-canary", label: "Prod canary reset tool (seed:prod-canary)", cmd: "scripts/seed-prod-canary.ts", type: "done" },
      { id: "b8-twodb-docs", label: "Two-DB steady-state docs on main (DEPLOYMENT.md, PR #6)", type: "done" },
      { id: "sec-smoke", label: "Security hardening manual checks 4/4", type: "done" },
      { id: "b8-eng", label: "B8 engineering gates (billing, deletion, prod harness)", type: "done" },
      { id: "b6-placeholders", label: "Legal placeholders wired (/terms, /privacy)", cmd: "lib/legal/company.ts", type: "done" },
    ],
  },
  {
    id: "b4",
    title: "B4 · Manual walkthroughs",
    note: "Human smokes before Gate 2. Fresh-signup may only fully close at flip.",
    accent: C.ink,
    items: [
      { id: "b4-prospect", label: "Prospect + Mobile (19 steps — Track 1 before Track 2)", type: "open", attest: true },
      { id: "b4-health", label: "Health Score + Advisor Playbook (18 steps)", type: "open", attest: true },
      { id: "b4-pdf", label: "PDF narrative engine (9 steps)", type: "open", attest: true },
      { id: "b4-drip", label: "Drip production smoke (assess → step 1 → cron 2/3)", type: "open", attest: true },
      { id: "b4-signup", label: "Fresh signup on prod URL", type: "open", attest: true, flag: "needs PUBLIC_SIGNUP_OPEN — may complete at flip" },
    ],
  },
  {
    id: "b5",
    title: "B5 · Stripe live mode + env audit",
    note: "Code/guard shipped. Dashboard fixes + clean verify-env?live=1 before Gate 2. No clean attestation until then.",
    accent: C.wait,
    items: [
      { id: "b5-keys", label: "Live keys in Vercel Prod (sk_live / pk_live / live whsec)", type: "open", attest: true },
      { id: "b5-catalog", label: "Live catalog: 6 consumer + attorney starter/growth", type: "open", attest: true },
      { id: "b5-envls", label: "STRIPE_PRICE_* / _ATTORNEY_* / _ADVISOR_* in Vercel Production", cmd: "vercel env ls production", type: "open", attest: true },
      { id: "b5-dashboard", label: "Vercel dashboard fixes (publishable-key rename, declare flip vars, delete dead vars)", type: "open", attest: true },
      { id: "b5-verify-live", label: "Gate-2: verify-env?live=1 → missing [] (only after dashboard fixes)", cmd: "GET /api/admin/verify-env?live=1", type: "open", attest: true },
      { id: "b5-c4", label: "C-4 walkthrough on prod (signup→checkout→active→cancel→deletion)", type: "open", attest: true },
      { id: "b5-card", label: "One real-card live smoke (smallest tier) + refund/cancel", type: "open", attest: true },
    ],
  },
  {
    id: "b6",
    title: "B6 · Legal & entity (ex-tax)",
    note: "Ops facts not in the repo. B&O/DOR may be OK pre-ruling — confirm with accountant.",
    accent: C.wait,
    items: [
      { id: "b6-counsel", label: "Counsel sign-off ToS §10, §11", type: "open", attest: true },
      { id: "b6-entity", label: "WA LLC UBI / EIN / registered agent on SOS", type: "open", attest: true },
      { id: "b6-bank", label: "Business bank account open", type: "open", attest: true },
      { id: "b6-dor", label: "B&O / DOR account registered", type: "open", attest: true, flag: "check sequencing w/ accountant — likely OK before ruling" },
      { id: "b6-aliases", label: "Email aliases security@ / legal@ live (privacy@ routed)", type: "open", attest: true },
    ],
  },
  {
    id: "b7",
    title: "B7 · Staging purge (optional)",
    note: "Prod one-time cleanup is DONE. Ongoing purge is staging-only via .env.local.",
    accent: C.flip,
    items: [
      { id: "b7-staging-purge", label: "Staging purge when needed: dry-run → purge → seed:e2e", cmd: "npm run cleanup:purge:dry-run", type: "deferred", attest: true },
    ],
  },
  {
    id: "a",
    title: "Bucket A · Blocked by the B&O / DAS ruling",
    note: "Locked until the ruling lands. Excluded from B&O-READY.",
    accent: C.wait,
    items: [
      { id: "a-position", label: "WA SaaS / DAS sales-tax position (the ruling itself)", type: "blocked" },
      { id: "a-tax", label: "Stripe Tax: collect WA sales tax at checkout — on/off", type: "blocked" },
      { id: "a-tos13", label: "ToS tax section — counsel pre-drafts both branches, one-line swap", type: "blocked" },
    ],
  },
  {
    id: "c",
    title: "Bucket C · Gate 2 flip sequence",
    note: "Do NOT run until B&O-READY. Order is fixed.",
    accent: C.flip,
    items: [
      { id: "c-flip", label: "verify-env?live=1 (clean) → Auth ON → PUBLIC_SIGNUP_OPEN → MFA → redeploy → post-deploy", type: "flip" },
    ],
  },
];

const DONE_IDS = new Set(SECTIONS.flatMap((s) => s.items.filter((i) => i.type === "done").map((i) => i.id)));
const SCOPED = new Set(SECTIONS.flatMap((s) => s.items.filter((i) => i.type === "open" || i.type === "done").map((i) => i.id)));

async function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { checks: {}, notes: {} };
    const parsed = JSON.parse(raw);
    return { checks: parsed.checks || {}, notes: parsed.notes || {} };
  } catch {
    return { checks: {}, notes: {} };
  }
}

async function saveState(checks, notes) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ checks, notes, updatedAt: new Date().toISOString() }),
  );
}

function LaunchTracker() {
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    loadState().then(({ checks: c, notes: n }) => {
      setChecks(c);
      setNotes(n);
      setLoaded(true);
    });
  }, []);

  const persist = (nextChecks, nextNotes) => saveState(nextChecks, nextNotes);

  const isChecked = (item) => (item.id in checks ? checks[item.id] : item.type === "done");

  const toggle = (item) => {
    if (item.type === "blocked" || item.type === "flip") return;
    const next = { ...checks, [item.id]: !isChecked(item) };
    setChecks(next);
    persist(next, notes);
  };

  const setNote = (id, v) => {
    const next = { ...notes, [id]: v };
    setNotes(next);
    persist(checks, next);
  };

  const { done, total } = useMemo(() => {
    let d = 0;
    SCOPED.forEach((id) => {
      const checked = id in checks ? checks[id] : DONE_IDS.has(id);
      if (checked) d++;
    });
    return { done: d, total: SCOPED.size };
  }, [checks]);

  const pct = Math.round((done / total) * 100);
  const ready = done === total;

  const buildJsonState = () =>
    JSON.stringify({ checks, notes, updatedAt: new Date().toISOString() }, null, 2);

  const buildExport = () => {
    const L = [];
    L.push("=== MWM LAUNCH TRACKER SYNC ===");
    L.push("exported: " + new Date().toISOString());
    L.push(`B&O-READY: ${done}/${total} (${pct}%)`);
    L.push("");
    L.push("COMPLETED (id|bucket — label):");
    let any = false;
    SECTIONS.forEach((sec) =>
      sec.items.forEach((item) => {
        if ((item.type === "open" || item.type === "done" || item.type === "deferred") && isChecked(item)) {
          const bucket = sec.title.split("·")[0].trim();
          const stamp = notes[item.id] ? `  [attest: ${notes[item.id]}]` : "";
          L.push(`[x] ${item.id}|${bucket} — ${item.label}${stamp}`);
          any = true;
        }
      }),
    );
    if (!any) L.push("(none yet)");
    L.push("");
    L.push("STILL OPEN:");
    SECTIONS.forEach((sec) =>
      sec.items.forEach((item) => {
        if ((item.type === "open" || item.type === "deferred") && !isChecked(item)) {
          const bucket = sec.title.split("·")[0].trim();
          L.push(`[ ] ${item.id}|${bucket} — ${item.label}`);
        }
      }),
    );
    return L.join("\n");
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(buildExport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(buildJsonState());
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      setCopiedJson(false);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([buildJsonState()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "launch-tracker-state.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reset = () => {
    if (!window.confirm("Clear all checks and notes? LAUNCH.md is unaffected.")) return;
    setChecks({});
    setNotes({});
    persist({}, {});
  };

  if (!loaded) {
    return <div style={{ padding: 24, color: C.sub, fontFamily: "system-ui" }}>Loading tracker…</div>;
  }

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: "20px 16px", fontFamily: "system-ui, -apple-system, sans-serif", color: C.ink }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.sub, fontFamily: MONO }}>My Wealth Maps · launch control</div>
              <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: -0.4 }}>B&amp;O-READY tracker</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: ready ? C.ready : C.ink, lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 12, color: C.sub }}>{done} / {total} actionable</div>
            </div>
          </div>
          <div style={{ marginTop: 16, height: 10, background: "#eef1f4", borderRadius: 99, overflow: "hidden", border: `1px solid ${C.line}` }}>
            <div style={{ width: `${pct}%`, height: "100%", background: ready ? C.ready : `linear-gradient(90deg, ${C.ready}, ${C.wait})`, transition: "width .35s ease" }} />
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start", background: ready ? C.readySoft : C.waitSoft, border: `1px solid ${ready ? C.ready : C.wait}33`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ready ? C.ready : C.wait, whiteSpace: "nowrap", marginTop: 1 }}>{ready ? "READY" : "GATE"}</div>
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
              {ready
                ? "Every actionable item checked. When the B&O ruling lands: resolve Bucket A, then run Bucket C."
                : "Drive everything below to checked except Bucket A and Bucket C. Sync to LAUNCH.md after each batch."}
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.sub, lineHeight: 1.5 }}>
            Working surface — <strong>docs/LAUNCH.md stays canonical</strong>. Sync: download JSON → <code style={{ fontFamily: MONO }}>npm run sync:launch-tracker</code> or paste export into Cursor.
          </div>
        </div>

        {SECTIONS.map((sec) => {
          const locked = sec.id === "a" || sec.id === "c";
          return (
            <div key={sec.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 12, opacity: locked ? 0.78 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: sec.accent, display: "inline-block" }} />
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{sec.title}</h2>
              </div>
              <p style={{ margin: "0 0 12px 16px", fontSize: 12, color: C.sub, lineHeight: 1.45 }}>{sec.note}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sec.items.map((item) => {
                  const checked = isChecked(item);
                  const lockedItem = item.type === "blocked" || item.type === "flip";
                  const deferredItem = item.type === "deferred";
                  const badge =
                    item.type === "blocked" ? { t: "B&O", c: C.wait, b: C.waitSoft } :
                    item.type === "flip" ? { t: "FLIP", c: C.flip, b: C.flipSoft } :
                    item.type === "deferred" ? { t: "LAST", c: C.flip, b: C.flipSoft } : null;
                  return (
                    <div key={item.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", background: checked ? C.readySoft : "#fbfcfd" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <button
                          onClick={() => toggle(item)}
                          disabled={lockedItem}
                          aria-label={checked ? "Uncheck" : "Check"}
                          style={{
                            flexShrink: 0, width: 20, height: 20, marginTop: 1, borderRadius: 5, cursor: lockedItem ? "not-allowed" : "pointer",
                            border: `2px solid ${checked ? C.ready : lockedItem ? C.line : C.sub}`,
                            background: checked ? C.ready : "#fff", color: "#fff", fontSize: 13, lineHeight: "16px", padding: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {checked ? "✓" : ""}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 500, color: checked ? C.sub : C.ink, textDecoration: checked ? "line-through" : "none" }}>{item.label}</span>
                            {badge && <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: badge.c, background: badge.b, padding: "1px 6px", borderRadius: 4 }}>{badge.t}</span>}
                          </div>
                          {item.cmd && (
                            <div style={{ fontFamily: MONO, fontSize: 11, color: C.sub, marginTop: 4, wordBreak: "break-all", background: "#f1f4f7", padding: "3px 6px", borderRadius: 5, display: "inline-block", maxWidth: "100%" }}>{item.cmd}</div>
                          )}
                          {item.flag && (
                            <div style={{ fontSize: 11.5, color: C.wait, marginTop: 5, lineHeight: 1.4 }}>⚑ {item.flag}</div>
                          )}
                          {item.attest && !lockedItem && (
                            <input
                              value={notes[item.id] || ""}
                              onChange={(e) => setNote(item.id, e.target.value)}
                              placeholder="initials / date (audit stamp)"
                              style={{ marginTop: 7, width: "100%", maxWidth: 260, fontSize: 11.5, fontFamily: MONO, padding: "4px 8px", border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", color: C.ink, boxSizing: "border-box" }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {showExport && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Sync block — paste into Cursor or use JSON + npm script</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyExport} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: copied ? C.ready : C.ink, border: "none", borderRadius: 7, padding: "5px 14px", cursor: "pointer" }}>
                  {copied ? "Copied ✓" : "Copy text"}
                </button>
                <button onClick={copyJson} style={{ fontSize: 12, fontWeight: 600, color: C.ink, background: copiedJson ? C.readySoft : "#fff", border: `1px solid ${C.line}`, borderRadius: 7, padding: "5px 14px", cursor: "pointer" }}>
                  {copiedJson ? "JSON ✓" : "Copy JSON"}
                </button>
                <button onClick={downloadJson} style={{ fontSize: 12, fontWeight: 600, color: C.ready, background: C.readySoft, border: `1px solid ${C.ready}33`, borderRadius: 7, padding: "5px 14px", cursor: "pointer" }}>
                  Download JSON
                </button>
              </div>
            </div>
            <textarea readOnly value={buildExport()} style={{ width: "100%", height: 180, fontFamily: MONO, fontSize: 11, color: C.ink, background: "#f7f9fb", border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setShowExport((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: C.ready, background: C.readySoft, border: `1px solid ${C.ready}33`, borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}>
            {showExport ? "Hide export" : "Export for LAUNCH.md sync"}
          </button>
          <button onClick={reset} style={{ fontSize: 12, color: C.danger, background: "none", border: `1px solid ${C.line}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>Reset</button>
        </div>
        <div style={{ fontSize: 11, color: C.sub, fontFamily: MONO, paddingBottom: 8 }}>localStorage · {STORAGE_KEY}</div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<LaunchTracker />);
