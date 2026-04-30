import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/Button'
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
      <header className="nav">
        <div className="app flex items-center justify-between gap-3 px-0 py-0">
          <div className="flex items-center gap-3">
            <div className="nav-logo">M</div>
            <Link href="/education" className="text-white">
              <div className="text-base font-semibold">My Wealth Maps</div>
              <div className="text-[10px] uppercase tracking-wide text-white/60">
                mywealthmaps.com
              </div>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ButtonLink href="/dashboard" variant="secondary" size="sm" className="border-white/25 bg-white/10 text-white hover:bg-white/15">
              Planning suite
            </ButtonLink>
          </div>
        </div>
      </header>
      <div className="app">
        <EducationDisclaimer />
        {children}
      </div>
    </div>
  )
}

