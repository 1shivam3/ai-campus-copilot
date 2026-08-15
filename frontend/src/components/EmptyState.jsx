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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl shadow-inner border border-slate-100">
        {icon}
      </div>

      <h3 className="mt-4 text-base font-bold text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
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
