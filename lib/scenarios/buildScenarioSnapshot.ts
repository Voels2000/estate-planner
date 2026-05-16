export type ScenarioSnapshotSummary = {
  at_retirement: number
  peak: number
  final: number
  funds_outlast: boolean
}

export type ScenarioSnapshotInsert = {
  household_id: string
  scenario_name: string
  projection_data: unknown[]
  summary: ScenarioSnapshotSummary
  calculated_at: string
}

const MAX_PROJECTION_YEARS = 120

function formatSnapshotTimestamp(date: Date): string {
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${datePart} at ${timePart}`
}

export function buildScenarioSnapshot(
  householdId: string,
  body: Record<string, unknown>,
): { ok: true; row: ScenarioSnapshotInsert } | { ok: false; error: string } {
  const scenarioLabel = (body.scenario_label as string | undefined)?.trim()
  if (!scenarioLabel) {
    return { ok: false, error: 'scenario_label required' }
  }

  const household_id = body.household_id as string | undefined
  if (!household_id || household_id !== householdId) {
    return { ok: false, error: 'household_id must match your household' }
  }

  const projection_data = body.projection_data
  if (!Array.isArray(projection_data) || projection_data.length === 0) {
    return { ok: false, error: 'projection_data must be a non-empty array' }
  }
  if (projection_data.length > MAX_PROJECTION_YEARS) {
    return { ok: false, error: `projection_data exceeds ${MAX_PROJECTION_YEARS} rows` }
  }

  const summaryRaw = body.summary as Record<string, unknown> | undefined
  if (!summaryRaw || typeof summaryRaw !== 'object') {
    return { ok: false, error: 'summary required' }
  }

  const at_retirement = Number(summaryRaw.at_retirement)
  const peak = Number(summaryRaw.peak)
  const final = Number(summaryRaw.final)
  if (![at_retirement, peak, final].every((n) => Number.isFinite(n))) {
    return { ok: false, error: 'summary must include numeric at_retirement, peak, and final' }
  }

  const now = new Date()

  return {
    ok: true,
    row: {
      household_id: householdId,
      scenario_name: `${scenarioLabel} — ${formatSnapshotTimestamp(now)}`,
      projection_data,
      summary: {
        at_retirement,
        peak,
        final,
        funds_outlast: Boolean(summaryRaw.funds_outlast),
      },
      calculated_at: now.toISOString(),
    },
  }
}
