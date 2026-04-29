export async function fetchCompletedModules(): Promise<Set<string>> {
  try {
    const res = await fetch('/api/education/progress', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return new Set()
    return new Set(Array.isArray(data.completedSlugs) ? data.completedSlugs : [])
  } catch {
    return new Set()
  }
}

export type CompletedEntry = {
  moduleSlug: string
  updatedAt: string
}

export async function fetchCompletedEntries(): Promise<CompletedEntry[]> {
  try {
    const res = await fetch('/api/education/progress', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return []
    return Array.isArray(data.completedEntries) ? data.completedEntries : []
  } catch {
    return []
  }
}

export async function saveModuleProgress(moduleSlug: string, completed: boolean): Promise<boolean> {
  try {
    const res = await fetch('/api/education/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleSlug, completed }),
    })
    return res.ok
  } catch {
    return false
  }
}

