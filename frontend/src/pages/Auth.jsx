import { useState } from "react"
import { supabase } from "../lib/supabase"
import { CoursePilotLogo } from "../components/CoursePilotLogo"

function Auth({ onLogin, initialMode = "login", onBackToLanding }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()

    setLoading(true)
    setError("")
    setMessage("")

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        onLogin(data.user)
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else if (data.user) {
        setMessage(
          "Account created successfully. You can now continue."
        )
        onLogin(data.user)
      }
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F2] p-4 sm:p-6 dark:bg-[#0f1416]">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E4E7] bg-white p-6 sm:p-8 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]">
        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#52525B] hover:text-[#18181B] transition dark:text-[#a1a1aa] dark:hover:text-[#f4f4f5]"
          >
            <span>← Back to Home</span>
          </button>
        )}

        <div className="mb-6">
          <CoursePilotLogo size="md" showTagline={true} />

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-[#52525B] font-normal dark:text-[#a1a1aa]">
            {mode === "login"
              ? "Sign in to access your Next Best Action and study schedule."
              : "Set up your student profile and start optimizing your study time."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
              Email Address
            </label>
            <input
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
              Password
            </label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[#0F766E] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs hover:bg-[#115E59] disabled:opacity-50 transition active:scale-[0.98]"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log In to CoursePilot"
                : "Create Account"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs sm:text-sm font-semibold text-[#DC2626] border border-rose-200/60 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-[#ECFDF5] p-3 text-xs sm:text-sm font-semibold text-[#15803D] border border-emerald-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login")
            setError("")
            setMessage("")
          }}
          className="mt-6 w-full text-center text-xs sm:text-sm font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline dark:text-[#2DD4BF]"
        >
          {mode === "login"
            ? "Don't have an account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  )
}

export default Auth
