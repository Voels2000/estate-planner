/**
 * First token of a stored full name for UI labels (dropdowns, headings, options, narrative).
 * Does not change database values — use only when rendering.
 */
export function displayPersonFirstName(
  fullName: string | null | undefined,
  fallbackWhenEmpty?: string,
): string {
  const trimmed = fullName?.trim()
  if (!trimmed) return fallbackWhenEmpty ?? ''
  return trimmed.split(/\s+/)[0] ?? (fallbackWhenEmpty ?? '')
}
