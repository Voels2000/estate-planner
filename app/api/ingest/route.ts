import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserAccess } from '@/lib/get-user-access'
import { hasFeatureAccess } from '@/lib/tiers'
import { resolveOwnedHouseholdId } from '@/lib/consumer/afterHouseholdWrite'
import {
  buildTableFieldsResponse,
  detectTable,
  suggestFieldMap,
  type ImportTable,
} from '@/lib/import/ingestConfig'
import { parseCsvText, parseExcelBuffer } from '@/lib/import/parseFile'

export const runtime = 'nodejs'

const ACCEPTED_EXTENSIONS = new Set(['csv', 'xlsx', 'xls'])

function extensionFromName(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? (parts.pop() ?? '') : ''
}

function sourceFormat(ext: string): 'csv' | 'xlsx' {
  return ext === 'csv' ? 'csv' : 'xlsx'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await getUserAccess()
    if (!hasFeatureAccess('import', access.tier, access.isAdvisor, access.isTrial)) {
      return NextResponse.json(
        { error: 'Import requires a Retirement or Estate plan' },
        { status: 403 },
      )
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = extensionFromName(file.name)
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Only CSV and Excel files are supported' },
        { status: 400 },
      )
    }

    let headers: string[] = []
    let rows: Record<string, string>[] = []

    try {
      if (ext === 'csv') {
        const text = await file.text()
        const parsed = parseCsvText(text.replace(/^\uFEFF/, ''))
        headers = parsed.headers
        rows = parsed.rows
      } else {
        const buffer = Buffer.from(await file.arrayBuffer())
        const parsed = parseExcelBuffer(buffer)
        headers = parsed.headers
        rows = parsed.rows
      }
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : 'Unknown parse error'
      return NextResponse.json(
        { error: `Could not parse file: ${message}` },
        { status: 400 },
      )
    }

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 })
    }

    const detectedTable: ImportTable = detectTable(headers) ?? 'assets'
    const suggestedMap = suggestFieldMap(headers, detectedTable)
    const householdId = await resolveOwnedHouseholdId(supabase, user.id)

    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .insert({
        owner_id: user.id,
        household_id: householdId,
        status: 'pending',
        source_format: sourceFormat(ext),
        original_filename: file.name,
        detected_table: detectedTable,
        headers,
        rows,
        field_map: suggestedMap,
        row_count: rows.length,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('ingestion_jobs insert error:', jobError)
      return NextResponse.json({ error: 'Failed to save import job' }, { status: 500 })
    }

    return NextResponse.json({
      job_id: job.id,
      file_name: file.name,
      headers,
      rows,
      row_count: rows.length,
      detected_table: detectedTable,
      field_map: suggestedMap,
      table_fields: buildTableFieldsResponse(),
    })
  } catch (err) {
    console.error('Ingest error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse failed' },
      { status: 500 },
    )
  }
}
