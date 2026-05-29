export const ESTATE_CHECKLIST_TASK_KEYS = [
  'will_on_file',
  'dpoa_on_file',
  'healthcare_directive',
  'trust_funded',
  'beneficiaries_updated',
  'titling_reviewed',
  'guardian_named',
  'annual_gifts_logged',
] as const

export type EstateChecklistTaskKey = (typeof ESTATE_CHECKLIST_TASK_KEYS)[number]

export function isEstateChecklistTaskKey(key: string): key is EstateChecklistTaskKey {
  return (ESTATE_CHECKLIST_TASK_KEYS as readonly string[]).includes(key)
}

/** Maps trust-will-rules checklist task text → persisted task_key (when applicable). */
export const TRUST_TASK_TO_CHECKLIST_KEY: Record<string, EstateChecklistTaskKey> = {
  'Schedule a consultation with an estate planning attorney': 'will_on_file',
  'Gather a complete list of all assets and their current titling': 'titling_reviewed',
  'Review and update all beneficiary designations': 'beneficiaries_updated',
  'Decide on an executor for your will': 'will_on_file',
  'Name a guardian for your minor children in your will': 'guardian_named',
  'Review joint ownership arrangements with your spouse': 'titling_reviewed',
  'Review business ownership documents and succession plan': 'annual_gifts_logged',
  'Execute a Healthcare Proxy and Power of Attorney': 'dpoa_on_file',
  'Store all documents in a secure, accessible location': 'will_on_file',
}
