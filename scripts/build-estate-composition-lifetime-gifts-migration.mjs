#!/usr/bin/env node
/**
 * Build 20260516140000_calculate_estate_composition_add_lifetime_gifts.sql from live pg_get_functiondef output.
 *
 * Usage:
 *   node scripts/build-estate-composition-lifetime-gifts-migration.mjs [path-to-live.sql]
 *
 * Default input: supabase/migrations/reference/live_calculate_estate_composition.sql
 */

import fs from 'fs'
import path from 'path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const inputPath = path.resolve(
  repoRoot,
  process.argv[2] ?? 'supabase/migrations/reference/live_calculate_estate_composition.sql',
)
const outputPath = path.resolve(
  repoRoot,
  'supabase/migrations/20260516140000_calculate_estate_composition_add_lifetime_gifts.sql',
)

let sql = fs.readFileSync(inputPath, 'utf8').trim()

if (sql.includes('Paste full output') || sql.length < 500) {
  console.error(
    'Reference file still has placeholder text. Paste pg_get_functiondef output into:\n  ' +
      inputPath,
  )
  process.exit(1)
}

if (!/calculate_estate_composition/i.test(sql)) {
  console.error('Input does not look like calculate_estate_composition function definition.')
  process.exit(1)
}

const lifetimeInsert = `  -- Reduce federal exemption by lifetime gifts already used (Form 709 history)
  v_exemption := GREATEST(0, v_exemption - p_lifetime_gifts_used);
`

// Normalize signature to 3-parameter version with defaults
sql = sql.replace(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.calculate_estate_composition\s*\([^)]*\)/is,
  `CREATE OR REPLACE FUNCTION public.calculate_estate_composition(
  p_household_id uuid,
  p_source_role text DEFAULT 'consumer'::text,
  p_lifetime_gifts_used numeric DEFAULT 0
)`,
)

if (!/SECURITY DEFINER/i.test(sql)) {
  console.error('Expected SECURITY DEFINER in function definition.')
  process.exit(1)
}

if (!/SET\s+search_path\s*=\s*public/i.test(sql)) {
  sql = sql.replace(
    /(SECURITY\s+DEFINER)\s*\n(\s*AS\s+\$function\$)/i,
    "$1\nSET search_path = public\n$2",
  )
}

const hasLifetimeSubtract = /v_exemption\s*:=\s*GREATEST\(0,\s*v_exemption\s*-\s*p_lifetime_gifts_used\)/i.test(
  sql,
)

if (!hasLifetimeSubtract) {
  const nullGuardPatterns = [
    /(IF\s+v_exemption\s+IS\s+NULL\s+THEN[\s\S]*?END\s+IF;\s*\n)/i,
    /(v_exemption\s*:=\s*CASE[\s\S]*?END\s*;\s*\n)(\s*IF\s+v_exemption)/i,
  ]

  let inserted = false
  for (const pattern of nullGuardPatterns) {
    if (pattern.test(sql)) {
      sql = sql.replace(pattern, `$1${lifetimeInsert}`)
      inserted = true
      break
    }
  }

  if (!inserted) {
    console.error(
      'Could not find v_exemption null-guard block. Insert manually after it closes:\n' +
        lifetimeInsert,
    )
    process.exit(1)
  }
}

if (!sql.includes("'lifetime_gifts_used'")) {
  const beforeSourceRole = sql.replace(
    /(\s*)('source_role'\s*,)/,
    `$1'lifetime_gifts_used',        p_lifetime_gifts_used,
$1$2`,
  )
  if (beforeSourceRole === sql) {
    console.error(
      "Could not find 'source_role' in return jsonb_build_object. Add manually:\n" +
        "    'lifetime_gifts_used',        p_lifetime_gifts_used,",
    )
    process.exit(1)
  }
  sql = beforeSourceRole
}

const drops = `-- Session 120 / Step 4: lifetime gifts reduce federal exemption in estate composition RPC.
-- Generated from live pg_get_functiondef via scripts/build-estate-composition-lifetime-gifts-migration.mjs
-- Do not edit by hand — regenerate from reference/live_calculate_estate_composition.sql

DROP FUNCTION IF EXISTS public.calculate_estate_composition(uuid);
DROP FUNCTION IF EXISTS public.calculate_estate_composition(uuid, text);
DROP FUNCTION IF EXISTS public.calculate_estate_composition(uuid, text, numeric);

`

const grants = `
GRANT EXECUTE ON FUNCTION public.calculate_estate_composition(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_estate_composition(uuid, text, numeric) TO service_role;
`

const out = `${drops}${sql}${grants}`
fs.writeFileSync(outputPath, out)
console.log('Wrote', outputPath)
