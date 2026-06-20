import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/compliance/requireAdminApi'
import { getCanonicalTerms } from '@/lib/terms/getCanonicalTerms'

/** Re-gate users who accepted a prior canonical ToS version. Does not write app_config. */
export async function POST() {
  const auth = await requireAdminApi()
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()
  const { version } = getCanonicalTerms()

  const { error: regateError } = await supabase
    .from('profiles')
    .update({ terms_accepted_at: null, terms_version: null })
    .neq('terms_version', version)
    .not('terms_accepted_at', 'is', null)

  if (regateError) {
    console.error('terms regate error:', regateError)
    return NextResponse.json({ error: 'Failed to re-gate users' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    version,
  })
}
