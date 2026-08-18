export function EmptyState({
  icon = "📚",
  title = "No items found",
  description = "Get started by adding your first record.",
  actionLabel = null,
  onAction = null,
  className = "",
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center sm:p-10 ${className}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-xl border border-slate-200/80 shadow-2xs">
        {icon}
      </div>

      <h3 className="mt-4 text-base font-bold text-slate-900 tracking-tight">
        {title}
      </h3>

      <p className="mx-auto mt-1.5 max-w-sm text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            <span>+</span>
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default EmptyState
