import Link from 'next/link'
import { stateGuidePath } from '@/lib/learn/state-estate-tax-slugs'

type Variant = 'inline' | 'banner'

const CALLOUT_COPY: Record<string, { title: string; body: string; link: string }> = {
  WA: {
    title: 'Washington state estate tax',
    body: 'Live in Washington or own WA property? The state\'s $3M exemption is five times smaller than federal — and most $3M–$10M households have real exposure.',
    link: 'WA estate tax exemption & bypass trust guide →',
  },
  OR: {
    title: 'Oregon estate tax',
    body: 'Oregon\'s estate tax starts at $1M — one of the lowest thresholds in the US. A bypass trust can eliminate exposure for married couples.',
    link: 'Oregon estate tax guide →',
  },
  MA: {
    title: 'Massachusetts estate tax',
    body: 'Massachusetts has a cliff effect — estates over $2M owe tax on the entire amount, not just the excess. Planning timing matters here.',
    link: 'Massachusetts estate tax guide →',
  },
  MD: {
    title: 'Maryland estate tax',
    body: 'Maryland has double exposure: both an estate tax and a separate inheritance tax. Coordination between the two matters for heirs.',
    link: 'Maryland estate tax guide →',
  },
  IL: {
    title: 'Illinois estate tax',
    body: 'Illinois offers a $4M exemption with no portability between spouses — without a bypass trust, the first spouse\'s exemption is lost.',
    link: 'Illinois estate tax guide →',
  },
  MN: {
    title: 'Minnesota estate tax',
    body: 'Minnesota\'s $3M exemption is inflation-adjusted and can include some out-of-state property. Appreciation alone can push estates over the line.',
    link: 'Minnesota estate tax guide →',
  },
  NY: {
    title: 'New York estate tax',
    body: 'New York has a cliff effect above $7.16M — estates just over the threshold face a large tax jump on the entire amount.',
    link: 'New York estate tax guide →',
  },
  CT: {
    title: 'Connecticut estate tax',
    body: 'Connecticut matches the federal exemption at $13.6M — a narrower audience, but the 12% top rate still matters for larger estates.',
    link: 'Connecticut estate tax guide →',
  },
  ME: {
    title: 'Maine estate tax',
    body: 'Maine offers a generous $6.8M exemption with a relatively low 12% top rate — but estates above that threshold still need a plan.',
    link: 'Maine estate tax guide →',
  },
  RI: {
    title: 'Rhode Island estate tax',
    body: 'Rhode Island\'s low $1.77M exemption is inflation-adjusted annually — most homeowners with retirement savings should understand their exposure.',
    link: 'Rhode Island estate tax guide →',
  },
  VT: {
    title: 'Vermont estate tax',
    body: 'Vermont applies a flat 16% on everything above $5M — straightforward but steep for estates in the planning range.',
    link: 'Vermont estate tax guide →',
  },
  HI: {
    title: 'Hawaii estate tax',
    body: 'Hawaii is the only state with portability — a surviving spouse can use the deceased spouse\'s exemption if elected properly.',
    link: 'Hawaii estate tax guide →',
  },
  DC: {
    title: 'District of Columbia estate tax',
    body: 'DC\'s exemption is indexed annually and affects high-value real estate estates — separate rules from neighboring Maryland and Virginia.',
    link: 'DC estate tax guide →',
  },
}

export function StateEstateTaxCallout({
  stateCode,
  variant = 'inline',
}: {
  stateCode: string
  variant?: Variant
}) {
  const code = stateCode.toUpperCase()
  const guidePath = stateGuidePath(code)
  const copy = CALLOUT_COPY[code]
  if (!guidePath || !copy) return null

  if (variant === 'banner') {
    return (
      <div
        style={{
          background: '#f0f5fb',
          border: '1px solid #b8c8da',
          borderLeft: '4px solid #0f1f3d',
          borderRadius: '0 10px 10px 0',
          padding: '16px 20px',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#0f1f3d',
            marginBottom: 6,
          }}
        >
          Washington residents
        </div>
        <p style={{ fontSize: 14, color: '#2d3748', lineHeight: 1.65, margin: '0 0 10px' }}>
          Washington has its own estate tax with a{' '}
          <strong style={{ color: '#0f1f3d' }}>$3M WA estate tax exemption</strong> — separate from
          federal rules. A $6M married couple without a{' '}
          <strong style={{ color: '#0f1f3d' }}>bypass trust Washington</strong> plan can owe six
          figures in state tax.
        </p>
        <Link
          href={guidePath}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0f1f3d',
            textDecoration: 'none',
          }}
        >
          Read the Washington state estate tax 2026 guide →
        </Link>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #d0dcea',
        borderRadius: 12,
        padding: '18px 20px',
        marginBottom: 24,
        boxShadow: '0 2px 12px rgba(15,31,61,0.06)',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🏛️</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#4a7c6f',
              marginBottom: 4,
            }}
          >
            {copy.title}
          </div>
          <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, margin: '0 0 8px' }}>
            {copy.body}
          </p>
          <Link
            href={guidePath}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f1f3d',
              textDecoration: 'none',
            }}
          >
            {copy.link}
          </Link>
        </div>
      </div>
    </div>
  )
}
