'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSignupHref } from '@/lib/waitlist-mode'

type Attorney = {
  id: string
  profile_id: string | null
  firm_name: string
  contact_name: string | null
  email: string
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  bar_number: string | null
  bio: string | null
  fee_structure: string | null
  specializations: string[]
  states_licensed: string[]
  languages: string[]
  serves_remote: boolean
  is_verified: boolean
  credential_verified_at: string | null
}

type Props = {
  attorneys: Attorney[]
  allSpecializations: string[]
  allStatesLicensed: string[]
  allStates: string[]
  existingConnections: string[]
  isLoggedIn: boolean
}

export function AttorneyDirectoryClient({
  attorneys,
  allSpecializations,
  allStatesLicensed,
  allStates,
  existingConnections,
  isLoggedIn,
}: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('')
  const [selectedLicensedState, setSelectedLicensedState] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [modalAttorney, setModalAttorney] = useState<Attorney | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentIds, setSentIds] = useState<string[]>([])
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    return attorneys.filter(a => {
      if (search) {
        const q = search.toLowerCase()
        const matches =
          a.firm_name.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q) ||
          a.contact_name?.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (selectedState && a.state !== selectedState) return false
      if (selectedSpec && !a.specializations.includes(selectedSpec)) return false
      if (selectedLicensedState && !a.states_licensed.includes(selectedLicensedState)) return false
      if (remoteOnly && !a.serves_remote) return false
      return true
    })
  }, [attorneys, search, selectedState, selectedSpec, selectedLicensedState, remoteOnly])

  function clearFilters() {
    setSearch('')
    setSelectedState('')
    setSelectedSpec('')
    setSelectedLicensedState('')
    setRemoteOnly(false)
  }

  async function handleConnect(attorney: Attorney) {
    if (!isLoggedIn) {
      router.push(getSignupHref({ redirectTo: '/find-attorney' }))
      return
    }
    setModalAttorney(attorney)
    setMessage('')
    setError('')
  }

  async function handleSendRequest() {
    if (!modalAttorney) return
    if (!message.trim()) {
      setError('Please include a brief message to the attorney.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/attorney-directory/request-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: modalAttorney.id,
          listing_type: 'attorney',
          message,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Could not send request.')
        setSending(false)
        return
      }
      setSentIds(prev => [...prev, modalAttorney.id])
      setModalAttorney(null)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setSending(false)
  }

  const nav = { background: '#0f1f3d', padding: '14px 32px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky' as const, top: 0, zIndex: 100,
    boxShadow: '0 2px 20px rgba(0,0,0,0.2)' }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8',
      fontFamily: 'DM Sans, system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%',
            background: '#c9a84c', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: 'Playfair Display, Georgia, serif',
            fontWeight: 700, fontSize: 16, color: '#0f1f3d' }}>M</div>
          <span style={{ fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 18, fontWeight: 600, color: 'white', letterSpacing: '-0.01em' }}>
            My Wealth Maps
          </span>
        </div>
        <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)',
          textDecoration: 'none' }}>← Back to home</Link>
      </nav>

      {/* Disclaimer */}
      <div style={{ background: '#1a3460', borderLeft: '4px solid #c9a84c',
        padding: '11px 32px', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
        Attorney listings are provided for discovery. Engage directly to discuss your situation and confirm fit.
      </div>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3460 100%)',
        padding: '48px 32px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          color: '#c9a84c', textTransform: 'uppercase', marginBottom: 12 }}>
          Attorney Directory
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 36, fontWeight: 500, color: 'white',
          margin: '0 0 12px', lineHeight: 1.2 }}>
          Find an Estate Planning Attorney
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)',
          maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
          Connect with verified estate planning attorneys who can help you
          draft wills, trusts, and legal documents.
        </p>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0',
        padding: '16px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' }}>
          <input
            placeholder="Search firm, name, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 8,
              border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none',
              fontFamily: 'DM Sans, system-ui, sans-serif' }}
          />
          <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 13, background: 'white', outline: 'none',
              fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            <option value="">All office states</option>
            {allStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedLicensedState} onChange={e => setSelectedLicensedState(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 13, background: 'white', outline: 'none',
              fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            <option value="">All licensed states</option>
            {allStatesLicensed.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {allSpecializations.length > 0 && (
            <select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                fontSize: 13, background: 'white', outline: 'none',
                fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              <option value="">All specializations</option>
              {allSpecializations.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#4a5568', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            <input type="checkbox" checked={remoteOnly}
              onChange={e => setRemoteOnly(e.target.checked)} />
            Remote only
          </label>
          {(search || selectedState || selectedSpec || selectedLicensedState || remoteOnly) && (
            <button onClick={clearFilters}
              style={{ padding: '8px 12px', borderRadius: 8,
                border: '1px solid #e2e8f0', background: 'white',
                fontSize: 12, color: '#718096', cursor: 'pointer',
                fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>
        <div style={{ fontSize: 13, color: '#718096', marginBottom: 20 }}>
          {filtered.length} attorney{filtered.length !== 1 ? 's' : ''} found
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚖️</div>
            <div style={{ fontSize: 16, color: '#4a5568', marginBottom: 8 }}>
              No attorneys match your filters
            </div>
            <button onClick={clearFilters}
              style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8,
                border: '1px solid #c9a84c', background: 'transparent',
                color: '#c9a84c', fontSize: 13, cursor: 'pointer',
                fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {filtered.map(attorney => {
              const alreadySent = sentIds.includes(attorney.id) ||
                existingConnections.includes(attorney.id)
              return (
                <div key={attorney.id} style={{ background: 'white',
                  border: '1px solid #e2e8f0', borderRadius: 12,
                  padding: '24px', boxShadow: '0 2px 12px rgba(15,31,61,0.06)',
                  display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: 'Playfair Display, Georgia, serif',
                        fontSize: 16, fontWeight: 600, color: '#0f1f3d',
                        marginBottom: 2 }}>{attorney.firm_name}</div>
                      {attorney.contact_name && (
                        <div style={{ fontSize: 13, color: '#4a5568' }}>
                          {attorney.contact_name}
                        </div>
                      )}
                    </div>
                    {attorney.credential_verified_at && (
                      <span style={{ background: '#f0fdf4', color: '#16a34a',
                        fontSize: 11, fontWeight: 600, padding: '3px 8px',
                        borderRadius: 20, border: '1px solid #bbf7d0',
                        whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>

                  {/* Location */}
                  <div style={{ fontSize: 13, color: '#718096' }}>
                    📍 {[attorney.city, attorney.state].filter(Boolean).join(', ') || 'Location not listed'}
                    {attorney.serves_remote && (
                      <span style={{ marginLeft: 8, background: '#eff6ff',
                        color: '#3b82f6', fontSize: 11, padding: '2px 7px',
                        borderRadius: 20, border: '1px solid #bfdbfe' }}>
                        Remote
                      </span>
                    )}
                  </div>

                  {/* Bio */}
                  {attorney.bio && (
                    <div style={{ fontSize: 13, color: '#4a5568',
                      lineHeight: 1.6, display: '-webkit-box',
                      WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden' }}>
                      {attorney.bio}
                    </div>
                  )}

                  {/* States licensed */}
                  {attorney.states_licensed?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                      {attorney.states_licensed.slice(0, 5).map(s => (
                        <span key={s} style={{ background: '#fdf6e3',
                          color: '#92400e', fontSize: 11, padding: '2px 7px',
                          borderRadius: 20, border: '1px solid #fde68a' }}>
                          {s}
                        </span>
                      ))}
                      {attorney.states_licensed.length > 5 && (
                        <span style={{ fontSize: 11, color: '#718096' }}>
                          +{attorney.states_licensed.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Specializations */}
                  {attorney.specializations?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                      {attorney.specializations.slice(0, 3).map(s => (
                        <span key={s} style={{ background: '#f0f4ff',
                          color: '#3730a3', fontSize: 11, padding: '2px 7px',
                          borderRadius: 20, border: '1px solid #c7d2fe' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Fee structure */}
                  {attorney.fee_structure && (
                    <div style={{ fontSize: 12, color: '#718096' }}>
                      💼 {attorney.fee_structure}
                    </div>
                  )}

                  {/* CTA */}
                  <div style={{ marginTop: 'auto', paddingTop: 8,
                    borderTop: '1px solid #f1f5f9', display: 'flex',
                    gap: 8, alignItems: 'center' }}>
                    {attorney.website && (
                      <a href={attorney.website} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#718096', textDecoration: 'none' }}>
                        Website ↗
                      </a>
                    )}
                    <button
                      onClick={() => handleConnect(attorney)}
                      disabled={alreadySent}
                      style={{ marginLeft: 'auto', padding: '8px 16px',
                        borderRadius: 8, border: 'none',
                        background: alreadySent ? '#f1f5f9' : '#0f1f3d',
                        color: alreadySent ? '#718096' : 'white',
                        fontSize: 13, fontWeight: 600,
                        cursor: alreadySent ? 'not-allowed' : 'pointer',
                        fontFamily: 'DM Sans, system-ui, sans-serif' }}>
                      {alreadySent ? 'Request Sent' : 'Request to Connect'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {modalAttorney && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalAttorney(null) }}>
          <div style={{ background: 'white', borderRadius: 16,
            padding: '36px', maxWidth: 460, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 20, fontWeight: 500, color: '#0f1f3d',
              marginBottom: 4 }}>Connect with {modalAttorney.firm_name}</h2>
            <p style={{ fontSize: 13, color: '#718096', marginBottom: 20, lineHeight: 1.6 }}>
              Send a connection request. They&apos;ll be able to view your estate plan
              summary and reach out to you directly.
            </p>
            <textarea
              placeholder="Introduce yourself or describe what you're looking for (required)"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'vertical',
                fontFamily: 'DM Sans, system-ui, sans-serif', outline: 'none',
                boxSizing: 'border-box' as const }}
            />
            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #fed7d7',
                borderRadius: 6, padding: '10px 14px', fontSize: 13,
                color: '#c53030', margin: '12px 0' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setModalAttorney(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: 'white',
                  fontSize: 13, color: '#718096', cursor: 'pointer',
                  fontFamily: 'DM Sans, system-ui, sans-serif' }}>
                Cancel
              </button>
              <button onClick={handleSendRequest} disabled={sending}
                style={{ flex: 2, padding: '10px', borderRadius: 8,
                  border: 'none', background: '#0f1f3d', color: 'white',
                  fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, system-ui, sans-serif' }}>
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
