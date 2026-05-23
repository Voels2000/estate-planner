/**
 * Prod smoke: every life-event slug has tier-2 and tier-3 EVENT_UPGRADE_COPY strings.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/verify-event-upgrade-copy.ts
 */

import { EVENT_SLUGS } from '../lib/events/content'
import { findMissingEventUpgradeCopy } from '../lib/events/upgradeContext'

const missing = findMissingEventUpgradeCopy(EVENT_SLUGS)

if (missing.length > 0) {
  console.error('Missing EVENT_UPGRADE_COPY for slugs:', missing.join(', '))
  process.exit(1)
}

console.log(`OK: all ${EVENT_SLUGS.length} event slugs have tier-2 and tier-3 upgrade copy.`)
