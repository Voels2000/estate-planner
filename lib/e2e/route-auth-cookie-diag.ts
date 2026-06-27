/** Single-use E2E diagnostic — log raw Cookie header before Supabase touches it. */

const AUTH_TOKEN = /^sb-.*-auth-token(\.\d+)?$/

function parseCookieHeader(header: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!header) return map
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return map
}

function jwtSubFromAccessToken(accessToken: string): string | null {
  try {
    const segment = accessToken.split('.')[1]
    if (!segment) return null
    const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64url').toString('utf8')) as {
      sub?: string
    }
    return payload.sub ?? null
  } catch {
    return null
  }
}

function subFromAuthCookieValue(value: string): string | null {
  try {
    const raw = value.startsWith('base64-')
      ? Buffer.from(value.slice('base64-'.length), 'base64').toString('utf8')
      : decodeURIComponent(value)
    const session = JSON.parse(raw) as { access_token?: string }
    if (!session.access_token) return null
    return jwtSubFromAccessToken(session.access_token)
  } catch {
    return null
  }
}

function combineAuthTokenValue(cookies: Map<string, string>, baseName: string): string | null {
  const direct = cookies.get(baseName)
  if (direct) return direct
  let combined = ''
  for (let i = 0; i < 5; i += 1) {
    const chunk = cookies.get(`${baseName}.${i}`)
    if (!chunk) break
    combined += chunk
  }
  return combined || null
}

/** Log every auth cookie on the wire plus JWT sub — before createClient/getUser. */
export function logPreCreateClientAuthCookies(request: Request, label: string): void {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const parsed = parseCookieHeader(cookieHeader)
  const allNames = [...parsed.keys()].sort()

  const authEntries = [...parsed.entries()]
    .filter(([name]) => AUTH_TOKEN.test(name))
    .map(([name, value]) => ({
      name,
      valueLen: value.length,
      valuePrefix: value.slice(0, 16),
      valueSuffix: value.slice(-8),
    }))

  const baseNames = [
    ...new Set(
      allNames
        .map((name) => {
          const m = name.match(/^(sb-.*-auth-token)(?:\.\d+)?$/)
          return m?.[1] ?? null
        })
        .filter((n): n is string => Boolean(n)),
    ),
  ]

  const combinedSessions = baseNames.map((baseName) => {
    const value = combineAuthTokenValue(parsed, baseName)
    return {
      baseName,
      combinedValueLen: value?.length ?? 0,
      sub: value ? subFromAuthCookieValue(value) : null,
    }
  })

  console.error(
    JSON.stringify({
      diag: 'route-auth-cookie-pre',
      label,
      timing: 'before-createClient',
      rawCookieHeaderLen: cookieHeader.length,
      allCookieNames: allNames,
      authCookieEntries: authEntries,
      combinedAuthSessions: combinedSessions,
      expectedAdvisorEmptySub: '0a56d38d-a005-4aff-84de-53c38662399c',
    }),
  )
}
