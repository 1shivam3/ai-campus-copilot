import { useEffect, useMemo, useCallback, useState, lazy, Suspense } from "react"
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
// ROUTE-BASED CODE SPLITTING (Lazy-loaded Subpages & Heavy Modals)
// Keeps initial bundle ultra-compact and speeds up first frame render
// =========================================================
const MyAcademics = lazy(() => import("./pages/MyAcademics"))
const Syllabus = lazy(() => import("./pages/Syllabus"))
const Progress = lazy(() => import("./pages/Progress"))
const Tasks = lazy(() => import("./pages/Tasks"))
const Exams = lazy(() => import("./pages/Exams"))
const ExamMode = lazy(() => import("./pages/ExamMode"))
const StudyMaterial = lazy(() => import("./pages/StudyMaterial"))
const StudyPack = lazy(() => import("./pages/StudyPack"))
const Flashcards = lazy(() => import("./pages/Flashcards"))
const FocusSession = lazy(() => import("./pages/FocusSession"))
const MyProfile = lazy(() => import("./pages/MyProfile"))
const Leaderboard = lazy(() => import("./pages/Leaderboard"))
const SavedChallenges = lazy(() => import("./pages/SavedChallenges"))
const Auth = lazy(() => import("./pages/Auth"))
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"))
const LandingPage = lazy(() => import("./pages/LandingPage"))
const GlobalSearch = lazy(() => import("./components/GlobalSearch"))
const NotificationCenter = lazy(() => import("./components/NotificationCenter"))
const StudyMaterialReader = lazy(() => import("./pages/StudyMaterialReader"))
const ExamPaperAnalysis = lazy(() => import("./pages/ExamPaperAnalysis"))

