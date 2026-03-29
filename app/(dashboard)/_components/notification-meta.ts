/** Icons and labels for notification `type` values from the database. */
export const NOTIFICATION_META: Record<string, { icon: string }> = {
  default: { icon: '🔔' },
  billing: { icon: '💳' },
  subscription: { icon: '✨' },
  advisor: { icon: '👤' },
  client_accepted_invite: { icon: '✅' },
  referral_status_update: { icon: '📝' },
  security: { icon: '🔐' },
}
