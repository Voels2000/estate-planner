'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const QUESTIONS = [
  {
    id: 'f1', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'Do you have an emergency fund covering 3–6 months of living expenses?',
    sub: 'An emergency fund is the foundation of financial stability.',
    options: [
      { label: 'Yes, fully funded (3+ months)', hint: 'Liquid savings in a separate account', score: 3 },
      { label: 'Partially — 1–2 months saved', hint: 'Started but not yet complete', score: 2 },
      { label: 'Working on it — less than 1 month', hint: 'Some savings but not designated', score: 1 },
      { label: 'No emergency fund in place', hint: 'No dedicated reserve currently', score: 0 },
    ],
  },
  {
    id: 'f2', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'Do you have adequate life insurance coverage for your dependents?',
    sub: 'Life insurance replaces lost income and protects those who rely on your earnings.',
    options: [
      { label: 'Yes — reviewed within the last 2 years', hint: 'Coverage aligned with current needs', score: 3 },
      { label: 'Yes, but not reviewed recently', hint: 'Coverage may be outdated', score: 2 },
      { label: 'Some coverage through work only', hint: 'Employer coverage alone is often insufficient', score: 1 },
      { label: 'No life insurance or dependents', hint: 'May not apply to your situation', score: 2 },
    ],
  },
  {
    id: 'f3', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'Do you have disability insurance to replace your income if you cannot work?',
    sub: 'Disability is far more common than death during working years.',
    options: [
      { label: 'Yes — long-term disability coverage in place', hint: 'Covers 60%+ of income for extended periods', score: 3 },
      { label: 'Short-term only through employer', hint: 'Gap exists for extended disabilities', score: 2 },
      { label: 'I rely on workers\' comp / Social Security', hint: 'These typically provide limited coverage', score: 1 },
      { label: 'No disability coverage', hint: 'Significant income risk if unable to work', score: 0 },
    ],
  },
  {
    id: 'f4', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'Are you actively contributing to tax-advantaged retirement or investment accounts?',
    sub: 'Consistent contributions — especially those capturing employer matches — are central to building long-term wealth.',
    options: [
      { label: 'Yes — maximizing or near-maximizing contributions', hint: 'Contributing at or near the IRS annual limit', score: 3 },
      { label: 'Contributing, including full employer match', hint: 'Taking full advantage of employer match', score: 3 },
      { label: 'Contributing but not capturing full match', hint: 'Leaving some tax-advantaged growth on the table', score: 1 },
      { label: 'Not currently contributing to any accounts', hint: 'No active retirement or investment contributions', score: 0 },
    ],
  },
  {
    id: 'f5', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'How would you describe your current debt situation?',
    sub: 'High-interest debt can significantly impair long-term wealth building.',
    options: [
      { label: 'Mortgage only — all other debt paid off', hint: 'Strong debt position', score: 3 },
      { label: 'Manageable — tracking and paying down actively', hint: 'Under control with a clear plan', score: 2 },
      { label: 'Significant — carrying high-interest balances', hint: 'Credit cards or personal loans at high rates', score: 1 },
      { label: 'Struggling — payments are difficult to manage', hint: 'Cash flow is constrained by debt obligations', score: 0 },
    ],
  },
  {
    id: 'f6', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'Do you have a written financial plan or work with a financial advisor?',
    sub: 'A documented plan with professional oversight dramatically improves financial outcomes.',
    options: [
      { label: 'Yes — active relationship with a CFP® advisor', hint: 'Comprehensive plan reviewed regularly', score: 3 },
      { label: 'I have a plan but no active advisor', hint: 'Self-directed with some structure', score: 2 },
      { label: 'No formal plan but I track finances', hint: 'Informal approach with budget awareness', score: 1 },
      { label: 'No plan and no advisor', hint: 'Common but fixable starting point', score: 0 },
    ],
  },
  {
    id: 'f7', pillar: 'financial', pillarLabel: 'Financial Planning',
    text: 'Do you have adequate property and liability insurance?',
    sub: 'Insurance is the first layer of asset protection.',
    options: [
      { label: 'Yes — all reviewed and appropriate coverage', hint: 'Including umbrella liability policy', score: 3 },
      { label: 'Basic coverage in place, not recently reviewed', hint: 'May have gaps not yet identified', score: 2 },
      { label: 'Minimum required coverage only', hint: 'Underinsured for asset protection purposes', score: 1 },
      { label: 'Unsure what coverage I have', hint: 'Coverage audit would be beneficial', score: 0 },
    ],
  },
  {
    id: 'r1', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'Do you know your estimated Social Security benefit and have you thought about when to claim?',
    sub: 'Social Security claiming decisions can affect lifetime income significantly.',
    options: [
      { label: 'Yes — reviewed my ssa.gov statement and explored timing', hint: 'Informed and strategically aware', score: 3 },
      { label: 'I\'ve checked my statement but haven\'t thought about timing', hint: 'Aware but not yet strategic', score: 2 },
      { label: 'I haven\'t looked at my Social Security statement', hint: 'Worth doing today at my.ssa.gov', score: 1 },
      { label: 'I don\'t expect to rely on Social Security', hint: 'May still be worth understanding', score: 1 },
    ],
  },
  {
    id: 'r2', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'Do you have a clear target for how much you\'ll need in retirement?',
    sub: 'Without a target, it\'s impossible to know if you\'re on track.',
    options: [
      { label: 'Yes — professionally modeled with specific projections', hint: 'Detailed plan with income and expense analysis', score: 3 },
      { label: 'Yes — I\'ve estimated using online calculators', hint: 'General idea but not professionally validated', score: 2 },
      { label: 'Rough idea but haven\'t done the math', hint: 'Intuition without analysis', score: 1 },
      { label: 'I haven\'t thought about a specific number', hint: 'High-priority planning gap', score: 0 },
    ],
  },
  {
    id: 'r3', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'Do you understand Medicare — enrollment windows, parts, and gaps in coverage?',
    sub: 'Missing Medicare enrollment windows can result in permanent premium penalties.',
    options: [
      { label: 'Yes — I understand Parts A, B, C, D and enrollment rules', hint: 'Prepared for healthcare in retirement', score: 3 },
      { label: 'General understanding — would benefit from more detail', hint: 'Know the basics but have gaps', score: 2 },
      { label: 'Limited knowledge — haven\'t researched it yet', hint: 'Important to understand before 65', score: 1 },
      { label: 'I have no idea how Medicare works', hint: 'A significant retirement planning gap', score: 0 },
    ],
  },
  {
    id: 'r4', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'Have you planned for potential long-term care costs in retirement?',
    sub: 'Long-term care can cost $90,000+ per year. Medicare does not cover custodial care.',
    options: [
      { label: 'Yes — long-term care insurance or hybrid product in place', hint: 'Financial protection against extended care costs', score: 3 },
      { label: 'Planning to self-fund — have significant assets', hint: 'Viable strategy for high-net-worth households', score: 2 },
      { label: 'Aware of the risk but haven\'t taken action', hint: 'Gap that warrants professional discussion', score: 1 },
      { label: 'Haven\'t thought about long-term care', hint: 'Very common and very costly gap', score: 0 },
    ],
  },
  {
    id: 'r5', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'Do you understand Required Minimum Distributions (RMDs) and their tax implications?',
    sub: 'RMDs begin at age 73 and are taxable income.',
    options: [
      { label: 'Yes — I understand RMDs and have planned around them', hint: 'Tax-aware retirement income strategy in place', score: 3 },
      { label: 'I know what they are but haven\'t planned for them', hint: 'Awareness without strategy', score: 2 },
      { label: 'I\'ve heard the term but don\'t fully understand', hint: 'Worth learning before retirement', score: 1 },
      { label: 'Not familiar with RMDs at all', hint: 'Important to understand — applies to most retirees', score: 0 },
    ],
  },
  {
    id: 'r6', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'Do you have a strategy for which accounts to draw from first in retirement?',
    sub: 'Withdrawal sequencing affects taxes, RMDs, Medicare premiums, and longevity of your money.',
    options: [
      { label: 'Yes — a coordinated withdrawal strategy with my advisor', hint: 'Optimized for taxes, RMDs, and longevity', score: 3 },
      { label: 'I have a general idea but no formal strategy', hint: 'Intuition-based without modeling', score: 2 },
      { label: 'I plan to figure it out when I retire', hint: 'Sequencing decisions benefit from early planning', score: 1 },
      { label: 'I haven\'t thought about withdrawal order', hint: 'High-impact planning area', score: 0 },
    ],
  },
  {
    id: 'r7', pillar: 'retirement', pillarLabel: 'Retirement Planning',
    text: 'If married or partnered, have you coordinated retirement planning with your spouse?',
    sub: 'Spousal benefit coordination can significantly affect combined lifetime income.',
    options: [
      { label: 'Yes — coordinated together with professional help', hint: 'Joint strategy optimized for both', score: 3 },
      { label: 'We\'ve discussed it but not formally coordinated', hint: 'Aligned in direction, not yet in detail', score: 2 },
      { label: 'We haven\'t coordinated our retirement plans', hint: 'Gap that can be costly over time', score: 1 },
      { label: 'Not applicable — single or widowed', hint: 'Individual planning applies', score: 3 },
    ],
  },
  {
    id: 'e1', pillar: 'estate', pillarLabel: 'Estate Planning',
    text: 'Do you have a current, legally valid will or living trust?',
    sub: 'Without a will, state law determines who receives your assets.',
    options: [
      { label: 'Yes — reviewed or created within the last 3 years', hint: 'Current and likely still reflective of your wishes', score: 3 },
      { label: 'Yes — but it\'s more than 5 years old', hint: 'May need updating after life changes', score: 2 },
      { label: 'Started but never completed', hint: 'An incomplete will may not be valid', score: 1 },
      { label: 'No will or trust in place', hint: 'High-priority estate planning gap', score: 0 },
    ],
  },
  {
    id: 'e2', pillar: 'estate', pillarLabel: 'Estate Planning',
    text: 'Do you have a Durable Power of Attorney and Healthcare Directive in place?',
    sub: 'These determine who makes decisions for you if you\'re incapacitated.',
    options: [
      { label: 'Yes — both financial POA and healthcare directive', hint: 'Incapacity planning complete', score: 3 },
      { label: 'One but not both', hint: 'Partial incapacity planning coverage', score: 2 },
      { label: 'Had them once but not sure if current', hint: 'May not reflect current wishes', score: 1 },
      { label: 'Neither in place', hint: 'Urgent gap — anyone can become incapacitated', score: 0 },
    ],
  },
  {
    id: 'e3', pillar: 'estate', pillarLabel: 'Estate Planning',
    text: 'Have you reviewed your beneficiary designations in the last 3 years?',
    sub: 'Beneficiary designations override your will. Outdated designations are one of the most common estate planning mistakes.',
    options: [
      { label: 'Yes — reviewed and confirmed current', hint: 'Aligned with current estate plan', score: 3 },
      { label: 'Reviewed more than 3 years ago', hint: 'Life changes since then may require updates', score: 2 },
      { label: 'Set them up once but never reviewed', hint: 'Significant risk if circumstances have changed', score: 1 },
      { label: 'Not sure what my designations say', hint: 'Immediate review recommended', score: 0 },
    ],
  },
  {
    id: 'e4', pillar: 'estate', pillarLabel: 'Estate Planning',
    text: 'Do you understand what would go through probate and have you taken steps to minimize it?',
    sub: 'Probate is public, slow, and costly.',
    options: [
      { label: 'Yes — plan in place to minimize probate exposure', hint: 'Trust, TOD/POD, and beneficiary designations coordinated', score: 3 },
      { label: 'I understand probate but haven\'t fully addressed it', hint: 'Awareness without implementation', score: 2 },
      { label: 'Limited understanding of probate', hint: 'Worth learning — it affects most estates', score: 1 },
      { label: 'Not familiar with probate at all', hint: 'Foundational estate planning knowledge gap', score: 0 },
    ],
  },
  {
    id: 'e5', pillar: 'estate', pillarLabel: 'Estate Planning',
    text: 'If you have minor children, have you named a guardian in a legally valid will?',
    sub: 'Without a named guardian, a court decides who raises your children.',
    options: [
      { label: 'Yes — named in a current, valid will', hint: 'Guardian designation is legally documented', score: 3 },
      { label: 'Named in an old or potentially invalid document', hint: 'Should be reviewed for validity', score: 2 },
      { label: 'No guardian named — haven\'t gotten around to it', hint: 'High-priority gap for parents of minors', score: 0 },
      { label: 'No minor children — not applicable', hint: 'Not required for your situation', score: 3 },
    ],
  },
  {
    id: 'e6', pillar: 'estate', pillarLabel: 'Estate Planning',
    text: 'Have you documented your digital assets and important documents for your heirs?',
    sub: 'Digital assets can be permanently lost without proper documentation.',
    options: [
      { label: 'Yes — everything documented and securely accessible', hint: 'Heirs can locate and access all assets', score: 3 },
      { label: 'Partially — some documents organized but not complete', hint: 'Gaps exist that could cause problems', score: 2 },
      { label: 'Not organized but planning to', hint: 'Valuable step that is often deferred', score: 1 },
      { label: 'Nothing organized or documented', hint: 'Assets at risk of being lost or inaccessible', score: 0 },
    ],
  },
]

