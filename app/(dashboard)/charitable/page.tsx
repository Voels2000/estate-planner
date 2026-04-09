import { redirect } from 'next/navigation'

/** Charitable Giving was consolidated into Gifting Strategy (`/gifting`). */
export default function CharitablePage() {
  redirect('/gifting')
}
