'use client'

interface TabSkeletonProps {
  rows?: number
  showHeader?: boolean
}

export function TabSkeleton({ rows = 4, showHeader = true }: TabSkeletonProps) {
  return (
    <div className="animate-pulse space-y-4 p-2">
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 bg-slate-200 rounded w-48" />
          <div className="h-4 bg-slate-200 rounded w-24" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-slate-100 rounded-xl p-5 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-7 bg-slate-200 rounded w-32" />
            <div className="h-3 bg-slate-200 rounded w-20" />
          </div>
        ))}
      </div>

      {[...Array(rows)].map((_, i) => (
        <div key={i} className="bg-slate-100 rounded-xl p-5 space-y-3">
          <div className="h-4 bg-slate-200 rounded w-40" />
          <div className="h-3 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-4/5" />
          <div className="h-3 bg-slate-200 rounded w-3/5" />
        </div>
      ))}
    </div>
  )
}

export function StrategyTabSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-2">
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 bg-slate-200 rounded w-48" />
        <div className="flex gap-2">
          <div className="h-8 bg-slate-200 rounded w-24" />
          <div className="h-8 bg-slate-200 rounded w-24" />
          <div className="h-8 bg-slate-200 rounded w-24" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-slate-100 rounded-xl p-5 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-24" />
            <div className="h-8 bg-slate-200 rounded w-28" />
            <div className="h-3 bg-slate-200 rounded w-20" />
          </div>
        ))}
      </div>

      <div className="bg-slate-100 rounded-xl p-5">
        <div className="h-4 bg-slate-200 rounded w-32 mb-4" />
        <div className="h-48 bg-slate-200 rounded-lg" />
      </div>

      <div className="bg-slate-100 rounded-xl p-5 space-y-3">
        <div className="h-4 bg-slate-200 rounded w-40" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-200 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DomicileTabSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-2">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <div className="h-5 bg-slate-200 rounded w-48" />
          <div className="h-3 bg-slate-200 rounded w-64" />
        </div>
        <div className="text-right space-y-2">
          <div className="h-10 bg-slate-200 rounded w-16" />
          <div className="h-3 bg-slate-200 rounded w-20" />
        </div>
      </div>

      <div className="bg-slate-100 rounded-xl p-5">
        <div className="h-4 bg-slate-200 rounded-full w-full" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-100 rounded-xl p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="bg-slate-100 rounded-xl p-5 h-32" />
          <div className="bg-slate-100 rounded-xl p-5 h-32" />
        </div>
      </div>
    </div>
  )
}
