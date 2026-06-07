#!/usr/bin/env tsx
/**
 * L4 — Consumer API OpenAPI contract stays in sync with route handlers.
 *
 * Run: npm run verify:consumer-openapi
 */
import {
  CONSUMER_HTTP_METHODS,
  discoverConsumerApiRoutes,
  routeSpecKey,
} from '../lib/api/openapi/discoverConsumerApiRoutes'
import { buildConsumerOpenApiSpec } from '../lib/api/openapi/buildConsumerOpenApiSpec'

const OPENAPI_PATH = '/api/consumer/openapi'

function main() {
  const routes = discoverConsumerApiRoutes()
  const spec = buildConsumerOpenApiSpec(routes)

  const discoveredKeys = new Set<string>()
  for (const route of routes) {
    if (route.path === OPENAPI_PATH) continue
    for (const method of route.methods) {
      discoveredKeys.add(routeSpecKey(route.path, method))
    }
  }

  const specKeys = new Set<string>()
  for (const [pathname, item] of Object.entries(spec.paths)) {
    for (const method of CONSUMER_HTTP_METHODS) {
      if ((item as Record<string, unknown>)[method.toLowerCase()]) {
        specKeys.add(routeSpecKey(pathname, method))
      }
    }
  }

  const missingFromSpec = [...discoveredKeys].filter((k) => !specKeys.has(k))
  const extraInSpec = [...specKeys].filter((k) => !discoveredKeys.has(k))

  if (missingFromSpec.length > 0 || extraInSpec.length > 0) {
    if (missingFromSpec.length > 0) {
      console.error('Routes missing from OpenAPI spec:')
      for (const key of missingFromSpec) console.error(`  - ${key}`)
    }
    if (extraInSpec.length > 0) {
      console.error('OpenAPI spec entries without route handlers:')
      for (const key of extraInSpec) console.error(`  - ${key}`)
    }
    process.exit(1)
  }

  const documentedPaths = Object.keys(spec.paths).length
  const operationCount = specKeys.size

  console.log(
    `OK: Consumer OpenAPI contract — ${documentedPaths} paths, ${operationCount} operations (${routes.length} route files including openapi)`,
  )
}

main()
