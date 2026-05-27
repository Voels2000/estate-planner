import { WordmarkOnly } from '@/components/nav/WordmarkOnly'

export default function AttorneyInviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--mwm-off-white)]">
      <WordmarkOnly />
      {children}
    </div>
  )
}
