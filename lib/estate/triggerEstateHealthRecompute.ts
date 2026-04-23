export async function triggerEstateHealthRecompute(
  householdId: string,
  appUrl: string,
): Promise<void> {
  fetch(`${appUrl}/api/recompute-estate-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-recompute-secret': process.env.RECOMPUTE_SECRET ?? '',
    },
    body: JSON.stringify({ householdId }),
  }).catch(() => {
    // Silently ignore — recompute is best-effort.
  })
}
