'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AdvisorNote = {
  id: string
  note: string
  created_at: string
}

function NotesPanel({ advisorId, clientId, initialNotes }: {
  advisorId: string
  clientId: string
  initialNotes: AdvisorNote[]
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleAddNote() {
    if (!newNote.trim()) return
    setIsSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('advisor_notes')
      .insert({
        advisor_id: advisorId,
        client_id: clientId,
        note: newNote.trim(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (!error && data) {
      setNotes(prev => [data, ...prev])
      setNewNote('')
    }
    setIsSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-4">
        Advisor Notes
      </h2>
      <div className="space-y-3">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this client..."
          rows={3}
          className="block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"
        />
        <button
          onClick={handleAddNote}
          disabled={isSaving || !newNote.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 transition"
        >
          {isSaving ? 'Saving...' : 'Add Note'}
        </button>
      </div>
      {notes.length > 0 && (
        <div className="mt-4 space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-700">{n.note}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {(() => {
                  const d = new Date(n.created_at)
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  const hours = d.getUTCHours()
                  const minutes = d.getUTCMinutes().toString().padStart(2, '0')
                  const ampm = hours >= 12 ? 'PM' : 'AM'
                  const hour12 = hours % 12 || 12
                  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} at ${hour12}:${minutes} ${ampm}`
                })()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotesPanel
