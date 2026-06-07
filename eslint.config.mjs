import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// L1 accessibility: eslint-config-next/core-web-vitals enables eslint-plugin-jsx-a11y recommended
// rules in CI via `npm run lint`. Axe scans: `npm run test:e2e:a11y`.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
