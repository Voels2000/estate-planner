export type DocumentGapAlert = {
  gap_key: string
  label: string
  severity: 'critical' | 'warning'
}

const REQUIRED_DOC_TYPES: { gap_key: string; document_type: string; label: string }[] = [
  { gap_key: 'will', document_type: 'will', label: 'Will: not on file' },
  { gap_key: 'trust', document_type: 'trust', label: 'Trust: not on file' },
  { gap_key: 'dpoa', document_type: 'dpoa', label: 'Durable Power of Attorney: not on file' },
  {
    gap_key: 'medical_poa',
    document_type: 'medical_poa',
    label: 'Healthcare Proxy: not on file',
  },
  {
    gap_key: 'advance_directive',
    document_type: 'advance_directive',
    label: 'Advance Directive: not on file',
  },
]

type LegalDocumentRow = {
  document_type: string
  is_current?: boolean
  is_deleted?: boolean
}

type DismissalRow = {
  gap_key: string
}

export function getMissingDocumentAlerts(
  documents: LegalDocumentRow[],
  dismissals: DismissalRow[] = [],
): DocumentGapAlert[] {
  const onFile = new Set(
    documents
      .filter((d) => d.is_current !== false && d.is_deleted !== true)
      .map((d) => d.document_type),
  )
  const dismissed = new Set(dismissals.map((d) => d.gap_key))

  return REQUIRED_DOC_TYPES.filter(
    (req) => !onFile.has(req.document_type) && !dismissed.has(req.gap_key),
  ).map((req) => ({
    gap_key: req.gap_key,
    label: req.label,
    severity: req.gap_key === 'will' || req.gap_key === 'dpoa' ? 'critical' : 'warning',
  }))
}

export const DOC_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'will', label: 'Will/Trust' },
  { value: 'dpoa', label: 'Powers of Attorney' },
  { value: 'advance_directive', label: 'Advance Directives' },
  { value: 'deed', label: 'Deeds/Titling' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
] as const

export const DOC_STATUS_OPTIONS = [
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_execution', label: 'Pending Execution' },
  { value: 'executed', label: 'Executed' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'superseded', label: 'Superseded' },
] as const

export const DOC_STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-neutral-100 text-neutral-700',
  draft: 'bg-slate-100 text-slate-700',
  pending_execution: 'bg-amber-100 text-amber-800',
  executed: 'bg-green-100 text-green-800',
  recorded: 'bg-blue-100 text-blue-800',
  superseded: 'bg-neutral-200 text-neutral-500',
}

export function filterDocumentsByType<T extends { document_type: string }>(
  docs: T[],
  filter: string,
): T[] {
  if (filter === 'all') return docs
  if (filter === 'will') return docs.filter((d) => d.document_type === 'will' || d.document_type === 'trust')
  if (filter === 'dpoa') return docs.filter((d) => d.document_type === 'dpoa' || d.document_type === 'medical_poa')
  if (filter === 'advance_directive')
    return docs.filter(
      (d) => d.document_type === 'advance_directive' || d.document_type === 'living_will',
    )
  if (filter === 'deed')
    return docs.filter((d) => d.document_type === 'deed' || d.document_type === 'titling')
  return docs.filter((d) => d.document_type === filter)
}
