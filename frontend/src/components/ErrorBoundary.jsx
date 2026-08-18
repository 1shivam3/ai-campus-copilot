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
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F2] p-6 text-[#18181B] selection:bg-[#0F766E] selection:text-white dark:bg-[#0f1416] dark:text-[#f4f4f5]">
          <div className="w-full max-w-md rounded-3xl border border-[#E4E4E7] bg-white p-6 shadow-xl text-center dark:border-[#27343a] dark:bg-[#141c1f]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#0F766E] shadow-2xs dark:bg-[#182226] dark:text-[#2DD4BF]">
              <CoursePilotMark className="h-8 w-8" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#18181B] dark:text-[#f4f4f5]">
              {isChunk ? "New Version Available" : "Something went wrong"}
            </h2>

            <p className="mt-2 text-xs text-[#52525B] leading-relaxed dark:text-[#a1a1aa]">
              {isChunk
                ? "A new version of CoursePilot is available. Click below to load the latest update."
                : "An unexpected error occurred while rendering this page. You can try again or refresh the app."}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 rounded-2xl bg-[#0F766E] px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] transition active:scale-[0.98]"
              >
                Try Again ↻
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] px-4 py-2.5 text-xs font-semibold text-[#18181B] hover:bg-white transition active:scale-[0.98] dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
              >
                Reload App
              </button>
            </div>

            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              className="mt-4 text-[11px] font-semibold text-[#71717A] hover:text-[#DC2626] transition underline dark:text-[#a1a1aa]"
            >
              Clear Cached Files & Hard Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
