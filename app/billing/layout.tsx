import { MinimalAuthNav } from '@/components/nav/MinimalAuthNav'

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <MinimalAuthNav backLabel="← My Dashboard" backHref="/dashboard" />
      <main>{children}</main>
    </div>
  )
}
