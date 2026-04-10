'use client'

import { useMemo, useState } from 'react'

type RefRow = {
  id: string
  value: string
  label: string
  description?: string | null
  sort_order?: number | null
  is_active?: boolean | null
}

type TableMap = Record<string, { tableName: string; rows: RefRow[] }>

export default function ReferenceDataClient({ tables }: { tables: TableMap }) {
  const tabNames = useMemo(() => Object.keys(tables), [tables])
  const [activeTab, setActiveTab] = useState(tabNames[0] ?? '')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const table = tables[activeTab]

  async function toggleRow(row: RefRow) {
    if (!table) return
    setPendingId(row.id)
    await fetch('/api/admin/reference-data', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: table.tableName,
        id: row.id,
        is_active: !(row.is_active ?? false),
      }),
    })
    setPendingId(null)
    window.location.reload()
  }

  async function addRow(formData: FormData) {
    if (!table) return
    setSaving(true)
    await fetch('/api/admin/reference-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: table.tableName,
        value: formData.get('value'),
        label: formData.get('label'),
        description: formData.get('description') || null,
        sort_order: Number(formData.get('sort_order') || 0),
      }),
    })
    setSaving(false)
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">Reference Data</h1>
      <p className="text-sm text-neutral-500 mt-1">Manage lookup table options without code changes.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabNames.map((name) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              activeTab === name
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-100">
          <thead className="bg-neutral-50">
            <tr>
              {['Value', 'Label', 'Description', 'Sort', 'Active', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(table?.rows ?? []).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-sm text-neutral-800">{row.value}</td>
                <td className="px-4 py-3 text-sm text-neutral-800">{row.label}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{row.description ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{row.sort_order ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{row.is_active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleRow(row)}
                    disabled={pendingId === row.id}
                    className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {pendingId === row.id ? 'Saving...' : row.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={(fd) => {
          void addRow(fd)
        }}
        className="mt-6 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">Add new option</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input name="value" required placeholder="value" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input name="label" required placeholder="label" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input name="sort_order" type="number" placeholder="sort order" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
        <textarea
          name="description"
          rows={2}
          placeholder="description (optional)"
          className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </form>
    </div>
  )
}
