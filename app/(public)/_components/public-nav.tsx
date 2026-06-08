'use client'

import Link from 'next/link'
import { getSignupHref } from '@/lib/waitlist-mode'

const NAV_LINKS = [
  { href: '/education', label: 'Education' },
  { href: '/events', label: 'Life Events' },
  { href: '/assess', label: 'Assessment' },
  { href: '/find-advisor', label: 'Find an Advisor' },
  { href: '/find-attorney', label: 'Find an Attorney' },
  { href: '/pricing', label: 'Pricing' },
] as const

export function PublicNav({ waitlistMode }: { waitlistMode: boolean }) {
  const signupHref = waitlistMode ? '/waitlist' : getSignupHref()
  const label = waitlistMode ? 'Join waitlist' : 'Get started'

  return (
    <nav
      style={{
        background: '#0f1f3d',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
        height: 56,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            background: '#c9a84c',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Playfair Display, Georgia, serif',
            fontWeight: 600,
            fontSize: 14,
            color: '#0f1f3d',
            flexShrink: 0,
          }}
        >
          M
        </div>
        <span
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 16,
            fontWeight: 500,
            color: 'white',
            lineHeight: 1,
          }}
        >
          My Wealth Maps
        </span>
      </Link>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              color: 'rgba(255,255,255,0.75)',
              textDecoration: 'none',
              borderRadius: 6,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
            }}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a
          href="/login"
          style={{
            padding: '7px 14px',
            fontSize: 13,
            color: 'rgba(255,255,255,0.8)',
            textDecoration: 'none',
            border: '1.5px solid rgba(255,255,255,0.2)',
            borderRadius: 7,
            transition: 'all 0.15s',
          }}
        >
          Log in
        </a>
        <a
          href={signupHref}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#0f1f3d',
            background: '#c9a84c',
            textDecoration: 'none',
            borderRadius: 7,
            transition: 'all 0.15s',
          }}
        >
          {label}
        </a>
      </div>
    </nav>
  )
}
