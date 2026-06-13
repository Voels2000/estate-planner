'use client'

// ─────────────────────────────────────────
// Menu: Retirement Planning > Social Security
// Route: /social-security
// ─────────────────────────────────────────

import { useEffect, useState } from 'react'

type Scenario = {
  age: number
  monthly: number
  annual: number
  lifetime: number
  cumulativeByAge: { age: number; cumulative: number }[]
}

type PersonData = {
  name: string
  birthYear: number | null
  fra: number
  pia: number
  electedAge: number
  electedMonthly: number
  scenarios: Scenario[]
  deltaVsFRA: number
  spousalBenefit?: number
  spousalApplies?: boolean
  survivorBenefit?: number
}

type SSData = {
  person1: PersonData
  person2: PersonData | null
  cola: number
  recommendation: string
}

const fmtMo = (n: number) => '$' + Math.round(n).toLocaleString()
const fmtCurrency = (n: number) => '$' + Math.round(n).toLocaleString()

function computeBreakevenAge(person: PersonData): number {
  const electedScenario = person.scenarios.find(s => s.age === person.electedAge)
  const fraScenario = person.scenarios.find(s => s.age === Math.round(person.fra))
  let breakevenAge = person.electedAge + 12

  if (electedScenario && fraScenario) {
    for (const d of electedScenario.cumulativeByAge) {
      const fraPoint = fraScenario.cumulativeByAge.find(x => x.age === d.age)
      if (fraPoint && d.cumulative > fraPoint.cumulative) {
        breakevenAge = d.age
        break
      }
    }
  }

  return breakevenAge
}

function electedBadge(person: PersonData): string {
  if (person.electedAge === Math.round(person.fra)) return 'At FRA'
  if (person.electedAge > person.fra) {
    return person.electedAge >= 70 ? 'Delayed — to age 70+' : 'Delayed'
  }
  return 'Early'
}

