import { WordmarkOnly } from '@/components/nav/WordmarkOnly'

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-zinc-950">
      <WordmarkOnly />
      {children}
    </div>
  )
}
