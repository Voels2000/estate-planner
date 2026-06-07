/** Preset households for estate verification suite. */

export type EstateVerificationPreset = 'voels' | 'voels-advisor' | 'e2e'

export const VOELS_CONSUMER_HOUSEHOLD_ID = '5ea14f56-e880-4992-87bc-0d815a450cdc'
export const VOELS_ADVISOR_HOUSEHOLD_ID = '23c8d2fb-3050-45a2-910b-edcc9ef82587'

export const ESTATE_VERIFICATION_PRESETS: Record<
  EstateVerificationPreset,
  { householdId: string; label: string; goldenFixture?: string; verifyEmail?: string }
> = {
  voels: {
    householdId: VOELS_CONSUMER_HOUSEHOLD_ID,
    label: 'Voels consumer (avoels@outlook.com)',
    goldenFixture: 'voels.json',
    verifyEmail: 'avoels@outlook.com',
  },
  'voels-advisor': {
    householdId: VOELS_ADVISOR_HOUSEHOLD_ID,
    label: 'Voels advisor My Plan (avoels@comcast.net)',
    goldenFixture: 'voels-advisor.json',
    verifyEmail: 'avoels@comcast.net',
  },
  e2e: {
    householdId: '',
    label: 'E2E consumer (PLAYWRIGHT_HOUSEHOLD_ID)',
    goldenFixture: 'e2e.json',
    verifyEmail: '',
  },
}
