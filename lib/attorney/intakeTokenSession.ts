'use client'

const INTAKE_TOKEN_KEY = 'mwm_intake_token'

export function storeIntakeToken(token: string) {
  sessionStorage.setItem(INTAKE_TOKEN_KEY, token)
}

export function consumeIntakeToken(): string | null {
  const token = sessionStorage.getItem(INTAKE_TOKEN_KEY)
  if (token) sessionStorage.removeItem(INTAKE_TOKEN_KEY)
  return token
}

export function peekIntakeToken(): string | null {
  return sessionStorage.getItem(INTAKE_TOKEN_KEY)
}
