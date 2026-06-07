'use client'

import { useState } from 'react'

type Note = {
  id: string
  content: string
  note_type: string
  created_at: string
}

export function AttorneyNotesPanel({
  householdId,
  initialNotes = [],
}: {
  householdId: string
  initialNotes?: Note[]
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/attorney/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household_id: householdId, content }),
      })
      const data = await res.json()
      if (res.ok && data.note) {
        setNotes((prev) => [data.note, ...prev])
        setContent('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/attorney/notes?id=${id}`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Firm notes (private)
        </h2>
        <p className="text-xs text-neutral-500 mt-1">
          Visible only to your firm — not shared with the client.
        </p>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Meeting prep, follow-ups, internal context…"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm resize-none"
      />
      <button
        type="button"
        disabled={saving || !content.trim()}
        onClick={() => void handleAdd()}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Add note'}
      </button>
      {notes.length > 0 && (
        <ul className="space-y-2 border-t border-neutral-100 pt-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
              <p className="text-neutral-800 whitespace-pre-wrap">{n.content}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                <span>{new Date(n.created_at).toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => void handleDelete(n.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