const MAX_SCORES = { financial: 21, retirement: 21, estate: 18 }

function getLevel(pct: number) {
  if (pct >= 80) return { label: 'Strong', color: '#4a7c6f', bg: '#eef6f4' }
  if (pct >= 60) return { label: 'Developing', color: '#ba7517', bg: '#faeeda' }
  if (pct >= 40) return { label: 'Needs Attention', color: '#c9a84c', bg: '#fdf6e3' }
  return { label: 'Action Required', color: '#d85a30', bg: '#fef3ee' }
}

type Answers = Record<string, number>

export default function AssessPage() {
  const [screen, setScreen] = useState<'intro' | 'questions' | 'results'>('intro')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})

  useEffect(() => {
    if (screen !== 'results') return
    const { financial, retirement, estate } = computeScores()
    const fp = Math.round((financial / MAX_SCORES.financial) * 100)
    const rp = Math.round((retirement / MAX_SCORES.retirement) * 100)
    const ep = Math.round((estate / MAX_SCORES.estate) * 100)
    const overall = Math.round(
      ((financial + retirement + estate) /
      (MAX_SCORES.financial + MAX_SCORES.retirement + MAX_SCORES.estate)) * 100
    )
    saveResults(fp, rp, ep, overall, answers)
  }, [screen])

  function selectOption(qId: string, optionIndex: number) {
    setAnswers(prev => ({ ...prev, [qId]: optionIndex }))
  }

  function nextQ() {
    const q = QUESTIONS[current]
    if (answers[q.id] === undefined) return
    if (current === QUESTIONS.length - 1) {
      setScreen('results')
    } else {
      setCurrent(c => c + 1)
      window.scrollTo(0, 0)
    }
  }

  function prevQ() {
    if (current > 0) {
      setCurrent(c => c - 1)
      window.scrollTo(0, 0)
    }
  }

  function retake() {
    setAnswers({})
    setCurrent(0)
    setScreen('intro')
    window.scrollTo(0, 0)
  }

  function computeScores() {
    const raw: Record<string, number> = {}
    QUESTIONS.forEach(q => {
      const idx = answers[q.id]
      raw[q.id] = idx !== undefined ? q.options[idx].score : 0
    })
    const financial = ['f1','f2','f3','f4','f5','f6','f7']
      .reduce((a, k) => a + (raw[k] || 0), 0)
    const retirement = ['r1','r2','r3','r4','r5','r6','r7']
      .reduce((a, k) => a + (raw[k] || 0), 0)
    const estate = ['e1','e2','e3','e4','e5','e6']
      .reduce((a, k) => a + (raw[k] || 0), 0)
    return { financial, retirement, estate, raw }
  }

  async function saveResults(
    fp: number, rp: number, ep: number,
    overall: number, answers: Answers
  ) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return // Not logged in — skip silently

      await supabase.from('assessment_results').insert({
        user_id: user.id,
        overall_score: overall,
        financial_score: fp,
        retirement_score: rp,
        estate_score: ep,
        financial_pct: fp,
        retirement_pct: rp,
        estate_pct: ep,
        answers: answers,
      })
    } catch {
      // Fail silently — don't interrupt the user experience
    }
  }

  const q = QUESTIONS[current]
  const pct = Math.round(((current + 1) / QUESTIONS.length) * 100)
  const hasAnswer = answers[q?.id] !== undefined

  // ── INTRO ──
  if (screen === 'intro') {
    return (
      <main style={{
        fontFamily: 'var(--font-body, DM Sans, system-ui)',
        background: 'var(--mwm-off-white, #fafaf8)',
        minHeight: '100vh',
      }}>
        {/* Nav */}
        <nav style={{
          background: 'var(--mwm-navy, #0f1f3d)',
          padding: '14px 32px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              background: 'var(--mwm-gold, #c9a84c)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
              fontWeight: 600, fontSize: 16,
              color: 'var(--mwm-navy, #0f1f3d)',
            }}>M</div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
                fontSize: 17, fontWeight: 500, color: 'white', lineHeight: 1.2,
              }}>My Wealth Maps</div>
              <div style={{
                fontSize: 10, color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.5px', textTransform: 'uppercase',
              }}>Planning Readiness Assessment</div>
            </div>
          </div>
          <Link href="/dashboard" style={{
            color: 'rgba(255,255,255,0.6)', fontSize: 12,
            textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.2)',
            padding: '6px 14px', borderRadius: 6, transition: 'all 0.2s',
          }}>← Back to Home</Link>
        </nav>

        {/* Disclaimer */}
        <div style={{
          background: '#1a3460', borderLeft: '4px solid #c9a84c',
          padding: '11px 32px', fontSize: 11,
          color: 'rgba(255,255,255,0.65)', lineHeight: 1.5,
        }}>
          <span style={{ color: '#c9a84c', fontWeight: 500 }}>Educational tool only.</span>
          {' '}This assessment does not constitute financial, legal, or tax advice.
          Results are for self-awareness purposes only.
        </div>

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(150deg, #0f1f3d 0%, #1a3460 55%, #2a4a7f 100%)',
          padding: '52px 32px 44px', textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(201,168,76,0.15)',
            border: '1px solid rgba(201,168,76,0.35)',
            color: '#e8c97a', fontSize: 10, fontWeight: 500,
            padding: '5px 16px', borderRadius: 40, marginBottom: 20,
            textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>✦ 3-Pillar Assessment</div>
          <h1 style={{
            fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
            fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 500,
            color: 'white', lineHeight: 1.2, marginBottom: 14,
          }}>
            Discover Your{' '}
            <span style={{ color: '#c9a84c' }}>Planning Readiness</span>
          </h1>
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.65)',
            maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7,
          }}>
            20 questions. 8 minutes. A clear picture of where your financial,
            retirement, and estate planning stands today.
          </p>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            {[
              '20 guided questions',
              '3 pillar scores',
              'Personalized gap report',
              'Advisor prep sheet',
            ].map(item => (
              <div key={item} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: 'rgba(255,255,255,0.55)', fontSize: 12,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6aab9a' }} />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Intro cards + start */}
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16, marginBottom: 32,
          }}>
            {[
              { icon: '💰', title: 'Financial Readiness', desc: 'Cash flow, insurance, debt, investment accounts, and protection basics' },
              { icon: '🏖️', title: 'Retirement Readiness', desc: 'Social Security, Medicare, LTC, RMDs, and income strategy' },
              { icon: '📜', title: 'Estate Readiness', desc: 'Will, POA, beneficiary designations, probate, and digital assets' },
            ].map(card => (
              <div key={card.title} style={{
                background: 'white', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: 20,
                boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
              }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{card.icon}</div>
                <div style={{
                  fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
                  fontSize: 14, fontWeight: 500, color: '#0f1f3d', marginBottom: 6,
                }}>{card.title}</div>
                <div style={{ fontSize: 12, color: '#718096', lineHeight: 1.5 }}>{card.desc}</div>
              </div>
            ))}
          </div>

          <div style={{
            background: '#fdf6e3', border: '1px solid #e8c97a',
            borderRadius: 8, padding: '14px 18px',
            marginBottom: 28, fontSize: 12, color: '#7a5a00', lineHeight: 1.55,
          }}>
            📋 <strong>How your answers are used:</strong> Your responses generate
            your personalized readiness report within this session.
            This tool helps identify planning areas to discuss with
            licensed professionals — it does not assess the quality
            of any existing plan or provide advice.
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setScreen('questions')}
              style={{
                background: '#0f1f3d', color: 'white',
                border: 'none', borderRadius: 8,
                padding: '14px 40px', fontSize: 16, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-body, DM Sans, system-ui)',
              }}
            >
              Begin My Assessment →
            </button>
            <div style={{ fontSize: 12, color: '#718096', marginTop: 12 }}>
              Takes about 8 minutes · You can go back at any time
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── QUESTIONS ──
  if (screen === 'questions') {
    const pillarColors: Record<string, string> = {
      financial: '#0f1f3d',
      retirement: '#c9a84c',
      estate: '#4a7c6f',
    }
    const pillarBgs: Record<string, string> = {
      financial: '#e6edf8',
      retirement: '#fdf6e3',
      estate: '#eef6f4',
    }

    return (
      <main style={{
        fontFamily: 'var(--font-body, DM Sans, system-ui)',
        background: 'var(--mwm-off-white, #fafaf8)',
        minHeight: '100vh',
      }}>
        {/* Nav */}
        <nav style={{
          background: '#0f1f3d', padding: '14px 32px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: '#c9a84c',
              borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Playfair Display, Georgia, serif',
              fontWeight: 600, fontSize: 16, color: '#0f1f3d',
            }}>M</div>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 17, fontWeight: 500, color: 'white',
            }}>My Wealth Maps</div>
          </div>
          <button onClick={retake} style={{
            color: 'rgba(255,255,255,0.6)', fontSize: 12, background: 'none',
            border: '1.5px solid rgba(255,255,255,0.2)',
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
          }}>✕ Start Over</button>
        </nav>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 80px' }}>
          {/* Progress */}
          <div style={{
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '20px 24px',
            marginBottom: 20, boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 10, fontSize: 13,
            }}>
              <span style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                color: '#0f1f3d', fontWeight: 500,
              }}>{q.pillarLabel}</span>
              <span style={{ color: '#718096' }}>
                Question {current + 1} of {QUESTIONS.length}
              </span>
            </div>
            <div style={{
              background: '#e2e8f0', borderRadius: 40,
              height: 7, overflow: 'hidden', marginBottom: 10,
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #c9a84c, #6aab9a)',
                height: '100%', borderRadius: 40,
                width: `${pct}%`, transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['financial', 'retirement', 'estate'] as const).map(p => {
                const isActive = q.pillar === p
                const isDone = (
                  p === 'financial' ? current >= 7 :
                  p === 'retirement' ? current >= 14 : false
                )
                return (
                  <div key={p} style={{
                    flex: 1, textAlign: 'center',
                    fontSize: 11, fontWeight: 500,
                    padding: '4px 6px', borderRadius: 6,
                    background: isDone ? '#eef6f4' : isActive ? '#0f1f3d' : '#f7f8fa',
                    color: isDone ? '#4a7c6f' : isActive ? 'white' : '#718096',
                    border: `1px solid ${isDone ? '#4a7c6f' : isActive ? '#0f1f3d' : '#e2e8f0'}`,
                    transition: 'all 0.3s',
                  }}>
                    {p === 'financial' ? '💰 Financial' :
                     p === 'retirement' ? '🏖️ Retirement' : '📜 Estate'}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Question card */}
          <div style={{
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: 32,
            boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
            marginBottom: 16,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 500,
              padding: '4px 12px', borderRadius: 40,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginBottom: 14,
              background: pillarBgs[q.pillar],
              color: pillarColors[q.pillar],
            }}>
              {q.pillarLabel}
            </div>
            <div style={{ fontSize: 11, color: '#718096', marginBottom: 8 }}>
              Question {current + 1} of {QUESTIONS.length}
            </div>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 20, color: '#0f1f3d',
              lineHeight: 1.3, marginBottom: 8,
            }}>{q.text}</h2>
            <p style={{
              fontSize: 13, color: '#718096',
              marginBottom: 22, lineHeight: 1.5,
            }}>{q.sub}</p>

            <div style={{ display: 'grid', gap: 10 }}>
              {q.options.map((opt, i) => {
                const selected = answers[q.id] === i
                return (
                  <div
                    key={i}
                    onClick={() => selectOption(q.id, i)}
                    style={{
                      border: `2px solid ${selected ? '#0f1f3d' : '#e2e8f0'}`,
                      borderRadius: 8,
                      padding: '16px 18px',
                      cursor: 'pointer',
                      background: selected ? '#0f1f3d' : '#fafaf8',
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      transition: 'all 0.2s',
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
                        marginBottom: 2,
                      }}>{opt.label}</div>
                      <div style={{
                        fontSize: 12,
                        color: selected ? 'rgba(255,255,255,0.6)' : '#718096',
                        lineHeight: 1.4,
                      }}>{opt.hint}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Nav buttons */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <button
              onClick={prevQ}
              disabled={current === 0}
              style={{
                background: 'transparent', color: '#0f1f3d',
                border: '1.5px solid #cbd5e0',
                borderRadius: 8, padding: '8px 18px',
                fontSize: 13, fontWeight: 500,
                cursor: current === 0 ? 'not-allowed' : 'pointer',
                opacity: current === 0 ? 0.4 : 1,
                fontFamily: 'var(--font-body, DM Sans, system-ui)',
              }}
            >← Previous</button>
            <button
              onClick={nextQ}
              disabled={!hasAnswer}
              style={{
                background: '#0f1f3d', color: 'white',
                border: 'none', borderRadius: 8,
                padding: '8px 24px', fontSize: 13, fontWeight: 500,
                cursor: hasAnswer ? 'pointer' : 'not-allowed',
                opacity: hasAnswer ? 1 : 0.4,
                fontFamily: 'var(--font-body, DM Sans, system-ui)',
              }}
            >
              {current === QUESTIONS.length - 1 ? 'See My Results →' : 'Next →'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── RESULTS ──
  const { financial, retirement, estate } = computeScores()
  const fp = Math.round((financial / MAX_SCORES.financial) * 100)
  const rp = Math.round((retirement / MAX_SCORES.retirement) * 100)
  const ep = Math.round((estate / MAX_SCORES.estate) * 100)
  const overall = Math.round(((financial + retirement + estate) /
    (MAX_SCORES.financial + MAX_SCORES.retirement + MAX_SCORES.estate)) * 100)

  const level = getLevel(overall)
  const fl = getLevel(fp)
  const rl = getLevel(rp)
  const el = getLevel(ep)

  return (
    <main style={{
      fontFamily: 'var(--font-body, DM Sans, system-ui)',
      background: '#fafaf8', minHeight: '100vh',
    }}>
      {/* Nav */}
      <nav style={{
        background: '#0f1f3d', padding: '14px 32px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: '#c9a84c',
            borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, Georgia, serif',
            fontWeight: 600, fontSize: 16, color: '#0f1f3d',
          }}>M</div>
          <div style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 17, fontWeight: 500, color: 'white',
          }}>My Wealth Maps</div>
        </div>
        <button onClick={retake} style={{
          color: 'rgba(255,255,255,0.6)', fontSize: 12,
          background: 'none', border: '1.5px solid rgba(255,255,255,0.2)',
          padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
        }}>↺ Retake Assessment</button>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Overall score */}
        <div style={{
          background: 'linear-gradient(135deg, #0f1f3d 0%, #2a4a7f 100%)',
          borderRadius: 12, padding: '36px 32px',
          marginBottom: 24, color: 'white',
          display: 'flex', alignItems: 'center',
          gap: 32, flexWrap: 'wrap',
          boxShadow: '0 8px 40px rgba(15,31,61,0.14)',
        }}>
          <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none"
                stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none"
                stroke={level.color} strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - overall / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)" />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                fontSize: 30, fontWeight: 600, color: 'white', lineHeight: 1,
              }}>{overall}%</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                OVERALL
              </div>
            </div>
          </div>
          <div>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 26, marginBottom: 8,
            }}>Your Planning Readiness Score</h2>
            <p style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 14, lineHeight: 1.65, maxWidth: 400,
              marginBottom: 12,
            }}>
              Assessed across financial, retirement, and estate planning.
              This score reflects your current awareness and preparation.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 40,
              fontSize: 11, fontWeight: 500,
              background: level.bg, color: level.color,
            }}>{level.label}</div>
          </div>
        </div>

        {/* Pillar scores */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>
          {[
            { label: '💰 Financial Planning', score: fp, level: fl, barColor: '#0f1f3d', note: 'Cash flow, insurance, debt, investment accounts' },
            { label: '🏖️ Retirement Planning', score: rp, level: rl, barColor: '#c9a84c', note: 'Social Security, Medicare, LTC, RMDs' },
            { label: '📜 Estate Planning', score: ep, level: el, barColor: '#4a7c6f', note: 'Will, POA, beneficiary designations, probate' },
          ].map(pillar => (
            <div key={pillar.label} style={{
              background: 'white', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 22,
              boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 4, background: pillar.barColor,
                borderRadius: '12px 12px 0 0',
              }} />
              <div style={{
                fontSize: 11, fontWeight: 500, color: '#718096',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: 8,
              }}>{pillar.label}</div>
              <div style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                fontSize: 32, color: '#0f1f3d', marginBottom: 4, lineHeight: 1,
              }}>{pillar.score}%</div>
              <div style={{
                fontSize: 12, fontWeight: 500, marginBottom: 10,
                color: pillar.level.color,
              }}>{pillar.level.label}</div>
              <div style={{
                background: '#e2e8f0', borderRadius: 40,
                height: 6, overflow: 'hidden', marginBottom: 8,
              }}>
                <div style={{
                  height: '100%', borderRadius: 40,
                  background: pillar.barColor,
                  width: `${pillar.score}%`,
                  transition: 'width 1s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#718096', lineHeight: 1.4 }}>
                {pillar.note}
              </div>
            </div>
          ))}
        </div>

        {/* Next steps */}
        <div style={{
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '24px 28px',
          marginBottom: 24,
          boxShadow: '0 4px 20px rgba(15,31,61,0.08)',
        }}>
          <h3 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 20, color: '#0f1f3d', marginBottom: 18,
          }}>Your Recommended Next Steps</h3>
          {[
            { num: 1, title: 'Review your gaps with a professional', desc: 'Share this report with your estate attorney, financial advisor, and CPA. Your gaps become the agenda for your next meeting.', cta: 'Find an Advisor →', href: '/advisor-directory' },
            { num: 2, title: 'Complete relevant education modules', desc: 'The My Wealth Maps education library has modules covering every gap identified in your assessment.', cta: 'Go to Education →', href: '/education' },
            { num: 3, title: 'Build your plan', desc: 'Use what you\'ve learned to start building your financial, retirement, and estate plan.', cta: 'Go to My Plan →', href: '/dashboard' },
          ].map(step => (
            <div key={step.num} style={{
              display: 'flex', gap: 14, padding: '14px 0',
              borderBottom: '1px solid #e2e8f0', alignItems: 'flex-start',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: '#0f1f3d', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, flexShrink: 0,
                fontFamily: 'Playfair Display, Georgia, serif',
              }}>{step.num}</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: '#0f1f3d', marginBottom: 4,
                }}>{step.title}</div>
                <div style={{
                  fontSize: 12, color: '#718096', lineHeight: 1.5, marginBottom: 8,
                }}>{step.desc}</div>
                <Link href={step.href} style={{
                  fontSize: 12, fontWeight: 500, color: '#c9a84c',
                  textDecoration: 'none',
                }}>{step.cta}</Link>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{
          background: 'linear-gradient(135deg, #0f1f3d 0%, #2a4a7f 100%)',
          borderRadius: 12, padding: '28px 32px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20, flexWrap: 'wrap',
          marginBottom: 20,
        }}>
          <div>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 20, color: 'white', marginBottom: 6,
            }}>Share with Your Advisor</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Print this report to bring to your next professional meeting.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.print()}
              style={{
                background: '#c9a84c', color: '#0f1f3d',
                border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >🖨️ Print Report</button>
            <Link href="/dashboard" style={{
              background: 'white', color: '#0f1f3d',
              border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}>📊 My Dashboard</Link>
            <Link href="/" style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: 8, padding: '10px 20px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}>🏠 Home</Link>
            <button
              onClick={retake}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: '1.5px solid rgba(255,255,255,0.25)',
                borderRadius: 8, padding: '10px 20px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >↺ Retake</button>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          background: '#fdf6e3', border: '1px solid #e8c97a',
          borderRadius: 8, padding: '14px 18px',
          fontSize: 12, color: '#7a5a00', lineHeight: 1.6,
        }}>
          <strong>Assessment Disclaimer:</strong> This Planning Readiness Assessment
          is an educational and organizational tool only. Your score and gap analysis
          are based solely on your self-reported answers and are intended to prompt
          reflection and professional conversation — not to constitute financial, legal,
          or tax advice. Always consult a licensed financial advisor, estate attorney,
          and/or CPA for guidance specific to your situation.
        </div>
      </div>
    </main>
  )
}
