import { z } from 'zod'

/** Canonical household id for API query/body params. */
export const householdIdSchema = z.string().uuid('Invalid household ID')

export const householdIdBodySchema = z.object({
  householdId: householdIdSchema,
})

export const householdIdSnakeBodySchema = z.object({
  household_id: householdIdSchema,
})

export const householdIdQuerySchema = z.object({
  household_id: householdIdSchema,
})

export function parseHouseholdIdBody(
  body: unknown,
): { ok: true; householdId: string } | { ok: false; error: string } {
  const parsed = householdIdBodySchema.safeParse(body)
  if (parsed.success) return { ok: true, householdId: parsed.data.householdId }
  const snake = householdIdSnakeBodySchema.safeParse(body)
  if (snake.success) return { ok: true, householdId: snake.data.household_id }
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'householdId required' }
}

export function parseHouseholdIdParam(
  value: string | null | undefined,
): { ok: true; householdId: string } | { ok: false; error: string } {
  const parsed = householdIdSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid household ID' }
  }
  return { ok: true, householdId: parsed.data }
}
