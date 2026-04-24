'use client'
// app/advisor/clients/[clientId]/_tabs/NotesTab.tsx
// Advisor-only notes — consumer NEVER sees these.
// RLS enforces: advisor reads/writes own notes for linked clients only.

import { useState, useCallback } from 'react'
import { ClientViewShellProps } from '../_client-view-shell'
import { formatDate } from '../_utils'

type AdvisorNote = {
  id: string
  content: string
  created_at: string
  updated_at: string | null
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong.'

export default function NotesTab({ notes: initialNotes, clientId }: ClientViewShellProps) {
  const [notes, setNotes] = useState<AdvisorNote[]>((initialNotes ?? []) as AdvisorNote[])
  const [newNote, setNewNote]   = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // ── Add note ────────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    if (!newNote.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, content: newNote.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save note')
      const { note } = await res.json()
      setNotes(prev => [note, ...prev])
      setNewNote('')
    } catch (error: unknown) {
      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }, [newNote, clientId])

  // ── Edit note ────────────────────────────────────────────────────────────────
  const startEdit = (note: AdvisorNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const handleSaveEdit = useCallback(async (id: string) => {
    if (!editContent.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/advisor/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent.trim() }),
      })
      if (!res.ok) throw new Error('Failed to update note')
      const { note } = await res.json()
      setNotes(prev => prev.map(n => n.id === id ? note : n))
      setEditingId(null)
    } catch (error: unknown) {
      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }, [editContent])

  // ── Delete note ──────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/advisor/notes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete note')
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (error: unknown) {
      setError(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }, [])

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Privacy banner ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-start gap-3">
        <span className="text-lg mt-0.5">🔒</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Advisor-Private Notes</p>
          <p className="text-sm text-amber-700 mt-0.5">
            These notes are <strong>never visible to the client</strong>. Only you can see them.
            Use this space for meeting prep, observations, follow-up items, and strategy notes.
          </p>
        </div>
      </div>

      {/* ── New note composer ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Note</h3>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          rows={4}
          placeholder="Meeting notes, follow-up items, strategy observations…"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
          }}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-400">{newNote.length} characters · ⌘↵ to save</span>
          <button
            onClick={handleAdd}
            disabled={saving || !newNote.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {/* ── Note list ── */}
      {notes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center text-slate-400">
          <span className="text-4xl mb-3">✎</span>
          <p className="text-sm font-medium">No notes yet</p>
          <p className="text-xs mt-1">Your private notes will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="bg-white rounded-xl border border-slate-200 p-5">
              {editingId === note.id ? (
                <>
                  <textarea
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={4}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-400">
                      <span>{formatDate(note.created_at)}</span>
                      {note.updated_at && note.updated_at !== note.created_at && (
                        <span className="ml-2 italic">· edited {formatDate(note.updated_at)}</span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(note)}
                        className="text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                        className="text-xs text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingId === note.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
