/**
 * Fail CI if App Router dynamic segments conflict at the same path depth.
 * Next.js build may pass while Vercel silently hangs all /api/* route handlers.
 *
 * Run: npx tsx scripts/verify-app-route-slugs.ts
 */
import fs from 'fs'
import path from 'path'
import { getSortedRoutes } from 'next/dist/shared/lib/router/utils/sorted-routes'

function collectAppRoutes(dir: string, prefix = ''): string[] {
  const routes: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}/${entry.name}`
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      routes.push(...collectAppRoutes(full, rel))
    } else if (entry.name === 'page.tsx' || entry.name === 'route.ts') {
      routes.push(prefix)
    }
  }
  return routes
}

const appDir = path.join(process.cwd(), 'app')
if (!fs.existsSync(appDir)) {
  console.error('app/ directory not found')
  process.exit(1)
}

const routes = collectAppRoutes(appDir)
try {
  getSortedRoutes(routes)
  console.log(`OK: ${routes.length} App Router paths — no dynamic slug conflicts`)
} catch (err) {
  console.error('App route slug conflict:', err instanceof Error ? err.message : err)
  process.exit(1)
}
