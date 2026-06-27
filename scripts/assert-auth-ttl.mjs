#!/usr/bin/env node
/**
 * Fail prepare if a minted session has less than N seconds of access-token life.
 *
 * Prefers `.auth/<name>.expires.json` sidecars (written by setup projects).
 * Falls back to parsing the sb-*-auth-token cookie when no sidecar exists.
 *
 * Usage: node scripts/assert-auth-ttl.mjs <storageState.json> [minSecondsRemaining]
 */
import { existsSync, readFileSync } from 'node:fs'

const [file, minStr] = process.argv.slice(2)
if (!file) {
  console.error('Usage: node scripts/assert-auth-ttl.mjs <storageState.json> [minSecondsRemaining]')
  process.exit(1)
}

const min = Number(minStr ?? 1800)
const sidecarPath = file.replace(/\.json$/, '.expires.json')

function parseExpiresAtFromStorageState(storageStatePath) {
  const state = JSON.parse(readFileSync(storageStatePath, 'utf8'))
  const chunks = (state.cookies ?? [])
    .filter((c) => /sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join('')

  if (!chunks) {
    console.error(`No sb-*-auth-token cookie in ${storageStatePath}`)
    process.exit(1)
  }

  const raw = chunks.startsWith('base64-')
    ? Buffer.from(chunks.slice('base64-'.length), 'base64').toString('utf8')
    : decodeURIComponent(chunks)

  const session = JSON.parse(raw)
  let expiresAt = session.expires_at

  if (!expiresAt && session.access_token) {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
    )
    expiresAt = payload.exp
  }

  if (!expiresAt) {
    console.error(`Could not resolve expires_at in ${storageStatePath}`)
    process.exit(1)
  }

  return expiresAt
}

let expiresAt
if (existsSync(sidecarPath)) {
  ;({ expiresAt } = JSON.parse(readFileSync(sidecarPath, 'utf8')))
} else if (existsSync(file)) {
  expiresAt = parseExpiresAtFromStorageState(file)
} else {
  console.error(`Neither ${sidecarPath} nor ${file} exists`)
  process.exit(1)
}

const remaining = expiresAt - Math.floor(Date.now() / 1000)
if (remaining < min) {
  console.error(
    `Auth TTL too short in ${file}: ${remaining}s remaining < ${min}s required.\n` +
      `Raise the staging project JWT expiry, or switch to per-job sessions (see e2e-shared-auth plan).`,
  )
  process.exit(1)
}

console.log(`${file}: ${remaining}s of access-token life — ok (>= ${min}s).`)
