import { Suspense } from 'react'
import { ForgotPasswordForm } from './_forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
