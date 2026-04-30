import type { ReactNode } from 'react'

export function EducationProse({ 
  children, 
  className = '' 
}: { 
  children: ReactNode
  className?: string 
}) {
  return (
    <div className={`education-prose-content ${className}`.trim()}>
      {children}
    </div>
  )
}
