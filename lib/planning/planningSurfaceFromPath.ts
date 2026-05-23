import type { PlanningSurfaceId } from '@/lib/planning/planningSurfaces'

/** Derive active planning surface from the current pathname (supports deep links). */
export function planningSurfaceFromPathname(pathname: string): PlanningSurfaceId {
  if (pathname === '/complete' || pathname.startsWith('/complete/')) return 'complete'
  if (pathname === '/scenarios' || pathname.startsWith('/scenarios/')) return 'scenarios'
  return 'projections'
}
