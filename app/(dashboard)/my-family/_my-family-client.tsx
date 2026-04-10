'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type HouseholdPersonRow = {
  id: string
  full_name: string
  relationship: string
  date_of_birth: string | null
  is_gst_skip: boolean
  is_beneficiary: boolean
  notes: string | null
}

type FamilyGroup = 'spouse' | 'children' | 'grandchildren' | 'other'

const inputClass =
  'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500'

const GROUP_ORDER: { key: FamilyGroup; title: string }[] = [
  { key: 'spouse', title: 'Spouse' },
  { key: 'children', title: 'Children' },
  { key: 'grandchildren', title: 'Grandchildren' },
  { key: 'other', title: 'Other' },
]

function familyGroup(rel: string): FamilyGroup {
  const r = rel.toLowerCase()
  if (/\b(spouse|husband|wife|partner)\b/.test(r)) return 'spouse'
  if (/grand|grandchild|grandson|granddaughter/.test(r)) return 'grandchildren'
  if (/\b(son|daughter|child|children|kid|stepchild|step-son|step-daughter)\b/.test(r)) return 'children'
  return 'other'
}

function isGrandchildRelationship(rel: string): boolean {
  const r = rel.toLowerCase()
  return /grand|grandchild|grandson|granddaughter/.test(r)
}

type Props = {
  householdId: string
  person1Name: string | null
  person2Name: string | null
  hasSpouse: boolean
  initialPeople: HouseholdPersonRow[]
}

