import type { ProfileSavePayload } from '@/lib/profile/buildHouseholdPayload'

/** Merge a partial profile PATCH over an existing payload (inline prompts). */
export function mergeProfilePatch(
  base: ProfileSavePayload,
  patch: Partial<ProfileSavePayload>,
): ProfileSavePayload {
  const merged = { ...base }
  for (const key of Object.keys(patch) as (keyof ProfileSavePayload)[]) {
    const value = patch[key]
    if (value !== undefined) {
      ;(merged as Record<string, unknown>)[key as string] = value
    }
  }
  return merged
}
