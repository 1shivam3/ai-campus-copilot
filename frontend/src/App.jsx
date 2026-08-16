import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import Sidebar from "./components/Sidebar"
import MyAcademics from "./pages/MyAcademics"
import Syllabus from "./pages/Syllabus"
import Progress from "./pages/Progress"
import Tasks from "./pages/Tasks"
import Exams from "./pages/Exams"
import ExamMode from "./pages/ExamMode"
import StudyMaterial from "./pages/StudyMaterial"
import StudyMaterialReader from "./pages/StudyMaterialReader"
import StudyPack from "./pages/StudyPack"
import Flashcards from "./pages/Flashcards"
import ExamPaperAnalysis from "./pages/ExamPaperAnalysis"
import FocusSession from "./pages/FocusSession"
import MyProfile from "./pages/MyProfile"
import Auth from "./pages/Auth"
import ProfileSetup from "./pages/ProfileSetup"
import LandingPage from "./pages/LandingPage"
import { getClassSchedule } from "./lib/academicData"
import { getTodaySchedule, getNextClass } from "./lib/todaySchedule"
import { getMergedFreeWindows, getBestStudyWindow } from "./utils/freeTime"
import { buildDailyPlan } from "./utils/dailyPlan"
import { getWeakestSyllabusTopic, calculateSyllabusMastery } from "./utils/syllabusProgress"
import { calculateExamReadiness } from "./utils/examReadiness"
import { runNextBestActionEngine, getDaysRemaining } from "./utils/nextBestActionEngine"
import { SkeletonBanner, SkeletonCard, SkeletonList } from "./components/SkeletonLoader"
import EmptyState from "./components/EmptyState"
import { CoursePilotMark } from "./components/CoursePilotLogo"
import PWAInstallBanner from "./components/PWAInstallBanner"
import { generateSmartNotifications, DEFAULT_NOTIFICATION_PREFERENCES } from "./utils/notificationEngine"
import { dispatchNativeBrowserNotification } from "./lib/notifications"
import NotificationCenter from "./components/NotificationCenter"
import GlobalSearch from "./components/GlobalSearch"
import MobileBottomNav from "./components/MobileBottomNav"
import { initTheme } from "./utils/theme"
import HomeHeader from "./components/HomeHeader"
import TodayTimetableStrip from "./components/TodayTimetableStrip"
import SocialFeed from "./components/SocialFeed"
import DailyProgressCard from "./components/DailyProgressCard"
import Leaderboard from "./pages/Leaderboard"
import SavedChallenges from "./pages/SavedChallenges"
import { getXPTransactions, calculateXPSummary } from "./utils/xpEngine"
import { calculateLearningStreak } from "./utils/streakEngine"
import { evaluateAndAwardBadges } from "./utils/badgeEngine"
import {
  getUserChallengeHistory,
  getDailyChallengeSet,
  awardDailySetBonus,
} from "./utils/dailyChallengeEngine"
import { getUserSavedItems } from "./utils/socialInteractions"

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authView, setAuthView] = useState(null) // null (landing), "login", "signup"
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
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
  const [academicSubjects, setAcademicSubjects] = useState([])
  const [syllabusTopics, setSyllabusTopics] = useState([])
  const [topicProgress, setTopicProgress] = useState({})
  const [xpTransactions, setXpTransactions] = useState([])
  const [studySessions, setStudySessions] = useState([])
  const [quizAttempts, setQuizAttempts] = useState([])
  const [challengeHistory, setChallengeHistory] = useState([])
  const [savedItemIds, setSavedItemIds] = useState(() => new Set())
  const [isBonusMode, setIsBonusMode] = useState(false)
  const [activeSelectedChallenge, setActiveSelectedChallenge] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [deliveredKeys, setDeliveredKeys] = useState(() => new Set())
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

  function handleClearAllNotifications() {
    setNotifications([])
  }

  useEffect(() => {
    initTheme()
    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null
      setUser(currentUser)

      if (currentUser) {
        await fetchProfile(currentUser)
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function checkUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const currentUser = session?.user || null
      setUser(currentUser)

      if (currentUser) {
        await fetchProfile(currentUser)
      }
    } catch (err) {
      console.error("Auth check error:", err)
    } finally {
      setAuthLoading(false)
    }
  }

  async function fetchProfile(currentUser) {
    if (!currentUser?.id) return
    setProfileLoading(true)

    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle()

      if (error) {
        console.error("Profile load error:", error)
        const savedAvatar = localStorage.getItem(`coursepilot_avatar_${currentUser.id}`)
        const savedDisplayName = localStorage.getItem(`coursepilot_display_name_${currentUser.id}`)
        setProfile({
          id: currentUser.id,
          full_name: currentUser.email?.split("@")[0] || "Student",
          semester: 3,
          section: "B2",
          avatar_url: savedAvatar || null,
          public_display_name: savedDisplayName || null,
        })
      } else {
        const savedAvatar = localStorage.getItem(`coursepilot_avatar_${currentUser.id}`)
        const savedDisplayName = localStorage.getItem(`coursepilot_display_name_${currentUser.id}`)
        setProfile({
          ...(data || {}),
          avatar_url: data?.avatar_url || savedAvatar || null,
          public_display_name: data?.public_display_name || savedDisplayName || data?.full_name || null,
        })
      }
    } catch (err) {
      console.error("Profile fetch error:", err)
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    }
    setUser(null)
    setProfile(null)
  }

  useEffect(() => {
    if (user?.id && profile) {
      loadAllDashboardData()
    }
  }, [user, profile, currentPage])

  // Parallelized dashboard data fetching
  async function loadAllDashboardData() {
    if (!user?.id || !profile) return
    setDashboardLoading(true)

    try {
      await Promise.all([
        fetchAcademicData(),
        loadSyllabusProgress(),
        loadDashboardSchedule(),
      ])
    } catch (e) {
      console.error("Dashboard data load error:", e)
    } finally {
      setDashboardLoading(false)
    }
  }

  async function loadDashboardSchedule() {
    try {
      const data = await getClassSchedule(profile.semester, profile.section)
      setDashboardSchedule(data || [])
    } catch (error) {
      console.error("Dashboard schedule error:", error)
    }
  }

  async function loadSyllabusProgress() {
    if (!user?.id || !profile) return

    try {
      const { data: subjectData, error: subjectError } = await supabase
        .from("academic_subjects")
        .select("id, subject_code, subject_name")
        .eq("semester", profile.semester)
        .eq("section", profile.section)

      if (subjectError) {
        console.error(subjectError)
        return
      }

      setAcademicSubjects(subjectData || [])
      const subjectIds = (subjectData || []).map((item) => item.id)

      if (!subjectIds.length) {
        setSyllabusTopics([])
        setTopicProgress({})
        return
      }

      const { data: topicData, error: topicError } = await supabase
        .from("syllabus_topics")
        .select("id, subject_id, unit_number, topic_name, description, academic_subjects(subject_name, subject_code)")
        .in("subject_id", subjectIds)

      if (topicError) {
        console.error(topicError)
        return
      }

      const topicIds = (topicData || []).map((topic) => topic.id)
      let progressData = []

      if (topicIds.length > 0) {
        const { data, error } = await supabase
          .from("student_topic_progress")
          .select("id, syllabus_topic_id, status, mastery_score")
          .eq("user_id", user.id)
          .in("syllabus_topic_id", topicIds)

        if (!error && data) {
          progressData = data
        }
      }

      const progressMap = {}
      progressData.forEach((item) => {
        progressMap[item.syllabus_topic_id] = item
      })

      const normalizedTopics = (topicData || []).map((t) => ({
        ...t,
        subject_name: t.academic_subjects?.subject_name || "",
        subject_code: t.academic_subjects?.subject_code || "",
      }))

      setSyllabusTopics(normalizedTopics)
      setTopicProgress(progressMap)
    } catch (err) {
      console.error("Syllabus progress loading error:", err)
    }
  }

  async function fetchAcademicData() {
    if (!user?.id) return

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
          .order("deadline", { ascending: true }),

        supabase
          .from("exams")
          .select("id, subject, exam_date, importance")
          .eq("user_id", user.id)
          .gte("exam_date", new Date().toISOString())
          .order("exam_date", { ascending: true }),

        supabase
          .from("student_topic_progress")
          .select("id, mastery_score, status, syllabus_topic_id, syllabus_topics(id, topic_name, unit_number, academic_subjects(subject_name))")
          .eq("user_id", user.id),

        supabase
          .from("study_sessions")
          .select("id, duration_minutes, completed_at, created_at")
          .eq("user_id", user.id),

        supabase
          .from("topic_quiz_attempts")
          .select("id, score_percentage, attempted_at, created_at")
          .eq("user_id", user.id),

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

      setDashboardTasks(tasksResult.data || [])
      setDashboardExams(examsResult.data || [])
      setDashboardTopics(formattedTopics)
      setStudySessions(sessionsResult.data || [])
      setQuizAttempts(quizzesResult.data || [])
      setXpTransactions(xpData || [])
      setChallengeHistory(histData || [])
      setSavedItemIds(savedData || new Set())

      // Check for due flashcards
      try {
        const now = new Date().toISOString()
        const { data: fcData } = await supabase
          .from("study_flashcards")
          .select("id, study_material_id, next_review_at")
          .eq("user_id", user.id)
          .lte("next_review_at", now)

        if (fcData && fcData.length > 0) {
          setDueFlashcardsCount(fcData.length)
          setDueFlashcardsMaterialId(fcData[0].study_material_id)
        } else {
          setDueFlashcardsCount(0)
          setDueFlashcardsMaterialId(null)
        }
      } catch (fcErr) {
        console.warn("Due flashcards check notice:", fcErr)
      }
    } catch (err) {
      console.error("Academic data error:", err)
    }
  }

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
        if (res.awarded) {
          loadAllDashboardData()
        }
      })
    }
  }, [dailyChallengeSet.isSetComplete, user?.id])

  const learningStreak = useMemo(() => {
    return calculateLearningStreak({
      studySessions,
      quizAttempts,
      xpTransactions,
      tasks: dashboardTasks,
      profile,
    })
  }, [studySessions, quizAttempts, xpTransactions, dashboardTasks, profile])

  // Memoized computations for performance
  const weakestSyllabusTopic = useMemo(() => {
    return getWeakestSyllabusTopic(syllabusTopics, topicProgress)
  }, [syllabusTopics, topicProgress])

  const syllabusMastery = useMemo(() => {
    return calculateSyllabusMastery(syllabusTopics, topicProgress)
  }, [syllabusTopics, topicProgress])

  const todayClasses = useMemo(() => {
    return getTodaySchedule(dashboardSchedule)
  }, [dashboardSchedule])

  const nextClass = useMemo(() => {
    return getNextClass(dashboardSchedule)
  }, [dashboardSchedule])

  const freeWindows = useMemo(() => {
    return getMergedFreeWindows({
      schedule: dashboardSchedule,
      calendarEvents: [],
      date: new Date(),
      dayStart: "08:00",
      dayEnd: "22:00",
    })
  }, [dashboardSchedule])

  const recommendedStudyWindow = useMemo(() => {
    return getBestStudyWindow(dashboardSchedule, 45, new Date(), [])
  }, [dashboardSchedule])

  const dailyPlan = useMemo(() => {
    return buildDailyPlan({
      classes: todayClasses,
      tasks: dashboardTasks,
      exams: dashboardExams,
      studyWindows: freeWindows,
      weakestTopic: weakestSyllabusTopic,
    })
  }, [todayClasses, dashboardTasks, dashboardExams, freeWindows, weakestSyllabusTopic])

  const { bestAction, otherPriorities } = useMemo(() => {
    return runNextBestActionEngine({
      profile,
      schedule: dashboardSchedule,
      tasks: dashboardTasks,
      exams: dashboardExams,
      syllabusTopics,
      topicProgress,
      studyWindow: recommendedStudyWindow,
    })
  }, [profile, dashboardSchedule, dashboardTasks, dashboardExams, syllabusTopics, topicProgress, recommendedStudyWindow])

  const closestExam = useMemo(() => {
    return [...dashboardExams].sort(
      (a, b) => new Date(a.exam_date) - new Date(b.exam_date)
    )[0] || null
  }, [dashboardExams])

  const examReadiness = useMemo(() => {
    if (!closestExam) return null

    const matched = academicSubjects.find(
      (s) =>
        s.subject_name.toLowerCase().includes(closestExam.subject.toLowerCase()) ||
        closestExam.subject.toLowerCase().includes(s.subject_name.toLowerCase()) ||
        (s.subject_code && closestExam.subject.toLowerCase().includes(s.subject_code.toLowerCase()))
    )

    const topicsForExam = matched
      ? syllabusTopics
          .filter((t) => t.subject_id === matched.id)
          .map((t) => ({
            ...t,
            mastery_score: topicProgress[t.id]?.mastery_score || 0,
          }))
      : dashboardTopics.filter((t) =>
          t.subject?.toLowerCase().includes(closestExam.subject.toLowerCase())
        )

    const days = getDaysRemaining(closestExam.exam_date)

    return calculateExamReadiness({
      topics: topicsForExam,
      daysRemaining: days,
    })
  }, [closestExam, academicSubjects, syllabusTopics, topicProgress, dashboardTopics])

  useEffect(() => {
    if (!user || dashboardLoading) return

    const newNotifs = generateSmartNotifications({
      tasks: dashboardTasks,
      exams: dashboardExams,
      syllabusTopics,
      topicProgress,
      studyWindows: freeWindows,
      bestAction,
      preferences: notificationPreferences,
      deliveredKeys,
      now: new Date(),
    })

    if (newNotifs.length > 0) {
      setNotifications((prev) => [...newNotifs, ...prev])
      setDeliveredKeys((prev) => {
        const nextSet = new Set(prev)
        newNotifs.forEach((n) => nextSet.add(n.dedup_key))
        return nextSet
      })

      // Dispatch native browser notification for CRITICAL / HIGH
      newNotifs.forEach((n) => {
        if (n.priority === "CRITICAL" || n.priority === "HIGH") {
          dispatchNativeBrowserNotification({
            title: n.title,
            message: n.message,
            url: window.location.origin,
            priority: n.priority,
            preferences: notificationPreferences,
          })
        }
      })
    }
  }, [
    user,
    dashboardLoading,
    dashboardTasks,
    dashboardExams,
    syllabusTopics,
    topicProgress,
    freeWindows,
    bestAction,
    notificationPreferences,
  ])

  function handleActionNavigation(action) {
    if (!action) return

    if (action.page === "Focus Session") {
      if (action.payload?.id) {
        setRecommendedTaskId(action.payload.id)
      }
      setCurrentPage("Focus Session")
    } else if (action.page === "Exam Mode") {
      setCurrentPage("Exam Mode")
    } else if (action.page === "Progress") {
      setCurrentPage("Progress")
    } else if (action.page === "My Academics") {
      setCurrentPage("My Academics")
    } else if (action.page === "Tasks") {
      setCurrentPage("Tasks")
    } else {
      setCurrentPage("Dashboard")
    }
  }

  // Global Shortcut: Ctrl+K or Cmd+K for Academic Search
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchModalOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleGlobalSearchNavigation = (type, metadata) => {
    if (type === "syllabus") {
      setCurrentPage("Syllabus")
    } else if (type === "study_material") {
      if (metadata?.material_id) {
        setSelectedMaterialIdForReader(metadata.material_id)
        setSelectedMaterialIdForAnalysis(null)
        setSelectedMaterialIdForFlashcards(null)
        setSelectedMaterialIdForStudyPack(null)
      }
      setCurrentPage("Study Material")
    } else if (type === "previous_paper") {
      if (metadata?.material_id) {
        setSelectedMaterialIdForAnalysis(metadata.material_id)
        setSelectedMaterialIdForReader(null)
        setSelectedMaterialIdForFlashcards(null)
        setSelectedMaterialIdForStudyPack(null)
      }
      setCurrentPage("Study Material")
    } else if (type === "flashcard") {
      if (metadata?.material_id) {
        setSelectedMaterialIdForFlashcards(metadata.material_id)
        setSelectedMaterialIdForReader(null)
        setSelectedMaterialIdForAnalysis(null)
        setSelectedMaterialIdForStudyPack(null)
      }
      setCurrentPage("Study Material")
    } else if (type === "task") {
      setCurrentPage("Tasks")
    } else if (type === "exam") {
      setCurrentPage("Exams")
    }
  }

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
        <>
          <PWAInstallBanner />
          <Auth
            initialMode={authView}
            onLogin={(newUser) => {
              setUser(newUser)
              setAuthView(null)
            }}
            onBackToLanding={() => setAuthView(null)}
          />
        </>
      )
    }

    return (
      <>
        <PWAInstallBanner />
        <LandingPage
          user={user}
          onGetStarted={() => setAuthView("signup")}
          onSignIn={() => setAuthView("login")}
          onGoToDashboard={() => setCurrentPage("Dashboard")}
        />
      </>
    )
  }

  if (!profile) {
    return (
      <>
        <PWAInstallBanner />
        <ProfileSetup
          user={user}
          onComplete={() => fetchProfile(user)}
        />
      </>
    )
  }

  const closestExamDaysRemaining = closestExam
    ? getDaysRemaining(closestExam.exam_date)
    : 0

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
            {/* Global Academic Search Trigger (Header) */}
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

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
              Sem {profile.semester}
            </span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 pb-24 lg:pb-0">
          {(currentPage === "Home" || currentPage === "Dashboard") && (
            <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:py-6 space-y-6">
              {/* 1. Student Mini-Profile Strip & Stats Header */}
              <HomeHeader
                user={user}
                profile={profile}
                totalXP={xpSummary.totalXP}
                thisWeekXP={xpSummary.thisWeekXP}
                streak={learningStreak.currentStreak}
                reputation={profile.reputation || 91}
                unreadCount={unreadNotifCount}
                onOpenProfile={() => setCurrentPage("Profile")}
                onOpenNotifications={() => setNotificationModalOpen(true)}
                onOpenSearch={() => setSearchModalOpen(true)}
              />

              {/* 2. Today's Timetable Strip (Top of Page) */}
              <TodayTimetableStrip
                schedule={dashboardSchedule}
                profile={profile}
                onNavigateToAcademics={() => setCurrentPage("My Academics")}
              />

              {/* 3. Daily 5-Question Challenge Progress & Bonus Card */}
              <DailyProgressCard
                completedCount={dailyChallengeSet.completedCount}
                totalCount={dailyChallengeSet.totalCount}
                isSetComplete={dailyChallengeSet.isSetComplete}
                isBonusMode={isBonusMode}
                adaptiveLevel={dailyChallengeSet.adaptiveLevel}
                onToggleBonusMode={() => setIsBonusMode((prev) => !prev)}
              />

              {/* 4. For You Social Learning Feed */}
              <SocialFeed
                user={user}
                profile={profile}
                topicProgress={dashboardTopics}
                exams={dashboardExams}
                completedKeys={xpSummary.completedKeys}
                onXPUpdated={loadAllDashboardData}
                onOpenFocusSession={() => setCurrentPage("Focus Session")}
                onChallengeSolved={() => loadAllDashboardData()}
              />
            </div>
          )}

          {/* Subpages */}
          {currentPage === "My Academics" && <MyAcademics profile={profile} />}
          {currentPage === "Syllabus" && <Syllabus profile={profile} />}
          {currentPage === "Progress" && <Progress user={user} profile={profile} />}
          {currentPage === "Tasks" && <Tasks user={user} />}
          {currentPage === "Exams" && <Exams user={user} />}
          {currentPage === "Exam Mode" && <ExamMode user={user} profile={profile} />}
          {currentPage === "Study Material" && (
            selectedMaterialIdForAnalysis ? (
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
                }}
              />
            ) : selectedMaterialIdForFlashcards ? (
              <Flashcards
                materialId={selectedMaterialIdForFlashcards}
                user={user}
                profile={profile}
                onBack={() => setSelectedMaterialIdForFlashcards(null)}
                onOpenReader={(id) => {
                  setSelectedMaterialIdForFlashcards(null)
                  setSelectedMaterialIdForReader(id)
                }}
              />
            ) : selectedMaterialIdForStudyPack ? (
              <StudyPack
                materialId={selectedMaterialIdForStudyPack}
                user={user}
                profile={profile}
                onBack={() => setSelectedMaterialIdForStudyPack(null)}
                onOpenReader={(id) => {
                  setSelectedMaterialIdForStudyPack(null)
                  setSelectedMaterialIdForReader(id)
                }}
                onOpenFlashcards={(id) => {
                  setSelectedMaterialIdForStudyPack(null)
                  setSelectedMaterialIdForFlashcards(id)
                }}
                onNavigateToSyllabus={() => {
                  setSelectedMaterialIdForStudyPack(null)
                  setCurrentPage("Syllabus")
                }}
              />
            ) : selectedMaterialIdForReader ? (
              <StudyMaterialReader
                materialId={selectedMaterialIdForReader}
                user={user}
                profile={profile}
                onBack={() => setSelectedMaterialIdForReader(null)}
                onOpenStudyPack={(id) => {
                  setSelectedMaterialIdForReader(null)
                  setSelectedMaterialIdForStudyPack(id)
                }}
                onOpenFlashcards={(id) => {
                  setSelectedMaterialIdForReader(null)
                  setSelectedMaterialIdForFlashcards(id)
                }}
                onOpenExamAnalysis={(id) => {
                  setSelectedMaterialIdForReader(null)
                  setSelectedMaterialIdForAnalysis(id)
                }}
                onNavigateToSyllabus={() => {
                  setSelectedMaterialIdForReader(null)
                  setCurrentPage("Syllabus")
                }}
              />
            ) : (
              <StudyMaterial
                user={user}
                profile={profile}
                onNavigateToSyllabus={() => setCurrentPage("Syllabus")}
                onOpenReader={(id) => setSelectedMaterialIdForReader(id)}
                onOpenStudyPack={(id) => setSelectedMaterialIdForStudyPack(id)}
                onOpenFlashcards={(id) => setSelectedMaterialIdForFlashcards(id)}
                onOpenExamAnalysis={(id) => setSelectedMaterialIdForAnalysis(id)}
              />
            )
          )}
          {currentPage === "Focus Session" && (
            <FocusSession
              user={user}
              recommendedTaskId={recommendedTaskId}
              onReturnToDashboard={() => {
                loadAllDashboardData()
                setCurrentPage("Dashboard")
              }}
            />
          )}
          {currentPage === "Profile" && (
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
              onProfileUpdated={(updatedProfile) => {
                setProfile(updatedProfile)
                loadAllDashboardData()
              }}
              onNavigate={(page) => setCurrentPage(page)}
            />
          )}
          {currentPage === "Leaderboard" && (
            <Leaderboard
              user={user}
              profile={profile}
              totalXP={xpSummary.totalXP}
              thisWeekXP={xpSummary.thisWeekXP}
              streak={learningStreak.currentStreak}
              reputation={profile.reputation || 91}
              onNavigate={(page) => setCurrentPage(page)}
            />
          )}
          {(currentPage === "Saved" || currentPage === "Saved Challenges") && (
            <SavedChallenges
              user={user}
              savedItemIds={savedItemIds}
              completedKeys={xpSummary.completedKeys}
              onSavedUpdated={loadAllDashboardData}
              onNavigate={(page) => setCurrentPage(page)}
            />
          )}
        </main>
      </div>

      {/* Smart Notification Center Modal */}
      <NotificationCenter
        isOpen={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearAll={handleClearAllNotifications}
        onNavigate={(page, entityId) => {
          if (page === "Focus Session" && entityId) {
            setRecommendedTaskId(entityId)
          }
          setCurrentPage(page)
        }}
        preferences={notificationPreferences}
        onUpdatePreferences={updateNotificationPreferences}
      />

      {/* Global Academic Search Modal */}
      <GlobalSearch
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        user={user}
        profile={profile}
        onNavigate={handleGlobalSearchNavigation}
      />

      {/* Mobile Bottom Taskbar Navigation (< 768px) */}
      <MobileBottomNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        profile={profile}
        onLogout={handleLogout}
        onOpenNotifications={() => setNotificationModalOpen(true)}
        unreadCount={unreadNotifCount}
      />
    </div>
  )
}

function TaskItem({ time, title, subject, priority }) {
  const priorityStyle = {
    High: "bg-red-50 text-red-700 border-red-100",
    Medium: "bg-amber-50 text-amber-700 border-amber-100",
    Low: "bg-emerald-50 text-emerald-700 border-emerald-100",
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:bg-slate-100/70">
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-[11px] font-medium text-slate-400 font-mono">{time}</p>
        <h4 className="mt-0.5 font-bold text-xs sm:text-sm text-slate-900 truncate">{title}</h4>
        <p className="text-[11px] text-slate-500 truncate">{subject}</p>
      </div>

      <span
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border shrink-0 ${priorityStyle[priority] || "bg-slate-100 text-slate-700"}`}
      >
        {priority}
      </span>
    </div>
  )
}

export default App
