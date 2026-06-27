/**
 * Reads minted `.auth/*.json` files: which underlying user does each session belong to?
 * Pairs with probe-refresh-rotation.ts — if a role shares one user across concurrent
 * jobs and the probe != INDEPENDENT, that role is broken or a latent flake.
 *
 * Reads files only. No network, no writes.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSessionFromStorageState } from '../tests/e2e/helpers/e2e-auth-session'

const AUTH_DIR = process.argv[2] ?? '.auth'

function roleOf(filename: string): string {
  const base = filename.replace(/\.json$/, '')
  const head = base.split('.')[0] ?? base
  return head.split('-')[0] ?? head
}

function userIdFromStorageFile(filePath: string): string | null {
  try {
    const session = parseSessionFromStorageState(filePath)
    return session.user_id ?? null
  } catch {
    return null
  }
}

function main() {
  if (!existsSync(AUTH_DIR)) {
    console.error(`ci-auth-topology-error ${JSON.stringify({ authDir: AUTH_DIR, error: 'missing' })}`)
    process.exit(1)
  }

  const files = readdirSync(AUTH_DIR).filter(
    (file) => file.endsWith('.json') && !file.endsWith('.expires.json'),
  )

  const byRole = new Map<string, { file: string; userId: string | null }[]>()
  for (const file of files) {
    const filePath = join(AUTH_DIR, file)
    const userId = userIdFromStorageFile(filePath)
    const role = roleOf(file)
    const entries = byRole.get(role) ?? []
    entries.push({ file, userId })
    byRole.set(role, entries)
  }

  let anyShared = false
  for (const [role, entries] of byRole) {
    const distinct = new Set(entries.map((entry) => entry.userId).filter(Boolean))
    const shared = entries.length > 1 && distinct.size === 1
    if (shared) anyShared = true
    console.log(
      `ci-auth-topology ${JSON.stringify({
        role,
        files: entries.length,
        distinctUsers: distinct.size,
        sharesOneUser: shared,
        detail: entries.map((entry) => ({
          file: entry.file,
          user: entry.userId?.slice(0, 8) ?? 'unknown',
        })),
      })}`,
    )
  }

  console.log(
    `ci-auth-topology-summary ${JSON.stringify({
      anyRoleSharesOneUserAcrossFiles: anyShared,
      note: 'If true AND probe != INDEPENDENT, those roles are the bug (or a latent flake).',
    })}`,
  )
}

main()
