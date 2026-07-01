import { test, expect } from '@playwright/test'
import {
  countBillableAdvisorHouseholdsForFirm,
  countBillableAttorneyHouseholds,
  countDistinctClientIds,
} from '@/lib/billing/connectedHouseholdCount'

test.describe('connectedHouseholdCount', () => {
  test('countDistinctClientIds dedupes and ignores empty ids', () => {
    expect(
      countDistinctClientIds([
        { client_id: 'a' },
        { client_id: 'a' },
        { client_id: 'b' },
        { client_id: '' },
        { client_id: '  ' },
      ]),
    ).toBe(2)
  })

  test('dedup within firm — two advisors, one household counts once', () => {
    const firmId = 'firm-a'
    const householdUser = 'consumer-1'
    expect(
      countBillableAdvisorHouseholdsForFirm(
        [
          {
            client_id: householdUser,
            status: 'active',
            advisor_id: 'adv-1',
            firm_id: firmId,
          },
          {
            client_id: householdUser,
            status: 'accepted',
            advisor_id: 'adv-2',
            firm_id: firmId,
          },
        ],
        firmId,
      ),
    ).toBe(1)
  })

  test('two firms, same household — each firm counts independently', () => {
    const householdUser = 'consumer-shared'
    const links = [
      {
        client_id: householdUser,
        status: 'active',
        advisor_id: 'adv-a',
        firm_id: 'firm-a',
      },
      {
        client_id: householdUser,
        status: 'active',
        advisor_id: 'adv-b',
        firm_id: 'firm-b',
      },
    ]
    expect(countBillableAdvisorHouseholdsForFirm(links, 'firm-a')).toBe(1)
    expect(countBillableAdvisorHouseholdsForFirm(links, 'firm-b')).toBe(1)
  })

  test('connected statuses only — pending and consumer_requested excluded', () => {
    expect(
      countBillableAdvisorHouseholdsForFirm(
        [
          {
            client_id: 'c1',
            status: 'consumer_requested',
            advisor_id: 'adv-1',
            firm_id: 'firm-a',
          },
          {
            client_id: 'c2',
            status: 'pending',
            advisor_id: 'adv-1',
            firm_id: 'firm-a',
          },
          {
            client_id: 'c3',
            status: 'active',
            advisor_id: 'adv-1',
            firm_id: 'firm-a',
          },
        ],
        'firm-a',
      ),
    ).toBe(1)
  })

  test('attorney count uses household ids directly with dedup', () => {
    expect(
      countBillableAttorneyHouseholds([
        { client_id: 'household-1', status: 'active' },
        { client_id: 'household-1', status: 'accepted' },
        { client_id: 'household-2', status: 'active' },
        { client_id: 'household-3', status: 'pending' },
      ]),
    ).toBe(2)
  })
})
