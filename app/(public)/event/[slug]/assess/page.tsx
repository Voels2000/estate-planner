'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getEventContent } from '@/lib/events/content'
import { getSignupHref } from '@/lib/waitlist-mode'
import type { EventContent, EventAssessmentQuestion } from '@/lib/events/types'
import { createClient } from '@/lib/supabase/client'

const MAX_SCORE_PER_Q = 3

function getLevel(pct: number): {
  label: string
  color: string
  bg: string
  border: string
  message: string
} {
  if (pct >= 80) return {
    label: 'Well prepared',
    color: '#4a7c6f', bg: '#eef6f4', border: '#a8d5c8',
    message: 'You\'re ahead of most households in this situation. A few gaps remain — review the action plan below.',
  }
  if (pct >= 60) return {
    label: 'Developing',
    color: '#ba7517', bg: '#faeeda', border: '#f5cc7a',
    message: 'You have some preparation in place but meaningful gaps exist. The action plan below prioritizes what to do first.',
  }
  if (pct >= 40) return {
    label: 'Needs attention',
    color: '#c9a84c', bg: '#fdf6e3', border: '#e8c97a',
    message: 'Several important planning steps haven\'t been taken yet. Start with the immediate priority items below.',
  }
  return {
    label: 'Areas to review',
    color: '#d85a30', bg: '#fef3ee', border: '#f9c5a1',
    message: 'Significant gaps exist that carry real risk. The action plan below identifies what to address urgently.',
  }
}

function getGapQuestions(
  questions: EventAssessmentQuestion[],
  answers: Record<string, number>,
): EventAssessmentQuestion[] {
  return questions.filter(q => {
    const idx = answers[q.id]
    if (idx === undefined) return false
    return q.options[idx].score <= 1
  })
}

