/** Advisor–consumer link statuses that grant a live connection (both sides). */
export const CONNECTED_ADVISOR_CLIENT_STATUSES = ['active', 'accepted'] as const

export type ConnectedAdvisorClientStatus = (typeof CONNECTED_ADVISOR_CLIENT_STATUSES)[number]

export function isConnectedAdvisorClientStatus(
  status: string,
): status is ConnectedAdvisorClientStatus {
  return (CONNECTED_ADVISOR_CLIENT_STATUSES as readonly string[]).includes(status)
}
