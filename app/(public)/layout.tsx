import { PublicNav } from './_components/public-nav'
import { LegalFooterLinks } from '@/components/layout/LegalFooterLinks'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PublicNav />
      {children}
      <footer className="border-t border-[#e2e8f0] bg-[#fafaf8] px-6 py-8 text-center text-sm text-[#718096]">
        <LegalFooterLinks linkClassName="text-[#4a5568] hover:text-[#0f1f3d] underline-offset-4 hover:underline" />
        <p className="mt-3 text-xs text-[#718096]">
          © {new Date().getFullYear()} My Wealth Maps. All rights reserved.
        </p>
      </footer>
    </>
  )
}
