import { assertPlaywrightEnvGuard } from '../../scripts/testEnv'

export default async function globalSetup(): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_ENV_GUARD === '1') return
  assertPlaywrightEnvGuard()
}
