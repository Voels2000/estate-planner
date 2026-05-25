import { test } from '@playwright/test'
import {
  CONSUMER_FINANCIAL_ROUTES,
  CONSUMER_LINKED_ROUTES,
  CONSUMER_OVERVIEW_ROUTES,
  CONSUMER_RETIREMENT_ROUTES,
  CONSUMER_ESTATE_ROUTES,
  QUICK_REGRESSION_ROUTES,
  dedupeRoutesByPath,
} from '../helpers/routes'
import { assertPageLoads } from '../helpers/page-assertions'

test.describe('Consumer route regression — quick set', () => {
  for (const route of QUICK_REGRESSION_ROUTES) {
    test(`quick: ${route.path}`, async ({ page }) => {
      await assertPageLoads(page, route.path, route.heading)
    })
  }
})

test.describe('Consumer route regression — full nav map', () => {
  const allRoutes = dedupeRoutesByPath([
    ...CONSUMER_OVERVIEW_ROUTES,
    ...CONSUMER_FINANCIAL_ROUTES,
    ...CONSUMER_RETIREMENT_ROUTES,
    ...CONSUMER_ESTATE_ROUTES,
    ...CONSUMER_LINKED_ROUTES,
  ])

  for (const route of allRoutes) {
    test(`${route.path}`, async ({ page }) => {
      await assertPageLoads(page, route.path, route.heading, { timeout: 45_000 })
    })
  }
})
