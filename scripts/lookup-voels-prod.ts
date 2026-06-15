/**
 * Resolve Voels post-deploy context (staging vs prod).
 * Run: npx dotenv -e .env.test.prod -- npx tsx scripts/lookup-voels-prod.ts
 */
import { createClient } from '@supabase/supabase-js'
import { resolveVoelsPostDeployContext } from '../lib/verify/resolveVoelsPostDeployContext'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log('Project:', new URL(url).hostname.split('.')[0])
  const ctx = await resolveVoelsPostDeployContext(admin)
  console.log(JSON.stringify(ctx, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
