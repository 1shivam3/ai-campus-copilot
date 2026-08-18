import React from "react"
import { CoursePilotMark } from "./CoursePilotLogo"

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, isChunkError: false }
  }

  static getDerivedStateFromError(error) {
    const isChunk =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("error loading dynamically imported module")

    return { hasError: true, error, isChunkError: Boolean(isChunk) }
  }

  componentDidCatch(error, errorInfo) {
    console.error("[CoursePilot ErrorBoundary caught error]:", error, errorInfo)

    const isChunk =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("error loading dynamically imported module")

    if (isChunk && typeof window !== "undefined") {
      const reloaded = sessionStorage.getItem("coursepilot_chunk_error_reloaded")
      if (!reloaded) {
        sessionStorage.setItem("coursepilot_chunk_error_reloaded", "true")
        window.location.reload()
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkError: false })
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("coursepilot_chunk_error_reloaded")
      window.location.reload()
    }
  }

  handleClearCacheAndReload = async () => {
    if (typeof window !== "undefined") {
      try {
        if ("caches" in window) {
          const keys = await caches.keys()
          await Promise.all(
            keys
              .filter((k) => k.startsWith("coursepilot-"))
              .map((k) => caches.delete(k))
          )
        }
      } catch {}
      sessionStorage.clear()
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunk = this.state.isChunkError

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] p-6 text-slate-900 selection:bg-slate-900 selection:text-white dark:bg-[#090d16] dark:text-slate-100">
          <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs dark:bg-blue-950 dark:text-blue-400">
              <CoursePilotMark className="h-8 w-8" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              {isChunk ? "New Version Available" : "Something went wrong"}
            </h2>

            <p className="mt-2 text-xs text-slate-600 leading-relaxed dark:text-slate-400">
              {isChunk
                ? "A new version of CoursePilot is available. Click below to load the latest update."
                : "An unexpected error occurred while rendering this page. You can try again or refresh the app."}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Try Again ↻
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
