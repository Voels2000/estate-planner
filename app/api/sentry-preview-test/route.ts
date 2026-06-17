export const dynamic = 'force-dynamic'

export async function GET() {
  throw new Error('sentry preview test ' + Date.now())
}
