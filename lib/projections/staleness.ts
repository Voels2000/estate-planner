export function getLatestTimestampMs(timestamps: Array<string | null | undefined>): number {
  return timestamps.reduce((max, ts) => {
    if (!ts) return max
    const ms = new Date(ts).getTime()
    return Number.isFinite(ms) ? Math.max(max, ms) : max
  }, 0)
}

export function isProjectionStale(params: {
  baseCaseScenarioId: string | null | undefined
  projectionCalculatedAt: string | null | undefined
  latestInputChangeMs: number
}): boolean {
  const projectionCalculatedMs = params.projectionCalculatedAt
    ? new Date(params.projectionCalculatedAt).getTime()
    : 0

  return (
    !params.baseCaseScenarioId ||
    !params.projectionCalculatedAt ||
    params.latestInputChangeMs > projectionCalculatedMs
  )
}
