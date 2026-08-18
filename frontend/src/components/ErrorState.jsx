export function ErrorState({
  title = "Something went wrong",
  message = "Could not load data. Please check your network connection and try again.",
  onRetry = null,
  className = "",
}) {
  return (
    <div className={`rounded-2xl border border-rose-200/80 bg-rose-50/50 p-5 sm:p-6 text-slate-900 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 font-bold border border-rose-200/60">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              {title}
            </h4>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed font-normal">
              {message}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="self-start sm:self-center shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            Try Again ↻
          </button>
        )}
      </div>
    </div>
  )
}

export default ErrorState
