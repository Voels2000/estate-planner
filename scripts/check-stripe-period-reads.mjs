#!/usr/bin/env node
// scripts/check-stripe-period-reads.mjs
//
// CI guard: forbids raw Stripe date/period reads outside the canonical helper.
// All `current_period_*` access and seconds->ms date math (`* 1000`) must go
// through lib/stripe/subscriptionPeriod.ts. Add `// stripe-dates-ok` on a line
// to opt out for a genuine exception. Exits non-zero on any violation.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

const SCAN_DIRS = ['app/api/stripe', 'lib/billing', 'lib/stripe']

const ALLOWLIST = ['lib/stripe/subscriptionPeriod.ts']

const RULES = [
  {
    id: 'raw-period-field',
    test: /\.current_period_(start|end)\b/,
    msg: 'Raw current_period_* read — use getSubscriptionPeriodEnd / subscriptionPeriodEndIso from lib/stripe/subscriptionPeriod.ts',
  },
  {
    id: 'raw-period-destructure',
    test: /\{[^}]*\bcurrent_period_(start|end)\b(?!\s*:)[^}]*\}/,
    msg: 'Destructured current_period_* read — use getSubscriptionPeriodEnd / subscriptionPeriodEndIso from lib/stripe/subscriptionPeriod.ts',
  },
  {
    id: 'raw-seconds-to-ms',
    test: /\*\s*1000\b/,
    msg: 'Raw seconds→ms date math — use unixToIsoOrNull from lib/stripe/subscriptionPeriod.ts',
  },
]

const OPT_OUT = '// stripe-dates-ok'
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      out.push(...walk(full))
    } else {
      const dot = e.name.lastIndexOf('.')
      if (dot !== -1 && EXTS.has(e.name.slice(dot))) out.push(full)
    }
  }
  return out
}

function isAllowlisted(relPath) {
  const norm = relPath.split(sep).join('/')
  return ALLOWLIST.some((a) => norm === a || norm.endsWith('/' + a))
}

const violations = []

for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file)
    if (isAllowlisted(rel)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (line.includes(OPT_OUT)) return
      for (const rule of RULES) {
        if (rule.test.test(line)) {
          violations.push({ rel, line: i + 1, rule: rule.id, msg: rule.msg, text: line.trim() })
        }
      }
    })
  }
}

if (violations.length > 0) {
  console.error(`\n\u2716 Stripe date/period guard failed \u2014 ${violations.length} violation(s):\n`)
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  [${v.rule}]`)
    console.error(`    ${v.text}`)
    console.error(`    \u2192 ${v.msg}\n`)
  }
  console.error(
    `Route these through lib/stripe/subscriptionPeriod.ts, or add \`${OPT_OUT}\` if intentional.\n`,
  )
  process.exit(1)
}

console.log(
  '\u2713 Stripe date/period guard passed \u2014 no raw current_period_* reads or seconds\u2192ms math outside the helper.',
)
process.exit(0)
