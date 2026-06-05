'use client'

/**
 * InfoTooltip — inline "?" trigger with click-to-toggle popover
 *
 * Design tokens: --mwm-border, --mwm-text-secondary, --mwm-shadow (see Card.tsx)
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InfoTooltipProps {
  content: string | ReactNode
  size?: 'sm' | 'md'
  className?: string
}

const triggerSizeStyles = {
  sm: 'h-4 w-4 text-[10px]',
  md: 'h-5 w-5 text-xs',
} as const

const panelTextStyles = {
  sm: 'text-xs',
  md: 'text-sm',
} as const

type Placement = 'above' | 'below'

export function InfoTooltip({ content, size = 'sm', className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement>('above')
  const popoverId = useId()
  const containerRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !containerRef.current || !popoverRef.current) return

    const triggerRect = containerRef.current.getBoundingClientRect()
    const popoverHeight = popoverRef.current.offsetHeight
    const margin = 8
    const aboveTop = triggerRect.top - popoverHeight - margin

    if (aboveTop >= margin) {
      setPlacement('above')
    } else {
      setPlacement('below')
    }
  }, [open, content])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open])

  return (
    <span ref={containerRef} className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label="More information"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          'border border-[var(--mwm-border-dark)] bg-[var(--mwm-off-white)]',
          'font-[family-name:var(--font-body)] font-semibold text-[var(--mwm-text-muted)]',
          'transition-colors duration-200',
          'hover:border-[var(--mwm-navy-mid)] hover:text-[var(--mwm-navy)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mwm-navy)] focus-visible:ring-offset-1',
          'cursor-pointer select-none',
          triggerSizeStyles[size],
        )}
      >
        ?
      </button>

      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="tooltip"
          className={cn(
            'absolute left-1/2 z-50 max-w-[280px] -translate-x-1/2',
            placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2',
            'rounded-[var(--mwm-radius-sm)] border border-[var(--mwm-border)] bg-white p-3',
            'shadow-[var(--mwm-shadow)]',
            'text-[var(--mwm-text-secondary)]',
            panelTextStyles[size],
          )}
        >
          {content}
        </div>
      )}
    </span>
  )
}

/*
 * Usage examples (not executed):
 *
 * // String content
 * <InfoTooltip content="Federal estate tax applies at 40% above the exemption." />
 *
 * // ReactNode content
 * <InfoTooltip
 *   size="md"
 *   content={
 *     <>
 *       <strong className="text-[var(--mwm-text-primary)]">Zero-Tax Paths</strong>
 *       {' '}
 *       Percentage of simulations where both federal and state estate tax are $0.
 *     </>
 *   }
 * />
 */
