/**
 * knip — dead-code / unused-export / unused-dependency detection.
 *
 *   npm run knip              full analysis (tests count as entry points)
 *   npm run knip:production   production-only — code kept alive ONLY by tests
 *
 * Diff between runs surfaces test-only survivors. knip --production excludes test
 * entry files regardless of entry config.
 *
 * Note: exports in the same file as production imports (e.g. shouldBypassWaitlistForSignup
 * alongside hasSignupPageAdmissionHint in lib/waitlist-mode.ts) may not appear in the
 * production unused-export list — the module is reachable. For those, confirm via full
 * run only: absent from unused exports when tests are entries, present when they are not.
 */
/** @type {import('knip').KnipConfig} */
const config = {
  // Explicit plugins — Next + Playwright (unit specs run via playwright test --project=import-unit)
  next: true,
  playwright: {
    config: ['playwright.config.ts'],
  },

  // tsconfig excludes scripts/ — paths still needed for @/ in ops scripts
  paths: {
    '@/*': ['./*'],
  },

  entry: [
    'app/**/page.tsx',
    'app/**/layout.tsx',
    'app/**/route.ts',
    'app/**/loading.tsx',
    'app/**/error.tsx',
    'app/**/template.tsx',
    'app/**/not-found.tsx',
    'app/**/default.tsx',
    'app/global-error.tsx',
    'middleware.ts',
    'next.config.{js,mjs,ts}',
    'instrumentation.ts',
    'instrumentation-client.ts',

    // Playwright unit + E2E specs (import-unit project lives under tests/unit/)
    'tests/**/*.spec.ts',
    'tests/e2e/helpers/**/*.setup.ts',

    'scripts/**/*.ts',
    'scripts/**/*.mjs',
    'supabase/functions/**/*.ts',
    'tools/**/*.{jsx,tsx,ts}',
  ],

  project: ['**/*.{ts,tsx}'],

  ignore: [
    'supabase/migrations/**',
    '.next/**',
    'node_modules/**',
    'tools/launch-tracker.html',
  ],

  /**
   * Add after triage with a one-line reason.
   * mammoth / pdf-parse: deferred post-launch (ROADMAP) — remove in Sprint E when ready.
   */
  ignoreDependencies: [],
}

export default config
