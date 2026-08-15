import { useState } from "react"
import { supabase } from "../lib/supabase"
import { CoursePilotLogo } from "../components/CoursePilotLogo"

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login")
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
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <CoursePilotLogo size="md" showTagline={true} />

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
            {mode === "login"
              ? "Sign in to access your Next Best Action and study schedule."
              : "Set up your student profile and start optimizing your study time."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Email Address
            </label>
            <input
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Password
            </label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-slate-900 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition active:scale-[0.98]"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log In to CoursePilot"
                : "Create Account"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs sm:text-sm font-semibold text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs sm:text-sm font-semibold text-emerald-700 border border-emerald-200">
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
          className="mt-6 w-full text-center text-xs sm:text-sm font-semibold text-blue-600 hover:underline"
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
