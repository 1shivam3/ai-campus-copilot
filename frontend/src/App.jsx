import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import Sidebar from "./components/Sidebar"
import MyAcademics from "./pages/MyAcademics"
import Syllabus from "./pages/Syllabus"
import Progress from "./pages/Progress"
import Tasks from "./pages/Tasks"
import Exams from "./pages/Exams"
import ExamMode from "./pages/ExamMode"
import AITest from "./pages/AITest"
import StudyMaterial from "./pages/StudyMaterial"
import FocusSession from "./pages/FocusSession"
import Auth from "./pages/Auth"
import ProfileSetup from "./pages/ProfileSetup"
import { getClassSchedule } from "./lib/academicData"
import { getTodaySchedule, getNextClass } from "./lib/todaySchedule"
import { getFreeWindows, getBestStudyWindow } from "./utils/freeTime"
import { buildDailyPlan } from "./utils/dailyPlan"
import { getWeakestSyllabusTopic, calculateSyllabusMastery } from "./utils/syllabusProgress"
import { calculateExamReadiness } from "./utils/examReadiness"
import { runNextBestActionEngine, getDaysRemaining } from "./utils/nextBestActionEngine"
import { SkeletonBanner, SkeletonCard, SkeletonList } from "./components/SkeletonLoader"
import EmptyState from "./components/EmptyState"

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState("Dashboard")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [recommendedTaskId, setRecommendedTaskId] = useState(null)
  const [dashboardTasks, setDashboardTasks] = useState([])
  const [dashboardExams, setDashboardExams] = useState([])
  const [dashboardTopics, setDashboardTopics] = useState([])
  const [dashboardSchedule, setDashboardSchedule] = useState([])
  const [academicSubjects, setAcademicSubjects] = useState([])
  const [syllabusTopics, setSyllabusTopics] = useState([])
  const [topicProgress, setTopicProgress] = useState({})
  const [dashboardLoading, setDashboardLoading] = useState(true)

  useEffect(() => {
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
        setProfile(null)
      } else {
        setProfile(data || null)
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
      const [tasksResult, examsResult, topicsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, subject, deadline, importance, estimated_minutes, status")
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
          .from("topics")
          .select("id, subject, topic_name, mastery_score")
          .eq("user_id", user.id),
      ])

      setDashboardTasks(tasksResult.data || [])
      setDashboardExams(examsResult.data || [])
      setDashboardTopics(topicsResult.data || [])
    } catch (err) {
      console.error("Academic data error:", err)
    }
  }

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
    return getFreeWindows(dashboardSchedule)
  }, [dashboardSchedule])

  const recommendedStudyWindow = useMemo(() => {
    return getBestStudyWindow(dashboardSchedule, 45)
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

  if (authLoading || (user && profileLoading && !profile)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] p-6 text-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white shadow-md animate-pulse">
          ⚡
        </div>
        <p className="mt-4 text-sm font-semibold tracking-wide text-slate-600">
          Loading AI Campus Copilot...
        </p>
      </div>
    )
  }

  if (!user) {
    return <Auth onLogin={setUser} />
  }

  if (!profile) {
    return (
      <ProfileSetup
        user={user}
        onComplete={() => fetchProfile(user)}
      />
    )
  }

  const closestExamDaysRemaining = closestExam
    ? getDaysRemaining(closestExam.exam_date)
    : 0

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        profile={profile}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
      />

      <div className="min-w-0 flex-1 flex flex-col">
        {/* Mobile Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-bold text-slate-900">{currentPage}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
              Sem {profile.semester}
            </span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1">
          {currentPage === "Dashboard" && (
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {/* Dashboard Greeting Header */}
              <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
                    WELCOME BACK, {profile.full_name.split(" ")[0]}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    What deserves your attention right now?
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                    Deterministic priorities synthesized from your timetable, assignments, exams, and real syllabus mastery.
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
                  <span className="text-sm">🗓️</span>
                  <div className="text-xs font-semibold text-slate-800">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>

              {/* Next Best Action Card (Primary Focal Point) */}
              {dashboardLoading ? (
                <SkeletonBanner />
              ) : bestAction ? (
                <section className="mb-8 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8 transition-all">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                          🎯 NEXT BEST ACTION
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${
                            bestAction.priority === "CRITICAL"
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : bestAction.priority === "HIGH"
                                ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                                : "bg-blue-400/20 text-blue-300 border border-blue-400/30"
                          }`}
                        >
                          {bestAction.priority} PRIORITY ({bestAction.score}/100)
                        </span>
                      </div>

                      <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {bestAction.title}
                      </h3>

                      <p className="mt-1 text-sm font-semibold text-blue-400">
                        {bestAction.subject}
                      </p>

                      <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-300">
                        {bestAction.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200 font-semibold">
                          ⏱️ {bestAction.estimated_minutes} min
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300 font-medium">
                          Source: {bestAction.source}
                        </span>
                      </div>

                      {/* Decision Rationale */}
                      {bestAction.whyThis && bestAction.whyThis.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                            Why this now?
                          </p>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {bestAction.whyThis.map((point, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Action Launch Button */}
                    <div className="self-start md:self-center shrink-0">
                      <button
                        onClick={() => handleActionNavigation(bestAction)}
                        className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100 shadow-md active:scale-[0.98] flex items-center gap-2"
                      >
                        <span>Start Now</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>

                  {/* Runner-up Priorities */}
                  {otherPriorities && otherPriorities.length > 0 && (
                    <div className="mt-8 border-t border-white/10 pt-6">
                      <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3">
                        OTHER PRIORITIES TODAY
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {otherPriorities.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleActionNavigation(item)}
                            className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.09]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                {item.subject}
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  item.priority === "CRITICAL"
                                    ? "text-red-400"
                                    : item.priority === "HIGH"
                                      ? "text-amber-400"
                                      : "text-blue-400"
                                }`}
                              >
                                {item.priority}
                              </span>
                            </div>
                            <h4 className="mt-1 font-bold text-xs sm:text-sm text-white line-clamp-1">
                              {item.title}
                            </h4>
                            <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : null}

              {/* Schedule & Academic Context Row */}
              <section className="mb-8 grid gap-5 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                        TODAY&apos;S SCHEDULE
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        {todayClasses.length} {todayClasses.length === 1 ? "class" : "classes"} scheduled today
                      </h3>
                    </div>

                    <button
                      onClick={() => setCurrentPage("My Academics")}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View Timetable →
                    </button>
                  </div>

                  {nextClass ? (
                    <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-xs font-bold tracking-wider text-slate-400">
                          NEXT CLASS
                        </p>
                      </div>

                      <h4 className="mt-2 text-xl font-bold">
                        {nextClass.academic_subjects?.subject_name}
                      </h4>

                      <p className="mt-1 font-mono text-sm text-slate-300">
                        {nextClass.start_time?.slice(0, 5)} – {nextClass.end_time?.slice(0, 5)}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                          📍 Room {nextClass.room || "—"}
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                          👨‍🏫 {nextClass.teacher_name || "Faculty N/A"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-5 border border-slate-100">
                      <p className="font-semibold text-slate-800 text-sm">
                        No more classes today 🎉
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        You have open study time. Focus on your highest-priority task or exam revision!
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                      ACADEMIC CONTEXT
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      Semester {profile.semester}
                    </h3>
                    <p className="text-sm font-medium text-blue-600">
                      Section {profile.section}
                    </p>
                  </div>

                  <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-xs sm:text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Classes today</span>
                      <span className="font-bold text-slate-900">{todayClasses.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Upcoming exams</span>
                      <span className="font-bold text-slate-900">{dashboardExams.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Pending tasks</span>
                      <span className="font-bold text-slate-900">{dashboardTasks.length}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Nearest Exam Readiness Indicator */}
              {closestExam && examReadiness && (
                <section className="mb-8 rounded-3xl border border-red-200/80 bg-gradient-to-br from-white to-red-50/30 p-5 sm:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                        <p className="text-[11px] font-bold tracking-widest text-red-600 uppercase">
                          NEAREST EXAM READINESS
                        </p>
                      </div>

                      <h3 className="mt-1 text-2xl font-bold text-slate-900">
                        {closestExam.subject}
                      </h3>

                      <p className="mt-1 text-xs sm:text-sm text-slate-500">
                        {closestExamDaysRemaining} {closestExamDaysRemaining === 1 ? "day" : "days"} remaining · Status:{" "}
                        <span
                          className={`font-bold ${
                            examReadiness.label === "Strong"
                              ? "text-emerald-600"
                              : examReadiness.label === "On track"
                                ? "text-blue-600"
                                : "text-amber-600"
                          }`}
                        >
                          {examReadiness.label}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-3xl font-bold text-slate-900">{examReadiness.score}%</p>
                        <p className="text-[10px] font-medium text-slate-400">Readiness Score</p>
                      </div>

                      <button
                        onClick={() => setCurrentPage("Exam Mode")}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm active:scale-[0.98]"
                      >
                        Prepare Now →
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-500 ${
                        examReadiness.score >= 75
                          ? "bg-emerald-500"
                          : examReadiness.score >= 50
                            ? "bg-blue-600"
                            : "bg-amber-500"
                      }`}
                      style={{ width: `${examReadiness.score}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Based on your recorded syllabus mastery ({examReadiness.averageMastery}%) and urgency penalty ({closestExamDaysRemaining} days left).
                  </p>
                </section>
              )}

              {/* Tasks & Syllabus Mastery Row */}
              <section className="grid gap-6 md:grid-cols-3">
                {/* Today's Tasks */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Today&apos;s Tasks</h3>
                      <p className="text-xs sm:text-sm text-slate-500">Focus on what matters today</p>
                    </div>
                    <button
                      onClick={() => setCurrentPage("Tasks")}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View all ({dashboardTasks.length}) →
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {dashboardTasks.slice(0, 4).map((task) => (
                      <TaskItem
                        key={task.id}
                        time={task.estimated_minutes ? `${task.estimated_minutes} min` : "30 min"}
                        title={task.title}
                        subject={task.subject}
                        priority={
                          task.importance >= 8
                            ? "High"
                            : task.importance >= 6
                              ? "Medium"
                              : "Low"
                        }
                      />
                    ))}
                    {dashboardTasks.length === 0 && (
                      <EmptyState
                        icon="✍️"
                        title="No pending tasks"
                        description="Add an assignment or project deadline to keep track of your workload."
                        actionLabel="Add Task"
                        onAction={() => setCurrentPage("Tasks")}
                      />
                    )}
                  </div>
                </div>

                {/* Syllabus Mastery Gauge */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                        SYLLABUS MASTERY
                      </p>
                      <button
                        onClick={() => setCurrentPage("Progress")}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Update →
                      </button>
                    </div>

                    <h3 className="mt-3 text-3xl font-bold text-slate-900">
                      {syllabusMastery}%
                    </h3>
                    <p className="text-xs text-slate-500">Overall Course Coverage</p>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${syllabusMastery}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                      HIGHEST-RISK TOPIC
                    </p>
                    {weakestSyllabusTopic ? (
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {weakestSyllabusTopic.topic_name}
                        </span>
                        <span className="text-xs font-bold text-amber-600">
                          {weakestSyllabusTopic.mastery_score}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">All topics on track</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Upcoming Exams Grid */}
              <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Upcoming Exams</h3>
                    <p className="text-xs sm:text-sm text-slate-500">Stay ahead of critical dates</p>
                  </div>
                  <button
                    onClick={() => setCurrentPage("Exams")}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View Exams →
                  </button>
                </div>

                {dashboardExams.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {dashboardExams.map((exam) => {
                      const daysRemaining = Math.max(
                        0,
                        Math.ceil((new Date(exam.exam_date) - new Date()) / (1000 * 60 * 60 * 24))
                      )
                      return (
                        <div
                          key={exam.id}
                          className="rounded-xl border border-slate-200/80 p-4 transition hover:border-slate-300"
                        >
                          <p className="text-xs font-bold text-slate-500 uppercase">{exam.subject}</p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">
                            {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">remaining to exam</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon="📝"
                    title="No upcoming exams added"
                    description="Add an exam in the Exams tab to activate exam readiness indicators."
                    actionLabel="Add Exam"
                    onAction={() => setCurrentPage("Exams")}
                  />
                )}
              </section>
            </div>
          )}

          {/* Subpages */}
          {currentPage === "My Academics" && <MyAcademics profile={profile} />}
          {currentPage === "Syllabus" && <Syllabus profile={profile} />}
          {currentPage === "Progress" && <Progress user={user} profile={profile} />}
          {currentPage === "Tasks" && <Tasks user={user} />}
          {currentPage === "Exams" && <Exams user={user} />}
          {currentPage === "Exam Mode" && <ExamMode user={user} profile={profile} />}
          {currentPage === "Study Material" && <StudyMaterial user={user} />}
          {currentPage === "AI Copilot" && (
            <AITest
              user={user}
              schedule={dashboardSchedule}
              profile={profile}
              onStartSession={(taskId) => {
                setRecommendedTaskId(taskId)
                setCurrentPage("Focus Session")
              }}
            />
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
        </main>
      </div>
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
