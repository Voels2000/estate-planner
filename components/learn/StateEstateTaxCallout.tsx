import Link from 'next/link'
import { stateGuidePath } from '@/lib/learn/state-estate-tax-slugs'

type Variant = 'inline' | 'banner'

const CALLOUT_COPY: Record<string, { title: string; body: string; link: string }> = {
  WA: {
    title: 'Washington state estate tax',
    body: 'Live in Washington or own WA property? The state\'s $3M exemption is five times smaller than federal — and most $3M–$10M households have real exposure.',
    link: 'WA estate tax exemption & bypass trust guide →',
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
