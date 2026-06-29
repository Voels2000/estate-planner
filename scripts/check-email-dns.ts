#!/usr/bin/env tsx
/**
 * Pre-flip email deliverability DNS gate (item 5).
 * Checks SPF, DKIM (Resend), and DMARC for mywealthmaps.com.
 *
 * Usage: npx tsx scripts/check-email-dns.ts
 */
import { resolveTxt } from 'node:dns/promises'

const DOMAIN = 'mywealthmaps.com'

type Check = { name: string; pass: boolean; detail: string }

async function txtRecords(host: string): Promise<string[]> {
  try {
    const rows = await resolveTxt(host)
    return rows.map((parts) => parts.join(''))
  } catch {
    return []
  }
}

async function main() {
  const checks: Check[] = []

  const rootTxt = await txtRecords(DOMAIN)
  const spf = rootTxt.find((r) => r.toLowerCase().startsWith('v=spf1'))
  checks.push({
    name: 'SPF (root TXT)',
    pass: Boolean(spf),
    detail: spf ?? `No v=spf1 record on ${DOMAIN}`,
  })

  const dmarcTxt = await txtRecords(`_dmarc.${DOMAIN}`)
  const dmarc = dmarcTxt.find((r) => r.toLowerCase().startsWith('v=dmarc1'))
  const dmarcPolicy = dmarc?.match(/;\s*p=([^;]+)/i)?.[1] ?? 'missing'
  checks.push({
    name: 'DMARC',
    pass: Boolean(dmarc),
    detail: dmarc
      ? `${dmarc} (policy=${dmarcPolicy})`
      : `No _dmarc.${DOMAIN} record`,
  })

  const dkimTxt = await txtRecords(`resend._domainkey.${DOMAIN}`)
  const dkim = dkimTxt.find((r) => r.startsWith('p=') || r.includes('p='))
  checks.push({
    name: 'DKIM (Resend)',
    pass: Boolean(dkim),
    detail: dkim
      ? `resend._domainkey.${DOMAIN} present (${dkim.slice(0, 40)}…)`
      : `No Resend DKIM at resend._domainkey.${DOMAIN}`,
  })

  console.log('\nEmail DNS deliverability\n')
  let failed = 0
  for (const c of checks) {
    const icon = c.pass ? '✅' : '❌'
    if (!c.pass) failed++
    console.log(`${icon} ${c.name}`)
    console.log(`   ${c.detail}\n`)
  }

  if (failed > 0) {
    console.log(`❌ ${failed} check(s) failed`)
    process.exit(1)
  }

  console.log('✅ DNS auth records present (inbox placement still requires Gmail/Outlook manual spot-check)')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
