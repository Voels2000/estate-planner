import { STATE_SLUG_MAP } from '@/lib/learn/state-estate-tax-slugs'
import { US_STATES } from '@/lib/learn/us-states'

const ESTATE_TAX_STATE_CODES = new Set(Object.values(STATE_SLUG_MAP))

type Props = {
  value: string | null
  onChange: (code: string) => void
  className?: string
  id?: string
}

export function StatePickerDropdown({ value, onChange, className, id = 'assess-state' }: Props) {
  return (
    <select
      id={id}
      aria-label="Select your state"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 14,
        color: '#0f1f3d',
        border: '1px solid #d0dcea',
        borderRadius: 8,
        background: '#fafaf8',
        fontFamily: 'var(--font-body, DM Sans, system-ui)',
      }}
    >
      <option value="">Select your state</option>
      {US_STATES.map(({ code, name }) => (
        <option key={code} value={code}>
          {ESTATE_TAX_STATE_CODES.has(code) ? `${name} (estate tax)` : name}
        </option>
      ))}
    </select>
  )
}
