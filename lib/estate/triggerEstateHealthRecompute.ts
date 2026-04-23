export async function triggerEstateHealthRecompute(
  householdId: string,
  appUrl: string,
  cookieHeader: string,
): Promise<void> {
  fetch(`${appUrl}/api/recompute-estate-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify({ householdId }),
  }).catch(() => {
    // Silently ignore — recompute is best-effort.
    // Dashboard will show cached values until a successful recompute.
  })
}
