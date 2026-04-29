'use client'

import { useEffect, useState } from 'react'
import { fetchCompletedModules, saveModuleProgress } from '@/lib/education/progressClient'

export default function ModuleProgressToggle({ slug }: { slug: string }) {
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    void fetchCompletedModules().then((completed) => {
      if (!mounted) return
      setDone(completed.has(slug))
    })
    return () => {
      mounted = false
    }
  }, [slug])

  async function toggle() {
    const next = !done
    setSaving(true)
    const ok = await saveModuleProgress(slug, next)
    setSaving(false)
    if (!ok) return
    setDone(next)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('education-progress-updated'))
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        done
          ? 'border border-green-300 bg-green-50 text-green-700'
          : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {saving ? 'Saving...' : done ? '✓ Marked complete' : 'Mark module complete'}
    </button>
  )
}

