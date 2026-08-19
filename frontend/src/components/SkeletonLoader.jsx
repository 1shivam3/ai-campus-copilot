export function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ${className}`}>
      <div className="h-4 w-28 rounded-md bg-slate-200" />
      <div className="mt-3 h-7 w-3/4 rounded-md bg-slate-200" />
      <div className="mt-2 h-4 w-1/2 rounded-md bg-slate-100" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded-md bg-slate-100" style={{ width: `${100 - i * 15}%` }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 3, className = "" }) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonBanner() {
  return (
    <div className="animate-pulse rounded-3xl bg-slate-900/90 p-8 text-white shadow-xl">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        <div className="h-3 w-32 rounded bg-slate-700" />
      </div>
      <div className="mt-4 h-9 w-2/3 rounded-lg bg-slate-700" />
      <div className="mt-3 h-4 w-1/2 rounded bg-slate-800" />
      <div className="mt-6 h-12 w-full rounded-2xl bg-slate-800" />
    </div>
  )
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>
          <div className="h-6 w-16 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
