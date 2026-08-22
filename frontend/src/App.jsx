import { useEffect, useMemo, useCallback, useState, useRef, lazy, Suspense } from "react"
import { supabase } from "./lib/supabase"
import Sidebar from "./components/Sidebar"
import HomeHeader from "./components/HomeHeader"
import TodayTimetableStrip from "./components/TodayTimetableStrip"
import SocialFeed from "./components/SocialFeed"
import DailyProgressCard from "./components/DailyProgressCard"
import MobileBottomNav from "./components/MobileBottomNav"
import { CoursePilotMark } from "./components/CoursePilotLogo"
import PWAInstallBanner from "./components/PWAInstallBanner"
import { SkeletonBanner, SkeletonCard, SkeletonList } from "./components/SkeletonLoader"
import EmptyState from "./components/EmptyState"

// =========================================================
// RESILIENT ROUTE-BASED CODE SPLITTING
// Keeps initial bundle ultra-compact and self-heals any deployment chunk mismatch
// =========================================================
function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport()
    } catch (error) {
      console.warn("[App] Dynamic import failed, retrying once:", error)
      if (typeof window !== "undefined") {
        const isRetried = sessionStorage.getItem("cp_chunk_retry")
        if (!isRetried) {
          sessionStorage.setItem("cp_chunk_retry", "true")
          window.location.reload()
          return new Promise(() => {})
        }
      }
      throw error
    }
  })
}

const MyAcademics = lazyWithRetry(() => import("./pages/MyAcademics"))
const Syllabus = lazyWithRetry(() => import("./pages/Syllabus"))
const Progress = lazyWithRetry(() => import("./pages/Progress"))
const Tasks = lazyWithRetry(() => import("./pages/Tasks"))
const Exams = lazyWithRetry(() => import("./pages/Exams"))
const ExamMode = lazyWithRetry(() => import("./pages/ExamMode"))
const MyProfile = lazyWithRetry(() => import("./pages/MyProfile"))
const Leaderboard = lazyWithRetry(() => import("./pages/Leaderboard"))
const SavedChallenges = lazyWithRetry(() => import("./pages/SavedChallenges"))
const Auth = lazyWithRetry(() => import("./pages/Auth"))
const ProfileSetup = lazyWithRetry(() => import("./pages/ProfileSetup"))
const LandingPage = lazyWithRetry(() => import("./pages/LandingPage"))
const GlobalSearch = lazyWithRetry(() => import("./components/GlobalSearch"))
const NotificationCenter = lazyWithRetry(() => import("./components/NotificationCenter"))
import NextBestActionCard from "./components/NextBestActionCard"

import { getTodaySchedule, getNextClass } from "./lib/todaySchedule"
import { getMergedFreeWindows, getBestStudyWindow } from "./utils/freeTime"
import { buildDailyPlan } from "./utils/dailyPlan"
import { getWeakestSyllabusTopic, calculateSyllabusMastery } from "./utils/syllabusProgress"
import { calculateExamReadiness } from "./utils/examReadiness"
import { runNextBestActionEngine, getDaysRemaining } from "./utils/nextBestActionEngine"
import { generateSmartNotifications, DEFAULT_NOTIFICATION_PREFERENCES } from "./utils/notificationEngine"
import { dispatchNativeBrowserNotification } from "./lib/notifications"
import { initTheme } from "./utils/theme"
import { getXPTransactions, calculateXPSummary, clearUserXPCache } from "./utils/xpEngine"
import { calculateLearningStreak } from "./utils/streakEngine"
import { evaluateAndAwardBadges } from "./utils/badgeEngine"
import {
  getUserChallengeHistory,
  getDailyChallengeSet,
  awardDailySetBonus,
  clearUserChallengeHistory,
} from "./utils/dailyChallengeEngine"
import { getUserSavedItems, clearUserSocialCache } from "./utils/socialInteractions"
import { fetchUserStats, syncUserLearningStats, clearApiMemoryCache } from "./lib/api"
import {
  getClassSchedule,
  clearAcademicMemoryCache,
} from "./lib/academicData"
import {
  saveUserProfile,
  getCachedUserProfile,
  getCachedClassSchedule,
  clearUserScopedCache,
} from "./lib/offlineDb"
import { initSyncQueueListener, getPendingQueueCount, processSyncQueue } from "./lib/syncQueue"
import {
  initInactivityTracker,
  recordUserActivity,
  clearSessionActivity,
} from "./utils/sessionSecurity"

function PageSuspenseFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-40 rounded-2xl bg-white border border-slate-200 p-4 shadow-xs" />
        <div className="h-40 rounded-2xl bg-white border border-slate-200 p-4 shadow-xs" />
        <div className="h-40 rounded-2xl bg-white border border-slate-200 p-4 shadow-xs" />
      </div>
      <div className="h-64 rounded-2xl bg-white border border-slate-200 p-6 shadow-xs" />
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const currentUserIdRef = useRef(null) // Tracks current user.id for onAuthStateChange closure (stable across re-renders)
  const [authLoading, setAuthLoading] = useState(true)
  const [authView, setAuthView] = useState(null) // null (landing), "login", "signup", "forgot", "reset"
  const [authMessage, setAuthMessage] = useState("")
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [showOfflineBanner, setShowOfflineBanner] = useState(true)
  const [currentPage, setCurrentPage] = useState("Home")
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [recommendedTaskId, setRecommendedTaskId] = useState(null)
  const [dashboardTasks, setDashboardTasks] = useState([])
  const [dashboardExams, setDashboardExams] = useState([])
  const [dashboardTopics, setDashboardTopics] = useState([])
  const [dashboardSchedule, setDashboardSchedule] = useState([])
  const [xpTransactions, setXpTransactions] = useState([])
  const [studySessions, setStudySessions] = useState([])
  const [quizAttempts, setQuizAttempts] = useState([])
  const [challengeHistory, setChallengeHistory] = useState([])
  const [savedItemIds, setSavedItemIds] = useState(() => new Set())
  const [isBonusMode, setIsBonusMode] = useState(false)
  const [activeSelectedChallenge, setActiveSelectedChallenge] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [deliveredKeys, setDeliveredKeys] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const raw = sessionStorage.getItem(`coursepilot_delivered_keys_${today}`)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [notificationPreferences, setNotificationPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem("coursepilot_notif_prefs")
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_PREFERENCES
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES
    }
  })

  function updateNotificationPreferences(newPrefs) {
    setNotificationPreferences(newPrefs)
    try {
      localStorage.setItem("coursepilot_notif_prefs", JSON.stringify(newPrefs))
    } catch {}
  }

  function handleMarkNotificationAsRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  function handleMarkAllNotificationsAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  function handleDismissNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  function handleClearAllNotifications() {
    setNotifications([])
  }

  // -------------------------------------------------------------
  // 1. FAST INITIALIZATION & INSTANT SESSION RESTORE
  // -------------------------------------------------------------
  const handleSessionExpiry = useCallback(async () => {
    const currentId = currentUserIdRef.current
    if (currentId) {
      await clearUserScopedCache(currentId)
      clearUserXPCache(currentId)
      clearUserChallengeHistory(currentId)
      clearAcademicMemoryCache()
      clearApiMemoryCache()
    }
    clearSessionActivity()
    try {
      await supabase.auth.signOut()
    } catch {}
    currentUserIdRef.current = null
    setUser(null)
    setProfile(null)
    setDashboardTasks([])
    setDashboardExams([])
    setDashboardTopics([])
    setStudySessions([])
    setQuizAttempts([])
    setXpTransactions([])
    setChallengeHistory([])
    setSavedItemIds(new Set())
    setNotifications([])
    setDashboardSchedule([])
    setRecommendedTaskId(null)
    setCurrentPage("Home")
    setAuthMessage("Your session expired for security. Please sign in again.")
    setAuthView("login")
  }, [])

  useEffect(() => {
    initTheme()
    initSyncQueueListener(() => user?.id)
    const stopInactivityTracker = initInactivityTracker(handleSessionExpiry)

    // Check if user arrived via password recovery / reset link
    if (typeof window !== "undefined") {
      const hash = window.location.hash || ""
      const search = window.location.search || ""
      if (
        hash.includes("type=recovery") ||
        hash.includes("reset-password") ||
        search.includes("type=recovery")
      ) {
        setAuthView("reset")
        setAuthMessage("Please set your new password below.")
      }
    }

    function handleOnline() {
      setIsOnline(true)
      if (user?.id) processSyncQueue(user.id)
    }
    function handleOffline() {
      setIsOnline(false)
      setShowOfflineBanner(true)
    }
    function handleQueueUpdate(e) {
      if (e.detail?.count !== undefined) {
        setPendingSyncCount(e.detail.count)
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("coursepilot:sync-queue-updated", handleQueueUpdate)

    // Fast-path auth initialization
    async function initAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const currentUser = session?.user || null
        currentUserIdRef.current = currentUser?.id || null
        setUser(currentUser)

        if (currentUser) {
          recordUserActivity()
          getPendingQueueCount(currentUser.id).then(setPendingSyncCount)
          getUserSavedItems(currentUser.id).then(setSavedItemIds)

          // 0ms instant cached profile restore
          const cached = await getCachedUserProfile(currentUser.id)
          if (cached) {
            setProfile(cached)
            setAuthLoading(false) // Unblock UI immediately!
            // Background refresh without blocking initial render
            fetchProfile(currentUser, false)
          } else {
            // Fresh profile query required
            await fetchProfile(currentUser, true)
          }
        } else {
          setAuthLoading(false)
        }
      } catch (err) {
        console.error("Auth initialization error:", err)
        setAuthLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null

      if (event === "PASSWORD_RECOVERY") {
        setAuthView("reset")
        setAuthMessage("Please set your new password below.")
        return
      }

      if (event === "SIGNED_OUT" || !currentUser) {
        currentUserIdRef.current = null
        setUser(null)
        setProfile(null)
        setDashboardTasks([])
        setDashboardExams([])
        setDashboardTopics([])
        setStudySessions([])
        setQuizAttempts([])
        setXpTransactions([])
        setChallengeHistory([])
        setSavedItemIds(new Set())
        setNotifications([])
        setDashboardSchedule([])
        clearAcademicMemoryCache()
        clearApiMemoryCache()
        return
      }

      // If switching accounts (User A -> User B) — use ref so closure is always fresh
      if (currentUserIdRef.current && currentUserIdRef.current !== currentUser.id) {
        clearAcademicMemoryCache()
        clearApiMemoryCache()
        setProfile(null)
        setDashboardTasks([])
        setDashboardExams([])
        setDashboardTopics([])
        setStudySessions([])
        setQuizAttempts([])
        setXpTransactions([])
        setChallengeHistory([])
        setSavedItemIds(new Set())
        setNotifications([])
        setDashboardSchedule([])
      }

      currentUserIdRef.current = currentUser.id
      setUser(currentUser)
      recordUserActivity()
      getPendingQueueCount(currentUser.id).then(setPendingSyncCount)
      getUserSavedItems(currentUser.id).then(setSavedItemIds)
      fetchProfile(currentUser, false)
    })

    return () => {
      stopInactivityTracker()
      subscription.unsubscribe()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("coursepilot:sync-queue-updated", handleQueueUpdate)
    }
  }, [handleSessionExpiry])

  // -------------------------------------------------------------
  // 2. PROFILE LOADING & ASYNCHRONOUS STATS SYNC
  // -------------------------------------------------------------
  async function fetchProfile(currentUser, isBlocking = false) {
    if (!currentUser?.id) return
    if (isBlocking) setProfileLoading(true)

    // 0. Instant Cache Fallback (Strictly user-scoped)
    try {
      const cachedProfile = await getCachedUserProfile(currentUser.id)
      if (cachedProfile && cachedProfile.user_id === currentUser.id) {
        setProfile((prev) => prev || cachedProfile)
        if (isBlocking) {
          setAuthLoading(false)
          setProfileLoading(false)
        }
      }
    } catch {}

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setProfileLoading(false)
      setAuthLoading(false)
      return
    }

    try {
      // 1. Fetch only columns that exist in student_profiles
      // NOTE: avatar_url, public_display_name, reputation are NOT in student_profiles —
      // they come from the cloud stats API (background sync) and localStorage.
      // Querying non-existent columns causes HTTP 400 / PG error 42703, which was
      // preventing setProfile() from ever being called for new users after onboarding.
      const { data, error } = await supabase
        .from("student_profiles")
        .select("id, full_name, semester, section")
        .eq("id", currentUser.id)
        .maybeSingle()

      if (data) {
        // Read avatar and display name from localStorage (set by background sync / MyProfile)
        const localAvatar = localStorage.getItem(`coursepilot_avatar_${currentUser.id}`) || null
        const localDisplayName = localStorage.getItem(`coursepilot_display_name_${currentUser.id}`) || null

        saveUserProfile(data)
        setProfile({
          id: currentUser.id,
          full_name: data.full_name || currentUser.email?.split("@")[0] || "Student",
          semester: data.semester || 3,
          section: data.section || "B2",
          avatar_url: localAvatar,
          public_display_name: localDisplayName || data.full_name || "Student",
          reputation: 91, // Default; updated by background cloud stats sync
        })
      }

      // Unblock UI as soon as Supabase profile is available
      if (isBlocking) {
        setAuthLoading(false)
        setProfileLoading(false)
      }

      // 2. Non-blocking background cross-device stats synchronization
      setTimeout(async () => {
        // Race condition guard: verify session user is still currentUser
        const { data: activeSession } = await supabase.auth.getSession()
        if (activeSession?.session?.user?.id !== currentUser.id) {
          return // User switched or logged out; abort stale background sync
        }

        try {
          const cloudStats = await fetchUserStats(currentUser.id)
          const localAvatar = localStorage.getItem(`coursepilot_avatar_${currentUser.id}`)
          const localDisplayName = localStorage.getItem(`coursepilot_display_name_${currentUser.id}`)

          const finalAvatar = cloudStats?.avatar_url || data?.avatar_url || localAvatar || null
          const finalDisplayName = cloudStats?.display_name || data?.public_display_name || localDisplayName || data?.full_name || "Student"

          let localTxs = []
          try {
            const raw = localStorage.getItem(`coursepilot_xp_transactions_cache_${currentUser.id}`)
            if (raw) localTxs = JSON.parse(raw)
          } catch {}

          const cloudTxs = Array.isArray(cloudStats?.xp_transactions) ? cloudStats.xp_transactions : []
          const mergedMap = new Map()
          localTxs.forEach((tx) => mergedMap.set(tx.reference_key || tx.id || `${tx.reason}_${tx.created_at}`, tx))
          cloudTxs.forEach((tx) => mergedMap.set(tx.reference_key || tx.id || `${tx.reason}_${tx.created_at}`, tx))

          const mergedTxs = Array.from(mergedMap.values())
          const xpSum = calculateXPSummary(mergedTxs)

          setXpTransactions(mergedTxs)
          try { localStorage.setItem(`coursepilot_xp_transactions_cache_${currentUser.id}`, JSON.stringify(mergedTxs)) } catch {}

          let localHist = []
          try {
            const rawH = localStorage.getItem(`coursepilot_challenge_history_${currentUser.id}`)
            if (rawH) localHist = JSON.parse(rawH)
          } catch {}
          const cloudHist = Array.isArray(cloudStats?.challenge_history) ? cloudStats.challenge_history : []
          const histMap = new Map()
          localHist.forEach((h) => histMap.set(h.challenge_id, h))
          cloudHist.forEach((h) => histMap.set(h.challenge_id, h))
          const mergedHist = Array.from(histMap.values())

          if (mergedHist.length > 0) {
            setChallengeHistory(mergedHist)
            try { localStorage.setItem(`coursepilot_challenge_history_${currentUser.id}`, JSON.stringify(mergedHist)) } catch {}
          }

          await syncUserLearningStats({
            user_id: currentUser.id,
            full_name: data?.full_name || "Student",
            public_display_name: finalDisplayName,
            avatar_url: finalAvatar,
            semester: data?.semester || 3,
            section: data?.section || "B2",
            total_xp: xpSum.totalXP,
            this_week_xp: xpSum.thisWeekXP,
            streak: cloudStats?.streak || 0,
            reputation: cloudStats?.reputation || 91,
            solved_count: Math.floor(xpSum.totalXP / 25),
            xp_transactions: mergedTxs,
            challenge_history: mergedHist,
          })
        } catch (bgSyncErr) {
          console.warn("Background stats sync note:", bgSyncErr)
        }
      }, 50)
    } catch (err) {
      console.error("Profile fetch error:", err)
    } finally {
      if (isBlocking) {
        setProfileLoading(false)
        setAuthLoading(false)
      }
    }
  }

  async function handleLogout() {
    const currentId = user?.id || currentUserIdRef.current
    if (currentId) {
      await clearUserScopedCache(currentId)
      clearUserXPCache(currentId)
      clearUserChallengeHistory(currentId)
      clearAcademicMemoryCache()
      clearApiMemoryCache()
    }
    clearSessionActivity()
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    }
    currentUserIdRef.current = null
    setUser(null)
    setProfile(null)
    setDashboardTasks([])
    setDashboardExams([])
    setDashboardTopics([])
    setStudySessions([])
    setQuizAttempts([])
    setXpTransactions([])
    setChallengeHistory([])
    setSavedItemIds(new Set())
    setNotifications([])
    setDashboardSchedule([])
    setRecommendedTaskId(null)
    setCurrentPage("Home")
    setAuthMessage("")
    setAuthView(null)
  }

  // -------------------------------------------------------------
  // 3. PROGRESSIVE DASHBOARD DATA LOADING (CRITICAL FIRST)
  // -------------------------------------------------------------
  const loadAllDashboardData = useCallback(async () => {
    if (!user?.id || !profile) return

    // 1. Critical first: Timetable (0ms cached + background refresh)
    try {
      const cached = await getCachedClassSchedule(profile.semester, profile.section)
      if (cached && cached.length > 0) {
        setDashboardSchedule(cached)
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const data = await getClassSchedule(profile.semester, profile.section)
        if (data && data.length > 0) {
          setDashboardSchedule(data)
        }
      }
    } catch (error) {
      console.warn("Dashboard schedule note:", error)
    }

    // 2. Secondary in background: Tasks, Exams, Study sessions
    try {
      const [
        tasksResult,
        examsResult,
        topicsResult,
        sessionsResult,
        quizzesResult,
        xpData,
        histData,
        savedData,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, subject, deadline, importance, estimated_minutes, status, is_completed, completed_at, updated_at")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("deadline", { ascending: true })
          .limit(10),

        supabase
          .from("exams")
          .select("id, subject, exam_date, importance")
          .eq("user_id", user.id)
          .gte("exam_date", new Date().toISOString())
          .order("exam_date", { ascending: true })
          .limit(5),

        supabase
          .from("student_topic_progress")
          .select("id, mastery_score, status, syllabus_topic_id, syllabus_topics(id, topic_name, unit_number, academic_subjects(subject_name))")
          .eq("user_id", user.id)
          .limit(15),

        supabase
          .from("study_sessions")
          .select("id, duration_minutes, completed_at, created_at")
          .eq("user_id", user.id)
          .limit(10),

        supabase
          .from("topic_quiz_attempts")
          .select("id, score_percentage, attempted_at, created_at")
          .eq("user_id", user.id)
          .limit(10),

        getXPTransactions(user.id),
        getUserChallengeHistory(user.id),
        getUserSavedItems(user.id),
      ])

      const formattedTopics = (topicsResult.data || []).map((p) => ({
        id: p.syllabus_topic_id || p.id,
        topic_name: p.syllabus_topics?.topic_name || "Topic",
        subject: p.syllabus_topics?.academic_subjects?.subject_name || "Academic Subject",
        mastery_score: p.mastery_score || 0,
        status: p.status || "not_started",
      }))

      if (tasksResult.data) setDashboardTasks(tasksResult.data)
      if (examsResult.data) setDashboardExams(examsResult.data)
      if (formattedTopics.length > 0) setDashboardTopics(formattedTopics)
      if (sessionsResult.data) setStudySessions(sessionsResult.data)
      if (quizzesResult.data) setQuizAttempts(quizzesResult.data)
      if (xpData) setXpTransactions(xpData)
      if (histData) setChallengeHistory(histData)
      if (savedData) setSavedItemIds(savedData)

      // Flashcard due-review check removed (Study Material feature removed)

    } catch (err) {
      console.warn("Secondary academic data note:", err)
    }
  }, [user?.id, profile?.semester, profile?.section])

  useEffect(() => {
    if (user?.id && profile) {
      loadAllDashboardData()
    }
  }, [user?.id, profile?.semester, profile?.section, currentPage, loadAllDashboardData])

  // Stable navigation & interaction callbacks
  const handleOpenProfile = useCallback(() => setCurrentPage("Profile"), [])
  const handleOpenNotifications = useCallback(() => setNotificationModalOpen(true), [])
  const handleOpenSearch = useCallback(() => setSearchModalOpen(true), [])
  const handleNavigateToAcademics = useCallback(() => setCurrentPage("My Academics"), [])
  const handleToggleBonusMode = useCallback(() => setIsBonusMode((prev) => !prev), [])
  const handleNavigateToSyllabus = useCallback(() => setCurrentPage("Syllabus"), [])

  // Global search keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchModalOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  // Derived Social Learning & Streak Stats
  const xpSummary = useMemo(() => {
    return calculateXPSummary(xpTransactions)
  }, [xpTransactions])

  const dailyChallengeSet = useMemo(() => {
    return getDailyChallengeSet({
      userId: user?.id,
      challengeHistory,
      isBonusMode,
    })
  }, [user?.id, challengeHistory, isBonusMode])

  // Check Daily Set Completion Bonus
  useEffect(() => {
    if (dailyChallengeSet.isSetComplete && user?.id) {
      awardDailySetBonus(user.id).then((res) => {
        if (res?.bonusAwarded) {
          getXPTransactions(user.id).then(setXpTransactions)
        }
      })
    }
  }, [dailyChallengeSet.isSetComplete, user?.id])

  // Streak & Badge Engine
  const learningStreak = useMemo(() => {
    return calculateLearningStreak(studySessions, quizAttempts)
  }, [studySessions, quizAttempts])

  useEffect(() => {
    if (!user?.id) return
    const unlocked = evaluateAndAwardBadges({
      userId: user.id,
      streak: learningStreak.currentStreak,
      xpSummary,
      studySessions,
      quizAttempts,
    })
    if (unlocked.length > 0) {
      console.log(`[Badges] Student has ${unlocked.length} badges unlocked.`)
    }
  }, [user?.id, learningStreak.currentStreak, xpSummary.totalXP, studySessions.length, quizAttempts.length])

  // Schedule Math & Free Time
  const todaySchedule = useMemo(() => {
    return getTodaySchedule(dashboardSchedule)
  }, [dashboardSchedule])

  const nextClass = useMemo(() => {
    return getNextClass(dashboardSchedule)
  }, [dashboardSchedule])

  const freeTimeSlots = useMemo(() => {
    return getMergedFreeWindows(todaySchedule)
  }, [todaySchedule])

  const bestStudyWindow = useMemo(() => {
    return getBestStudyWindow(freeTimeSlots)
  }, [freeTimeSlots])

  const closestExam = useMemo(() => {
    return dashboardExams[0] || null
  }, [dashboardExams])

  const nextBestAction = useMemo(() => {
    return runNextBestActionEngine({
      profile,
      schedule: dashboardSchedule,
      tasks: dashboardTasks,
      exams: dashboardExams,
      syllabusTopics: dashboardTopics,
      studyWindow: bestStudyWindow,
    })
  }, [profile, dashboardSchedule, dashboardTasks, dashboardExams, dashboardTopics, bestStudyWindow])

  // Auto-fill recommended task from Next Best Action engine
  useEffect(() => {
    if (nextBestAction?.bestAction?.payload?.id) {
      setRecommendedTaskId(nextBestAction.bestAction.payload.id)
    }
  }, [nextBestAction])

  // Daily Study Plan
  const dailyPlan = useMemo(() => {
    return buildDailyPlan({
      classes: todaySchedule,
      tasks: dashboardTasks,
      exams: dashboardExams,
      topics: dashboardTopics,
      freeSlots: freeTimeSlots,
      recommendedTaskId,
    })
  }, [todaySchedule, dashboardTasks, dashboardExams, dashboardTopics, freeTimeSlots, recommendedTaskId])

  // Next Best Action navigation handler — handles all action_type values from the engine
  function handleExecuteNextAction(action) {
    if (!action) return

    // Handle actual NBA engine action types
    switch (action.action_type) {
      case "ATTEND_CLASS":
        setCurrentPage("My Academics")
        break
      case "SUBMIT_ASSIGNMENT":
      case "COMPLETE_ASSIGNMENT":
      case "open_tasks":
      case "start_focus_session":
        setCurrentPage("Tasks")
        break
      case "PREPARE_FOR_EXAM":
      case "open_exam_mode":
      case "start_exam_quiz":
        setCurrentPage("Exam Mode")
        break
      case "STUDY_TOPIC":
        setCurrentPage("Progress")
        break
      case "REVIEW_SCHEDULE":
        setCurrentPage("Progress")
        break
      case "open_academics":
        setCurrentPage("My Academics")
        break
      case "open_exams":
        setCurrentPage("Exams")
        break
      case "open_syllabus":
        setCurrentPage("Syllabus")
        break
      default:
        // Fallback: use page name from action object
        if (action.page) {
          if (action.page === "Focus Session") {
            setCurrentPage("Tasks")
          } else if (action.page === "Study Material") {
            setCurrentPage("Syllabus")
          } else {
            setCurrentPage(action.page)
          }
        }
    }
  }

  // Smart Academic Proactive Notifications Engine
  useEffect(() => {
    if (!user || !profile) return

    const generated = generateSmartNotifications({
      user,
      profile,
      schedule: dashboardSchedule,
      tasks: dashboardTasks,
      exams: dashboardExams,
      studySessions,
      topicProgress: dashboardTopics,
      preferences: notificationPreferences,
    })

    setNotifications(generated)

    // Dispatch native browser notification for high-priority items
    generated.forEach((notif) => {
      if (notif.is_urgent && notif.delivery_key && !deliveredKeys.has(notif.delivery_key)) {
        dispatchNativeBrowserNotification({
          title: notif.title,
          body: notif.body,
          tag: notif.delivery_key,
        })
        setDeliveredKeys((prev) => {
          const next = new Set(prev).add(notif.delivery_key)
          try {
            const today = new Date().toISOString().slice(0, 10)
            sessionStorage.setItem(`coursepilot_delivered_keys_${today}`, JSON.stringify(Array.from(next)))
          } catch {}
          return next
        })
      }
    })
  }, [
    user,
    profile,
    dashboardSchedule,
    dashboardTasks,
    dashboardExams,
    studySessions,
    dashboardTopics,
    notificationPreferences,
  ])

  function handleNotificationAction(notif) {
    setNotificationModalOpen(false)
    if (!notif?.action_type) return

    if (notif.action_type === "open_tasks") {
      setCurrentPage("Tasks")
    } else if (notif.action_type === "open_exams") {
      setCurrentPage("Exams")
    } else if (notif.action_type === "open_exam_mode") {
      setCurrentPage("Exam Mode")
    } else if (notif.action_type === "open_academics") {
      setCurrentPage("My Academics")
    } else if (notif.action_type === "open_syllabus") {
      setCurrentPage("Syllabus")
    } else if (notif.action_type === "open_progress") {
      setCurrentPage("Progress")
    }
  }

  function handleNavigate(page, payload) {
    if (payload?.taskId) {
      setCurrentPage("Tasks")
      return
    }
    if (payload?.examId) {
      setCurrentPage("Exams")
      return
    }
    if (page === "Focus Session" || page === "Study Material" || page === "Study Pack" || page === "Flashcards") {
      setCurrentPage("Home")
      return
    }
    if (page) {
      setCurrentPage(page)
    }
  }

  // -------------------------------------------------------------
  // 4. RENDER GUARDS (Skeletons & Fast App Shell)
  // -------------------------------------------------------------
  if (authLoading || (user && profileLoading && !profile)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] p-6 text-slate-900">
        <CoursePilotMark className="h-12 w-12 shadow-md animate-pulse" />
        <p className="mt-4 text-sm font-semibold tracking-wide text-slate-600">
          Loading CoursePilot...
        </p>
      </div>
    )
  }

  if (!user) {
    if (
      authView === "login" ||
      authView === "signup" ||
      authView === "forgot" ||
      authView === "reset"
    ) {
      return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F7F7F2] p-6 dark:bg-[#0f1416]"><CoursePilotMark className="h-10 w-10 animate-pulse" /></div>}>
          <PWAInstallBanner />
          <Auth
            initialMode={authView}
            initialMessage={authMessage}
            onLogin={(newUser) => {
              setUser(newUser)
              setAuthView(null)
              setAuthMessage("")
              recordUserActivity()
            }}
            onBackToLanding={() => {
              setAuthView(null)
              setAuthMessage("")
            }}
          />
        </Suspense>
      )
    }

    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F7F7F2] p-6 dark:bg-[#0f1416]"><CoursePilotMark className="h-10 w-10 animate-pulse" /></div>}>
        <PWAInstallBanner />
        <LandingPage
          user={user}
          onGetStarted={() => {
            setAuthMessage("")
            setAuthView("signup")
          }}
          onSignIn={() => {
            setAuthMessage("")
            setAuthView("login")
          }}
          onGoToDashboard={() => setCurrentPage("Dashboard")}
        />
      </Suspense>
    )
  }

  if (!profile) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F7F7F2] p-6 dark:bg-[#0f1416]"><CoursePilotMark className="h-10 w-10 animate-pulse" /></div>}>
        <PWAInstallBanner />
        <ProfileSetup
          user={user}
          onComplete={() => fetchProfile(user, true)}
        />
      </Suspense>
    )
  }

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="flex min-h-screen bg-[#F7F7F2] text-[#18181B] dark:bg-[#0f1416] dark:text-[#f4f4f5]">
      <PWAInstallBanner />

      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        profile={profile}
        onLogout={handleLogout}
        onOpenNotifications={() => setNotificationModalOpen(true)}
        unreadCount={unreadNotifCount}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
      />

      <div className="min-w-0 flex-1 flex flex-col">
        {/* Mobile Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E4E4E7] bg-white/95 px-4 backdrop-blur-md lg:hidden dark:border-[#27343a] dark:bg-[#0f1416]/95">
          <div className="flex items-center gap-2">
            <CoursePilotMark className="h-6 w-6" />
            <span className="text-sm font-bold text-[#18181B] dark:text-[#f4f4f5]">{currentPage}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Academic Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-[#F7F7F2] px-3 py-1 text-xs text-[#52525B] hover:border-[#0F766E]/40 hover:bg-white transition shadow-2xs group dark:border-[#27343a] dark:bg-[#182226] dark:text-[#a1a1aa]"
              title="Search your academics (Ctrl+K)"
            >
              <span>🔍</span>
              <span className="hidden sm:inline font-medium">Search...</span>
            </button>

            <button
              type="button"
              onClick={() => setNotificationModalOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F7F7F2] hover:text-[#18181B] transition shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
              aria-label="Notifications"
            >
              <span className="text-xs">🔔</span>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0F766E] text-[9px] font-bold text-white shadow-2xs">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Offline / Sync Badge */}
            {!isOnline ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-[#D97706]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Offline
              </span>
            ) : pendingSyncCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#0F766E] dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E] animate-spin"></span>
                ↻ {pendingSyncCount}
              </span>
            ) : (
              <span className="rounded-full bg-[#F7F7F2] px-2.5 py-1 text-[11px] font-bold text-[#52525B] border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#a1a1aa]">
                Sem {profile.semester}
              </span>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 pb-24 lg:pb-0">
          {/* Offline Notice Banner */}
          {!isOnline && showOfflineBanner && (
            <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                <span>You&apos;re currently offline. Your timetable, syllabus, and today&apos;s classes are fully available.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineBanner(false)}
                className="text-amber-100 hover:text-white px-2 py-0.5 rounded text-xs transition font-bold"
                aria-label="Dismiss offline banner"
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. HOME / DASHBOARD (Rendered Instantly) */}
          {(currentPage === "Home" || currentPage === "Dashboard") && (
            <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:py-6 space-y-6">
              <HomeHeader
                user={user}
                profile={profile}
                totalXP={xpSummary.totalXP}
                thisWeekXP={xpSummary.thisWeekXP}
                streak={learningStreak.currentStreak}
                reputation={profile.reputation || 91}
                unreadCount={unreadNotifCount}
                onOpenProfile={handleOpenProfile}
                onOpenNotifications={handleOpenNotifications}
                onOpenSearch={handleOpenSearch}
              />

              <NextBestActionCard
                action={nextBestAction?.bestAction}
                onExecute={handleExecuteNextAction}
                onOpenTasks={() => setCurrentPage("Tasks")}
                onOpenExams={() => setCurrentPage("Exams")}
                onOpenAcademics={handleNavigateToAcademics}
              />

              <TodayTimetableStrip
                schedule={dashboardSchedule}
                profile={profile}
                onNavigateToAcademics={handleNavigateToAcademics}
              />

              <DailyProgressCard
                completedCount={dailyChallengeSet.completedCount}
                totalCount={dailyChallengeSet.totalCount}
                isSetComplete={dailyChallengeSet.isSetComplete}
                isBonusMode={isBonusMode}
                adaptiveLevel={dailyChallengeSet.adaptiveLevel}
                onToggleBonusMode={handleToggleBonusMode}
              />

              <SocialFeed
                user={user}
                profile={profile}
                topicProgress={dashboardTopics}
                exams={dashboardExams}
                completedKeys={xpSummary.completedKeys}
                savedItemIds={savedItemIds}
                selectedChallenge={activeSelectedChallenge}
                onClearSelectedChallenge={() => setActiveSelectedChallenge(null)}
                onXPUpdated={loadAllDashboardData}
                onChallengeSolved={loadAllDashboardData}
                onSavedItemToggled={(itemId, isSaved) => {
                  setSavedItemIds((prev) => {
                    const next = new Set(prev)
                    if (isSaved) next.add(itemId)
                    else next.delete(itemId)
                    return next
                  })
                }}
              />
            </div>
          )}

          {/* 2. LAZY LOADED SUBPAGES */}
          {currentPage === "My Academics" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <MyAcademics profile={profile} />
            </Suspense>
          )}

          {currentPage === "Syllabus" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Syllabus profile={profile} />
            </Suspense>
          )}

          {currentPage === "Progress" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Progress user={user} profile={profile} />
            </Suspense>
          )}

          {currentPage === "Tasks" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Tasks user={user} />
            </Suspense>
          )}

          {currentPage === "Exams" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Exams user={user} />
            </Suspense>
          )}

          {currentPage === "Exam Mode" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <ExamMode user={user} profile={profile} />
            </Suspense>
          )}

          {currentPage === "Leaderboard" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Leaderboard
                user={user}
                profile={profile}
                totalXP={xpSummary.totalXP}
                thisWeekXP={xpSummary.thisWeekXP}
                streak={learningStreak.currentStreak}
                reputation={profile.reputation || 91}
                onNavigate={setCurrentPage}
              />
            </Suspense>
          )}

          {currentPage === "Saved" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <SavedChallenges
                user={user}
                profile={profile}
                savedItemIds={savedItemIds}
                completedKeys={xpSummary.completedKeys}
                onSavedUpdated={(itemId, isSaved) => {
                  setSavedItemIds((prev) => {
                    const next = new Set(prev)
                    if (isSaved) next.add(itemId)
                    else next.delete(itemId)
                    return next
                  })
                }}
                onOpenChallenge={(item) => {
                  setActiveSelectedChallenge(item)
                  setCurrentPage("Home")
                }}
                onNavigate={setCurrentPage}
                onChallengeSolved={() => loadAllDashboardData()}
              />
            </Suspense>
          )}

          {currentPage === "Profile" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <MyProfile
                user={user}
                profile={profile}
                totalXP={xpSummary.totalXP}
                thisWeekXP={xpSummary.thisWeekXP}
                streak={learningStreak.currentStreak}
                reputation={profile.reputation || 91}
                topicProgress={dashboardTopics}
                quizAttempts={quizAttempts}
                xpTransactions={xpTransactions}
                studySessions={studySessions}
                onProfileUpdated={(updated) => setProfile(updated)}
                onNavigate={setCurrentPage}
              />
            </Suspense>
          )}
        </main>
      </div>

      {/* Global Academic Search Modal (Lazy Loaded) */}
      {searchModalOpen && (
        <Suspense fallback={null}>
          <GlobalSearch
            isOpen={searchModalOpen}
            onClose={() => setSearchModalOpen(false)}
            user={user}
            profile={profile}
            currentSemester={profile?.semester || 3}
            currentSection={profile?.section || "B2"}
            currentUserId={user?.id}
            onNavigate={(page, payload) => {
              handleNavigate(page, payload)
              setSearchModalOpen(false)
            }}
          />
        </Suspense>
      )}

      {/* Proactive Academic Notification Modal (Lazy Loaded) */}
      {notificationModalOpen && (
        <Suspense fallback={null}>
          <NotificationCenter
            isOpen={notificationModalOpen}
            onClose={() => setNotificationModalOpen(false)}
            notifications={notifications}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={handleMarkAllNotificationsAsRead}
            onDismiss={handleDismissNotification}
            onClearAll={handleClearAllNotifications}
            onNavigate={handleNotificationAction}
            preferences={notificationPreferences}
            onUpdatePreferences={updateNotificationPreferences}
          />
        </Suspense>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        unreadCount={unreadNotifCount}
        onOpenNotifications={() => setNotificationModalOpen(true)}
        onOpenSearch={() => setSearchModalOpen(true)}
      />
    </div>
  )
}

export default App
