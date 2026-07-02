'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'

type Props = {
  label?: string
}

export function ConfirmButton({ label }: Props) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="primary" disabled={pending} className="mt-6 w-full">
      {pending ? 'Continuing…' : label ?? 'Confirm my email'}
    </Button>
  )
}
