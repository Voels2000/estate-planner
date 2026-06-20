import { readFileSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'

export type PromotionSchemaCheck = { id: string; pass: boolean; detail: string }

const PROMOTION_SCHEMA_SQL_PATH = join(process.cwd(), 'scripts/assert-promotion-schema.sql')

export type PromotionSchemaViolation = {
  gate: string
  violation: string
  detail: string
}

export function resolvePromotionDbUrl(env: 'production' | 'staging' = 'production'): string | undefined {
  if (env === 'production') {
    return process.env.PROD_SUPABASE_DB_URL ?? process.env.SUPABASE_DB_URL
  }
  return process.env.STAGING_SUPABASE_DB_URL ?? process.env.SUPABASE_DB_URL
}

export async function runPromotionSchemaVerification(
  dbUrl: string,
  label = 'Promotion',
): Promise<PromotionSchemaCheck[]> {
  const sql = readFileSync(PROMOTION_SCHEMA_SQL_PATH, 'utf8')
  const db = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 15 })

  try {
    const rows = await db.unsafe<PromotionSchemaViolation[]>(sql)

    if (rows.length === 0) {
      return [
        {
          id: 'promotion_schema_gate',
          pass: true,
          detail: `${label} schema gate passed (0 violations)`,
        },
      ]
    }

    const preview = rows
      .slice(0, 8)
      .map((r) => `${r.gate}/${r.violation}: ${r.detail}`)
      .join('; ')
    const suffix = rows.length > 8 ? ` (+${rows.length - 8} more)` : ''

    return [
      {
        id: 'promotion_schema_gate',
        pass: false,
        detail: `${rows.length} violation(s): ${preview}${suffix}`,
      },
    ]
  } finally {
    await db.end({ timeout: 5 })
  }
}

export function summarizePromotionSchemaChecks(checks: PromotionSchemaCheck[]): {
  ok: boolean
  passed: number
} {
  const passed = checks.filter((c) => c.pass).length
  return { ok: passed === checks.length, passed }
}
