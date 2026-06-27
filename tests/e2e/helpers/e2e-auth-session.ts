import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export function sidecarPathFor(storageStatePath: string): string {
  return storageStatePath.replace(/\.json$/, '.expires.json')
}

/** Write `.auth/<name>.expires.json` after minting storage state (CI TTL guard reads this). */
export function writeAuthExpirySidecar(storageStatePath: string): void {
  const expiresAt = parseExpiresAtFromStorageState(storageStatePath)
  const sidecarPath = sidecarPathFor(storageStatePath)
  mkdirSync(dirname(sidecarPath), { recursive: true })
  writeFileSync(
    sidecarPath,
    JSON.stringify({ expiresAt, writtenAt: Math.floor(Date.now() / 1000) }, null, 2),
  )
}

export function parseExpiresAtFromStorageState(storageStatePath: string): number {
  if (!existsSync(storageStatePath)) {
    throw new Error(`Storage state not found: ${storageStatePath}`)
  }

  const state = JSON.parse(readFileSync(storageStatePath, 'utf8')) as {
    cookies?: Array<{ name: string; value: string }>
  }

  const chunks = (state.cookies ?? [])
    .filter((c) => /sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join('')

  if (!chunks) {
    throw new Error(`No sb-*-auth-token cookie in ${storageStatePath}`)
  }

  const raw = chunks.startsWith('base64-')
    ? Buffer.from(chunks.slice('base64-'.length), 'base64').toString('utf8')
    : decodeURIComponent(chunks)

  const session = JSON.parse(raw) as { expires_at?: number; access_token?: string }
  let expiresAt = session.expires_at

  if (!expiresAt && session.access_token) {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
    ) as { exp?: number }
    expiresAt = payload.exp
  }

  if (!expiresAt) {
    throw new Error(`Could not resolve expires_at in ${storageStatePath}`)
  }

  return expiresAt
}
