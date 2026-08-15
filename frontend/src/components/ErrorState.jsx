export function ErrorState({
  title = "Something went wrong",
  message = "Could not load data. Please check your network connection and try again.",
  onRetry = null,
  className = "",
}) {
  return (
    <div className={`rounded-2xl border border-red-200/80 bg-red-50/70 p-6 text-red-900 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 font-bold">
            !
          </div>
          <div>
            <h4 className="font-bold text-sm text-red-950">
              {title}
            </h4>
            <p className="mt-1 text-xs text-red-800 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="self-start sm:self-center shrink-0 rounded-xl bg-red-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-800 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:outline-none"
          >
            Retry Action ↻
          </button>
        )}
      </div>
    </div>
  )
}

export default ErrorState
