import { runPlaywrightStartupGuards } from '../../scripts/testEnv'

export default async function globalSetup(): Promise<void> {
  await runPlaywrightStartupGuards()
}
