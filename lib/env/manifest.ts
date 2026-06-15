export type EnvScope = 'local' | 'preview' | 'production'

export type EnvShape = RegExp | string

export interface EnvVarEntry {
  name: string
  /** Scopes where this var is expected / validated when present. */
  scopes: EnvScope[]
  /** Hard fail (MISSING) when absent in these scopes. */
  requiredInScopes: EnvScope[]
  secret: boolean
  shape?: Partial<Record<EnvScope, EnvShape>>
  /** Present in these scopes → FORBIDDEN_IN_SCOPE flag. */
  forbiddenInScopes?: EnvScope[]
  /** Absent in these scopes → WARN flag (not counted in summary.missing). */
  warnIfMissingInScopes?: EnvScope[]
}

const ALL_DEPLOYED: EnvScope[] = ['preview', 'production']
const ALL_SCOPES: EnvScope[] = ['local', 'preview', 'production']

const HTTPS = /^https:\/\//
/** Legacy JWT and new Supabase API key formats (staging vs prod projects differ). */
const SUPABASE_SERVICE_ROLE = /^(eyJ|sb_secret_)/
const SUPABASE_ANON_KEY = /^(eyJ|sb_publishable_)/
const PRICE = /^price_/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function entry(
  name: string,
  opts: Omit<EnvVarEntry, 'name' | 'scopes'> & { scopes?: EnvScope[] },
): EnvVarEntry {
  const { scopes = ALL_SCOPES, ...rest } = opts
  return { name, scopes, ...rest }
}

/** Consumer tier prices in stripePrices.ts — shared with env verifier (no duplicate list). */
export const CONSUMER_STRIPE_PRICE_ENV_VARS = [
  'STRIPE_PRICE_FINANCIAL_MONTHLY',
  'STRIPE_PRICE_FINANCIAL_ANNUAL',
  'STRIPE_PRICE_RETIREMENT_MONTHLY',
  'STRIPE_PRICE_RETIREMENT_ANNUAL',
  'STRIPE_PRICE_ESTATE_MONTHLY',
  'STRIPE_PRICE_ESTATE_ANNUAL',
] as const

export type ConsumerStripePriceEnvVar = (typeof CONSUMER_STRIPE_PRICE_ENV_VARS)[number]

/** All Stripe price ID env vars verified with prices.retrieve when ?live=1. */
export const LIVE_STRIPE_PRICE_ENV_VARS = [
  ...CONSUMER_STRIPE_PRICE_ENV_VARS,
  'STRIPE_PRICE_ADVISOR_STARTER_MONTHLY',
  'STRIPE_PRICE_ADVISOR_GROWTH_MONTHLY',
  'STRIPE_PRICE_ADVISOR_ENTERPRISE_MONTHLY',
  'STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY',
  'STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY',
] as const

function consumerPrice(name: ConsumerStripePriceEnvVar): EnvVarEntry {
  return entry(name, {
    scopes: ALL_SCOPES,
    requiredInScopes: ['production'],
    warnIfMissingInScopes: ['preview'],
    secret: false,
    shape: { local: PRICE, preview: PRICE, production: PRICE },
  })
}

function forbiddenTestVar(name: string): EnvVarEntry {
  return {
    name,
    scopes: [],
    requiredInScopes: [],
    secret: false,
    forbiddenInScopes: ['preview', 'production'],
  }
}

