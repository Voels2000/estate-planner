'use client'

type Scenario = {
  age: number
  monthly: number
  annual: number
  lifetime: number
  cumulativeByAge: { age: number; cumulative: number }[]
}

type PersonData = {
  name: string
  birthYear: number
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

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString()
}

function BenefitCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-neutral-50 border border-neutral-200'}`}>
      <p className='text-xs text-neutral-500 mb-1'>{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-700' : 'text-neutral-900'}`}>{value}</p>
      <p className='text-xs text-neutral-400 mt-1'>{sub}</p>
    </div>
  )
}

function ScenarioTable({ person, electedAge }: { person: PersonData; electedAge: number }) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-neutral-200'>
            <th className='text-left py-2 px-3 text-neutral-500 font-medium'>Claim age</th>
            <th className='text-right py-2 px-3 text-neutral-500 font-medium'>Monthly</th>
            <th className='text-right py-2 px-3 text-neutral-500 font-medium'>Annual</th>
            <th className='text-right py-2 px-3 text-neutral-500 font-medium'>Lifetime</th>
          </tr>
        </thead>
        <tbody>
          {person.scenarios.map(s => {
            const isElected = s.age === electedAge
            const isFRA = s.age === Math.round(person.fra)
            return (
              <tr
                key={s.age}
                className={`border-b border-neutral-100 ${isElected ? 'bg-blue-50 font-semibold text-blue-800' : 'text-neutral-700'}`}
              >
                <td className='py-2 px-3'>{s.age}{isFRA ? ' (FRA)' : ''}{isElected ? ' ✓' : ''}</td>
                <td className='py-2 px-3 text-right'>{fmt(s.monthly)}</td>
                <td className='py-2 px-3 text-right'>{fmt(s.annual)}</td>
                <td className='py-2 px-3 text-right'>{fmt(s.lifetime)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BreakevenChart({ person, compareAge }: { person: PersonData; compareAge: number }) {
  const elected = person.scenarios.find(s => s.age === person.electedAge)
  const compare = person.scenarios.find(s => s.age === compareAge)
  if (!elected || !compare) return null

  const maxVal = Math.max(
    ...elected.cumulativeByAge.map(d => d.cumulative),
    ...compare.cumulativeByAge.map(d => d.cumulative),
  )

  const W = 500, H = 180
  const PAD = { top: 10, right: 10, bottom: 28, left: 64 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const ages = elected.cumulativeByAge.map(d => d.age)
  const minAge = ages[0]
  const maxAge = ages[ages.length - 1]

  function xPos(age: number) {
    return PAD.left + ((age - minAge) / (maxAge - minAge)) * chartW
  }
  function yPos(val: number) {
    return PAD.top + chartH - (val / maxVal) * chartH
  }
  function toPath(data: { age: number; cumulative: number }[]) {
    return data.map((d, i) =>
      `${i === 0 ? 'M' : 'L'} ${xPos(d.age).toFixed(1)} ${yPos(d.cumulative).toFixed(1)}`
    ).join(' ')
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(maxVal * p))
  const xTicks = [65, 70, 75, 80, 85, 90, 95].filter(a => a >= minAge && a <= maxAge)

  const breakevenAge = (() => {
    for (const d of elected.cumulativeByAge) {
      const c = compare.cumulativeByAge.find(x => x.age === d.age)
      if (c && d.cumulative >= c.cumulative) return d.age
    }
    return null
  })()

  return (
    <div>
      <div className='flex gap-4 text-xs text-neutral-500 mb-2'>
        <span className='flex items-center gap-1'>
          <span className='inline-block w-6 h-0.5 bg-blue-600'></span>
          Age {person.electedAge} (elected)
        </span>
        <span className='flex items-center gap-1'>
          <span className='inline-block w-6 h-0.5 bg-neutral-300'></span>
          Age {compareAge}
        </span>
        {breakevenAge && (
          <span className='text-emerald-600'>Breakeven: age {breakevenAge}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className='w-full' style={{ maxHeight: 180 }}>
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke='#e5e7eb' strokeWidth='1' />
            <text x={PAD.left - 4} y={yPos(v) + 4} textAnchor='end' fontSize='10' fill='#9ca3af'>
              {v === 0 ? '$0' : `$${Math.round(v / 1000)}k`}
            </text>
          </g>
        ))}
        {xTicks.map(a => (
          <g key={a}>
            <text x={xPos(a)} y={H - 6} textAnchor='middle' fontSize='10' fill='#9ca3af'>{a}</text>
          </g>
        ))}
        <path d={toPath(compare.cumulativeByAge)} fill='none' stroke='#d1d5db' strokeWidth='2' />
        <path d={toPath(elected.cumulativeByAge)} fill='none' stroke='#2563eb' strokeWidth='2.5' />
        {breakevenAge && (
          <line
            x1={xPos(breakevenAge)} y1={PAD.top}
            x2={xPos(breakevenAge)} y2={H - PAD.bottom}
            stroke='#10b981' strokeWidth='1' strokeDasharray='4 3'
          />
        )}
      </svg>
    </div>
  )
}

export function SSClient({ data }: { data: SSData | null }) {
  if (!data) {
    return (
      <div className='rounded-xl border border-neutral-200 p-8 text-center text-neutral-500'>
        <p className='text-lg font-medium mb-2'>No data available</p>
        <p className='text-sm'>Please complete your profile with Social Security benefit information.</p>
      </div>
    )
  }

  const { person1, person2, recommendation } = data

  return (
    <div className='space-y-6'>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <BenefitCard
          label={`${person1.name} — elected`}
          value={fmt(person1.electedMonthly)}
          sub={`claiming at age ${person1.electedAge}`}
          highlight
        />
        <BenefitCard
          label={`${person1.name} — at FRA`}
          value={fmt(person1.pia)}
          sub={`FRA age ${person1.fra}`}
        />
        {person2 && (
          <>
            <BenefitCard
              label={`${person2.name} — elected`}
              value={fmt(person2.electedMonthly)}
              sub={`claiming at age ${person2.electedAge}`}
              highlight
            />
            <BenefitCard
              label={`${person2.name} — at FRA`}
              value={fmt(person2.pia)}
              sub={`FRA age ${person2.fra}`}
            />
          </>
        )}
      </div>

      <div className='rounded-xl bg-emerald-50 border border-emerald-200 p-4'>
        <p className='text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1'>Recommendation</p>
        <p className='text-sm text-emerald-900'>{recommendation}</p>
      </div>

      <div className='rounded-xl border border-neutral-200 overflow-hidden'>
        <div className='bg-neutral-50 border-b border-neutral-200 px-4 py-3'>
          <h2 className='font-semibold text-neutral-900'>{person1.name} — Claiming Scenarios</h2>
          <p className='text-xs text-neutral-500 mt-0.5'>
            FRA age {person1.fra} &nbsp;&middot;&nbsp; PIA ${person1.pia.toLocaleString()}/mo &nbsp;&middot;&nbsp; Elected age {person1.electedAge} = {fmt(person1.electedMonthly)}/mo
          </p>
        </div>
        <div className='p-4'>
          <ScenarioTable person={person1} electedAge={person1.electedAge} />
        </div>
      </div>

      <div className='rounded-xl border border-neutral-200 p-4'>
        <h2 className='font-semibold text-neutral-900 mb-1'>{person1.name} — Breakeven Analysis</h2>
        <p className='text-xs text-neutral-500 mb-3'>Cumulative lifetime benefits: elected age vs claiming at 62</p>
        <BreakevenChart person={person1} compareAge={62} />
      </div>

      {person2 && (
        <>
          <div className='rounded-xl border border-neutral-200 overflow-hidden'>
            <div className='bg-neutral-50 border-b border-neutral-200 px-4 py-3'>
              <h2 className='font-semibold text-neutral-900'>{person2.name} — Claiming Scenarios</h2>
              <p className='text-xs text-neutral-500 mt-0.5'>
                FRA age {person2.fra} &nbsp;&middot;&nbsp; PIA ${person2.pia.toLocaleString()}/mo &nbsp;&middot;&nbsp; Elected age {person2.electedAge} = {fmt(person2.electedMonthly)}/mo
              </p>
            </div>
            <div className='p-4'>
              <ScenarioTable person={person2} electedAge={person2.electedAge} />
            </div>
          </div>

          <div className='rounded-xl border border-neutral-200 p-4'>
            <h2 className='font-semibold text-neutral-900 mb-1'>{person2.name} — Breakeven Analysis</h2>
            <p className='text-xs text-neutral-500 mb-3'>Cumulative lifetime benefits: elected age vs claiming at 62</p>
            <BreakevenChart person={person2} compareAge={62} />
          </div>

          <div className='rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3'>
            <h2 className='font-semibold text-blue-900'>Spousal &amp; Survivor Strategy</h2>
            <div className='text-sm text-blue-800 space-y-2'>
              <p>
                <span className='font-medium'>Survivor benefit:</span>{' '}
                If {person1.name} predeceases {person2.name}, the survivor benefit would be{' '}
                <span className='font-semibold'>{fmt(person2.survivorBenefit ?? 0)}/mo</span>.
                {person1.electedAge >= 70 && ' Delaying to 70 maximizes this amount.'}
              </p>
              <p>
                <span className='font-medium'>Spousal benefit:</span>{' '}
                {person2.spousalApplies
                  ? `${person2.name}'s spousal benefit (50% of ${person1.name}'s PIA = ${fmt(person2.spousalBenefit ?? 0)}/mo) exceeds her own earned benefit. Consider spousal filing strategy.`
                  : `${person2.name}'s own earned benefit exceeds the spousal benefit (50% of ${person1.name}'s PIA = ${fmt(person2.spousalBenefit ?? 0)}/mo). Claim on own record.`
                }
              </p>
              <p>
                <span className='font-medium'>Restricted application:</span>{' '}
                Not available — both spouses were born after January 1, 1954.
              </p>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
