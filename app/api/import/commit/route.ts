import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type CommitPayload = {
  job_id: string
  target_table: 'assets' | 'liabilities' | 'income' | 'expenses'
  field_map: Record<string, string>
  rows: Record<string, string>[]
}

function transformRow(
  raw: Record<string, string>,
  fieldMap: Record<string, string>,
  table: string,
  ownerId: string
): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = { owner_id: ownerId }
  for (const [header, dbField] of Object.entries(fieldMap)) {
    if (!dbField) continue
    const val = raw[header]?.trim() ?? ''
    if (!val) continue
    // Type coercions
    if (['value', 'balance', 'amount', 'interest_rate', 'monthly_payment'].includes(dbField)) {
      const num = parseFloat(val.replace(/[$,%]/g, ''))
      if (!isNaN(num)) mapped[dbField] = num
    } else if (['start_year', 'end_year'].includes(dbField)) {
      const num = parseInt(val)
      if (!isNaN(num)) mapped[dbField] = num
    } else if (dbField === 'inflation_adjust') {
      mapped[dbField] = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes'
    } else {
      mapped[dbField] = val
    }
  }
  // Validate required fields per table
  const required: Record<string, string[]> = {
    assets: ['name', 'type', 'value'],
    liabilities: ['name', 'type', 'balance'],
    income: ['source', 'amount', 'start_year'],
    expenses: ['category', 'amount', 'start_year'],
  }
  const missing = (required[table] ?? []).filter(f => mapped[f] === undefined || mapped[f] === '')
  if (missing.length > 0) return null
  // Defaults
  if (!mapped.owner) mapped.owner = 'person1'
  if (table === 'income' && mapped.inflation_adjust === undefined) mapped.inflation_adjust = true
  if (table === 'expenses' && mapped.inflation_adjust === undefined) mapped.inflation_adjust = true
  return mapped
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: CommitPayload = await req.json()
    const { job_id, target_table, field_map, rows } = body

    if (!['assets', 'liabilities', 'income', 'expenses'].includes(target_table)) {
      return NextResponse.json({ error: 'Invalid target table' }, { status: 400 })
    }

    const transformed = rows
      .map(row => transformRow(row, field_map, target_table, user.id))
      .filter((r): r is Record<string, unknown> => r !== null)

    if (transformed.length === 0) {
      return NextResponse.json({ error: 'No valid rows to import after field mapping. Check required fields.' }, { status: 400 })
    }

    const { error: insertError } = await supabase.from(target_table).insert(transformed)
    if (insertError) throw insertError

    // Mark job as committed
    await supabase.from('ingestion_jobs').update({
      status: 'committed',
      committed_at: new Date().toISOString(),
      field_map,
    }).eq('id', job_id).eq('owner_id', user.id)

    return NextResponse.json({ committed: transformed.length, skipped: rows.length - transformed.length })
  } catch (err) {
    console.error('Commit error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Commit failed' }, { status: 500 })
  }
}
