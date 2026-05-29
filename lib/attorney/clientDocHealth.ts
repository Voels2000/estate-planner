import { getMissingDocumentAlerts } from '@/lib/attorney/getMissingDocumentAlerts'

const TRACKED_DOC_TYPES = ['will', 'trust', 'dpoa', 'medical_poa', 'advance_directive'] as const

export function countDocumentsOnFile(
  documents: { document_type: string; is_current?: boolean; is_deleted?: boolean }[],
): { onFile: number; total: number } {
  const onFileSet = new Set(
    documents
      .filter((d) => d.is_current !== false && d.is_deleted !== true)
      .map((d) => d.document_type),
  )
  const onFile = TRACKED_DOC_TYPES.filter(
    (t) => onFileSet.has(t) || (t === 'will' && onFileSet.has('trust')),
  ).length
  return { onFile, total: TRACKED_DOC_TYPES.length }
}

export function summarizeMissingDocs(
  documents: { document_type: string; is_current?: boolean; is_deleted?: boolean }[],
): string {
  const gaps = getMissingDocumentAlerts(documents)
  if (gaps.length === 0) return '—'
  return gaps
    .slice(0, 2)
    .map((g) => g.gap_key.toUpperCase())
    .join(', ')
}
