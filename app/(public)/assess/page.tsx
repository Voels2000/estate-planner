import AssessClient from './_assess-client'

/** Assessment always shows scores to logged-out users; gap report gated behind signup (Sprint 12). */
export default function AssessPage() {
  return <AssessClient />
}
