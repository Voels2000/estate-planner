import { createClient } from '@/lib/supabase/server'
import { logPreCreateClientAuthCookies } from '@/lib/e2e/route-auth-cookie-diag'
import { loadAdvisorClientExportPayload } from '@/lib/advisor/loadClientExportPayload'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')?.trim()
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  if (process.env.E2E_DIAG_ROUTE_AUTH === '1') {
    logPreCreateClientAuthCookies(request, 'client-export-payload')
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    if (process.env.E2E_DIAG_ROUTE_AUTH === '1') {
      try {
        const { cookies } = await import('next/headers')
        const store = await cookies()
        const authCookies = store
          .getAll()
          .filter((c) => /sb-.*-auth-token(\.\d+)?$/.test(c.name))
        console.error(
          JSON.stringify({
            diag: 'client-export-payload-auth-post',
            timing: 'after-getUser',
            authError: authError?.message ?? null,
            userPresent: Boolean(user),
            wireCookieChunks: authCookies.length,
            wireCookieNames: authCookies.map((c) => c.name).sort(),
            wireCookieTotalLen: authCookies.reduce((n, c) => n + (c.value?.length ?? 0), 0),
            note: 'post-getUser — cookie may be cleared by SSR; compare route-auth-cookie-pre',
          }),
        )
      } catch (e) {
        console.error(JSON.stringify({ diag: 'client-export-payload-auth', logError: String(e) }))
      }
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'advisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await loadAdvisorClientExportPayload(supabase, user.id, clientId)
  if (!payload) {
    return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 })
  }

  return NextResponse.json(payload)
}
