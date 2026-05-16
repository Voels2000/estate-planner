export type HouseholdPersonRow = {
  id: string
  full_name: string
  relationship: string
  date_of_birth: string | null
  is_gst_skip: boolean
  is_beneficiary: boolean
  notes: string | null
}

export function isGrandchildRelationship(rel: string): boolean {
  return /grand|grandchild|grandson|granddaughter/i.test(rel)
}

export function buildHouseholdPersonPayload(
  householdId: string,
  body: {
    full_name: string
    relationship: string
    date_of_birth?: string | null
    is_gst_skip?: boolean
    is_beneficiary?: boolean
    notes?: string | null
  },
) {
  const rel = body.relationship.trim()
  return {
    household_id: householdId,
    full_name: body.full_name.trim(),
    relationship: rel,
    date_of_birth: body.date_of_birth || null,
    is_gst_skip: isGrandchildRelationship(rel) ? Boolean(body.is_gst_skip) : false,
    is_beneficiary: body.is_beneficiary ?? true,
    notes: body.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

const PERSON_SELECT =
  'id, full_name, relationship, date_of_birth, is_gst_skip, is_beneficiary, notes'

export { PERSON_SELECT as HOUSEHOLD_PERSON_SELECT }
