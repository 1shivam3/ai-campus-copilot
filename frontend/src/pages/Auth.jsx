import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { CoursePilotLogo } from "../components/CoursePilotLogo"
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogins,
  checkPasswordResetRateLimit,
  recordPasswordResetRequest,
} from "../utils/sessionSecurity"

function Auth({
  onLogin,
  initialMode = "login",
  initialMessage = "",
  onBackToLanding,
}) {
  const [mode, setMode] = useState(initialMode) // 'login' | 'signup' | 'forgot' | 'reset'
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(initialMessage)
  const [error, setError] = useState("")

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage)
    }
  }, [initialMessage])

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setMessage("")

    const cleanEmail = email.trim().toLowerCase()

    // 1. Password Reset Request Flow (Forgot Password)
    if (mode === "forgot") {
      if (!cleanEmail || !cleanEmail.includes("@")) {
        setError("Please provide a valid university email address.")
        return
      }

      // Check client-side rate limit
      const rateCheck = checkPasswordResetRateLimit()
      if (!rateCheck.allowed) {
        setError(rateCheck.message)
        return
      }

      setLoading(true)
      recordPasswordResetRequest()

      try {
        const redirectTo = typeof window !== "undefined"
          ? `${window.location.origin}/#reset-password`
          : undefined

        await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo })
      } catch {
        // Suppress specific backend errors to prevent account enumeration
      } finally {
        setLoading(false)
        // Always provide a generic, safe response to prevent email enumeration
        setMessage(
          "If an account exists for that email, a password reset link has been sent."
        )
      }
      return
    }

    // 2. Set New Password Flow (Recovery / Reset Link Target)
    if (mode === "reset") {
      if (!password || password.length < 6) {
        setError("New password must be at least 6 characters.")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please re-enter.")
        return
      }

      setLoading(true)
      try {
        const { data, error: updateError } = await supabase.auth.updateUser({
          password,
        })

        if (updateError) {
          setError(
            "This password reset link is invalid or has expired. Please request a new one."
          )
        } else if (data?.user) {
          setMessage("Your password has been successfully updated! You can now log in.")
          setPassword("")
          setConfirmPassword("")
          setMode("login")
        }
      } catch {
        setError(
          "This password reset link is invalid or has expired. Please request a new one."
        )
      } finally {
        setLoading(false)
      }
      return
    }

    // 3. Login Flow
    if (mode === "login") {
      // Check login rate limiting
      const rateCheck = checkLoginRateLimit(cleanEmail)
      if (!rateCheck.allowed) {
        setError(rateCheck.message)
        return
      }

      setLoading(true)
      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

        if (authError) {
          recordFailedLogin(cleanEmail)
          // Generic authentication error message to prevent user enumeration
          setError("Invalid email or password.")
        } else if (data?.user) {
          clearFailedLogins(cleanEmail)
          onLogin(data.user)
        }
      } catch {
        recordFailedLogin(cleanEmail)
        setError("Authentication failed. Please try again.")
      } finally {
        setLoading(false)
      }
      return
    }

    // 4. Signup Flow
    if (mode === "signup") {
      if (!cleanEmail || !cleanEmail.includes("@")) {
        setError("Please enter a valid email address.")
        return
      }
      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters.")
        return
      }

      setLoading(true)
      try {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        })

        if (signupError) {
          setError(signupError.message || "Could not complete account signup.")
        } else if (data?.user) {
          setMessage("Account created successfully. You can now continue.")
          onLogin(data.user)
        }
      } catch {
        setError("Signup failed. Please try again.")
      } finally {
        setLoading(false)
      }
    }
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
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset" && "Set new password"}
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-[#52525B] font-normal dark:text-[#a1a1aa]">
            {mode === "login" && "Sign in to access your Next Best Action and study schedule."}
            {mode === "signup" && "Set up your student profile and start optimizing your study time."}
            {mode === "forgot" && "Enter your university email to receive a password recovery link."}
            {mode === "reset" && "Enter your new account password below."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== "reset" && (
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
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
              />
            </div>
          )}

          {mode !== "forgot" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
                  {mode === "reset" ? "New Password" : "Password"}
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot")
                      setError("")
                      setMessage("")
                    }}
                    className="text-xs font-semibold text-[#0F766E] hover:underline dark:text-[#2DD4BF]"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
              />
            </div>
          )}

          {mode === "reset" && (
            <div>
              <label className="text-[11px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[#0F766E] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs hover:bg-[#115E59] disabled:opacity-50 transition active:scale-[0.98]"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log In to CoursePilot"
                : mode === "signup"
                  ? "Create Account"
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : "Update Password"}
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

        <div className="mt-6 flex flex-col items-center gap-2">
          {mode === "login" && (
            <button
              type="button"
              onClick={() => {
                setMode("signup")
                setError("")
                setMessage("")
              }}
              className="text-xs sm:text-sm font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline dark:text-[#2DD4BF]"
            >
              Don't have an account? Sign up
            </button>
          )}

          {(mode === "signup" || mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              onClick={() => {
                setMode("login")
                setError("")
                setMessage("")
              }}
              className="text-xs sm:text-sm font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline dark:text-[#2DD4BF]"
            >
              Remember your credentials? Log in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Auth
