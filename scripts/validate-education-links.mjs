import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'

const MODULES_DIR = path.join(process.cwd(), 'content', 'education', 'modules')
const BASE_URL = process.env.EDUCATION_LINK_BASE_URL ?? 'http://localhost:3457'

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw }
  const frontmatter = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1')
    frontmatter[key] = value
  }
  return { frontmatter, body: match[2] }
}

const BUNDLE_SLUGS = [
  'financial-foundations',
  'retirement-foundations',
  'estate-foundations',
  'beneficiary-designations',
  'trusts-deep-dive',
  'estate-gift-tax-basics',
  'charitable-trusts-overview',
  'qprt-education-overview',
  'flp-fllc-education-overview',
  'asset-protection-education',
  'multi-state-planning-basics',
  'business-succession-education',
  'scenario-library-overview',
  'scenario-blended-family',
  'scenario-business-owner',
  'scenario-recent-retiree',
  'scenario-digital-nomad',
]

const STATIC_ROUTES = [
  '/education',
  '/education/decision-tree',
  '/education/glossary',
  '/education/prep-sheet',
]

function curlStatus(url) {
  try {
    return execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 8 "${url}"`, {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'ERR'
  }
}

const entries = await readdir(MODULES_DIR)
const files = entries.filter((f) => f.endsWith('.md'))
const all = []
for (const file of files) {
  const slug = file.replace(/\.md$/, '')
  const raw = await readFile(path.join(MODULES_DIR, file), 'utf8')
  const { frontmatter } = parseFrontmatter(raw)
  const published = frontmatter.published !== 'false'
  all.push({ slug, published, title: frontmatter.title ?? slug })
}

const published = all.filter((m) => m.published)
console.log(`Files: ${all.length}, published: ${published.length}, unpublished: ${all.length - published.length}`)

console.log('\nUnpublished (hidden from catalog, should 404 when served):')
for (const m of all.filter((x) => !x.published)) {
  console.log(`  - ${m.slug}`)
}

console.log('\nBundle slug check:')
let bundleOk = true
for (const slug of BUNDLE_SLUGS) {
  const m = all.find((x) => x.slug === slug)
  if (!m) {
    console.log(`  MISSING FILE: ${slug}`)
    bundleOk = false
  } else if (!m.published) {
    console.log(`  UNPUBLISHED: ${slug}`)
    bundleOk = false
  }
}
if (bundleOk) console.log('  All bundle slugs exist and are published.')

const decisionTree = await readFile(
  path.join(process.cwd(), 'content', 'education', 'decision-tree.md'),
  'utf8',
)
const linkedSlugs = [...decisionTree.matchAll(/\]\(\/education\/modules\/([^)]+)\)/g)].map((m) => m[1])
console.log('\nDecision tree module links:')
for (const slug of linkedSlugs) {
  const m = all.find((x) => x.slug === slug)
  if (!m) console.log(`  BROKEN LINK (no file): ${slug}`)
  else if (!m.published) console.log(`  BROKEN LINK (unpublished): ${slug}`)
  else console.log(`  OK: ${slug}`)
}

console.log(`\nHTTP checks against ${BASE_URL}:`)
const httpFailures = []
for (const route of STATIC_ROUTES) {
  const status = curlStatus(`${BASE_URL}${route}`)
  console.log(`  ${route} -> ${status}`)
  if (status !== '200') httpFailures.push(route)
}
for (const m of published) {
  const route = `/education/modules/${m.slug}`
  const status = curlStatus(`${BASE_URL}${route}`)
  if (status !== '200') {
    httpFailures.push(route)
    console.log(`  FAIL ${route} -> ${status}`)
  }
}
for (const m of all.filter((x) => !x.published)) {
  const route = `/education/modules/${m.slug}`
  const status = curlStatus(`${BASE_URL}${route}`)
  if (status !== '404') {
    httpFailures.push(route)
    console.log(`  FAIL (expected 404) ${route} -> ${status}`)
  }
}

if (httpFailures.length > 0) {
  console.log(`\n${httpFailures.length} HTTP failure(s).`)
  process.exit(1)
}
console.log('\nAll education link checks passed.')
