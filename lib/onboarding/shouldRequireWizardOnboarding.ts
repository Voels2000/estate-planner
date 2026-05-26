/** Whether the client wizard gate should force redirect to /onboarding/wizard. */
export function shouldRequireWizardOnboarding(input: {
  isSuperuser: boolean
  role: string | null | undefined
  wizardComplete: boolean
  wizardReady: boolean
  hasAnyData: boolean
}): boolean {
  if (input.isSuperuser) return false
  if (input.role !== 'consumer') return false
  if (input.wizardComplete) return false
  if (!input.wizardReady) return false
  if (input.hasAnyData) return false
  return true
}
