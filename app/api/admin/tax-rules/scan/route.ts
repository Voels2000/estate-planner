import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { scanTaxCoverage } from '@/lib/tax/admin/scanTaxCoverage'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const taxYear = yearParam ? Number(yearParam) : new Date().getFullYear()
  if (!Number.isFinite(taxYear) || taxYear < 2000 || taxYear > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const admin = createAdminClient()
  const result = await scanTaxCoverage(admin, taxYear)
  return NextResponse.json({ data: result })
}
