import type { ReactNode } from 'react'

/**
 * Consistent typography and link styling for Markdown-rendered education content.
 */
export function EducationProse({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`prose prose-neutral max-w-none prose-headings:font-semibold prose-h1:mb-2 prose-h1:text-2xl prose-h2:mt-8 prose-h2:text-lg prose-h3:text-base prose-p:leading-relaxed prose-strong:text-neutral-900 prose-a:text-indigo-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-li:marker:text-neutral-400 prose-blockquote:border-l-indigo-200 prose-blockquote:bg-indigo-50/40 prose-blockquote:py-0.5 prose-blockquote:text-neutral-700 prose-code:rounded prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-neutral-800 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-hr:border-neutral-200 prose-table:text-sm prose-th:border prose-th:border-neutral-200 prose-th:bg-neutral-50 prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-neutral-200 prose-td:px-2 prose-td:py-1 ${className}`.trim()}
    >
      {children}
    </div>
  )
}
