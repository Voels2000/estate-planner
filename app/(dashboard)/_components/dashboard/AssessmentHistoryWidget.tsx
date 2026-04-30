'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type AssessmentResult = {
  id: string
  taken_at: string
  overall_score: number
  financial_pct: number
  retirement_pct: number
  estate_pct: number
}

function getLevel(pct: number) {
  if (pct >= 80) return { label: 'Strong', color: '#4a7c6f' }
  if (pct >= 60) return { label: 'Developing', color: '#ba7517' }
  if (pct >= 40) return { label: 'Needs Attention', color: '#c9a84c' }
  return { label: 'Action Required', color: '#d85a30' }
}

export function AssessmentHistoryWidget() {
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('assessment_results')
          .select('id, taken_at, overall_score, financial_pct, retirement_pct, estate_pct')
          .order('taken_at', { ascending: false })
          .limit(3)
        setResults(data ?? [])
      } catch {
        // fail silently
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return null
  if (results.length === 0) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 24,
        boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 18, fontWeight: 500,
            color: '#0f1f3d', marginBottom: 6,
          }}>
            Planning Readiness Assessment
          </div>
          <div style={{ fontSize: 13, color: '#718096', lineHeight: 1.5 }}>
            Discover where your financial, retirement, and estate
            planning stands today. Takes about 8 minutes.
          </div>
        </div>
        <Link href="/assess" style={{
          background: '#0f1f3d', color: 'white',
          borderRadius: 8, padding: '10px 20px',
          fontSize: 13, fontWeight: 500,
          textDecoration: 'none', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Take Assessment →
        </Link>
      </div>
    )
  }

  const latest = results[0]
  const level = getLevel(latest.overall_score)

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '24px 28px',
      marginBottom: 24,
      boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 18, fontWeight: 500, color: '#0f1f3d',
        }}>
          Planning Readiness Score
        </div>
        <Link href="/assess" style={{
          fontSize: 12, color: '#718096',
          textDecoration: 'none',
          border: '1px solid #e2e8f0',
          padding: '5px 12px', borderRadius: 6,
        }}>
          Retake Assessment →
        </Link>
      </div>

      {/* Overall score + pillars */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 24, alignItems: 'center',
        marginBottom: 20,
      }}>
        {/* Score ring */}
        <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="38" fill="none"
              stroke="#e2e8f0" strokeWidth="8" />
            <circle cx="45" cy="45" r="38" fill="none"
              stroke={level.color} strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 38}`}
              strokeDashoffset={`${2 * Math.PI * 38 * (1 - latest.overall_score / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 45 45)" />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 22, fontWeight: 600,
              color: '#0f1f3d', lineHeight: 1,
            }}>{latest.overall_score}%</div>
            <div style={{
              fontSize: 8, color: '#718096',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>Overall</div>
          </div>
        </div>

        {/* Pillar bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: '💰 Financial', score: latest.financial_pct, color: '#0f1f3d' },
            { label: '🏖️ Retirement', score: latest.retirement_pct, color: '#c9a84c' },
            { label: '📜 Estate', score: latest.estate_pct, color: '#4a7c6f' },
          ].map(pillar => (
            <div key={pillar.label}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12, marginBottom: 4,
              }}>
                <span style={{ color: '#4a5568' }}>{pillar.label}</span>
                <span style={{ color: pillar.color, fontWeight: 600 }}>
                  {pillar.score}%
                </span>
              </div>
              <div style={{
                background: '#e2e8f0', borderRadius: 40,
                height: 5, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 40,
                  background: pillar.color,
                  width: `${pillar.score}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Level badge + date */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 40,
          fontSize: 11, fontWeight: 500,
          background: level.color + '18',
          color: level.color,
        }}>
          {level.label}
        </div>
        <div style={{ fontSize: 11, color: '#718096' }}>
          Last taken {new Date(latest.taken_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })}
          {results.length > 1 && ` · ${results.length} assessments taken`}
        </div>
      </div>
    </div>
  )
}
