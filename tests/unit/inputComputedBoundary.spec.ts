import { test, expect } from '@playwright/test'
import {
  COMPUTED_ANALYSIS_FEATURES,
  EXPORT_COMPUTED_DENYLIST,
  EXPORT_INPUT_TABLES,
  PAGE_INPUT_COMPUTED_SPLIT,
  TIER_ZERO_DATA_ENTRY_FEATURES,
  assertDataEntryFeaturesAtTierZero,
} from '@/lib/access/inputComputedBoundary'
import { FEATURE_TIERS } from '@/lib/tiers'

test.describe('inputComputedBoundary', () => {
  test('keeps data-entry FEATURE_TIERS keys at tier 0', () => {
    expect(() => assertDataEntryFeaturesAtTierZero()).not.toThrow()
    for (const key of TIER_ZERO_DATA_ENTRY_FEATURES) {
      expect(FEATURE_TIERS[key]).toBe(0)
    }
  })

  test('aligns computed analysis keys with FEATURE_TIERS', () => {
    for (const [key, tier] of Object.entries(COMPUTED_ANALYSIS_FEATURES)) {
      expect(FEATURE_TIERS[key]).toBe(tier)
    }
  })

  test('documents a computed feature for each shared page split', () => {
    for (const split of Object.values(PAGE_INPUT_COMPUTED_SPLIT)) {
      expect(split.computedFeature).toBeTruthy()
      expect(COMPUTED_ANALYSIS_FEATURES[split.computedFeature]).toBeGreaterThan(0)
    }
  })

  test('exports input tables without computed denylist overlap', () => {
    const inputs = new Set<string>(EXPORT_INPUT_TABLES)
    for (const denied of EXPORT_COMPUTED_DENYLIST) {
      expect(inputs.has(denied)).toBe(false)
    }
  })
})
