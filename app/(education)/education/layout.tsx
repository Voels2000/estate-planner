import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink } from '@/components/ui/Button'

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
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/education"
            className="text-sm font-semibold text-neutral-900 transition-colors hover:text-indigo-700"
          >
            Education Guide
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ButtonLink href="/dashboard" variant="secondary" size="sm">
              Planning suite
            </ButtonLink>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

