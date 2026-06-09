import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import {
  appendFederalTaxConfigAudit,
  getLastFederalConfigUpdate,
} from '@/lib/admin/federalTaxConfigAudit'
import { getAdminActorEmail } from '@/lib/admin/adminActionLog'

const EDITABLE_FIELDS = [
  'estate_exemption_individual',
  'estate_exemption_married',
  'estate_top_rate_pct',
  'annual_gift_exclusion',
] as const

type EditableField = (typeof EDITABLE_FIELDS)[number]

type FederalTaxConfigRow = {
  id: string
  scenario_id: string | null
  estate_exemption_individual: number
  estate_exemption_married: number
  estate_top_rate_pct: number
  annual_gift_exclusion: number
  is_active: boolean | null
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export async function GET() {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('federal_tax_config')
    .select(
      'id, scenario_id, estate_exemption_individual, estate_exemption_married, estate_top_rate_pct, annual_gift_exclusion, is_active',
    )
    .eq('is_active', true)
    .order('scenario_id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows?.length) {
    return NextResponse.json(
      { error: 'federal_tax_config has no rows — seed it first via migration' },
      { status: 404 },
    )
  }

  const lastUpdate = await getLastFederalConfigUpdate(admin)

  return NextResponse.json({
    data: {
      rows: rows as FederalTaxConfigRow[],
      lastUpdatedAt: lastUpdate?.updatedAt ?? null,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  let body: { id?: string; changes?: Partial<Record<EditableField, number>> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || !body.changes || typeof body.changes !== 'object') {
    return NextResponse.json({ error: 'id and changes are required' }, { status: 400 })
  }

  const updates: Partial<Record<EditableField, number>> = {}
  for (const field of EDITABLE_FIELDS) {
    if (body.changes[field] !== undefined) {
      if (!isPositiveNumber(body.changes[field])) {
        return NextResponse.json(
          { error: `${field} must be a positive number` },
          { status: 400 },
        )
      }
      updates[field] = body.changes[field]!
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing, error: fetchErr } = await admin
    .from('federal_tax_config')
    .select(
      'id, scenario_id, estate_exemption_individual, estate_exemption_married, estate_top_rate_pct, annual_gift_exclusion, is_active',
    )
    .eq('id', body.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json(
      { error: 'federal_tax_config has no rows — seed it first via migration' },
      { status: 404 },
    )
  }

  const changes: Record<string, { old: unknown; new: unknown }> = {}
  for (const [field, newVal] of Object.entries(updates)) {
    const oldVal = existing[field as EditableField]
    if (oldVal !== newVal) {
      changes[field] = { old: oldVal, new: newVal }
    }
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ data: existing, message: 'No changes detected' })
  }

  const { data: updated, error: updateErr } = await admin
    .from('federal_tax_config')
    .update(updates)
    .eq('id', body.id)
    .select(
      'id, scenario_id, estate_exemption_individual, estate_exemption_married, estate_top_rate_pct, annual_gift_exclusion, is_active',
    )
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const adminEmail = await getAdminActorEmail(admin, auth.userId)
  await appendFederalTaxConfigAudit(admin, {
    action: 'federal_config_update',
    updatedAt: new Date().toISOString(),
    adminEmail,
    adminUserId: auth.userId,
    configId: body.id,
    scenarioId: existing.scenario_id,
    changes,
  })

  return NextResponse.json({ data: updated })
}
