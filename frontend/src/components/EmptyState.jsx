export function EmptyState({
  icon = "📚",
  title = "No items found",
  description = "Get started by adding your first record.",
  actionLabel = null,
  onAction = null,
  className = "",
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-[#E4E4E7] bg-white p-8 text-center sm:p-10 dark:border-[#27343a] dark:bg-[#141c1f] ${className}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F7F2] text-xl border border-[#E4E4E7] shadow-2xs dark:bg-[#182226] dark:border-[#27343a]">
        {icon}
      </div>

      <h3 className="mt-4 text-base font-bold text-[#18181B] tracking-tight dark:text-[#f4f4f5]">
        {title}
      </h3>

      <p className="mx-auto mt-1.5 max-w-sm text-xs sm:text-sm text-[#52525B] leading-relaxed font-normal dark:text-[#a1a1aa]">
        {description}
      </p>

      {actionLabel && onAction && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#115E59] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:outline-none"
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
