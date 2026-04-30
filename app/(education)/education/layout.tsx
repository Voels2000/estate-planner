import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EducationDisclaimer } from '@/components/education/EducationDisclaimer'
import './education-theme.css'

export default async function EducationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="education-shell min-h-screen">
      <header style={{
        background: 'var(--navy, #0f1f3d)',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--gold, #c9a84c)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
            fontWeight: 600, fontSize: 16,
            color: 'var(--navy, #0f1f3d)',
          }}>M</div>
          <Link href="/education" style={{ textDecoration: 'none' }}>
            <div style={{
              fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
              fontSize: 17, fontWeight: 500,
              color: 'white', lineHeight: 1.2,
            }}>My Wealth Maps</div>
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.5px', textTransform: 'uppercase',
            }}>Education Guide</div>
          </Link>
        </div>
        <Link href="/dashboard" style={{
          color: 'rgba(255,255,255,0.6)', fontSize: 12,
          textDecoration: 'none',
          border: '1.5px solid rgba(255,255,255,0.2)',
          padding: '6px 14px', borderRadius: 6,
          transition: 'all 0.2s',
        }}>← My Dashboard</Link>
      </header>
      <div className="app">
        <EducationDisclaimer />
        {children}
      </div>
    </div>
  )
}

