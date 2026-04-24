'use client'
// app/advisor/clients/[clientId]/_tabs/DocumentsTab.tsx
// Legal document vault — read-only for advisor, shows vault contents and metadata

import { ClientViewShellProps } from '../_client-view-shell'
import { formatDate } from '../_utils'

const DOC_TYPE_LABELS: Record<string, string> = {
  will:              'Last Will & Testament',
  trust:             'Revocable Living Trust',
  dpoa:              'Durable Power of Attorney',
  medical_poa:       'Medical Power of Attorney',
  advance_directive: 'Advance Directive',
  living_will:       'Living Will',
  deed:              'Deed',
  titling:           'Titling Document',
  correspondence:    'Correspondence',
  other:             'Other',
}

const DOC_ICONS: Record<string, string> = {
  will:              '📜',
  trust:             '⚖',
  dpoa:              '🔐',
  medical_poa:       '🏥',
  advance_directive: '📋',
  living_will:       '💙',
  deed:              '🏠',
  titling:           '📑',
  correspondence:    '✉',
  other:             '📄',
}

export default function DocumentsTab({ legalDocuments, household }: ClientViewShellProps) {
  type LegalDocumentRow = {
    id: string
    document_type?: string | null
    created_at?: string | null
    uploader_role?: string | null
    file_name?: string | null
    version?: number | null
    is_current?: boolean | null
    is_signed?: boolean | null
  }

  const docs = (legalDocuments ?? []) as LegalDocumentRow[]

  // Group by document type
  const byType = docs.reduce<Record<string, LegalDocumentRow[]>>((acc, doc) => {
    const key = doc.document_type ?? 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  const typeOrder = ['will','trust','dpoa','medical_poa','advance_directive','living_will','deed','titling','correspondence','other']
  const sortedTypes = Object.keys(byType).sort((a, b) => {
    const ai = typeOrder.indexOf(a)
    const bi = typeOrder.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="space-y-6">

      {/* ── Header callout ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 flex items-start gap-3">
        <span className="text-lg mt-0.5">🔒</span>
        <div>
          <p className="text-sm font-semibold text-blue-900">Legal Document Vault — Read-Only View</p>
          <p className="text-sm text-blue-700 mt-0.5">
            You are viewing {household.person1_first_name}&apos;s document vault. You can view document metadata and version history.
            PDF download access requires explicit consumer permission.
          </p>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-4 gap-4">
        <DocStat label="Total Documents"      value={String(docs.length)} />
        <DocStat label="Document Types"       value={String(sortedTypes.length)} />
        <DocStat label="Most Recent"          value={docs.length > 0 ? formatDate(docs[0]?.created_at) : '—'} />
        <DocStat label="Uploaded by Consumer" value={String(docs.filter(d => d.uploader_role === 'consumer').length)} />
      </div>

      {/* ── Document vault ── */}
      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center text-slate-400">
          <span className="text-4xl mb-3">📂</span>
          <p className="text-sm font-medium">No documents in vault</p>
          <p className="text-xs mt-1">Consumer has not uploaded any documents yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTypes.map(type => (
            <div key={type} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{DOC_ICONS[type] ?? '📄'}</span>
                <h3 className="text-sm font-semibold text-slate-800">
                  {DOC_TYPE_LABELS[type] ?? type}
                </h3>
                <span className="text-xs text-slate-400">
                  ({byType[type].length} file{byType[type].length !== 1 ? 's' : ''})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-500 pb-2">File Name</th>
                      <th className="text-left text-xs font-semibold text-slate-500 pb-2">Version</th>
                      <th className="text-left text-xs font-semibold text-slate-500 pb-2">Uploaded By</th>
                      <th className="text-left text-xs font-semibold text-slate-500 pb-2">Date</th>
                      <th className="text-left text-xs font-semibold text-slate-500 pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {byType[type].map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-800">
                          <span className="text-slate-400 text-xs mr-1.5">📎</span>
                          {doc.file_name}
                        </td>
                        <td className="py-2.5">
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            v{doc.version ?? 1}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {doc.uploader_role === 'attorney' ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                              Attorney
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                              Consumer
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-500">{formatDate(doc.created_at)}</td>
                        <td className="py-2.5">
                          {doc.is_current ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Current</span>
                          ) : (
                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Prior version</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Access note ── */}
      <div className="text-center py-2">
        <p className="text-xs text-slate-400">
          Document downloads require explicit consumer permission (advisor_pdf_access).
          Contact your client to request download access.
        </p>
      </div>

    </div>
  )
}

function DocStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
