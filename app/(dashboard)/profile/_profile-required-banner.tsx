'use client'

import type { ProfileGateMissingField } from '@/lib/estate/profileGate'
import { isMinimumViableProfile, type ProfileGateHousehold } from '@/lib/estate/profileGate'

const FIELD_META: Record<
  ProfileGateMissingField,
  { label: string; anchorId: string }
> = {
  state_primary: { label: 'State of residence', anchorId: 'profile-field-state-primary' },
  filing_status: { label: 'Filing status', anchorId: 'profile-field-filing-status' },
  date_of_birth_1: { label: 'Date of birth', anchorId: 'profile-field-person1-birth-year' },
}

const ALL_FIELDS: ProfileGateMissingField[] = [
  'state_primary',
  'filing_status',
  'date_of_birth_1',
]

type ProfileRequiredBannerProps = {
  missingFromUrl: ProfileGateMissingField[]
  householdSnapshot: ProfileGateHousehold
}

export function ProfileRequiredBanner({
  missingFromUrl,
  householdSnapshot,
}: ProfileRequiredBannerProps) {
  const gate = isMinimumViableProfile(householdSnapshot)
  if (gate.complete) return null

  const missingSet = new Set(missingFromUrl.length > 0 ? missingFromUrl : gate.missing)

  function scrollToField(anchorId: string) {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4">
      <p className="text-sm font-semibold text-amber-900">
        Complete your profile to unlock your estate plan
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {ALL_FIELDS.map((field) => {
          const isMissing = missingSet.has(field)
          const meta = FIELD_META[field]
          return (
            <li key={field} className="flex flex-wrap items-center gap-2">
              <span className={isMissing ? 'text-amber-800' : 'text-[color:var(--mwm-sage)]'}>
                {isMissing ? '✗' : '✓'} {meta.label}
              </span>
              {isMissing ? (
                <button
                  type="button"
                  onClick={() => scrollToField(meta.anchorId)}
                  className="text-amber-900 font-medium underline underline-offset-2 hover:text-amber-950"
                >
                  update below ↓
                </button>
              ) : (
                <span className="text-[color:var(--mwm-sage)] text-xs">— already set</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
