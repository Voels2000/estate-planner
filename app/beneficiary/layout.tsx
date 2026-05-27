import { WordmarkOnly } from '@/components/nav/WordmarkOnly'

export default function BeneficiaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WordmarkOnly />
      {children}
    </>
  )
}
