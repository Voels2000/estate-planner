'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaEnrollPage() {
  const router = useRouter()
  const supabase = createClient()

  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(true)

  useEffect(() => {
    async function enroll() {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'My Wealth Maps',
      })
      if (error || !data) {
        setError('Could not start setup. Please try again.')
        setEnrolling(false)
        return
      }
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setEnrolling(false)
    }
    enroll()
  }, [])

  async function handleVerify() {
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      })
      if (challengeError) {
        setError('Invalid code. Please try again.')
        setLoading(false)
        return
      }
      router.push('/settings/security?mfa=enabled')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#fafaf8',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        background: 'white', border: '1px solid #e2e8f0',
        borderRadius: 16, padding: '40px 36px',
        maxWidth: 440, width: '100%',
        boxShadow: '0 8px 40px rgba(15,31,61,0.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: '#c9a84c',
            borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 20,
          }}>🔐</div>
          <h1 style={{
            fontFamily: 'Playir Display, Georgia, serif',
            fontSize: 22, fontWeight: 500,
            color: '#0f1f3d', marginBottom: 6,
          }}>Set Up Two-Factor Authentication</h1>
          <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
            Scan the QR code with your authenticator app, then enter
            the 6-digit code to confirm.
          </p>
        </div>

        {enrolling && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#718096', fontSize: 13 }}>
            Setting up authenticator...
          </div>
        )}

        {!enrolling && qrCode && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{
                background: 'white', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: 12, marginBottom: 12,
              }}>
                <img src={qrCode} alt="MFA QR Code" width={160} height={160} style={{ display: 'block' }} />
              </div>
              <details style={{ width: '100%' }}>
                <summary style={{ fontSize: 11, color: '#718096', cursor: 'pointer', textAlign: 'center', listStyle: 'none' }}>
                  Can&apos;t scan? Enter code manually
                </summary>
                <div style={{
                  marginTop: 8, background: '#f7f8fa',
                  border: '1px solid #e2e8f0', borderRadius: 6,
                  padding: '8px 12px', fontSize: 12,
                  fontFamily: 'monospace', color: '#0f1f3d',
                  wordBreak: 'break-all', textAlign: 'center',
                }}>{secret}</div>
              </details>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#0f1f3d', marginBottom: 8 }}>
                Enter the 6-digit code from your app
              </label>
              <input
                type="text" inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6} placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%', padding: '12px',
                  borderRadius: 8, border: '1.5px solid #e2e8f0',
                  fontSize: 24, textAlign: 'center',
                  letterSpacing: '0.3em', fontFamily: 'monospace',
                  outline: 'none', color: '#0f1f3d',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#fff5f5', border: '1px solid #fed7d7',
                borderRadius: 6, padding: '10px 14px',
                fontSize: 13, color: '#c53030', marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              onClick={handleVerify}
              disabled={code.length !== 6 || loading}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 8, border: 'none',
                background: code.length === 6 ? '#0f1f3d' : '#e2e8f0',
                color: code.length === 6 ? 'white' : '#718096',
                fontSize: 14, fontWeight: 600,
                cursor: code.length === 6 ? 'pointer' : 'not-allowed',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                transition: 'all 0.2s',
              }}
            >{loading ? 'Verifying...' : 'Enable Two-Factor Authentication'}</button>
          </>
        )}

        {error && !qrCode && (
          <div style={{
            background: '#fff5f5', border: '1px solid #fed7d7',
            borderRadius: 6, padding: '10px 14px',
            fontSize: 13, color: '#c53030',
            marginBottom: 16, textAlign: 'center',
          }}>{error}</div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/settings/security" style={{ fontSize: 12, color: '#718096', textDecoration: 'none' }}>
            Cancel — back to Security settings
          </a>
        </div>
      </div>
    </div>
  )
}
