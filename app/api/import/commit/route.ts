import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type CommitPayload = {
  job_id: string
  target_table: 'assets' | 'liabilities' | 'income' | 'expenses'
  field_map: Record<string, string>
  rows: Record<string, string>[]
  skip_duplicates?: boolean
  force_all?: boolean
}

/** Columns that exist on each financial table — strips UI-only fields like `notes`. */
const INSERT_COLUMNS: Record<string, readonly string[]> = {
  assets: ['owner_id', 'owner', 'type', 'name', 'value', 'details', 'ingestion_job_id'],
  liabilities: [
    'owner_id',
    'owner',
    'type',
    'name',
    'balance',
    'monthly_payment',
    'interest_rate',
    'ingestion_job_id',
  ],
  income: [
    'owner_id',
    'source',
    'amount',
    'start_year',
    'end_year',
    'inflation_adjust',
    'ingestion_job_id',
  ],
  expenses: [
    'owner_id',
    'owner',
    'category',
    'amount',
    'start_year',
    'end_year',
    'inflation_adjust',
    'ingestion_job_id',
  ],
}

function transformRow(
  raw: Record<string, string>,
  fieldMap: Record<string, string>,
  table: string,
  ownerId: string,
  jobId: string,
): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = { owner_id: ownerId, ingestion_job_id: jobId }
  for (const [header, dbField] of Object.entries(fieldMap)) {
    if (!dbField) continue
    const val = raw[header]?.trim() ?? ''
    if (!val) continue
    if (['value', 'balance', 'amount', 'interest_rate', 'monthly_payment'].includes(dbField)) {
      const num = parseFloat(val.replace(/[$,%]/g, ''))
      if (!isNaN(num)) mapped[dbField] = num
    } else if (['start_year', 'end_year'].includes(dbField)) {
      const num = parseInt(val, 10)
      if (!isNaN(num)) mapped[dbField] = num
    } else if (dbField === 'inflation_adjust') {
      mapped[dbField] = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes'
    } else {
      mapped[dbField] = val
    }
  }
  const required: Record<string, string[]> = {
    assets: ['name', 'type', 'value'],
    liabilities: ['name', 'type', 'balance'],
    income: ['source', 'amount', 'start_year'],
    expenses: ['category', 'amount', 'start_year'],
  }
  const missing = (required[table] ?? []).filter(
    (f) => mapped[f] === undefined || mapped[f] === '',
  )
  if (missing.length > 0) return null
  if (table !== 'income' && !mapped.owner) mapped.owner = 'person1'
  if (table === 'income' && mapped.inflation_adjust === undefined) mapped.inflation_adjust = true
  if (table === 'expenses' && mapped.inflation_adjust === undefined) mapped.inflation_adjust = true
  return mapped
}

function toInsertRow(table: string, mapped: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(INSERT_COLUMNS[table] ?? [])
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(mapped)) {
    if (allowed.has(key)) row[key] = value
  }
  if (table === 'assets' && mapped.notes && typeof mapped.notes === 'string') {
    const existing =
      row.details && typeof row.details === 'object' && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {}
    row.details = { ...existing, notes: mapped.notes }
  }
  return row
}

async function findDuplicates(
  supabase: SupabaseClient,
  targetTable: string,
  transformedRows: Record<string, unknown>[],
  ownerId: string,
): Promise<number[]> {
  const duplicateIndexes: number[] = []

  for (let i = 0; i < transformedRows.length; i++) {
    const row = transformedRows[i]
    let query = supabase.from(targetTable).select('id').eq('owner_id', ownerId)

    if (targetTable === 'assets' && row.name != null && row.value != null) {
      query = query.eq('name', row.name).eq('value', row.value)
    } else if (targetTable === 'liabilities' && row.name != null && row.balance != null) {
      query = query.eq('name', row.name).eq('balance', row.balance)
    } else if (targetTable === 'income' && row.source != null && row.amount != null) {
      query = query.eq('source', row.source).eq('amount', row.amount)
    } else if (targetTable === 'expenses' && row.category != null && row.amount != null) {
      query = query.eq('category', row.category).eq('amount', row.amount)
    } else {
      continue
    }

    const { data } = await query.limit(1)
    if (data && data.length > 0) duplicateIndexes.push(i)
  }

  return duplicateIndexes
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: CommitPayload = await req.json()
    const { job_id, target_table, field_map, rows, skip_duplicates, force_all } = body

    if (!['assets', 'liabilities', 'income', 'expenses'].includes(target_table)) {
      return NextResponse.json({ error: 'Invalid target table' }, { status: 400 })
    }

    const transformed = rows
      .map((row) => transformRow(row, field_map, target_table, user.id, job_id))
      .filter((r): r is Record<string, unknown> => r !== null)
      .map((row) => toInsertRow(target_table, row))

    if (transformed.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows to import after field mapping. Check required fields.' },
        { status: 400 },
      )
    }

    let rowsToInsert = transformed

    if (!force_all) {
      const duplicateIndexes = await findDuplicates(
        supabase,
        target_table,
        transformed,
        user.id,
      )

      if (duplicateIndexes.length > 0 && !skip_duplicates) {
        return NextResponse.json(
          {
            error: 'duplicates_found',
            duplicate_count: duplicateIndexes.length,
            duplicate_indexes: duplicateIndexes,
            message: `${duplicateIndexes.length} row(s) look similar to existing records.`,
          },
          { status: 409 },
        )
      }

      if (skip_duplicates && duplicateIndexes.length > 0) {
        const dupSet = new Set(duplicateIndexes)
        rowsToInsert = transformed.filter((_, i) => !dupSet.has(i))
      }
    }

    if (rowsToInsert.length === 0) {
      if (body.skip_duplicates) {
        return NextResponse.json({
          success: true,
          committed: 0,
          inserted_count: 0,
          skipped: transformed.length,
          job_id,
          message: 'All rows were duplicates of existing records.',
        })
      }
      return NextResponse.json(
        { error: 'All rows are duplicates of existing records.' },
        { status: 400 },
      )
    }

    const { error: insertError } = await supabase.from(target_table).insert(rowsToInsert)
    if (insertError) throw insertError

    const { error: jobUpdateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: 'committed',
        committed_at: new Date().toISOString(),
        field_map,
        row_count: rowsToInsert.length,
      })
      .eq('id', job_id)
      .eq('owner_id', user.id)

    if (jobUpdateError) throw jobUpdateError

    const skipped = rows.length - transformed.length + (transformed.length - rowsToInsert.length)

    return NextResponse.json({
      success: true,
      committed: rowsToInsert.length,
      inserted_count: rowsToInsert.length,
      skipped,
      job_id,
    })
  } catch (err) {
    console.error('Commit error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Commit failed' },
      { status: 500 },
    )
  }
}
