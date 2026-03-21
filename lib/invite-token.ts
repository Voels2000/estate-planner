import crypto from 'crypto'

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function tokenExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}
