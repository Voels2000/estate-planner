import type { NextRequest } from 'next/server'
import { GPC_OPT_OUT_COOKIE, requestHasGpcOptOut } from './globalPrivacyControl'

/** True when the browser sent Sec-GPC: 1 or the middleware GPC cookie is present. */
export function requestHasGpcMarketingOptOut(request: NextRequest): boolean {
  if (requestHasGpcOptOut(request)) return true
  return request.cookies.get(GPC_OPT_OUT_COOKIE)?.value === '1'
}
