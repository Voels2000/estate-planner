/**
 * Estate health score unit tests
 * Run: npm run test:unit:health
 */
import { test, expect } from '@playwright/test'
import {
  scoreLabel,
  scoreContextSentence,
  scoreContextSentenceForAdvisor,
  isScoreStale,
} from '../../lib/estate-health-score'

test.describe('scoreLabel', () => {
  test('Strong at 75+', () => {
    expect(scoreLabel(75)).toBe('Strong')
    expect(scoreLabel(100)).toBe('Strong')
  })

  test('Needs Attention at 50–74', () => {
    expect(scoreLabel(50)).toBe('Needs Attention')
    expect(scoreLabel(74)).toBe('Needs Attention')
  })

  test('At Risk below 50', () => {
    expect(scoreLabel(49)).toBe('At Risk')
    expect(scoreLabel(0)).toBe('At Risk')
  })
})

test.describe('scoreContextSentence', () => {
  test('returns tier-appropriate consumer copy', () => {
    expect(scoreContextSentence(80)).toMatch(/covers the key areas/)
    expect(scoreContextSentence(60)).toMatch(/meaningful gaps/)
    expect(scoreContextSentence(30)).toMatch(/significant unaddressed risks/)
  })
})

test.describe('scoreContextSentenceForAdvisor', () => {
  test('uses client name when provided', () => {
    expect(scoreContextSentenceForAdvisor(30, 'Jane')).toMatch(/Jane's plan/)
  })
})

test.describe('isScoreStale', () => {
  test('null or missing computedAt is not stale', () => {
    expect(isScoreStale(null)).toBe(false)
    expect(isScoreStale(undefined)).toBe(false)
  })

  test('recent score is not stale', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(isScoreStale(recent)).toBe(false)
  })

  test('score over 30 days old is stale', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    expect(isScoreStale(old)).toBe(true)
  })
})
