/**
 * Primary-role check for advisor *identity* (billing model, firm linkage, consumer vs advisor UI).
 *
 * Use this — not `getAccessContext().isAdvisor` — when the decision is which experience
 * the user gets. `getAccessContext().isAdvisor` is a *capability* flag
 * (`isSuperuser || role === 'advisor'`) for portal/API access.
 */
export function isAdvisorIdentity(role: string | null | undefined): boolean {
  return role === 'advisor'
}
