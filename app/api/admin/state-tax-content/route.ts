import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { getAdminActorEmail } from '@/lib/admin/adminActionLog'
import {
  appendStateTaxContentAudit,
  getStateTaxContentAuditLog,
} from '@/lib/admin/stateTaxContentAudit'
import type { StateBracket, StateQuirk } from '@/lib/learn/state-estate-tax-types'

const EDITABLE_FIELDS = [
  'exemption_amount',
  'exemption_indexed',
  'top_rate_pct',
  'portability',
  'has_cliff_effect',
  'law_effective_date',
  'last_reviewed',
  'review_notes',
  'brackets',
  'quirks',
  'scenario_estate_value',
  'scenario_tax_no_plan',
  'scenario_tax_with_plan',
  'scenario_notes',
] as const

type EditableField = (typeof EDITABLE_FIELDS)[number]

function isValidBrackets(value: unknown): value is StateBracket[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (b) =>
      typeof b === 'object' &&
      b !== null &&
      typeof (b as StateBracket).min === 'number' &&
      ((b as StateBracket).max === null || typeof (b as StateBracket).max === 'number') &&
      typeof (b as StateBracket).rate_pct === 'number' &&
      typeof (b as StateBracket).base_tax === 'number',
  )
}

function isValidQuirks(value: unknown): value is StateQuirk[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (q) =>
      typeof q === 'object' &&
      q !== null &&
      typeof (q as StateQuirk).label === 'string' &&
      typeof (q as StateQuirk).description === 'string',
  )
}

export async function GET() {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const [{ data: rows, error }, auditLog] = await Promise.all([
    admin.from('state_estate_tax_content').select('*').order('state_name', { ascending: true }),
    getStateTaxContentAuditLog(admin),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: rows ?? [],
    auditLog: auditLog.slice(0, 10),
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  let body: { state_code?: string; changes?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.state_code || !body.changes || typeof body.changes !== 'object') {
    return NextResponse.json({ error: 'state_code and changes are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const stateCode = body.state_code.toUpperCase()

  const { data: existing, error: fetchErr } = await admin
    .from('state_estate_tax_content')
    .select('*')
    .eq('state_code', stateCode)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: `Unknown state_code: ${stateCode}` }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  const previousValues: Record<string, unknown> = {}

  for (const field of EDITABLE_FIELDS) {
    if (body.changes[field] === undefined) continue

    const newVal = body.changes[field]
    const oldVal = existing[field as keyof typeof existing]

    if (field === 'brackets') {
      if (!isValidBrackets(newVal)) {
        return NextResponse.json({ error: 'brackets must be a valid bracket array' }, { status: 400 })
      }
    } else if (field === 'quirks') {
      if (!isValidQuirks(newVal)) {
        return NextResponse.json({ error: 'quirks must be a valid quirks array' }, { status: 400 })
      }
    } else if (
      field === 'exemption_amount' ||
      field === 'top_rate_pct' ||
      field === 'scenario_estate_value' ||
      field === 'scenario_tax_no_plan' ||
      field === 'scenario_tax_with_plan'
    ) {
      if (newVal !== null && (typeof newVal !== 'number' || !Number.isFinite(newVal) || newVal < 0)) {
        return NextResponse.json({ error: `${field} must be a non-negative number or null` }, { status: 400 })
      }
    } else if (field === 'exemption_indexed' || field === 'portability' || field === 'has_cliff_effect') {
      if (typeof newVal !== 'boolean') {
        return NextResponse.json({ error: `${field} must be a boolean` }, { status: 400 })
      }
    } else if (field === 'law_effective_date' || field === 'last_reviewed') {
      if (typeof newVal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(newVal)) {
        return NextResponse.json({ error: `${field} must be YYYY-MM-DD` }, { status: 400 })
      }
    }

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      updates[field] = newVal
      previousValues[field] = oldVal
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: existing, message: 'No changes detected' })
  }

  const adminEmail = await getAdminActorEmail(admin, auth.userId)
  updates.updated_by = adminEmail

  const { data: updated, error: updateErr } = await admin
    .from('state_estate_tax_content')
    .update(updates)
    .eq('state_code', stateCode)
    .select('*')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  await appendStateTaxContentAudit(admin, {
    action: 'state_tax_update',
    state_code: stateCode,
    changedFields: Object.keys(updates).filter((k) => k !== 'updated_by'),
    adminEmail,
    adminUserId: auth.userId,
    timestamp: new Date().toISOString(),
    previousValues,
  })

  return NextResponse.json({ data: updated })
}
