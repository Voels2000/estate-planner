import { WordmarkOnly } from '@/components/nav/WordmarkOnly'

export default function EstateFlowShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <WordmarkOnly />
      {children}
    </div>
  )
}