/** Single source of truth for env var expectations per deployment scope. */
export const ENV_MANIFEST: EnvVarEntry[] = [
  // --- Auth gate for this route ---
  entry('ADMIN_VERIFY_TOKEN', {
    scopes: ALL_DEPLOYED,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
  }),

  // --- Supabase ---
  entry('NEXT_PUBLIC_SUPABASE_URL', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: HTTPS, production: HTTPS },
  }),
  entry('NEXT_PUBLIC_SUPABASE_ANON_KEY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { local: SUPABASE_ANON_KEY, preview: SUPABASE_ANON_KEY, production: SUPABASE_ANON_KEY },
  }),
  entry('SUPABASE_SERVICE_ROLE_KEY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
    shape: { local: SUPABASE_SERVICE_ROLE, preview: SUPABASE_SERVICE_ROLE, production: SUPABASE_SERVICE_ROLE },
  }),

  // --- Stripe secrets ---
  entry('STRIPE_SECRET_KEY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
    shape: { preview: /^sk_test_/, production: /^sk_live_/ },
  }),
  entry('STRIPE_WEBHOOK_SECRET', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
    shape: { local: /^whsec_/, preview: /^whsec_/, production: /^whsec_/ },
  }),
  entry('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: /^pk_test_/, production: /^pk_live_/ },
  }),

  // --- Consumer Stripe prices (preview: warn — legacy fallbacks exist in stripePrices.ts) ---
  ...CONSUMER_STRIPE_PRICE_ENV_VARS.map((name) => consumerPrice(name)),

  // --- Advisor / attorney firm prices (no safe fallbacks) ---
  entry('STRIPE_PRICE_ADVISOR_STARTER_MONTHLY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: PRICE, production: PRICE },
  }),
  entry('STRIPE_PRICE_ADVISOR_GROWTH_MONTHLY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: PRICE, production: PRICE },
  }),
  entry('STRIPE_PRICE_ADVISOR_ENTERPRISE_MONTHLY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: PRICE, production: PRICE },
  }),
  entry('STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: PRICE, production: PRICE },
  }),
  entry('STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: PRICE, production: PRICE },
  }),

  // --- Server secrets ---
  entry('CRON_SECRET', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
  }),
  entry('RECOMPUTE_SECRET', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
  }),
  entry('INTERNAL_API_KEY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
  }),
  entry('RESEND_API_KEY', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: true,
    shape: { local: /^re_/, preview: /^re_/, production: /^re_/ },
  }),

  // --- URLs & ops ---
  entry('NEXT_PUBLIC_APP_URL', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
    shape: { preview: HTTPS, production: HTTPS },
  }),
  entry('COMPLIANCE_EMAIL', {
    scopes: ALL_SCOPES,
    requiredInScopes: ['production'],
    secret: false,
    shape: { production: EMAIL },
  }),
  entry('EMAIL_FROM', {
    scopes: ALL_SCOPES,
    requiredInScopes: ALL_DEPLOYED,
    secret: false,
  }),

  // --- Security / go-live flags ---
  entry('REQUIRE_PRIVILEGED_MFA', {
    scopes: ALL_SCOPES,
    requiredInScopes: ['production'],
    secret: false,
    shape: { production: 'true' },
  }),
  entry('PUBLIC_SIGNUP_OPEN', {
    scopes: ALL_SCOPES,
    requiredInScopes: ['production'],
    secret: false,
    shape: { production: 'false' },
  }),

  // --- Optional config (validated when present) ---
  entry('NEXT_PUBLIC_SITE_URL', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
    shape: { preview: HTTPS, production: HTTPS },
  }),
  entry('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', {
    scopes: ['production'],
    requiredInScopes: [],
    secret: false,
  }),
  entry('NEXT_PUBLIC_ADVISOR_BENCHMARKS', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('WAITLIST_MODE', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('NEXT_PUBLIC_WAITLIST_MODE', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('NEXT_PUBLIC_SIGNUP_OPEN', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('BETA_SIGNUP_TOKEN', {
    scopes: ALL_DEPLOYED,
    requiredInScopes: [],
    secret: true,
  }),
  entry('B2B2C_ADVISOR_CONSUMER_BILLING', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('B2B2C_ADVISOR_MANAGED_TIER', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('B2B2C_ATTORNEY_CONSUMER_BILLING', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('B2B2C_ATTORNEY_MANAGED_TIER', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
  }),
  entry('UPSTASH_REDIS_REST_URL', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: false,
    shape: { preview: HTTPS, production: HTTPS },
  }),
  entry('UPSTASH_REDIS_REST_TOKEN', {
    scopes: ALL_SCOPES,
    requiredInScopes: [],
    secret: true,
  }),

  // --- Local-only tooling ---
  entry('SUPABASE_DB_URL', {
    scopes: ['local'],
    requiredInScopes: [],
    secret: true,
  }),
  entry('DATABASE_URL', {
    scopes: ['local'],
    requiredInScopes: [],
    secret: true,
  }),
  entry('RLS_VERIFY_REQUIRE_SQL', {
    scopes: ['local'],
    requiredInScopes: [],
    secret: false,
  }),

  // Prod canary E2E — password belongs in production; warn if missing until account exists
  entry('E2E_CANARY_PASSWORD', {
    scopes: ['production'],
    requiredInScopes: [],
    warnIfMissingInScopes: ['production'],
    secret: true,
  }),

  // --- Forbidden in deployed scopes (test / E2E / debug) ---
  forbiddenTestVar('E2E_SKIP_RECOMPUTE'),
  forbiddenTestVar('PLAYWRIGHT_BASE_URL'),
  forbiddenTestVar('PLAYWRIGHT_CONSUMER_EMAIL'),
  forbiddenTestVar('PLAYWRIGHT_CONSUMER_PASSWORD'),
  forbiddenTestVar('PLAYWRIGHT_CONSUMER_TIER1_EMAIL'),
  forbiddenTestVar('PLAYWRIGHT_CONSUMER_TIER1_PASSWORD'),
  forbiddenTestVar('PLAYWRIGHT_HOUSEHOLD_ID'),
  forbiddenTestVar('PLAYWRIGHT_ADVISOR_EMAIL'),
  forbiddenTestVar('PLAYWRIGHT_ADVISOR_PASSWORD'),
  forbiddenTestVar('PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID'),
  forbiddenTestVar('PLAYWRIGHT_ADVISOR_FIRM_STARTER_PRICE_ID'),
  forbiddenTestVar('PLAYWRIGHT_ADVISOR_FIRM_ENTERPRISE_PRICE_ID'),
  forbiddenTestVar('PLAYWRIGHT_ADVISOR_REFERRAL_CODE'),
  forbiddenTestVar('PLAYWRIGHT_ATTORNEY_EMAIL'),
  forbiddenTestVar('PLAYWRIGHT_ATTORNEY_PASSWORD'),
  forbiddenTestVar('PLAYWRIGHT_ATTORNEY_REFERRAL_CODE'),
  forbiddenTestVar('PLAYWRIGHT_PUBLIC_API_BASE_URL'),
  forbiddenTestVar('PLAYWRIGHT_STRIPE_WEBHOOK_SECRET'),
  forbiddenTestVar('SEED_ADVISOR_EMAIL'),
  forbiddenTestVar('SEED_CLIENT_EMAIL'),
  forbiddenTestVar('SMOKE_ADVISOR_EMAIL'),
  forbiddenTestVar('SMOKE_ADVISOR_PASSWORD'),
  forbiddenTestVar('VERIFY_USER_EMAIL'),
  forbiddenTestVar('HOUSEHOLD_ID'),
  forbiddenTestVar('VOELS_SOURCE_EMAIL'),
  forbiddenTestVar('VOELS_TARGET_EMAIL'),
  forbiddenTestVar('ALLOW_LIFECYCLE_ANY'),
  forbiddenTestVar('DRY_RUN'),
  forbiddenTestVar('TAX_YEAR'),
  forbiddenTestVar('EDUCATION_LINK_BASE_URL'),
  forbiddenTestVar('SUPABASE_URL'),
]

export const MANIFEST_VAR_NAMES = new Set(ENV_MANIFEST.map((e) => e.name))
