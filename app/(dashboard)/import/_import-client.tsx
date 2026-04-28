'use client'

import { useState, useRef } from 'react'

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
}

const TABLE_LABELS: Record<string, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  income: 'Income',
  expenses: 'Expenses',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  committed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export function ImportClient({ jobs: initialJobs }: { jobs: IngestionJob[] }) {
  const [jobs, setJobs] = useState<IngestionJob[]>(initialJobs)
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const [targetTable, setTargetTable] = useState<string>('assets')
  const [commitResult, setCommitResult] = useState<{ committed: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/ingest', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Parse failed')
      setParseResult(data)
      setFieldMap(data.field_map)
      setTargetTable(data.detected_table)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleCommit() {
    if (!parseResult) return
    setError(null)
    setIsCommitting(true)
    try {
      const res = await fetch('/api/ingest/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: parseResult.job_id,
          target_table: targetTable,
          field_map: fieldMap,
          rows: parseResult.rows,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Commit failed')
      setCommitResult(data)
      setStep('done')
      setJobs(prev => [{
        id: parseResult.job_id,
        file_name: parseResult.file_name,
        file_type: parseResult.file_name.split('.').pop() ?? '',
        status: 'committed',
        row_count: data.committed,
        committed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        error_message: null,
      }, ...prev])
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
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Import Data</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Upload a file to import assets, liabilities, income, or expenses. Supports .csv, .xlsx, .docx, and .pdf.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Step 1 — Upload */}
      {step === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
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
                <p className="text-xs text-neutral-400 mt-1">or click to browse — .csv, .xlsx, .docx, .pdf</p>
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
                accept=".csv,.xlsx,.xls,.docx,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Review field mapping */}
      {step === 'review' && parseResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Review Field Mapping</h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {parseResult.file_name} — {parseResult.row_count} rows detected
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-neutral-500">Import into:</label>
                <select
                  value={targetTable}
                  onChange={e => setTargetTable(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                >
                  {Object.entries(TABLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-neutral-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Column in File</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Maps to DB Field</p>
              </div>
              {parseResult.headers.map(header => (
                <div key={header} className="grid grid-cols-2 gap-4 items-center py-1.5">
                  <p className="text-sm font-mono text-neutral-700 bg-neutral-50 rounded px-2 py-1">{header}</p>
                  <select
                    value={fieldMap[header] ?? ''}
                    onChange={e => setFieldMap(prev => ({ ...prev, [header]: e.target.value }))}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  >
                    <option value="">— Skip this column —</option>
                    {(parseResult.table_fields[targetTable] ?? []).map(f => (
                      <option key={f.value} value={f.value}>
                        {f.label}{f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-3">* Required fields</p>
          </div>

          {/* Preview first 5 rows */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">
              Data Preview <span className="text-neutral-400 font-normal">(first 5 rows)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-100">
                    {parseResult.headers.map(h => (
                      <th key={h} className="pb-2 pr-4 text-left font-semibold text-neutral-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {parseResult.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {parseResult.headers.map(h => (
                        <td key={h} className="py-1.5 pr-4 text-neutral-600">{row[h] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {isCommitting ? 'Importing...' : `Import into ${TABLE_LABELS[targetTable]}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 'done' && commitResult && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">Import Complete</h2>
          <p className="text-sm text-neutral-500 mb-2">
            <span className="font-semibold text-green-600">{commitResult.committed} rows</span> imported into {TABLE_LABELS[targetTable]}.
            {commitResult.skipped > 0 && (
              <span className="text-amber-600"> {commitResult.skipped} rows skipped (missing required fields).</span>
            )}
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={handleReset}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Job history */}
      {jobs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">Import History</h2>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-100">
              <thead className="bg-neutral-50">
                <tr>
                  {['File', 'Type', 'Rows', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{job.file_name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500 uppercase">{job.file_type}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{job.row_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[job.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