export default function MyFamilyClient({
  householdId,
  person1Name,
  person2Name,
  hasSpouse,
  initialPeople,
}: Props) {
  const [people, setPeople] = useState<HouseholdPersonRow[]>(initialPeople)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<HouseholdPersonRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('Child')
  const [relationshipCustom, setRelationshipCustom] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [isGstSkip, setIsGstSkip] = useState(false)
  const [isBeneficiary, setIsBeneficiary] = useState(true)
  const [notes, setNotes] = useState('')

  const relationshipEffective = relationship === 'Custom' ? relationshipCustom.trim() : relationship

  const grouped = useMemo(() => {
    const map: Record<FamilyGroup, HouseholdPersonRow[]> = {
      spouse: [],
      children: [],
      grandchildren: [],
      other: [],
    }
    for (const p of people) {
      map[familyGroup(p.relationship)].push(p)
    }
    return map
  }, [people])

  function openAdd() {
    setEditing(null)
    setFullName('')
    setRelationship('Child')
    setRelationshipCustom('')
    setDateOfBirth('')
    setIsGstSkip(false)
    setIsBeneficiary(true)
    setNotes('')
    setError(null)
    setModalOpen(true)
  }

  function openEdit(row: HouseholdPersonRow) {
    setEditing(row)
    setFullName(row.full_name)
    const preset = ['Spouse', 'Child', 'Grandchild', 'Other'].includes(row.relationship)
      ? row.relationship
      : 'Custom'
    setRelationship(preset === 'Custom' ? 'Custom' : row.relationship)
    setRelationshipCustom(preset === 'Custom' ? row.relationship : '')
    setDateOfBirth(row.date_of_birth ?? '')
    setIsGstSkip(row.is_gst_skip)
    setIsBeneficiary(row.is_beneficiary)
    setNotes(row.notes ?? '')
    setError(null)
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const rel = relationshipEffective
    if (!fullName.trim()) {
      setError('Name is required.')
      return
    }
    if (!rel) {
      setError('Relationship is required.')
      return
    }

    setSaving(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      household_id: householdId,
      full_name: fullName.trim(),
      relationship: rel,
      date_of_birth: dateOfBirth || null,
      is_gst_skip: isGrandchildRelationship(rel) ? isGstSkip : false,
      is_beneficiary: isBeneficiary,
      notes: notes.trim() || null,
    }

    if (editing) {
      const { data, error: err } = await supabase
        .from('household_people')
        .update({
          full_name: payload.full_name,
          relationship: payload.relationship,
          date_of_birth: payload.date_of_birth,
          is_gst_skip: payload.is_gst_skip,
          is_beneficiary: payload.is_beneficiary,
          notes: payload.notes,
        })
        .eq('id', editing.id)
        .select('id, full_name, relationship, date_of_birth, is_gst_skip, is_beneficiary, notes')
        .single()
      setSaving(false)
      if (err) {
        setError(err.message)
        return
      }
      if (data) setPeople(prev => prev.map(p => (p.id === editing.id ? (data as HouseholdPersonRow) : p)))
    } else {
      const { data, error: err } = await supabase
        .from('household_people')
        .insert(payload)
        .select('id, full_name, relationship, date_of_birth, is_gst_skip, is_beneficiary, notes')
        .single()
      setSaving(false)
      if (err) {
        setError(err.message)
        return
      }
      if (data) setPeople(prev => [...prev, data as HouseholdPersonRow])
    }
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('household_people').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setPeople(prev => prev.filter(p => p.id !== id))
    setDeleteId(null)
  }

  const ownerNames = [person1Name, hasSpouse ? person2Name : null].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Family</h1>
          <p className="mt-1 text-sm text-neutral-600">
            List people in your household and extended family. Mark grandchildren for GST skip when
            applicable, and include who should appear as a beneficiary in your estate flow.
          </p>
          {ownerNames.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              Household: {ownerNames.join(' · ')} (not listed here — edit Profile if needed)
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Add family member
        </button>
      </div>

      {error && !modalOpen && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="space-y-8">
        {GROUP_ORDER.map(({ key, title }) => {
          const rows = grouped[key]
          if (rows.length === 0) return null
          return (
            <section key={key}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
              <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                {rows.map(row => (
                  <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{row.full_name}</p>
                      <p className="text-sm text-neutral-600">
                        {row.relationship}
                        {row.is_gst_skip ? ' · GST skip' : ''}
                        {!row.is_beneficiary ? ' · Not in flow as beneficiary' : ''}
                      </p>
                      {row.date_of_birth && (
                        <p className="text-xs text-neutral-500">DOB: {row.date_of_birth}</p>
                      )}
                      {row.notes && <p className="mt-1 text-xs text-neutral-500">{row.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(row.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {people.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
          No family members yet. Use &quot;Add family member&quot; to build your list.
        </p>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-neutral-900">
              {editing ? 'Edit family member' : 'Add family member'}
            </h3>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Full name</label>
                <input className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Relationship</label>
                <select
                  className={inputClass}
                  value={relationship}
                  onChange={e => {
                    const v = e.target.value
                    setRelationship(v)
                    if (v === 'Grandchild') {
                      setIsGstSkip(true)
                    } else if (v !== 'Custom') {
                      setIsGstSkip(false)
                    }
                  }}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child</option>
                  <option value="Grandchild">Grandchild</option>
                  <option value="Other">Other</option>
                  <option value="Custom">Custom…</option>
                </select>
                {relationship === 'Custom' && (
                  <input
                    className={`${inputClass} mt-2`}
                    placeholder="Describe relationship"
                    value={relationshipCustom}
                    onChange={e => {
                      const next = e.target.value
                      setRelationshipCustom(next)
                      if (isGrandchildRelationship(next)) setIsGstSkip(true)
                    }}
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Date of birth (optional)</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={isBeneficiary}
                  onChange={e => setIsBeneficiary(e.target.checked)}
                />
                Include as beneficiary in estate flow
              </label>
              {isGrandchildRelationship(relationshipEffective) && (
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    checked={isGstSkip}
                    onChange={e => setIsGstSkip(e.target.checked)}
                  />
                  GST skip person (suggested for grandchildren)
                </label>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</label>
                <textarea className={inputClass} rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm text-neutral-800">Remove this person from your family list?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(deleteId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
