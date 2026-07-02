import { WordmarkOnly } from '@/components/nav/WordmarkOnly'

export default function ClaimListingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <WordmarkOnly />
      <main>{children}</main>
    </div>
  )
}
