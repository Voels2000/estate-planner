import { MinimalAuthNav } from '@/components/nav/MinimalAuthNav'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccessContext()
  const isAdvisor = isAdvisorIdentity(access.profile?.role)

  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <MinimalAuthNav
        backLabel={isAdvisor ? '← Advisor portal' : '← My Dashboard'}
        backHref={isAdvisor ? '/advisor' : '/dashboard'}
        logoHref={isAdvisor ? '/advisor' : '/dashboard'}
      />
      <main>{children}</main>
    </div>
  )
}
