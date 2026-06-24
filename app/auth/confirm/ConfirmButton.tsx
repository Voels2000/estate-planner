'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'

export function ConfirmButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="primary" disabled={pending} className="mt-6 w-full">
      {pending ? 'Confirming…' : 'Confirm my email'}
    </Button>
  )
}
