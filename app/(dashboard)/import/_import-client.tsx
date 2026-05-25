'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type IngestionJob = {
  id: string
  file_name: string
  file_type: string
  status: string
  row_count: number | null
  committed_at: string | null
  created_at: string
  error_message: string | null
}

type ParseResult = {
  job_id: string
  file_name: string
  detected_table: string
  headers: string[]
  rows: Record<string, string>[]
  field_map: Record<string, string>
  table_fields: Record<string, { value: string; label: string; required?: boolean }[]>
  row_count: number
  header_row_index?: number
  sheet_names?: string[]
  selected_sheet?: string | null
}

type DuplicateWarning = {
  duplicate_count: number
  duplicate_indexes: number[]
  message: string
}

const TABLE_LABELS: Record<string, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  income: 'Income',
  expenses: 'Expenses',
}

const TABLE_PATHS: Record<string, string> = {
  assets: '/assets',
  liabilities: '/liabilities',
  income: '/income',
  expenses: '/expenses',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  committed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const IMPORT_TEMPLATES = [
  { href: '/templates/import-sample.csv', label: 'Assets template' },
  { href: '/templates/import-sample-liabilities.csv', label: 'Liabilities template' },
  { href: '/templates/import-sample-income.csv', label: 'Income template' },
  { href: '/templates/import-sample-expenses.csv', label: 'Expenses template' },
] as const

const DELETABLE_STATUSES = new Set(['pending', 'mapped', 'failed'])

export function ImportClient({ jobs: initialJobs }: { jobs: IngestionJob[] }) {
  const [jobs, setJobs] = useState<IngestionJob[]>(initialJobs)
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const [targetTable, setTargetTable] = useState<string>('assets')
  const [commitResult, setCommitResult] = useState<{
    committed: number
    skipped: number
    inserted_count?: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [editableRows, setEditableRows] = useState<Record<string, string>[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (parseResult?.rows) {
      setEditableRows(parseResult.rows.map((row) => ({ ...row })))
    } else {
      setEditableRows([])
    }
  }, [parseResult])

  useEffect(() => {
    if (parseResult?.selected_sheet) {
      setSelectedSheet(parseResult.selected_sheet)
    }
  }, [parseResult?.selected_sheet, parseResult?.job_id])

  async function deleteJob(jobId: string): Promise<boolean> {
    setError(null)
    setDeletingId(jobId)
    try {
      const res = await fetch(`/api/import/jobs/${jobId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      return false
    } finally {
      setDeletingId(null)
    }
  }

  async function ingestFile(file: File, sheetName?: string) {
    const formData = new FormData()
    formData.append('file', file)
    if (sheetName) formData.append('sheet_name', sheetName)
    const res = await fetch('/api/ingest', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Parse failed')
    return data as ParseResult
  }

  async function handleFile(file: File) {
    setError(null)
    setDuplicateWarning(null)
    setUploadedFile(file)
    setIsUploading(true)
    try {
      const data = await ingestFile(file)
      setParseResult(data)
      setFieldMap(data.field_map)
      setTargetTable(data.detected_table)
      if (data.selected_sheet) setSelectedSheet(data.selected_sheet)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  async function reparseWithSheet(sheetName: string) {
    if (!uploadedFile || !parseResult?.job_id) return
    setError(null)
    setIsUploading(true)
    const oldJobId = parseResult.job_id
    try {
      await deleteJob(oldJobId)
      const data = await ingestFile(uploadedFile, sheetName)
      setParseResult(data)
      setFieldMap(data.field_map)
      setTargetTable(data.detected_table)
      setSelectedSheet(sheetName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-parse failed')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleCommit(skipDuplicates = false, forceAll = false) {
    if (!parseResult) return
    setError(null)
    if (!skipDuplicates && !forceAll) setDuplicateWarning(null)
    setIsCommitting(true)
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: parseResult.job_id,
          target_table: targetTable,
          field_map: fieldMap,
          rows: editableRows,
          skip_duplicates: skipDuplicates,
          force_all: forceAll,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.error === 'duplicates_found') {
        setDuplicateWarning({
          duplicate_count: data.duplicate_count,
          duplicate_indexes: data.duplicate_indexes ?? [],
          message: data.message ?? 'Duplicate rows detected.',
        })
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Commit failed')
      setCommitResult(data)
      setStep('done')
      setDuplicateWarning(null)
      setJobs((prev) => [
        {
          id: parseResult.job_id,
          file_name: parseResult.file_name,
          file_type: parseResult.file_name.split('.').pop() ?? '',
          status: 'committed',
          row_count: data.inserted_count ?? data.committed,
          committed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          error_message: null,
        },
        ...prev,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed')
    } finally {
      setIsCommitting(false)
    }
  }

  function handleReset() {
    setStep('upload')
    setParseResult(null)
    setFieldMap({})
    setCommitResult(null)
    setError(null)
    setUploadedFile(null)
    setSelectedSheet('')
    setEditableRows([])
    setDuplicateWarning(null)
  }

  async function handleCancelReview() {
    if (parseResult?.job_id) {
      const ok = await deleteJob(parseResult.job_id)
      if (!ok) return
    }
    handleReset()
  }

  const nonDuplicateCount = duplicateWarning
    ? editableRows.length - duplicateWarning.duplicate_count
    : editableRows.length

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Import Data</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Upload CSV or Excel files. Headers are detected automatically; edit cells and mapping before
          importing. Committed imports stay in history; pending imports can be removed.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {step === 'upload' && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
            className={`rounded-2xl border-2 border-dashed p-16 text-center transition-colors ${
              isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-neutral-300 bg-white'
            }`}
          >
            {isUploading ? (
              <div className="space-y-3">
                <div className="text-4xl">⏳</div>
                <p className="text-sm font-medium text-neutral-600">Parsing file...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-5xl">📂</div>
                <div>
                  <p className="text-sm font-semibold text-neutral-700">Drop your file here</p>
                  <p className="text-xs text-neutral-400 mt-1">or click to browse — .csv, .xlsx, .xls</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium text-neutral-600">Sample templates</p>
            <p className="mt-1 text-xs text-neutral-500">
              Download a starter CSV with common column headers for each table type.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {IMPORT_TEMPLATES.map((template) => (
                <a
                  key={template.href}
                  href={template.href}
                  download
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline"
                >
                  {template.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 'review' && parseResult && (
        <div className="space-y-6">
          {isUploading && (
            <p className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2">
              Re-parsing selected sheet...
            </p>
          )}

          {duplicateWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                {duplicateWarning.duplicate_count} row(s) look similar to existing records
              </p>
              <p className="text-xs text-amber-700 mt-1">
                These rows have matching names and values already in your account.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => handleCommit(true, false)}
                  disabled={isCommitting || nonDuplicateCount === 0}
                  className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Import non-duplicates ({nonDuplicateCount} rows)
                </button>
                <button
                  type="button"
                  onClick={() => handleCommit(false, true)}
                  disabled={isCommitting}
                  className="text-sm px-3 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  Import all anyway
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="text-sm text-amber-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Review Field Mapping</h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {parseResult.file_name} — {editableRows.length} rows
                  {parseResult.header_row_index != null && parseResult.header_row_index > 0 && (
                    <span className="text-neutral-400">
                      {' '}
                      (header detected on row {parseResult.header_row_index + 1})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-neutral-500">Import into:</label>
                <select
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                >
                  {Object.entries(TABLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {parseResult.sheet_names && parseResult.sheet_names.length > 1 && (
              <div className="mb-4">
                <label className="text-sm font-medium text-neutral-700">Excel sheet</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value)
                    reparseWithSheet(e.target.value)
                  }}
                  disabled={isUploading}
                  className="mt-1 block w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  {parseResult.sheet_names.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-500">Select the sheet containing your data</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-neutral-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Column in File
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Maps to DB Field
                </p>
              </div>
              {parseResult.headers.map((header) => (
                <div key={header} className="grid grid-cols-2 gap-4 items-center py-1.5">
                  <p className="text-sm font-mono text-neutral-700 bg-neutral-50 rounded px-2 py-1">
                    {header}
                  </p>
                  <select
                    value={fieldMap[header] ?? ''}
                    onChange={(e) =>
                      setFieldMap((prev) => ({ ...prev, [header]: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  >
                    <option value="">— Skip this column —</option>
                    {(parseResult.table_fields[targetTable] ?? []).map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-3">* Required fields</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">Data preview</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Click any cell to edit before importing. Use ✕ to remove a row.
            </p>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm min-w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-neutral-200">
                    {parseResult.headers.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {header}
                        {fieldMap[header] && (
                          <span className="ml-1 text-indigo-500 normal-case font-normal">
                            → {fieldMap[header]}
                          </span>
                        )}
                      </th>
                    ))}
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {editableRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-neutral-100 hover:bg-neutral-50">
                      {parseResult.headers.map((header) => (
                        <td key={header} className="px-3 py-1">
                          <input
                            type="text"
                            value={row[header] ?? ''}
                            onChange={(e) => {
                              const updated = [...editableRows]
                              updated[rowIndex] = {
                                ...updated[rowIndex],
                                [header]: e.target.value,
                              }
                              setEditableRows(updated)
                            }}
                            className="w-full min-w-[6rem] px-1 py-0.5 text-sm border-0 rounded focus:ring-1 focus:ring-indigo-500 bg-transparent hover:bg-white focus:bg-white transition-colors"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditableRows(editableRows.filter((_, i) => i !== rowIndex))
                          }
                          className="text-neutral-300 hover:text-red-500 transition-colors"
                          title="Remove this row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editableRows.length !== parseResult.rows.length && (
              <p className="text-xs text-neutral-500 mt-2">
                {parseResult.rows.length - editableRows.length} row(s) removed.{' '}
                <button
                  type="button"
                  onClick={() =>
                    setEditableRows(parseResult.rows.map((r) => ({ ...r })))
                  }
                  className="text-indigo-600 hover:underline"
                >
                  Restore all
                </button>
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancelReview}
              disabled={deletingId === parseResult.job_id || isUploading}
              className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
            >
              {deletingId === parseResult.job_id ? 'Removing...' : 'Cancel import'}
            </button>
            <button
              type="button"
              onClick={() => handleCommit()}
              disabled={isCommitting || isUploading || editableRows.length === 0}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {isCommitting ? 'Importing...' : `Import into ${TABLE_LABELS[targetTable]}`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && commitResult && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">Import Complete</h2>
          <p className="text-sm text-neutral-500 mb-2">
            <span className="font-semibold text-green-600">
              {commitResult.inserted_count ?? commitResult.committed} rows
            </span>{' '}
            imported into {TABLE_LABELS[targetTable]}.
            {commitResult.skipped > 0 && (
              <span className="text-amber-600">
                {' '}
                {commitResult.skipped} rows skipped (missing fields or duplicates).
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link
              href={TABLE_PATHS[targetTable] ?? '/assets'}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
            >
              View imported {TABLE_LABELS[targetTable]} →
            </Link>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
            >
              Import another file
            </button>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">
            Import History
          </h2>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {['File', 'Type', 'Rows', 'Status', 'Date', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{job.file_name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500 uppercase">{job.file_type}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{job.row_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[job.status] ?? 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {new Date(job.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {DELETABLE_STATUSES.has(job.status) ? (
                        <button
                          type="button"
                          onClick={() => deleteJob(job.id)}
                          disabled={deletingId === job.id}
                          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {deletingId === job.id ? 'Removing...' : 'Remove'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
