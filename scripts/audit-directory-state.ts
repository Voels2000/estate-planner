/**
 * audit-directory-state.ts
 *
 * READ-ONLY audit of the outreach directory tables before we build the importer.
 * Makes NO writes and runs NO DDL — SELECT + schema introspection only.
 *
 * Purpose: read ground truth instead of guessing. Answers three things:
 *   1. SCHEMA   — real columns/types/nullability/defaults/FKs for the two tables
 *   2. STATE    — row counts, the active/claim flag distribution, a masked sample
 *   3. RECONCILE— is what's loaded the E2E fixture, or real rows? does it match
 *                 the verified spreadsheets? (you've said: nothing real loaded yet)
 *
 * Run (STAGING FIRST, then prod once output shape is confirmed):
 *   SUPABASE_DB_REF=cmzyxpxfyvdvbsykjvsg \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/audit-directory-state.ts
 *
 * Optional row-level dump (PII — writes to a local file, not stdout):
 *   ...as above... AUDIT_DUMP=./directory-audit-rows.json npx tsx scripts/audit-directory-state.ts
 *
 * Safety:
 *   - Ref guard: refuses to run unless SUPABASE_DB_REF matches a known ref.
 *   - Console output masks emails/phones. Full rows only ever go to AUDIT_DUMP file.
 *   - Schema introspection uses information_schema (read-only system views).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

// ---- Known refs (your canonical values) ----
const REFS: Record<string, 'staging' | 'production'> = {
  cmzyxpxfyvdvbsykjvsg: 'staging',
  fnzvlmrqwcqwiqueevux: 'production',
};

const DB_REF = process.env.SUPABASE_DB_REF ?? '';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DUMP_PATH = process.env.AUDIT_DUMP ?? null;

// Tables we care about. Add others here if the schema differs.
const TABLES = ['attorney_listings', 'advisor_directory'] as const;

// Expected E2E fixture markers (so we can tell fixture rows from real ones).
type SchemaColumn = {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

type DirectoryRow = Record<string, unknown>

function fail(msg: string): never {
  console.error(`\n[FATAL] ${msg}\n`);
  process.exit(1);
}

function maskEmail(v: unknown): string {
  if (typeof v !== 'string' || !v.includes('@')) return String(v ?? '');
  const [local, domain] = v.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}
function maskPhone(v: unknown): string {
  if (typeof v !== 'string') return String(v ?? '');
  return v.replace(/\d(?=\d{2})/g, '•');
}

// Heuristics: which columns look like PII to mask in console output.
const EMAILISH = /email|e_mail/i;
const PHONEISH = /phone|tel|mobile/i;

async function main() {
  // ---- Guard rails ----
  if (!DB_REF) fail('SUPABASE_DB_REF not set. Set it to the ref you intend to audit.');
  const env = REFS[DB_REF];
  if (!env) fail(`Unknown SUPABASE_DB_REF "${DB_REF}". Expected one of: ${Object.keys(REFS).join(', ')}.`);
  if (!SUPABASE_URL || !SERVICE_ROLE) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.');
  if (!SUPABASE_URL.includes(DB_REF)) {
    fail(`SUPABASE_URL does not contain the ref "${DB_REF}". Refusing to run against a mismatched project.`);
  }

  console.log('='.repeat(70));
  console.log(`DIRECTORY AUDIT  —  ${env.toUpperCase()}  (ref ${DB_REF})`);
  console.log(`READ-ONLY. No writes, no DDL. ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const dump: Record<string, unknown> = { ref: DB_REF, env, generated_at: new Date().toISOString() };

  for (const table of TABLES) {
    console.log(`\n\n######## ${table} ########`);

    // ---- 1. SCHEMA (information_schema is read-only) ----
    // Requires a SECURITY DEFINER RPC OR direct PostgREST access to information_schema.
    // PostgREST doesn't expose information_schema by default, so we try an RPC first
    // and fall back to inferring columns from a sample row.
    let columns: SchemaColumn[] | null = null;
    const { data: schemaData, error: schemaErr } = await db.rpc('describe_table_columns', {
      p_table: table,
    });
    if (!schemaErr && Array.isArray(schemaData)) {
      columns = schemaData as SchemaColumn[];
      console.log('\n-- SCHEMA (from information_schema) --');
      for (const c of columns) {
        console.log(
          `  ${c.column_name.padEnd(28)} ${String(c.data_type).padEnd(16)}` +
            ` null=${c.is_nullable}  default=${c.column_default ?? '—'}`,
        );
      }
    } else {
      console.log('\n-- SCHEMA: describe_table_columns RPC not available --');
      console.log(`   (${schemaErr?.message ?? 'no rows'})`);
      console.log('   Will infer columns from a sample row instead. See note at end.');
    }

    // ---- 2. STATE: count + sample ----
    const { count, error: countErr } = await db
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (countErr) {
      console.log(`\n-- STATE: could not count ${table}: ${countErr.message}`);
      continue;
    }
    console.log(`\n-- STATE --`);
    console.log(`  total rows: ${count ?? 0}`);

    const { data: sample, error: sampleErr } = await db.from(table).select('*').limit(25);
    if (sampleErr) {
      console.log(`  could not sample: ${sampleErr.message}`);
      continue;
    }
    const rows = (sample ?? []) as DirectoryRow[];

    // Infer columns if schema RPC was unavailable.
    if (!columns && rows.length) {
      console.log('\n-- COLUMNS (inferred from sample row) --');
      console.log('  ' + Object.keys(rows[0]).join(', '));
    }

    // Active/claim flag distribution — try the common column names.
    const FLAG_CANDIDATES = ['is_active', 'active', 'claim_status', 'claimed', 'status', 'profile_id'];
    const presentFlags = rows.length
      ? FLAG_CANDIDATES.filter((f) => f in rows[0])
      : [];
    for (const flag of presentFlags) {
      const dist: Record<string, number> = {};
      for (const r of rows) {
        const k = String(r[flag] ?? 'null');
        dist[k] = (dist[k] ?? 0) + 1;
      }
      console.log(`  ${flag} distribution (in sample of ${rows.length}): ${JSON.stringify(dist)}`);
    }

    // ---- 3. RECONCILE ----
    console.log(`\n-- RECONCILE --`);
    const asText = JSON.stringify(rows).toLowerCase();
    const fixtureHits = E2E_MARKERS.filter((m) => asText.includes(m.toLowerCase()));
    console.log(`  E2E fixture markers present: ${fixtureHits.length ? fixtureHits.join(', ') : 'none'}`);
    console.log(
      `  looks like: ${
        (count ?? 0) === 0
          ? 'EMPTY — no rows at all'
          : fixtureHits.length && (count ?? 0) <= 2
          ? 'E2E FIXTURE ONLY (matches your expectation: no real entries made)'
          : 'CONTAINS NON-FIXTURE ROWS — inspect before importing'
      }`,
    );

    // Masked sample to console.
    if (rows.length) {
      console.log('\n-- SAMPLE (masked) --');
      const cols = Object.keys(rows[0]);
      for (const r of rows.slice(0, 5)) {
        const view: Record<string, string> = {};
        for (const c of cols) {
          const val = r[c];
          view[c] = EMAILISH.test(c) ? maskEmail(val) : PHONEISH.test(c) ? maskPhone(val) : String(val ?? '');
        }
        console.log('  ' + JSON.stringify(view));
      }
    }

    dump[table] = { count: count ?? 0, columns, rows };
  }

  // ---- Optional PII dump to local file ----
  if (DUMP_PATH) {
    writeFileSync(DUMP_PATH, JSON.stringify(dump, null, 2));
    console.log(`\n\nFull (unmasked) rows + schema written to ${DUMP_PATH} — local only, do not commit.`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('AUDIT COMPLETE. No changes were made.');
  console.log('Next: paste the SCHEMA section back to Claude to build the importer.');
  console.log('='.repeat(70) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * NOTE on the schema RPC:
 * PostgREST does not expose information_schema over the REST API, so the cleanest
 * way to read real column metadata is a tiny read-only helper. If you don't already
 * have one, add this SECURITY DEFINER function (read-only; selects from a system view):
 *
 *   create or replace function describe_table_columns(p_table text)
 *   returns table (column_name text, data_type text, is_nullable text, column_default text)
 *   language sql stable security definer set search_path = public as $$
 *     select column_name::text, data_type::text, is_nullable::text, column_default::text
 *     from information_schema.columns
 *     where table_schema = 'public' and table_name = p_table
 *     order by ordinal_position;
 *   $$;
 *
 * If you'd rather not add a function, the script still works — it falls back to
 * inferring column names from a sample row. But on EMPTY tables (your case), there's
 * no sample to infer from, so the RPC (or pasting the CREATE TABLE migration) is how
 * I get the real schema. Given the tables are empty, the migration file is actually
 * the fastest path — paste those two CREATE TABLE statements and I can skip this.
 */