function QuestionCard({
  question,
  qIndex,
  total,
  selectedIndex,
  onSelect,
}: {
  question: EventAssessmentQuestion
  qIndex: number
  total: number
  selectedIndex: number | undefined
  onSelect: (idx: number) => void
}) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '28px 28px 24px',
      boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
    }}>
      <div style={{
        fontSize: 11, color: '#718096', marginBottom: 10,
      }}>
        Question {qIndex + 1} of {total}
      </div>
      <h2 style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: 19, color: '#0f1f3d',
        lineHeight: 1.3, marginBottom: 22,
      }}>
        {question.question}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.options.map((opt, i) => {
          const selected = selectedIndex === i
          return (
            <div
              key={i}
              onClick={() => onSelect(i)}
              style={{
                border: `2px solid ${selected ? '#0f1f3d' : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '14px 16px',
                cursor: 'pointer',
                background: selected ? '#0f1f3d' : '#fafaf8',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${selected ? '#c9a84c' : '#cbd5e0'}`,
                background: selected ? '#c9a84c' : 'white',
                flexShrink: 0, marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#0f1f3d',
                  }} />
                )}
              </div>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 500,
                  color: selected ? 'white' : '#1a202c',
                  marginBottom: opt.hint ? 3 : 0,
                }}>
                  {opt.label}
                </div>
                {opt.hint && (
                  <div style={{
                    fontSize: 12,
                    color: selected ? 'rgba(255,255,255,0.6)' : '#718096',
                    lineHeight: 1.4,
                  }}>
                    {opt.hint}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultsScreen({
  event,
  score,
  answers,
  onRetake,
}: {
  event: EventContent
  score: number
  answers: Record<string, number>
  onRetake: () => void
}) {
  const pct = Math.round((score / (event.assessmentQuestions.length * MAX_SCORE_PER_Q)) * 100)
  const level = getLevel(pct)
  const gaps = getGapQuestions(event.assessmentQuestions, answers)
  const [saved, setSaved] = useState(false)
  const [showCapture, setShowCapture] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    async function trySave() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setShowCapture(true); return }
        await supabase.from('assessment_results').insert({
          user_id: user.id,
          overall_score: pct,
          financial_score: pct,
          retirement_score: pct,
          estate_score: pct,
          financial_pct: pct,
          retirement_pct: pct,
          estate_pct: pct,
          answers: { ...answers, _event_slug: event.slug, _type: 'event' },
        })
        setSaved(true)
      } catch {
        setShowCapture(true)
      }
    }
    trySave()
  }, [answers, event.slug, pct])

  async function handleEmailCapture() {
    if (!email.trim()) return
    try {
      await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: `event-assess-${event.slug}`, score: pct }),
      })
      setEmailSent(true)
      const { captureFunnelEvent } = await import('@/lib/analytics/useFunnelEvent')
      captureFunnelEvent({
        event_name: 'email_captured',
        event_slug: event.slug,
        properties: { score: pct, source: `event-assess-${event.slug}` },
      })
    } catch {
      setEmailSent(true)
    }
  }

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #0f1f3d 0%, #2a4a7f 100%)',
        borderRadius: 12,
        padding: '32px',
        color: 'white',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none"
              stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
            <circle cx="50" cy="50" r="42" fill="none"
              stroke={level.color} strokeWidth="9"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)" />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 24, fontWeight: 600, color: 'white', lineHeight: 1,
            }}>{pct}%</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: level.bg, color: level.color,
            fontSize: 11, fontWeight: 600,
            padding: '3px 12px', borderRadius: 40,
            border: `1px solid ${level.border}`,
            marginBottom: 10,
          }}>
            {level.label}
          </div>
          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 20, marginBottom: 8,
          }}>
            Your {event.shortTitle} Readiness Score
          </h2>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.6,
          }}>
            {level.message}
          </p>
        </div>
      </div>

      {gaps.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '24px',
          marginBottom: 24,
        }}>
          <h3 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 18, color: '#0f1f3d', marginBottom: 16,
          }}>
            {gaps.length} gap{gaps.length !== 1 ? 's' : ''} identified
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gaps.map(q => {
              const selectedIdx = answers[q.id]
              const selectedOpt = q.options[selectedIdx]
              return (
                <div key={q.id} style={{
                  background: '#fef3ee',
                  border: '1px solid #f9c5a1',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#d85a30', flexShrink: 0, marginTop: 5,
                  }} />
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: '#0f1f3d', marginBottom: 2,
                    }}>
                      {q.question}
                    </div>
                    <div style={{ fontSize: 12, color: '#718096' }}>
                      Your answer: {selectedOpt?.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showCapture && !emailSent && (
        <div style={{
          background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3460 100%)',
          borderRadius: 12,
          padding: '28px',
          marginBottom: 24,
          border: '1px solid rgba(201,168,76,0.3)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
            color: '#c9a84c', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Save your results
          </div>
          <h3 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 18, color: 'white', marginBottom: 8,
          }}>
            Get your personalized action checklist
          </h3>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.6, marginBottom: 18,
          }}>
            We&apos;ll email you a prioritized checklist based on your gaps —
            formatted to share with your attorney or advisor.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmailCapture()}
              style={{
                flex: '1 1 200px',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1.5px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'DM Sans, system-ui, sans-serif',
              }}
            />
            <button
              onClick={handleEmailCapture}
              style={{
                padding: '10px 20px',
                background: '#c9a84c', color: '#0f1f3d',
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Send my checklist
            </button>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={getSignupHref({ redirectTo: `/event/${event.slug}` })} style={{
              fontSize: 12, color: '#c9a84c', textDecoration: 'none',
            }}>
              Create a free account to save your score →
            </a>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>or</span>
            <a href={`/login?redirectTo=/event/${event.slug}/assess`} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none',
            }}>
              Sign in
            </a>
          </div>
        </div>
      )}

      {emailSent && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          fontSize: 13, color: '#16a34a',
        }}>
          ✓ Checklist sent — check your inbox.
        </div>
      )}

      {saved && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          fontSize: 13, color: '#16a34a',
        }}>
          ✓ Results saved to your account.
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        <a href={`/event/${event.slug}`} style={{
          display: 'block',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '18px 20px',
          textDecoration: 'none',
        }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>📋</div>
          <div style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 15, color: '#0f1f3d', marginBottom: 4,
          }}>
            See your action plan
          </div>
          <div style={{ fontSize: 12, color: '#718096', lineHeight: 1.5 }}>
            Review the prioritized steps for {event.shortTitle.toLowerCase()}.
          </div>
        </a>

        <a href="/assess" style={{
          display: 'block',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '18px 20px',
          textDecoration: 'none',
        }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>
          <div style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 15, color: '#0f1f3d', marginBottom: 4,
          }}>
            Full planning assessment
          </div>
          <div style={{ fontSize: 12, color: '#718096', lineHeight: 1.5 }}>
            20 questions across financial, retirement, and estate planning.
          </div>
        </a>

        <a href={getSignupHref()} style={{
          display: 'block',
          background: '#0f1f3d',
          borderRadius: 10,
          padding: '18px 20px',
          textDecoration: 'none',
        }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🗂️</div>
          <div style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 15, color: 'white', marginBottom: 4,
          }}>
            Build my plan
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            Start your estate and financial plan — free for 3 days.
          </div>
        </a>
      </div>

      {(event.advisorCTA || event.attorneyCTA) && (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '20px',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#718096',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: 12,
          }}>
            Get professional help
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {event.attorneyCTA && (
              <a href="/find-attorney" style={{
                padding: '9px 18px',
                background: '#0f1f3d', color: 'white',
                borderRadius: 7, fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}>
                ⚖️ Find an estate attorney →
              </a>
            )}
            {event.advisorCTA && (
              <a href="/find-advisor" style={{
                padding: '9px 18px',
                background: '#4a7c6f', color: 'white',
                borderRadius: 7, fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}>
                🤝 Find a financial advisor →
              </a>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={onRetake}
          style={{
            background: 'none', border: 'none',
            fontSize: 12, color: '#718096',
            cursor: 'pointer', textDecoration: 'underline',
            fontFamily: 'DM Sans, system-ui, sans-serif',
          }}
        >
          ↺ Retake assessment
        </button>
      </div>
    </div>
  )
}

export default function EventAssessPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const event = getEventContent(slug)

  const [screen, setScreen] = useState<'questions' | 'results'>('questions')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})

  if (!event) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'DM Sans, system-ui, sans-serif',
      }}>
        <p style={{ color: '#718096' }}>Assessment not found.</p>
      </div>
    )
  }

  const questions = event.assessmentQuestions
  const q = questions[current]
  const selectedIndex = answers[q?.id]
  const hasAnswer = selectedIndex !== undefined
  const progressPct = Math.round(((current + 1) / questions.length) * 100)

  function selectOption(qId: string, idx: number) {
    setAnswers(prev => ({ ...prev, [qId]: idx }))
  }

  function next() {
    if (!hasAnswer) return
    if (current === 0) {
      import('@/lib/analytics/useFunnelEvent').then(({ captureFunnelEvent }) => {
        captureFunnelEvent({
          event_name: 'event_assess_start',
          event_slug: slug,
        })
      })
    }
    if (current === questions.length - 1) {
      setScreen('results')
      import('@/lib/analytics/useFunnelEvent').then(({ captureFunnelEvent }) => {
        captureFunnelEvent({
          event_name: 'event_assess_complete',
          event_slug: slug,
        })
      })
    } else {
      setCurrent(c => c + 1)
      window.scrollTo(0, 0)
    }
  }

  function prev() {
    if (current > 0) {
      setCurrent(c => c - 1)
      window.scrollTo(0, 0)
    }
  }

  function retake() {
    setAnswers({})
    setCurrent(0)
    setScreen('questions')
    window.scrollTo(0, 0)
  }

  const totalScore = screen === 'results'
    ? questions.reduce((sum, q) => {
        const idx = answers[q.id]
        return sum + (idx !== undefined ? q.options[idx].score : 0)
      }, 0)
    : 0

  return (
    <main style={{
      fontFamily: 'DM Sans, system-ui, sans-serif',
      background: '#fafaf8',
      minHeight: '100vh',
    }}>

      <div style={{
        background: '#1a3460',
        borderLeft: '4px solid #c9a84c',
        padding: '10px 32px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
      }}>
        Your score is calculated from your answers and reflects real planning gaps for this life event.
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>

        <div style={{ marginBottom: 32 }}>
          <a href={`/event/${event.slug}`} style={{
            fontSize: 12, color: '#718096', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginBottom: 16,
          }}>
            ← Back to {event.shortTitle}
          </a>
          <h1 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 24, color: '#0f1f3d', marginBottom: 6,
          }}>
            {event.shortTitle} Readiness Assessment
          </h1>
          <p style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
            {questions.length} questions · 2 minutes ·
            Personalized score with specific gaps identified
          </p>
        </div>

        {screen === 'questions' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 11, color: '#718096', marginBottom: 8,
              }}>
                <span>{current + 1} of {questions.length}</span>
                <span>{progressPct}% complete</span>
              </div>
              <div style={{
                background: '#e2e8f0', borderRadius: 40,
                height: 6, overflow: 'hidden',
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #c9a84c, #6aab9a)',
                  height: '100%', borderRadius: 40,
                  width: `${progressPct}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <QuestionCard
              question={q}
              qIndex={current}
              total={questions.length}
              selectedIndex={selectedIndex}
              onSelect={idx => selectOption(q.id, idx)}
            />

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 20,
            }}>
              <button
                onClick={prev}
                disabled={current === 0}
                style={{
                  background: 'transparent', color: '#0f1f3d',
                  border: '1.5px solid #cbd5e0',
                  borderRadius: 8, padding: '9px 20px',
                  fontSize: 13, fontWeight: 500,
                  cursor: current === 0 ? 'not-allowed' : 'pointer',
                  opacity: current === 0 ? 0.4 : 1,
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                }}
              >
                ← Previous
              </button>
              <button
                onClick={next}
                disabled={!hasAnswer}
                style={{
                  background: '#0f1f3d', color: 'white',
                  border: 'none', borderRadius: 8,
                  padding: '9px 24px',
                  fontSize: 13, fontWeight: 500,
                  cursor: hasAnswer ? 'pointer' : 'not-allowed',
                  opacity: hasAnswer ? 1 : 0.4,
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                }}
              >
                {current === questions.length - 1 ? 'See my results →' : 'Next →'}
              </button>
            </div>
          </>
        )}

        {screen === 'results' && (
          <ResultsScreen
            event={event}
            score={totalScore}
            answers={answers}
            onRetake={retake}
          />
        )}
      </div>
    </main>
  )
}
