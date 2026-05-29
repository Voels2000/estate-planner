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
import {
  CANONICAL_ASSET_TYPES,
  CANONICAL_LIABILITY_TYPES,
} from '@/lib/import/type-normalizer'
import { parseCsvText, parseExcelBuffer } from '@/lib/import/parseFile'
import {
  parseAllExcelSheets,
  splitCsvByRecordType,
  type ParsedImportSheet,
} from '@/lib/import/multiSheet'

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

    const requestedSheet = formData.get('sheet_name')
    const sheetName =
      typeof requestedSheet === 'string' && requestedSheet.trim()
        ? requestedSheet.trim()
        : null
    const forceSingleSheet = formData.get('single_sheet') === 'true'

    let headers: string[] = []
    let rows: Record<string, string>[] = []
    let headerRowIndex = 0
    let sheetNames: string[] | undefined
    let selectedSheet: string | null = null
    let multiSheet = false
    let sheets: ParsedImportSheet[] | undefined

    try {
      if (ext === 'csv') {
        const text = await file.text()
        const parsed = parseCsvText(text.replace(/^\uFEFF/, ''))
        const csvSheets = splitCsvByRecordType(parsed)
        if (csvSheets && csvSheets.length > 1) {
          multiSheet = true
          sheets = csvSheets
          headers = parsed.headers
          rows = parsed.rows
          headerRowIndex = parsed.header_row_index
        } else {
          headers = parsed.headers
          rows = parsed.rows
          headerRowIndex = parsed.header_row_index
        }
      } else {
        const buffer = Buffer.from(await file.arrayBuffer())
        if (!sheetName && !forceSingleSheet) {
          const all = parseAllExcelSheets(buffer)
          sheetNames = all.sheet_names
          if (all.sheets.length > 1) {
            multiSheet = true
            sheets = all.sheets
            headers = all.sheets[0]?.headers ?? []
            rows = all.sheets[0]?.rows ?? []
            headerRowIndex = all.sheets[0]?.header_row_index ?? 0
            selectedSheet = all.sheets[0]?.sheet_name ?? null
          }
        }
        if (!multiSheet) {
          const parsed = parseExcelBuffer(buffer, { sheetName })
          headers = parsed.headers
          rows = parsed.rows
          headerRowIndex = parsed.header_row_index
          sheetNames = parsed.sheet_names
          selectedSheet = parsed.selected_sheet ?? null
        }
      }
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : 'Unknown parse error'
      return NextResponse.json(
        { error: `Could not parse file: ${message}` },
        { status: 400 },
      )
    }

    if (!multiSheet && (headers.length === 0 || rows.length === 0)) {
      return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 })
    }
    if (multiSheet && (!sheets || sheets.length === 0)) {
      return NextResponse.json({ error: 'File contains no importable sheets' }, { status: 400 })
    }

    const primarySheet = multiSheet ? sheets![0] : null
    const detectedTable: ImportTable =
      primarySheet?.target_table ?? detectTable(headers) ?? 'assets'
    const suggestedMap =
      primarySheet?.field_map ?? suggestFieldMap(headers, detectedTable)
    const primaryRows = primarySheet?.rows ?? rows
    const householdId = await resolveOwnedHouseholdId(supabase, user.id)
    const format = sourceFormat(ext)

    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .insert({
        owner_id: user.id,
        household_id: householdId,
        file_name: file.name,
        file_type: format,
        status: 'pending',
        detected_table: detectedTable,
        headers: primarySheet?.headers ?? headers,
        rows: primaryRows,
        field_map: suggestedMap,
        row_count: primaryRows.length,
        header_row_index: primarySheet?.header_row_index ?? headerRowIndex,
        sheet_name: selectedSheet,
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
      headers: primarySheet?.headers ?? headers,
      rows: primaryRows,
      row_count: primaryRows.length,
      detected_table: detectedTable,
      field_map: suggestedMap,
      table_fields: buildTableFieldsResponse(),
      header_row_index: primarySheet?.header_row_index ?? headerRowIndex,
      sheet_names: sheetNames,
      selected_sheet: selectedSheet,
      multi_sheet: multiSheet,
      sheets: multiSheet
        ? sheets!.map((s) => ({
            sheet_name: s.sheet_name,
            target_table: s.target_table,
            rows: s.rows,
            headers: s.headers,
            field_map: s.field_map,
            header_row_index: s.header_row_index,
            confidence: s.confidence,
            row_count: s.rows.length,
          }))
        : undefined,
      canonical_asset_types: CANONICAL_ASSET_TYPES,
      canonical_liability_types: CANONICAL_LIABILITY_TYPES,
    })
  } catch (err) {
    console.error('Ingest error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse failed' },
      { status: 500 },
    )
  }
}
