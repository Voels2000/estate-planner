/**
 * Shared form class constants — My Wealth Maps tokens (navy focus, no indigo).
 * Auth pages may still use parent `.dark`; planning-app forms use light tokens only.
 */

/** Standard text input / select */
export const formControlClass =
  'block w-full rounded-[var(--mwm-radius-sm)] border border-[var(--mwm-border)] ' +
  'bg-white px-4 py-2.5 text-sm text-[var(--mwm-text-primary)] ' +
  'placeholder:text-[var(--mwm-text-muted)] ' +
  'focus:outline-none focus:border-[var(--mwm-navy)] ' +
  'focus:ring-2 focus:ring-[var(--mwm-navy)]/20 ' +
  'disabled:bg-[var(--mwm-off-white)] disabled:text-[var(--mwm-text-muted)] disabled:cursor-not-allowed ' +
  'transition-colors duration-150'

/** Textarea — same as formControlClass but min-height */
export const formTextareaClass = formControlClass + ' min-h-[100px] resize-y'

/** Form label */
export const formLabelClass =
  'block text-sm font-medium text-[var(--mwm-text-primary)] mb-1.5'

/** Helper / hint text below an input */
export const formHintClass = 'mt-1 text-xs text-[var(--mwm-text-muted)]'

/** Error text below an input */
export const formErrorClass = 'mt-1 text-xs text-[var(--mwm-danger)]'

/** Checkbox */
export const formCheckboxClass =
  'h-4 w-4 rounded border-[var(--mwm-border-dark)] ' +
  'text-[var(--mwm-navy)] ' +
  'focus:ring-[var(--mwm-navy)]/20 focus:ring-offset-0 ' +
  'checked:bg-[var(--mwm-navy)] checked:border-[var(--mwm-navy)]'

/** Select — same as formControlClass; browser renders the arrow */
export const formSelectClass = formControlClass

/** Radio */
export const formRadioClass =
  'h-4 w-4 border-[var(--mwm-border-dark)] ' +
  'text-[var(--mwm-navy)] ' +
  'focus:ring-[var(--mwm-navy)]/20 focus:ring-offset-0'

/** Fieldset / group wrapper */
export const formGroupClass = 'space-y-1'

/** Full form section with bottom separator */
export const formSectionClass =
  'space-y-5 pb-6 border-b border-[var(--mwm-border)] last:border-0 last:pb-0'
