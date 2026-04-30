import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/Button'
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
      <header className="education-nav sticky top-0 z-20 border-b border-transparent">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="education-nav-logo flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold">
              P
            </div>
            <Link href="/education" className="education-nav-brand">
              <div className="text-base font-semibold">PlanWise Guide</div>
              <div className="text-[10px] uppercase tracking-wide text-white/60">
                Educational platform only
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
      {children}
    </div>
  )
}

