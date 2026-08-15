import { useState } from "react"
import { supabase } from "../lib/supabase"

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            AI Campus Copilot
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Your personalized academic command center.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          />

          <input
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200">
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
          className="mt-6 w-full text-center text-sm font-medium text-blue-600 hover:underline"
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
