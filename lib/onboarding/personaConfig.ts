export type OnboardingPersona =
  | 'business_owner'
  | 'real_estate'
  | 'executive'
  | 'accumulator'

export interface PersonaConfig {
  wizardStep1Headline: string
  wizardStep1Body: string
  firstAssetType: string
  firstAssetLabel: string
  firstAssetPlaceholder: string
  importTemplateName: string
  dashboardEmphasis: PersonaDashboardEmphasis
}

export type PersonaDashboardEmphasis =
  | 'business_succession'
  | 'real_estate_situs'
  | 'estate_tax_band'
  | 'retirement_timeline'

export const PERSONA_CONFIG: Record<OnboardingPersona, PersonaConfig> = {
  business_owner: {
    wizardStep1Headline: 'Tell us about your business',
    wizardStep1Body:
      'Your business interest is often your largest asset — and the hardest to plan around. Add it first so we can show you succession exposure.',
    firstAssetType: 'business',
    firstAssetLabel: 'Business interest',
    firstAssetPlaceholder: 'ABC Enterprises LLC',
    importTemplateName: 'template-business-owner.xlsx',
    dashboardEmphasis: 'business_succession',
  },
  real_estate: {
    wizardStep1Headline: 'Add your first property',
    wizardStep1Body:
      'Real estate held in multiple states creates probate exposure in each. Add your properties so we can map your situs exposure.',
    firstAssetType: 'real_estate',
    firstAssetLabel: 'Property',
    firstAssetPlaceholder: '123 Main St, Seattle WA',
    importTemplateName: 'template-real-estate.xlsx',
    dashboardEmphasis: 'real_estate_situs',
  },
  executive: {
    wizardStep1Headline: 'Start with your investment accounts',
    wizardStep1Body:
      'RSUs, stock options, and brokerage accounts are the core of executive wealth. Add them first to see your estate tax band.',
    firstAssetType: 'taxable_brokerage',
    firstAssetLabel: 'Brokerage / investment account',
    firstAssetPlaceholder: 'Company stock plan or brokerage',
    importTemplateName: 'template-executive.xlsx',
    dashboardEmphasis: 'estate_tax_band',
  },
  accumulator: {
    wizardStep1Headline: 'Add your retirement accounts',
    wizardStep1Body:
      'Your 401(k) and IRA balances anchor your retirement projection. Add them now to see your timeline.',
    firstAssetType: 'traditional_401k',
    firstAssetLabel: 'Retirement account',
    firstAssetPlaceholder: 'My 401(k)',
    importTemplateName: 'template-executive.xlsx',
    dashboardEmphasis: 'retirement_timeline',
  },
}

export const ONBOARDING_PERSONAS = Object.keys(PERSONA_CONFIG) as OnboardingPersona[]

export function isOnboardingPersona(value: string): value is OnboardingPersona {
  return ONBOARDING_PERSONAS.includes(value as OnboardingPersona)
}

export function getPersonaConfig(persona: string | null | undefined): PersonaConfig {
  return (
    PERSONA_CONFIG[(persona as OnboardingPersona) ?? 'accumulator'] ?? PERSONA_CONFIG.accumulator
  )
}
