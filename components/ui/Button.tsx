'use client'

/**
 * Button — My Wealth Maps shared button primitive
 *
 * Design tokens: --mwm-navy, --mwm-gold, --mwm-sage, --mwm-danger
 * Legacy variants secondary → outline, dark → primary (navy).
 */

import Link from 'next/link'
import {
  ButtonHTMLAttributes,
  forwardRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type MwmVariant = 'primary' | 'gold' | 'outline' | 'ghost' | 'sage' | 'danger' | 'link'
/** @deprecated Use `outline` instead of `secondary`, `primary` instead of `dark`. */
type LegacyVariant = 'secondary' | 'dark'
export type ButtonVariant = MwmVariant | LegacyVariant
export type LinkVariant = ButtonVariant
type Size = 'sm' | 'md' | 'lg'

function normalizeVariant(variant: ButtonVariant): MwmVariant {
  if (variant === 'secondary') return 'outline'
  if (variant === 'dark') return 'primary'
  return variant
}

const variantStyles: Record<MwmVariant, string> = {
  primary: [
    'bg-[var(--mwm-navy)] text-white',
    'hover:bg-[var(--mwm-navy-light)]',
    'focus-visible:ring-[var(--mwm-navy)]',
    'disabled:bg-[var(--mwm-navy)] disabled:opacity-40',
  ].join(' '),

  gold: [
    'bg-[var(--mwm-gold)] text-[var(--mwm-navy)] font-semibold',
    'hover:bg-[var(--mwm-gold-light)] hover:-translate-y-px',
    'focus-visible:ring-[var(--mwm-gold)]',
    'disabled:opacity-40',
  ].join(' '),

  outline: [
    'border border-[var(--mwm-navy)] text-[var(--mwm-navy)] bg-transparent',
    'hover:bg-[var(--mwm-navy)] hover:text-white',
    'focus-visible:ring-[var(--mwm-navy)]',
    'disabled:opacity-40',
  ].join(' '),

  ghost: [
    'bg-transparent text-[var(--mwm-navy)]',
    'hover:bg-[var(--mwm-off-white)]',
    'focus-visible:ring-[var(--mwm-navy)]',
    'disabled:opacity-40',
  ].join(' '),

  sage: [
    'bg-[var(--mwm-sage)] text-white',
    'hover:bg-[var(--mwm-sage-light)]',
    'focus-visible:ring-[var(--mwm-sage)]',
    'disabled:opacity-40',
  ].join(' '),

  danger: [
    'bg-[var(--mwm-danger)] text-white',
    'hover:opacity-90',
    'focus-visible:ring-[var(--mwm-danger)]',
    'disabled:opacity-40',
  ].join(' '),

  link: [
    'bg-transparent text-[var(--mwm-navy)] underline-offset-4',
    'hover:underline',
    'focus-visible:ring-[var(--mwm-navy)]',
    'disabled:opacity-40 disabled:no-underline',
    'px-0 py-0',
  ].join(' '),
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-[var(--mwm-radius-sm)]',
  md: 'px-5 py-2.5 text-sm rounded-[var(--mwm-radius-sm)]',
  lg: 'px-7 py-3.5 text-[15px] rounded-[var(--mwm-radius-sm)]',
}

const baseInteractiveClass =
  'inline-flex items-center justify-center gap-2 font-[family-name:var(--font-body)] font-medium ' +
  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'cursor-pointer select-none disabled:cursor-not-allowed'

function interactiveClasses(variant: ButtonVariant, size: Size, className?: string) {
  const v = normalizeVariant(variant)
  return cn(
    baseInteractiveClass,
    variantStyles[v],
    v !== 'link' && sizeStyles[size],
    className,
  )
}

const Spinner = () => (
  <svg
    className="h-4 w-4 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={interactiveClasses(variant, size, className)}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  href: string
  children: ReactNode
  variant?: LinkVariant
  size?: Size
  className?: string
}) {
  return (
    <Link href={href} className={interactiveClasses(variant, size, className)}>
      {children}
    </Link>
  )
}

/** Same styles as ButtonLink but renders a native `<a>` (e.g. downloads). */
export function ButtonAnchor({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: ReactNode
  variant?: Exclude<LinkVariant, 'link'>
  size?: Size
  className?: string
}) {
  return (
    <a href={href} className={interactiveClasses(variant, size, className)} {...props}>
      {children}
    </a>
  )
}
