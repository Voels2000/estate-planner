'use client'

import {
  GROWTH_ASSUMPTION_LABELS,
  GROWTH_ASSUMPTION_RANGES,
} from '@/lib/types/growthAssumptions'

export type GrowthAssumptionField =
  | 'financial_accumulation'
  | 'financial_retirement'
  | 'real_estate'
  | 'business'

interface GrowthAssumptionInputsProps {
  financialAccumulation: number
  financialRetirement: number
  realEstate: number
  business: number
  onChange: (field: GrowthAssumptionField, value: number) => void
  readOnly?: boolean
  showBusinessInput?: boolean
  showRealEstateInput?: boolean
}

export function GrowthAssumptionInputs({
  financialAccumulation,
  financialRetirement,
  realEstate,
  business,
  onChange,
  readOnly = false,
  showBusinessInput = true,
  showRealEstateInput = true,
}: GrowthAssumptionInputsProps) {
  return (
    <div className="space-y-4">
      <div className="border-l-4 border-[#C9A84C] pl-3">
        <h3 className="text-sm font-semibold text-[#0F1B3C]">Growth Assumptions</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Annual growth rates applied to each asset category in your estate projections
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RateInput
          label="Financial Assets (Accumulation)"
          value={financialAccumulation}
          hint="Applied to investment accounts while still working"
          onChange={(v) => onChange('financial_accumulation', v)}
          readOnly={readOnly}
          range={GROWTH_ASSUMPTION_RANGES.financial}
        />
        <RateInput
          label="Financial Assets (Retirement)"
          value={financialRetirement}
          hint="Applied to investment accounts in retirement"
          onChange={(v) => onChange('financial_retirement', v)}
          readOnly={readOnly}
          range={GROWTH_ASSUMPTION_RANGES.financial}
        />
        {showRealEstateInput && (
          <RateInput
            label={GROWTH_ASSUMPTION_LABELS.real_estate.label}
            value={realEstate}
            hint={GROWTH_ASSUMPTION_LABELS.real_estate.hint}
            onChange={(v) => onChange('real_estate', v)}
            readOnly={readOnly}
            range={GROWTH_ASSUMPTION_RANGES.real_estate}
          />
        )}
        {showBusinessInput && (
          <RateInput
            label={GROWTH_ASSUMPTION_LABELS.business.label}
            value={business}
            hint={GROWTH_ASSUMPTION_LABELS.business.hint}
            onChange={(v) => onChange('business', v)}
            readOnly={readOnly}
            range={GROWTH_ASSUMPTION_RANGES.business}
          />
        )}
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Portfolio growth rates apply to financial assets only. Real estate and business interests
        use their own rates above. Inflation is configured separately below.
      </p>
    </div>
  )
}

function RateInput({
  label,
  value,
  hint,
  onChange,
  readOnly,
  range,
}: {
  label: string
  value: number
  hint: string
  onChange: (v: number) => void
  readOnly: boolean
  range: { min: number; max: number; step: number }
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {readOnly ? (
        <p className="text-sm font-medium text-[#0F1B3C]">{value.toFixed(1)}%</p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 accent-[#0F1B3C]"
          />
          <div className="flex items-center border border-gray-200 rounded px-2 py-1 w-16">
            <input
              type="number"
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className="w-full text-sm text-right focus:outline-none"
            />
            <span className="text-xs text-gray-400 ml-0.5">%</span>
          </div>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{hint}</p>
    </div>
  )
}
