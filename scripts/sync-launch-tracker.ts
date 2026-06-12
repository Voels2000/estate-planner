/**
 * Apply launch-tracker state → docs/LAUNCH.md checkboxes.
 *
 * Usage:
 *   npm run sync:launch-tracker -- --from tools/launch-tracker-state.json
 *   npm run sync:launch-tracker -- --from tools/launch-tracker-state.json --dry-run
 */
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..')
const LAUNCH_PATH = path.join(ROOT, 'docs/LAUNCH.md')
const MAPPING_PATH = path.join(ROOT, 'tools/launch-tracker-mapping.json')

interface TrackerState {
  checks: Record<string, boolean>
  notes: Record<string, string>
  updatedAt?: string
}

interface MappingEntry {
  launchContains: string
  attest?: boolean
}

function applyAttest(line: string, note: string | undefined): string {
  const stamp = note?.trim()
  if (!stamp) return line
  if (line.includes('(attest: __ / __)')) {
    return line.replace('(attest: __ / __)', `(attest: ${stamp})`)
  }
  return line.replace(/\(attest:[^)]*\)/, `(attest: ${stamp})`)
}

function markChecked(line: string, note: string | undefined, attest: boolean): string {
  let out = line.replace(/^- \[ \]/, '- [x]')
  if (attest) out = applyAttest(out, note)
  return out
}

function countBucketB(lines: string[]): { done: number; total: number } {
  const start = lines.findIndex((l) => l.startsWith('## Bucket B'))
  const end = lines.findIndex((l) => l.startsWith('## Bucket C'))
  if (start < 0 || end < 0) return { done: 0, total: 0 }

  const section = lines.slice(start, end)
  const boxes = section.filter((l) => /^- \[[ x]\]/.test(l))
  const done = boxes.filter((l) => /^- \[x\]/.test(l)).length
  return { done, total: boxes.length }
}

function updateScoreboard(lines: string[]): string[] {
  const { done, total } = countBucketB(lines)
  return lines.map((line) => {
    if (line.startsWith('**Bucket B:**')) {
      return `**Bucket B:** **${done} of ${total}** checked (${total - done} open).`
    }
    return line
  })
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const fileIdx = args.indexOf('--from')
  const statePath = fileIdx >= 0 ? path.resolve(args[fileIdx + 1]) : null

  if (!statePath || !fs.existsSync(statePath)) {
    console.error('Usage: npx tsx scripts/sync-launch-tracker.ts --from <state.json> [--dry-run]')
    console.error('Export JSON from tools/launch-tracker.html → save as tools/launch-tracker-state.json')
    process.exit(1)
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as TrackerState
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8')) as Record<string, MappingEntry>
  const lines = fs.readFileSync(LAUNCH_PATH, 'utf8').split('\n')
  let changes = 0

  for (const [id, entry] of Object.entries(mapping)) {
    if (!state.checks[id]) continue

    const idx = lines.findIndex(
      (l) => l.includes(entry.launchContains) && /^- \[[ x]\]/.test(l),
    )
    if (idx < 0) {
      console.warn(`skip ${id}: no LAUNCH.md line matching "${entry.launchContains}"`)
      continue
    }

    const next = markChecked(lines[idx], state.notes[id], entry.attest ?? false)
    if (next !== lines[idx]) {
      console.log(`${id}:`)
      console.log(`  was: ${lines[idx]}`)
      console.log(`  now: ${next}`)
      lines[idx] = next
      changes++
    }
  }

  let output = updateScoreboard(lines)
  const today = new Date().toISOString().slice(0, 10)
  output = output.map((line) =>
    line.startsWith('**Last updated:**')
      ? `**Last updated:** ${today} (launch-tracker sync)`
      : line,
  )

  const { done, total } = countBucketB(output)
  console.log(`\nBucket B scoreboard: ${done}/${total}`)

  if (changes === 0) {
    console.log('No checkbox changes needed.')
    return
  }

  if (dryRun) {
    console.log(`Dry run — ${changes} item(s) would update (LAUNCH.md not written).`)
    return
  }

  fs.writeFileSync(LAUNCH_PATH, output.join('\n'))
  console.log(`Wrote ${LAUNCH_PATH} (${changes} item(s)).`)
  console.log('Review diff, then commit: docs(launch): sync tracker attestations')
}

main()