import { getClassSchedule } from "./lib/academicData"
import { getTodaySchedule, getNextClass } from "./lib/todaySchedule"
import { getMergedFreeWindows, getBestStudyWindow } from "./utils/freeTime"
import { buildDailyPlan } from "./utils/dailyPlan"
import { getWeakestSyllabusTopic, calculateSyllabusMastery } from "./utils/syllabusProgress"
import { calculateExamReadiness } from "./utils/examReadiness"
import { runNextBestActionEngine, getDaysRemaining } from "./utils/nextBestActionEngine"
import { generateSmartNotifications, DEFAULT_NOTIFICATION_PREFERENCES } from "./utils/notificationEngine"
import { dispatchNativeBrowserNotification } from "./lib/notifications"
import { initTheme } from "./utils/theme"
import { getXPTransactions, calculateXPSummary } from "./utils/xpEngine"
import { calculateLearningStreak } from "./utils/streakEngine"
import { evaluateAndAwardBadges } from "./utils/badgeEngine"
import {
  getUserChallengeHistory,
  getDailyChallengeSet,
  awardDailySetBonus,
} from "./utils/dailyChallengeEngine"
import { getUserSavedItems } from "./utils/socialInteractions"
import { fetchUserStats, syncUserLearningStats } from "./lib/api"
import {
  saveUserProfile,
  getCachedUserProfile,
  getCachedClassSchedule,
  clearUserScopedCache,
} from "./lib/offlineDb"
import { initSyncQueueListener, getPendingQueueCount, processSyncQueue } from "./lib/syncQueue"

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
  const [authLoading, setAuthLoading] = useState(true)
  const [authView, setAuthView] = useState(null) // null (landing), "login", "signup"
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [showOfflineBanner, setShowOfflineBanner] = useState(true)
  const [currentPage, setCurrentPage] = useState("Home")
  const [selectedMaterialIdForReader, setSelectedMaterialIdForReader] = useState(null)
  const [selectedMaterialIdForStudyPack, setSelectedMaterialIdForStudyPack] = useState(null)
  const [selectedMaterialIdForFlashcards, setSelectedMaterialIdForFlashcards] = useState(null)
  const [selectedMaterialIdForAnalysis, setSelectedMaterialIdForAnalysis] = useState(null)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [dueFlashcardsCount, setDueFlashcardsCount] = useState(0)
  const [dueFlashcardsMaterialId, setDueFlashcardsMaterialId] = useState(null)
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
  useEffect(() => {
    initTheme()
    initSyncQueueListener(() => user?.id)

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
        setUser(currentUser)

        if (currentUser) {
          getPendingQueueCount(currentUser.id).then(setPendingSyncCount)

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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null
      setUser(currentUser)

      if (currentUser) {
        getPendingQueueCount(currentUser.id).then(setPendingSyncCount)
        fetchProfile(currentUser, false)
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("coursepilot:sync-queue-updated", handleQueueUpdate)
    }
  }, [user?.id])

  // -------------------------------------------------------------
  // 2. PROFILE LOADING & ASYNCHRONOUS STATS SYNC
  // -------------------------------------------------------------
  async function fetchProfile(currentUser, isBlocking = false) {
    if (!currentUser?.id) return
    if (isBlocking) setProfileLoading(true)

    // 0. Instant Cache Fallback
    try {
      const cachedProfile = await getCachedUserProfile(currentUser.id)
      if (cachedProfile) {
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
      // 1. Fetch minimum required profile columns
      const { data, error } = await supabase
        .from("student_profiles")
        .select("id, full_name, semester, section, avatar_url, public_display_name, reputation")
        .eq("id", currentUser.id)
        .maybeSingle()

      if (data) {
        saveUserProfile(data)
        setProfile({
          id: currentUser.id,
          full_name: data.full_name || currentUser.email?.split("@")[0] || "Student",
          semester: data.semester || 3,
          section: data.section || "B2",
          avatar_url: data.avatar_url || null,
          public_display_name: data.public_display_name || data.full_name || "Student",
          reputation: data.reputation || 91,
        })
      }

      // Unblock UI as soon as Supabase profile is available
      if (isBlocking) {
        setAuthLoading(false)
        setProfileLoading(false)
      }

      // 2. Non-blocking background cross-device stats synchronization
      setTimeout(async () => {
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
            const rawH = localStorage.getItem("coursepilot_challenge_history")
            if (rawH) localHist = JSON.parse(rawH)
          } catch {}
          const cloudHist = Array.isArray(cloudStats?.challenge_history) ? cloudStats.challenge_history : []
          const histMap = new Map()
          localHist.forEach((h) => histMap.set(h.challenge_id, h))
          cloudHist.forEach((h) => histMap.set(h.challenge_id, h))
          const mergedHist = Array.from(histMap.values())

          if (mergedHist.length > 0) {
            setChallengeHistory(mergedHist)
            try { localStorage.setItem("coursepilot_challenge_history", JSON.stringify(mergedHist)) } catch {}
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
    if (user?.id) {
      await clearUserScopedCache(user.id)
    }
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    }
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
    setSelectedMaterialIdForReader(null)
    setRecommendedTaskId(null)
    setCurrentPage("Home")
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

      // Background due flashcards check
      try {
        const now = new Date().toISOString()
        const { data: fcData } = await supabase
          .from("study_flashcards")
          .select("id, study_material_id, next_review_at")
          .eq("user_id", user.id)
          .lte("next_review_at", now)
          .limit(1)

        if (fcData && fcData.length > 0) {
          setDueFlashcardsCount(fcData.length)
          setDueFlashcardsMaterialId(fcData[0].study_material_id)
        } else {
          setDueFlashcardsCount(0)
          setDueFlashcardsMaterialId(null)
        }
      } catch {}
    } catch (err) {
      console.warn("Secondary academic data note:", err)
    }
  }, [user?.id, profile?.semester, profile?.section])

  useEffect(() => {
    if (user?.id && profile && (currentPage === "Home" || currentPage === "Dashboard")) {
      loadAllDashboardData()
    }
  }, [user?.id, profile?.semester, profile?.section, currentPage, loadAllDashboardData])

  // Stable navigation & interaction callbacks
  const handleOpenProfile = useCallback(() => setCurrentPage("Profile"), [])
  const handleOpenNotifications = useCallback(() => setNotificationModalOpen(true), [])
  const handleOpenSearch = useCallback(() => setSearchModalOpen(true), [])
  const handleNavigateToAcademics = useCallback(() => setCurrentPage("My Academics"), [])
  const handleToggleBonusMode = useCallback(() => setIsBonusMode((prev) => !prev), [])
  const handleOpenFocusSession = useCallback(() => setCurrentPage("Focus Session"), [])
  const handleNavigateToSyllabus = useCallback(() => setCurrentPage("Syllabus"), [])

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
      tasks: dashboardTasks,
      exams: dashboardExams,
      topics: dashboardTopics,
      nextClass,
      bestStudyWindow,
    })
  }, [dashboardTasks, dashboardExams, dashboardTopics, nextClass, bestStudyWindow])

  // Auto-fill recommended task from Next Best Action engine
  useEffect(() => {
    if (nextBestAction?.task_id) {
      setRecommendedTaskId(nextBestAction.task_id)
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

  // Next Best Action navigation handler
  function handleExecuteNextAction(action) {
    if (!action) return
    if (action.action_type === "start_focus_session") {
      setCurrentPage("Focus Session")
    } else if (action.action_type === "navigate_to_study_material") {
      setCurrentPage("Study Material")
    } else if (action.action_type === "open_syllabus") {
      setCurrentPage("Syllabus")
    } else if (action.action_type === "open_tasks") {
      setCurrentPage("Tasks")
    } else if (action.action_type === "open_academics") {
      setCurrentPage("My Academics")
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
      flashcardCount: dueFlashcardsCount,
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
    dueFlashcardsCount,
    notificationPreferences,
  ])

  function handleNotificationAction(notif) {
    setNotificationModalOpen(false)
    if (!notif?.action_type) return

    if (notif.action_type === "open_flashcards") {
      if (dueFlashcardsMaterialId) {
        setSelectedMaterialIdForFlashcards(dueFlashcardsMaterialId)
        setCurrentPage("Flashcards")
      } else {
        setCurrentPage("Study Material")
      }
    } else if (notif.action_type === "open_tasks") {
      setCurrentPage("Tasks")
    } else if (notif.action_type === "open_exams") {
      setCurrentPage("Exams")
    } else if (notif.action_type === "open_academics") {
      setCurrentPage("My Academics")
    } else if (notif.action_type === "open_progress") {
      setCurrentPage("Progress")
    }
  }

  function handleNavigate(page, payload) {
    if (payload?.materialId) {
      if (payload.action === "study_pack") {
        setSelectedMaterialIdForStudyPack(payload.materialId)
        setCurrentPage("Study Pack")
        return
      }
      if (payload.action === "flashcards") {
        setSelectedMaterialIdForFlashcards(payload.materialId)
        setCurrentPage("Flashcards")
        return
      }
      if (payload.action === "analysis") {
        setSelectedMaterialIdForAnalysis(payload.materialId)
        setCurrentPage("Study Material")
        return
      }
      setSelectedMaterialIdForReader(payload.materialId)
      setCurrentPage("Study Material")
      return
    }
    setCurrentPage(page)
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
    if (authView === "login" || authView === "signup") {
      return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6"><CoursePilotMark className="h-10 w-10 animate-pulse" /></div>}>
          <PWAInstallBanner />
          <Auth
            initialMode={authView}
            onLogin={(newUser) => {
              setUser(newUser)
              setAuthView(null)
            }}
            onBackToLanding={() => setAuthView(null)}
          />
        </Suspense>
      )
    }

    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6"><CoursePilotMark className="h-10 w-10 animate-pulse" /></div>}>
        <PWAInstallBanner />
        <LandingPage
          user={user}
          onGetStarted={() => setAuthView("signup")}
          onSignIn={() => setAuthView("login")}
          onGoToDashboard={() => setCurrentPage("Dashboard")}
        />
      </Suspense>
    )
  }

  if (!profile) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6"><CoursePilotMark className="h-10 w-10 animate-pulse" /></div>}>
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
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2">
            <CoursePilotMark className="h-6 w-6" />
            <span className="text-sm font-bold text-slate-900">{currentPage}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Academic Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1 text-xs text-slate-500 hover:border-slate-300 hover:bg-white transition shadow-2xs group"
              title="Search your academics (Ctrl+K)"
            >
              <span>🔍</span>
              <span className="hidden sm:inline font-medium">Search...</span>
            </button>

            <button
              type="button"
              onClick={() => setNotificationModalOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-xs"
              aria-label="Notifications"
            >
              <span className="text-xs">🔔</span>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-xs">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Offline / Sync Badge */}
            {!isOnline ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Offline
              </span>
            ) : pendingSyncCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-spin"></span>
                ↻ {pendingSyncCount}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
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
                onXPUpdated={loadAllDashboardData}
                onOpenFocusSession={handleOpenFocusSession}
                onChallengeSolved={loadAllDashboardData}
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

          {currentPage === "Study Material" && (
            selectedMaterialIdForAnalysis ? (
              <Suspense fallback={<PageSuspenseFallback />}>
                <ExamPaperAnalysis
                  materialId={selectedMaterialIdForAnalysis}
                  user={user}
                  profile={profile}
                  onBack={() => setSelectedMaterialIdForAnalysis(null)}
                  onOpenReader={(id) => {
                    setSelectedMaterialIdForAnalysis(null)
                    setSelectedMaterialIdForReader(id)
                  }}
                  onOpenExamMode={() => {
                    setSelectedMaterialIdForAnalysis(null)
                    setCurrentPage("Exam Mode")
                  }}
                  onOpenStudyPack={(id) => {
                    setSelectedMaterialIdForAnalysis(null)
                    setSelectedMaterialIdForStudyPack(id)
                    setCurrentPage("Study Pack")
                  }}
                  onOpenFlashcards={(id) => {
                    setSelectedMaterialIdForAnalysis(null)
                    setSelectedMaterialIdForFlashcards(id)
                    setCurrentPage("Flashcards")
                  }}
                />
              </Suspense>
            ) : selectedMaterialIdForReader ? (
              <Suspense fallback={<PageSuspenseFallback />}>
                <StudyMaterialReader
                  materialId={selectedMaterialIdForReader}
                  user={user}
                  profile={profile}
                  onBack={() => setSelectedMaterialIdForReader(null)}
                  onNavigateToSyllabus={() => setCurrentPage("Syllabus")}
                  onOpenStudyPack={(id) => {
                    setSelectedMaterialIdForStudyPack(id)
                    setCurrentPage("Study Pack")
                  }}
                  onOpenFlashcards={(id) => {
                    setSelectedMaterialIdForFlashcards(id)
                    setCurrentPage("Flashcards")
                  }}
                  onOpenExamAnalysis={(id) => {
                    setSelectedMaterialIdForAnalysis(id)
                  }}
                />
              </Suspense>
            ) : (
              <Suspense fallback={<PageSuspenseFallback />}>
                <StudyMaterial
                  user={user}
                  profile={profile}
                  onOpenReader={(id) => setSelectedMaterialIdForReader(id)}
                  onOpenStudyPack={(id) => {
                    setSelectedMaterialIdForStudyPack(id)
                    setCurrentPage("Study Pack")
                  }}
                  onOpenFlashcards={(id) => {
                    setSelectedMaterialIdForFlashcards(id)
                    setCurrentPage("Flashcards")
                  }}
                  onOpenExamAnalysis={(id) => {
                    setSelectedMaterialIdForAnalysis(id)
                  }}
                  onNavigateToSyllabus={() => setCurrentPage("Syllabus")}
                />
              </Suspense>
            )
          )}

          {currentPage === "Study Pack" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <StudyPack
                user={user}
                profile={profile}
                initialMaterialId={selectedMaterialIdForStudyPack}
                onBack={() => {
                  setSelectedMaterialIdForStudyPack(null)
                  setCurrentPage("Study Material")
                }}
                onOpenReader={(id) => {
                  setSelectedMaterialIdForReader(id)
                  setCurrentPage("Study Material")
                }}
                onOpenFlashcards={(id) => {
                  setSelectedMaterialIdForFlashcards(id)
                  setCurrentPage("Flashcards")
                }}
              />
            </Suspense>
          )}

          {currentPage === "Flashcards" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Flashcards
                user={user}
                profile={profile}
                initialMaterialId={selectedMaterialIdForFlashcards}
                onBack={() => {
                  setSelectedMaterialIdForFlashcards(null)
                  setCurrentPage("Study Material")
                }}
                onOpenReader={(id) => {
                  setSelectedMaterialIdForReader(id)
                  setCurrentPage("Study Material")
                }}
                onOpenStudyPack={(id) => {
                  setSelectedMaterialIdForStudyPack(id)
                  setCurrentPage("Study Pack")
                }}
              />
            </Suspense>
          )}

          {currentPage === "Focus Session" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <FocusSession user={user} profile={profile} />
            </Suspense>
          )}

          {currentPage === "Leaderboard" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <Leaderboard user={user} profile={profile} />
            </Suspense>
          )}

          {currentPage === "Saved" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <SavedChallenges
                user={user}
                profile={profile}
                onChallengeSolved={() => loadAllDashboardData()}
              />
            </Suspense>
          )}

          {currentPage === "Profile" && (
            <Suspense fallback={<PageSuspenseFallback />}>
              <MyProfile
                user={user}
                profile={profile}
                onUpdateProfile={(updated) => setProfile(updated)}
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
            onNavigate={(page, payload) => {
              handleNavigate(page, payload)
              setSearchModalOpen(false)
            }}
            currentSemester={profile?.semester || 3}
            currentSection={profile?.section || "B2"}
            currentUserId={user?.id}
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
