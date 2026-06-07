export const ATTORNEY_MATTER_STAGES = [
  { value: 'intake', label: 'Intake' },
  { value: 'review', label: 'Review & analysis' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'execution', label: 'Execution' },
  { value: 'complete', label: 'Complete' },
] as const

export const ATTORNEY_CLIENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'complete', label: 'Complete' },
] as const

export type AttorneyMatterStage = (typeof ATTORNEY_MATTER_STAGES)[number]['value']
export type AttorneyClientStatus = (typeof ATTORNEY_CLIENT_STATUSES)[number]['value']

export const ATTORNEY_DOC_REQUEST_TYPES = [
  { value: 'will', label: 'Will' },
  { value: 'trust', label: 'Trust' },
  { value: 'dpoa', label: 'Durable POA' },
  { value: 'medical_poa', label: 'Medical POA' },
  { value: 'advance_directive', label: 'Advance directive' },
  { value: 'living_will', label: 'Living will' },
  { value: 'deed', label: 'Deed / titling' },
  { value: 'titling', label: 'Titling document' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
] as const

export function parseMatterStage(raw: unknown): AttorneyMatterStage | null {
  const v = String(raw ?? '')
  return ATTORNEY_MATTER_STAGES.some((s) => s.value === v) ? (v as AttorneyMatterStage) : null
}

export function parseClientStatus(raw: unknown): AttorneyClientStatus | null {
  const v = String(raw ?? '')
  return ATTORNEY_CLIENT_STATUSES.some((s) => s.value === v) ? (v as AttorneyClientStatus) : null
}
