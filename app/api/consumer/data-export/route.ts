import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canExportRawData } from '@/lib/billing/exportAccess'
import { loadInputExportPayload } from '@/lib/export/loadInputExportPayload'

export const runtime = 'nodejs'

/**
 * Free portability export — input tables only (PR 6).
 * Scoped to auth.uid(); no household id parameter (IDOR-safe).
 */
export async function GET() {
  if (!canExportRawData()) {
    return NextResponse.json({ error: 'Export unavailable' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await loadInputExportPayload(supabase, user.id)
    return NextResponse.json(payload, {
      headers: {
        'Content-Disposition': 'attachment; filename="mywealthmaps-input-export.json"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    console.error('[data-export]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
