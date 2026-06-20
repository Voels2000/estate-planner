import { NextResponse, type NextRequest } from 'next/server'

/** Cookie set when the browser sends Sec-GPC: 1 (Global Privacy Control). */
export const GPC_OPT_OUT_COOKIE = 'mwm_gpc_opt_out'

/** True when the request carries a recognized universal opt-out signal. */
export function requestHasGpcOptOut(request: Request): boolean {
  return request.headers.get('Sec-GPC')?.trim() === '1'
}

export function attachGpcOptOutCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!requestHasGpcOptOut(request)) return response

  response.cookies.set(GPC_OPT_OUT_COOKIE, '1', {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return response
}
