import {
  CONNECTION_STRIPE_PRICE_ENV_VARS,
  LEGACY_PROFESSIONAL_STRIPE_PRICE_ENV_VARS,
} from '@/lib/pricing/connectionPricing'
import type { EnvScope, EnvVarEntry } from '@/lib/env/manifest'

export { CONNECTION_STRIPE_PRICE_ENV_VARS, LEGACY_PROFESSIONAL_STRIPE_PRICE_ENV_VARS }

export type ConnectionStripePriceEnvVar = (typeof CONNECTION_STRIPE_PRICE_ENV_VARS)[number]

export function isConnectionBillingEnabledInEnv(
  env: Record<string, string | undefined>,
): boolean {
  return env.CONNECTION_BILLING_ENABLED === 'true'
}

export function isLegacyProfessionalStripePriceEnvVar(name: string): boolean {
  return (LEGACY_PROFESSIONAL_STRIPE_PRICE_ENV_VARS as readonly string[]).includes(name)
}

export function isConnectionStripePriceEnvVar(name: string): boolean {
  return (CONNECTION_STRIPE_PRICE_ENV_VARS as readonly string[]).includes(name)
}

/** Manifest requiredInScopes, adjusted when CONNECTION_BILLING_ENABLED selects connection vs legacy checkout. */
export function isStripePriceRequiredInScope(
  entry: EnvVarEntry,
  scope: EnvScope,
  env: Record<string, string | undefined>,
): boolean {
  const staticRequired = entry.requiredInScopes.includes(scope)
  const connectionBilling = isConnectionBillingEnabledInEnv(env)

  if (isLegacyProfessionalStripePriceEnvVar(entry.name)) {
    return staticRequired && !connectionBilling
  }
  if (isConnectionStripePriceEnvVar(entry.name)) {
    return (scope === 'preview' || scope === 'production') && connectionBilling
  }
  return staticRequired
}
