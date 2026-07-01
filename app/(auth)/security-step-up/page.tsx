import { Suspense } from 'react'
import { SecurityStepUpForm } from './_security-step-up-form'

export default function SecurityStepUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
          <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
        </div>
      }
    >
      <SecurityStepUpForm />
    </Suspense>
  )
}
