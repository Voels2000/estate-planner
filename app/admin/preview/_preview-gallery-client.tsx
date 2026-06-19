'use client'

import { useMemo, useState } from 'react'
import { previewRegistry } from '@/lib/preview/previewRegistry'
import type { PreviewVariant } from '@/lib/preview/types'

function variantKey(screenId: string, variantId: string) {
  return `${screenId}:${variantId}`
}

export function PreviewGalleryClient() {
  const defaultScreen = previewRegistry[0]
  const defaultVariant = defaultScreen?.variants[0]

  const [selectedKey, setSelectedKey] = useState(
    defaultScreen && defaultVariant
      ? variantKey(defaultScreen.id, defaultVariant.id)
      : '',
  )

  const selected = useMemo(() => {
    for (const screen of previewRegistry) {
      for (const variant of screen.variants) {
        if (variantKey(screen.id, variant.id) === selectedKey) {
          return { screen, variant }
        }
      }
    }
    return null
  }, [selectedKey])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-neutral-900">Screen preview gallery</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Superuser-only. Synthetic fixtures — not live user data.
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white">
          <nav className="p-4">
            {previewRegistry.map((screen) => (
              <div key={screen.id} className="mb-6">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {screen.label}
                </h2>
                <ul className="space-y-1">
                  {screen.variants.map((variant) => {
                    const key = variantKey(screen.id, variant.id)
                    const isSelected = key === selectedKey
                    return (
                      <li key={variant.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedKey(key)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-[var(--mwm-navy)] text-white'
                              : 'text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          {variant.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="relative flex flex-1 flex-col overflow-hidden bg-[var(--mwm-off-white)]">
          <div
            className="shrink-0 border-b border-amber-300 bg-amber-50 px-6 py-2 text-center text-sm font-medium text-amber-900"
            role="status"
          >
            PREVIEW — synthetic data, actions disabled
          </div>

          <div className="relative flex-1 overflow-auto">
            {selected ? (
              <PreviewPane variant={selected.variant} />
            ) : (
              <p className="p-8 text-neutral-500">Select a variant from the sidebar.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PreviewPane({ variant }: { variant: PreviewVariant }) {
  const Component = variant.component
  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none min-h-full select-none" aria-hidden={false}>
        <Component {...(variant.fixture as object)} />
      </div>
      <div
        className="pointer-events-auto absolute inset-0 z-10 cursor-not-allowed"
        aria-label="Preview mode — interactions disabled"
        title="Preview mode — interactions disabled"
      />
    </div>
  )
}