function ScenarioTable({
  person,
  electedAge,
  breakevenAge,
  color,
}: {
  person: PersonData
  electedAge: number
  breakevenAge: number
  color: 'blue' | 'emerald'
}) {
  const electedBg = color === 'blue' ? 'bg-blue-50' : 'bg-emerald-50'
  const electedText = color === 'blue' ? 'text-blue-700' : 'text-emerald-700'
  const electedBar = color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'
  const electedMuted = color === 'blue' ? 'text-blue-600' : 'text-emerald-600'
  const checkColor = color === 'blue' ? 'text-blue-600' : 'text-emerald-600'

  return (
    <>
      <div className='mb-2'>
        <p className='text-sm font-medium text-[color:var(--mwm-navy)]'>
          {person.name} — claiming scenarios
        </p>
        <p className='text-xs text-[color:var(--mwm-text-secondary)]'>
          FRA age {person.fra} · PIA {fmtMo(person.pia)}/mo · Elected age {electedAge} = {fmtMo(person.electedMonthly)}/mo
        </p>
      </div>

      <div className='rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] overflow-hidden mb-1'>
        <table className='w-full text-xs border-collapse' style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className='border-b border-[color:var(--mwm-border)] bg-[var(--mwm-bg-muted)]'>
              <th className='px-3 py-2 text-left font-medium text-[color:var(--mwm-text-secondary)] w-[22%]'>
                Claim age
              </th>
              <th className='px-3 py-2 text-left font-medium text-[color:var(--mwm-text-secondary)] w-[28%]'>
                Lifetime benefit
              </th>
              <th className='px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)] w-[18%]'>
                Monthly
              </th>
              <th className='px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)] w-[18%]'>
                Annual
              </th>
              <th className='px-3 py-2 text-right font-medium text-[color:var(--mwm-text-secondary)] w-[14%]'>
                Lifetime
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const maxLifetime = Math.max(...person.scenarios.map(s => s.lifetime))
              return person.scenarios.map(s => {
                const isElected = s.age === electedAge
                const isFRA = s.age === Math.round(person.fra)
                const barPct = Math.round((s.lifetime / maxLifetime) * 100)
                return (
                  <tr
                    key={s.age}
                    className={[
                      'border-b border-[color:var(--mwm-border)] last:border-b-0',
                      isElected ? electedBg : '',
                    ].join(' ')}
                  >
                    <td className={`px-3 py-2 font-medium ${isElected ? electedText : 'text-[color:var(--mwm-text-primary)]'}`}>
                      {s.age}
                      {isFRA && (
                        <span className='ml-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium bg-[var(--mwm-bg-muted)] text-[color:var(--mwm-text-secondary)] border border-[color:var(--mwm-border)]'>
                          FRA
                        </span>
                      )}
                      {isElected && (
                        <i className={`ti ti-check ml-1 ${checkColor}`} aria-hidden='true' style={{ fontSize: 11 }} />
                      )}
                    </td>
                    <td className='px-3 py-2'>
                      <div className='flex items-center gap-2'>
                        <div className='h-1.5 w-14 overflow-hidden rounded-full bg-[var(--mwm-bg-muted)]'>
                          <div
                            className={`h-full rounded-full ${isElected ? electedBar : 'bg-[color:var(--mwm-text-secondary)]'}`}
                            style={{ width: `${barPct}%`, opacity: isElected ? 1 : 0.4 }}
                          />
                        </div>
                        {isElected && (
                          <span className={`text-[10px] ${electedMuted}`}>max</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${isElected ? `${electedText} font-medium` : 'text-[color:var(--mwm-text-primary)]'}`}>
                      {fmtMo(s.monthly)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${isElected ? `${electedText} font-medium` : 'text-[color:var(--mwm-text-primary)]'}`}>
                      {fmtCurrency(s.annual)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${isElected ? `${electedText} font-medium` : 'text-[color:var(--mwm-text-primary)]'}`}>
                      {fmtCurrency(s.lifetime)}
                    </td>
                  </tr>
                )
              })
            })()}
          </tbody>
        </table>
      </div>

      <p className='text-xs text-[color:var(--mwm-text-secondary)] mb-4'>
        Break-even vs FRA:{' '}
        <span className={`${electedMuted} font-medium`}>age {breakevenAge}</span>
        {' '}— delay pays off if {person.name} lives past {breakevenAge}
      </p>
    </>
  )
}

function CumulativeBreakevenChart({
  person,
  breakevenAge,
}: {
  person: PersonData
  breakevenAge: number
}) {
  const elected = person.scenarios.find(s => s.age === person.electedAge)
  const fra = person.scenarios.find(s => s.age === Math.round(person.fra))
  const early = person.scenarios.find(s => s.age === 62)
  if (!elected || !fra || !early) return null

  const chartData = elected.cumulativeByAge.filter(d => d.age >= person.electedAge)
  if (chartData.length === 0) return null

  const lookup = (scenario: Scenario) =>
    new Map(scenario.cumulativeByAge.map(d => [d.age, d.cumulative]))

  const fraLookup = lookup(fra)
  const earlyLookup = lookup(early)

  const maxVal = Math.max(
    ...chartData.map(d => d.cumulative),
    ...chartData.map(d => fraLookup.get(d.age) ?? 0),
    ...chartData.map(d => earlyLookup.get(d.age) ?? 0),
  )

  const W = 600
  const H = 200
  const PAD = { top: 10, right: 16, bottom: 28, left: 56 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const ages = chartData.map(d => d.age)
  const minAge = ages[0]
  const maxAge = ages[ages.length - 1]

  function xPos(age: number) {
    return PAD.left + ((age - minAge) / (maxAge - minAge)) * chartW
  }
  function yPos(val: number) {
    return PAD.top + chartH - (val / maxVal) * chartH
  }
  function toPath(getVal: (age: number) => number | undefined) {
    return chartData
      .map((d, i) => {
        const val = getVal(d.age)
        if (val == null) return null
        return `${i === 0 ? 'M' : 'L'} ${xPos(d.age).toFixed(1)} ${yPos(val).toFixed(1)}`
      })
      .filter(Boolean)
      .join(' ')
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(maxVal * p))
  const xTicks = ages.filter(a => a % 5 === 0)

  const legend = [
    { color: '#185FA5', dash: false, label: `Claim at ${person.electedAge} (elected)` },
    { color: '#888780', dash: true, label: `Claim at FRA (${Math.round(person.fra)})` },
    { color: '#E24B4A', dash: true, label: 'Claim at 62' },
  ]

  return (
    <div className='rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-4 mb-4'>
      <div className='flex flex-wrap items-start justify-between gap-3 mb-3'>
        <div>
          <p className='text-sm font-medium text-[color:var(--mwm-navy)]'>
            Cumulative benefit — {person.name} claiming scenarios
          </p>
          <p className='text-xs text-[color:var(--mwm-text-secondary)]'>
            Crossover shows when delay strategy wins
          </p>
        </div>
        <div className='flex flex-wrap gap-3'>
          {legend.map(l => (
            <span key={l.label} className='flex items-center gap-1.5 text-xs text-[color:var(--mwm-text-secondary)]'>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: l.dash ? 'transparent' : l.color,
                  border: l.dash ? `1px dashed ${l.color}` : 'none',
                  display: 'inline-block',
                }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className='w-full h-full'
          role='img'
          aria-label={`Cumulative Social Security benefits chart for ${person.name} showing three claiming scenarios. The elected age-${person.electedAge} line crosses above the FRA line at age ${breakevenAge}.`}
        >
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={yPos(v)}
                x2={W - PAD.right}
                y2={yPos(v)}
                stroke='rgba(0,0,0,0.04)'
                strokeWidth='1'
              />
              <text x={PAD.left - 4} y={yPos(v) + 4} textAnchor='end' fontSize='11' fill='#888'>
                {v === 0 ? '$0' : `$${Math.round(v / 1000)}K`}
              </text>
            </g>
          ))}
          {xTicks.map(a => (
            <g key={a}>
              <line
                x1={xPos(a)}
                y1={PAD.top}
                x2={xPos(a)}
                y2={H - PAD.bottom}
                stroke='rgba(0,0,0,0.04)'
                strokeWidth='1'
              />
              <text x={xPos(a)} y={H - 6} textAnchor='middle' fontSize='11' fill='#888'>
                {a}
              </text>
            </g>
          ))}
          <path
            d={toPath(age => earlyLookup.get(age))}
            fill='none'
            stroke='#E24B4A'
            strokeWidth='2'
            strokeDasharray='2 3'
          />
          <path
            d={toPath(age => fraLookup.get(age))}
            fill='none'
            stroke='#888780'
            strokeWidth='2'
            strokeDasharray='5 3'
          />
          <path
            d={toPath(age => elected.cumulativeByAge.find(x => x.age === age)?.cumulative)}
            fill='none'
            stroke='#185FA5'
            strokeWidth='2'
          />
        </svg>
      </div>
    </div>
  )
}

export function SSClient({ data: initialData }: { data: SSData | null }) {
  const [data, setData] = useState<SSData | null>(initialData)
  const [loading, setLoading] = useState(initialData === null)

  useEffect(() => {
    if (initialData !== null) return
    fetch('/api/social-security')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [initialData])

  if (loading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <p className='text-neutral-500'>Loading Social Security data...</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className='rounded-xl border border-neutral-200 p-8 text-center text-neutral-500'>
        <p className='text-lg font-medium mb-2'>No data available</p>
        <p className='text-sm'>Please complete your profile with Social Security benefit information.</p>
      </div>
    )
  }

  const { person1, person2 } = data
  const p1BreakevenAge = computeBreakevenAge(person1)
  const p2BreakevenAge = person2 ? computeBreakevenAge(person2) : null
  const combinedMonthly = person1.electedMonthly + (person2?.electedMonthly ?? 0)

  return (
    <div className='space-y-6'>

      {/* Elected hero cards */}
      <div
        className='grid gap-2 mb-4'
        style={{ display: 'grid', gridTemplateColumns: person2 ? '2fr 2fr 1fr 1fr' : '2fr 1fr', gap: 8 }}
      >
        <div className='rounded-[var(--mwm-radius)] border-2 border-blue-400 bg-white p-4'>
          <p className='text-xs text-blue-700 mb-1'>{person1.name} — elected strategy</p>
          <span className='inline-block text-[10px] font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full mb-2'>
            {electedBadge(person1)}
          </span>
          <p className='text-3xl font-medium text-blue-700 leading-none'>
            {fmtMo(person1.electedMonthly)}
            <span className='text-sm font-normal text-blue-600'>/mo</span>
          </p>
          <p className='text-xs text-blue-600 mt-1'>
            Claiming at age {person1.electedAge}
            {person1.electedAge > person1.fra
              ? ` · delayed ${Math.round(person1.electedAge - person1.fra)} yr past FRA`
              : ` · FRA age ${person1.fra}`}
          </p>
        </div>

        {person2 && (
          <div className='rounded-[var(--mwm-radius)] border-2 border-emerald-400 bg-white p-4'>
            <p className='text-xs text-emerald-700 mb-1'>{person2.name} — elected strategy</p>
            <span className='inline-block text-[10px] font-medium bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full mb-2'>
              {electedBadge(person2)}
            </span>
            <p className='text-3xl font-medium text-emerald-700 leading-none'>
              {fmtMo(person2.electedMonthly)}
              <span className='text-sm font-normal text-emerald-600'>/mo</span>
            </p>
            <p className='text-xs text-emerald-600 mt-1'>
              Claiming at age {person2.electedAge} · FRA age {person2.fra}
            </p>
          </div>
        )}

        <div className='rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3'>
          <p className='text-[10px] text-[color:var(--mwm-text-secondary)] mb-1'>{person1.name} at FRA</p>
          <p className='text-base font-medium text-[color:var(--mwm-text-primary)]'>{fmtMo(person1.pia)}</p>
          <p className='text-[10px] text-[color:var(--mwm-text-secondary)] mt-1'>Age {person1.fra} · reference</p>
        </div>

        {person2 && (
          <div className='rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3'>
            <p className='text-[10px] text-[color:var(--mwm-text-secondary)] mb-1'>{person2.name} at FRA</p>
            <p className='text-base font-medium text-[color:var(--mwm-text-primary)]'>{fmtMo(person2.pia)}</p>
            <p className='text-[10px] text-[color:var(--mwm-text-secondary)] mt-1'>Age {person2.fra} · reference</p>
          </div>
        )}
      </div>

      {/* Insight card */}
      <div className='rounded-[var(--mwm-radius)] border border-[color:var(--mwm-border)] bg-white p-4 mb-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div className='flex flex-col gap-3'>
            <div className='rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3'>
              <p className='text-xs text-[color:var(--mwm-text-secondary)] mb-1'>
                Lifetime gain from {person1.name} delaying
              </p>
              <p className='text-xl font-medium text-emerald-700'>
                {person1.deltaVsFRA >= 0 ? '+' : '−'}{fmtCurrency(Math.abs(person1.deltaVsFRA))}
              </p>
              <p className='text-xs text-[color:var(--mwm-text-secondary)] mt-1'>
                vs. claiming at FRA · to longevity · {data.cola.toFixed(1)}% COLA
              </p>
            </div>
            <div className='rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3'>
              <p className='text-xs text-[color:var(--mwm-text-secondary)] mb-1'>
                Combined monthly at full claiming
              </p>
              <p className='text-xl font-medium text-[color:var(--mwm-navy)]'>
                {fmtMo(combinedMonthly)}/mo
              </p>
              <p className='text-xs text-[color:var(--mwm-text-secondary)] mt-1'>
                {person1.name} {fmtMo(person1.electedMonthly)}
                {person2 ? ` + ${person2.name} ${fmtMo(person2.electedMonthly)}` : ''}
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            {person2 && (
              <div className='rounded-[var(--mwm-radius)] bg-blue-50 border border-blue-200 p-3'>
                <p className='text-xs text-blue-700 mb-1'>
                  Survivor benefit — if {person1.name} predeceases
                </p>
                <p className='text-xl font-medium text-blue-700'>
                  {fmtMo(person2.survivorBenefit ?? 0)}/mo
                </p>
                <p className='text-xs text-blue-600 mt-1'>
                  {person2.name} receives the higher of both benefits · maximized by delay
                </p>
              </div>
            )}
            <div className='rounded-[var(--mwm-radius)] bg-[var(--mwm-bg-muted)] p-3'>
              <p className='text-xs text-[color:var(--mwm-text-secondary)] mb-1'>
                {person1.name}&apos;s break-even age
              </p>
              <p className='text-xl font-medium text-[color:var(--mwm-navy)]'>
                Age {p1BreakevenAge}
              </p>
              <p className='text-xs text-[color:var(--mwm-text-secondary)] mt-1'>
                Delay pays off if {person1.name} lives past {p1BreakevenAge}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CumulativeBreakevenChart person={person1} breakevenAge={p1BreakevenAge} />

      <ScenarioTable
        person={person1}
        electedAge={person1.electedAge}
        breakevenAge={p1BreakevenAge}
        color='blue'
      />

      {person2 && p2BreakevenAge != null && (
        <ScenarioTable
          person={person2}
          electedAge={person2.electedAge}
          breakevenAge={p2BreakevenAge}
          color='emerald'
        />
      )}

      {person2 && (
        <div className='rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3'>
          <h2 className='font-semibold text-blue-900'>Spousal &amp; Survivor Strategy</h2>
          <div className='text-sm text-blue-800 space-y-2'>
            <p>
              <span className='font-medium'>Survivor benefit:</span>{' '}
              If {person1.name} predeceases {person2.name}, the survivor benefit would be{' '}
              <span className='font-semibold'>{fmtMo(person2.survivorBenefit ?? 0)}/mo</span>.
              {person1.electedAge >= 70 && ' Delaying to 70 maximizes this amount.'}
            </p>
            <p>
              <span className='font-medium'>Spousal benefit:</span>{' '}
              {person2.spousalApplies
                ? `${person2.name}'s spousal benefit (50% of ${person1.name}'s PIA = ${fmtMo(person2.spousalBenefit ?? 0)}/mo) exceeds her own earned benefit. Consider spousal filing strategy.`
                : `${person2.name}'s own earned benefit exceeds the spousal benefit (50% of ${person1.name}'s PIA = ${fmtMo(person2.spousalBenefit ?? 0)}/mo). Claim on own record.`
              }
            </p>
            <p>
              <span className='font-medium'>Restricted application:</span>{' '}
              Not available — both spouses were born after January 1, 1954.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
