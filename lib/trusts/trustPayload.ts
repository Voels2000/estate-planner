export const TRUST_TYPES = [
  'revocable',
  'irrevocable',
  'qtip',
  'bypass',
  'charitable',
  'special_needs',
] as const

export type TrustType = (typeof TRUST_TYPES)[number]

export const TRUST_SELECT =
  'id, owner_id, name, excluded_from_estate, trust_type, grantor, trustee, funding_amount, state, is_irrevocable, excludes_from_estate, created_at, updated_at'

export const TRUST_DOCUMENT_SELECT =
  'id, name, trust_type, is_irrevocable, funding_amount'

function normalizeState(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (trimmed.length === 2) return trimmed.toUpperCase()
  return trimmed
}

export function buildTrustRow(body: Record<string, unknown>):
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string } {
  const name = (body.name as string | undefined)?.trim()
  if (!name) {
    return { ok: false, error: 'name required' }
  }

  const trustTypeRaw = (body.trust_type as string | undefined) ?? 'revocable'
  if (!(TRUST_TYPES as readonly string[]).includes(trustTypeRaw)) {
    return { ok: false, error: 'Invalid trust_type' }
  }

  const funding = Math.max(0, Number(body.funding_amount) || 0)
  const excludesFromEstate = Boolean(body.excludes_from_estate)
  const excludedNumeric = excludesFromEstate ? funding : 0

  return {
    ok: true,
    row: {
      name,
      trust_type: trustTypeRaw,
      grantor: (body.grantor as string | undefined)?.trim() ?? '',
      trustee: (body.trustee as string | undefined)?.trim() ?? '',
      funding_amount: funding,
      state: normalizeState(body.state as string | undefined),
      is_irrevocable: Boolean(body.is_irrevocable),
      excludes_from_estate: excludesFromEstate,
      excluded_from_estate: excludedNumeric,
      updated_at: new Date().toISOString(),
    },
  }
}
