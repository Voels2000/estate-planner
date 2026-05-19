import { PublicNav } from './_components/public-nav'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  )
}
