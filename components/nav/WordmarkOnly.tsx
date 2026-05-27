import { MwmWordmark } from '@/components/nav/MwmWordmark'

/** Ultra-minimal brand mark for utility/token pages — no nav links. */
export function WordmarkOnly() {
  return (
    <header className="border-b border-[color:var(--mwm-border)] bg-white px-6 py-4">
      <MwmWordmark href="/" />
    </header>
  )
}
