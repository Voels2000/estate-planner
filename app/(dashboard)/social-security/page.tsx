import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SSClient } from './_ss-client'

export default async function SocialSecurityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!household) redirect('/profile')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/social-security`, {
    headers: { cookie: '' },
    cache: 'no-store',
  })

  const data = res.ok ? await res.json() : null

  return (
    <div className='max-w-5xl mx-auto px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-neutral-900'>Social Security Report</h1>
        <p className='text-sm text-neutral-500 mt-1'>
          Optimal claiming analysis and spousal coordination strategy
        </p>
      </div>
      <SSClient data={data} />
    </div>
  )
}