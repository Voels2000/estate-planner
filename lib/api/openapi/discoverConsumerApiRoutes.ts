import fs from 'fs'
import path from 'path'

export const CONSUMER_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type ConsumerHttpMethod = (typeof CONSUMER_HTTP_METHODS)[number]

export type DiscoveredConsumerRoute = {
  path: string
  methods: ConsumerHttpMethod[]
}

const METHOD_PATTERN = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g

function methodsInRouteFile(filePath: string): ConsumerHttpMethod[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const methods = new Set<ConsumerHttpMethod>()
  for (const match of content.matchAll(METHOD_PATTERN)) {
    methods.add(match[1] as ConsumerHttpMethod)
  }
  return CONSUMER_HTTP_METHODS.filter((m) => methods.has(m))
}

function walkConsumerRoutes(dir: string, urlPrefix: string, out: DiscoveredConsumerRoute[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkConsumerRoutes(full, `${urlPrefix}/${entry.name}`, out)
      continue
    }
    if (entry.name !== 'route.ts') continue

    const methods = methodsInRouteFile(full)
    if (methods.length === 0) continue

    out.push({
      path: `/api/consumer${urlPrefix}`,
      methods,
    })
  }
}

/** Scan app/api/consumer route.ts files for exported HTTP handlers. */
export function discoverConsumerApiRoutes(root = path.join(process.cwd(), 'app/api/consumer')): DiscoveredConsumerRoute[] {
  if (!fs.existsSync(root)) {
    throw new Error(`Consumer API directory not found: ${root}`)
  }

  const routes: DiscoveredConsumerRoute[] = []
  walkConsumerRoutes(root, '', routes)
  return routes.sort((a, b) => a.path.localeCompare(b.path))
}

export function routeSpecKey(pathname: string, method: ConsumerHttpMethod): string {
  return `${method} ${pathname}`
}
