export type AdvisorPlaybookState = {
  step1: boolean
  step2: boolean
  step3: boolean
  dismissed?: boolean
}

const STORAGE_PREFIX = 'mwm_advisor_playbook_'

function storageKey(advisorId: string): string {
  return `${STORAGE_PREFIX}${advisorId}`
}

export function getPlaybookState(advisorId: string): AdvisorPlaybookState {
  if (typeof window === 'undefined') {
    return { step1: false, step2: false, step3: false }
  }
  try {
    const raw = localStorage.getItem(storageKey(advisorId))
    if (!raw) return { step1: false, step2: false, step3: false }
    const parsed = JSON.parse(raw) as Partial<AdvisorPlaybookState>
    return {
      step1: parsed.step1 === true,
      step2: parsed.step2 === true,
      step3: parsed.step3 === true,
      dismissed: parsed.dismissed === true,
    }
  } catch {
    return { step1: false, step2: false, step3: false }
  }
}

export function savePlaybookState(advisorId: string, state: AdvisorPlaybookState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(advisorId), JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

export function markPlaybookStep(
  advisorId: string,
  step: 1 | 2 | 3,
): AdvisorPlaybookState {
  const current = getPlaybookState(advisorId)
  const next: AdvisorPlaybookState = {
    ...current,
    step1: step === 1 ? true : current.step1,
    step2: step === 2 ? true : current.step2,
    step3: step === 3 ? true : current.step3,
  }
  savePlaybookState(advisorId, next)
  return next
}

export function dismissPlaybook(advisorId: string): void {
  const current = getPlaybookState(advisorId)
  savePlaybookState(advisorId, { ...current, dismissed: true })
}
