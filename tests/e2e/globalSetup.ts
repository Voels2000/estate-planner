import { assertPlaywrightEnvGuard } from '../../scripts/testEnv'

export default async function globalSetup(): Promise<void> {
  assertPlaywrightEnvGuard()
}
