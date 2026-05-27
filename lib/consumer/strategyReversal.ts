/** Client helpers for strategy reversal PATCH actions. */

export type StrategyReversalAction =
  | 'promote'
  | 'return_to_sandbox'
  | 'demote'
  | 'withdraw'

export async function applyStrategyReversal(
  id: string,
  action: StrategyReversalAction,
  reversalReason?: string,
): Promise<void> {
  const res = await fetch('/api/strategy-line-items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      action,
      reversal_reason: reversalReason,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Strategy update failed')
  }
}

export async function returnStrategyToSandbox(id: string): Promise<void> {
  await applyStrategyReversal(id, 'return_to_sandbox')
}

export async function demoteStrategyFromCertain(id: string, reason?: string): Promise<void> {
  await applyStrategyReversal(id, 'demote', reason)
}

export async function withdrawStrategy(id: string, reason?: string): Promise<void> {
  await applyStrategyReversal(id, 'withdraw', reason)
}
