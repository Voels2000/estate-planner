/** First token of contact_name for outreach salutation; falls back to neutral greeting. */
export function outreachFirstNameFromContact(contactName: string | null | undefined): string {
  const trimmed = (contactName ?? '').trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0] || 'there'
}
