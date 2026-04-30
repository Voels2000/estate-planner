'use client'

import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type LinkVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'dark'
export type ButtonVariant = 'primary' | 'secondary' | 'dark'
type Size = 'sm' | 'md'

function linkClasses(variant: LinkVariant, size: Size): string {
  if (variant === 'link') {
    const text = size === 'sm' ? 'text-xs' : 'text-sm'
    return `inline-flex items-center font-medium text-indigo-600 transition-colors hover:text-indigo-700 ${text}`
  }
  const base =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors'
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const variantClass =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : variant === 'dark'
        ? 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200'
      : variant === 'secondary'
        ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
        : 'text-neutral-700 hover:bg-neutral-100'
  return `${base} ${sizeClass} ${variantClass}`
}

function buttonClasses(variant: ButtonVariant, size: Size): string {
  const base =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70'
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
  const variantClass =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : variant === 'secondary'
        ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
        : 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200'
  return `${base} ${sizeClass} ${variantClass}`
}

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
    <Link href={href} className={`${linkClasses(variant, size)} ${className}`.trim()}>
      {children}
    </Link>
  )
}

/** Same styles as primary/secondary ButtonLink but renders a native `<a>` (e.g. downloads). */
export function ButtonAnchor({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  href: string
  children: ReactNode
  variant?: Exclude<LinkVariant, 'link'>
  size?: Size
  className?: string
}) {
  return (
    <a href={href} className={`${linkClasses(variant, size)} ${className}`.trim()}>
      {children}
    </a>
  )
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: Size
}) {
  return (
    <button type={type} className={`${buttonClasses(variant, size)} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
