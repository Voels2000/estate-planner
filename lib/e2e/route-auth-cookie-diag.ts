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

/** Log raw Cookie header vs Next.js cookies().getAll() before Supabase touches either. */
export async function logCookieLayerComparison(request: Request): Promise<void> {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const parsedHeader = parseCookieHeader(cookieHeader)
  const authHeaderEntries = [...parsedHeader.entries()].filter(([name]) => AUTH_TOKEN.test(name))
  const rawVal =
    authHeaderEntries.find(([name]) => !/\.\d+$/.test(name))?.[1] ??
    authHeaderEntries[0]?.[1] ??
    ''

  const { cookies } = await import('next/headers')
  const nextParsed = (await cookies()).getAll().filter((c) => AUTH_TOKEN.test(c.name))

  console.error(
    JSON.stringify({
      diag: 'client-export-payload-cookie-layer',
      timing: 'before-createClient',
      rawHeaderAuthLen: rawVal.length,
      rawIsUrlEncoded: /%[0-9A-Fa-f]{2}/.test(rawVal),
      rawHead: rawVal.slice(0, 24),
      parsedNames: nextParsed.map((c) => c.name),
      parsedTotalLen: nextParsed.reduce((n, c) => n + (c.value?.length ?? 0), 0),
      parsedEntries: nextParsed.map((c) => ({
        name: c.name,
        valueLen: c.value?.length ?? 0,
        head: (c.value ?? '').slice(0, 24),
      })),
    }),
  )
}

export async function logPreCreateClientAuthDiag(request: Request, label: string): Promise<void> {
  logPreCreateClientAuthCookies(request, label)
  await logCookieLayerComparison(request)
}

function logPreCreateClientAuthCookies(request: Request, label: string): void {
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
