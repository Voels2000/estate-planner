/**
 * Type normalizer unit tests — Import Expansion Phase 1
 * Run: npx playwright test tests/unit/type-normalizer.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  normalizeAssetType,
  normalizeLiabilityType,
  normalizePropertyType,
} from '../../lib/import/type-normalizer'

test.describe('normalizeAssetType', () => {
  test('maps brokerage labels to taxable_brokerage', () => {
    expect(normalizeAssetType('Brokerage Account')).toEqual({
      canonical: 'taxable_brokerage',
      matched: true,
      displayLabel: 'Taxable Brokerage',
    })
  })

  test('maps 401k variants', () => {
    expect(normalizeAssetType('401(k)').canonical).toBe('traditional_401k')
    expect(normalizeAssetType('401k').canonical).toBe('traditional_401k')
  })

  test('passes through canonical slugs', () => {
    expect(normalizeAssetType('taxable_brokerage').matched).toBe(true)
    expect(normalizeAssetType('taxable_brokerage').canonical).toBe('taxable_brokerage')
  })

  test('returns unmatched for unknown labels', () => {
    const result = normalizeAssetType('Mystery Widget')
    expect(result.matched).toBe(false)
    expect(result.canonical).toBeNull()
    expect(result.displayLabel).toBe('Mystery Widget')
  })
})

test.describe('normalizeLiabilityType', () => {
  test('maps mortgage aliases', () => {
    expect(normalizeLiabilityType('Home Loan').canonical).toBe('mortgage')
    expect(normalizeLiabilityType('HELOC').canonical).toBe('heloc')
  })
})

test.describe('normalizePropertyType', () => {
  test('maps vacation home to vacation', () => {
    expect(normalizePropertyType('Vacation Home').canonical).toBe('vacation')
  })

  test('maps rental property to rental', () => {
    expect(normalizePropertyType('Investment Property').canonical).toBe('rental')
  })
})
