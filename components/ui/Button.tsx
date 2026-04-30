'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

function classesFor(variant: Variant, size: Size): string {
  const base =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors'
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const variantClass =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : variant === 'secondary'
        ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
        : 'text-neutral-700 hover:bg-neutral-100'
  return `${base} ${sizeClass} ${variantClass}`
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
}: {
  href: string
  children: ReactNode
  variant?: Variant
  size?: Size
}) {
  return (
    <Link href={href} className={classesFor(variant, size)}>
      {children}
    </Link>
  )
}

/** Same styles as ButtonLink but renders a native `<a>` (e.g. file downloads, mailto). */
export function ButtonAnchor({
  href,
  children,
  variant = 'primary',
  size = 'md',
}: {
  href: string
  children: ReactNode
  variant?: Variant
  size?: Size
}) {
  return (
    <a href={href} className={classesFor(variant, size)}>
      {children}
    </a>
  )
}

