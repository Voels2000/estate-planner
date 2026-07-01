'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formControlClass, formLabelClass } from '@/components/ui/form'
import type { CredentialGateType } from '@/lib/directory/professionalCredential'

type Props = {
  open: boolean
  credentialType: CredentialGateType
  defaultBarState?: string
  loading?: boolean
  onClose: () => void
  onSubmit: (values: { bar_number?: string; bar_state?: string; crd_number?: string }) => void
}

export function ProfessionalCredentialModal({
  open,
  credentialType,
  defaultBarState = 'WA',
  loading = false,
  onClose,
  onSubmit,
}: Props) {
  const [barNumber, setBarNumber] = useState('')
  const [barState, setBarState] = useState(defaultBarState)
  const [crdNumber, setCrdNumber] = useState('')

  useEffect(() => {
    if (!open) return
    setBarNumber('')
    setBarState(defaultBarState)
    setCrdNumber('')
  }, [open, defaultBarState])

  if (!open) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (credentialType === 'bar') {
      onSubmit({ bar_number: barNumber.trim(), bar_state: barState.trim().toUpperCase() })
      return
    }
    onSubmit({ crd_number: crdNumber.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credential-modal-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-neutral-200"
      >
        <h2 id="credential-modal-title" className="text-lg font-semibold text-neutral-900">
          {credentialType === 'bar' ? 'Confirm your bar number' : 'Confirm your CRD number'}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {credentialType === 'bar'
            ? 'Before connecting with a client, enter your primary bar number. This unlocks your verified badge on the directory.'
            : 'Before connecting with a client, enter your FINRA CRD number. This unlocks your verified badge on the directory.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {credentialType === 'bar' ? (
            <>
              <div>
                <label className={formLabelClass} htmlFor="connect_bar_state">
                  Primary bar state
                </label>
                <input
                  id="connect_bar_state"
                  className={formControlClass}
                  value={barState}
                  onChange={(e) => setBarState(e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <label className={formLabelClass} htmlFor="connect_bar_number">
                  Bar number
                </label>
                <input
                  id="connect_bar_number"
                  className={formControlClass}
                  value={barNumber}
                  onChange={(e) => setBarNumber(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className={formLabelClass} htmlFor="connect_crd_number">
                CRD number
              </label>
              <input
                id="connect_crd_number"
                className={formControlClass}
                value={crdNumber}
                onChange={(e) => setCrdNumber(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Continue and accept'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
