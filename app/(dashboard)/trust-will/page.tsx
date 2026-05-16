import { redirect } from 'next/navigation'

/** Legacy route — trust documents live on Gifting, Strategies & Trusts tab. */
export default function TrustWillPage() {
  redirect('/my-estate-trust-strategy?tab=trusts')
}
