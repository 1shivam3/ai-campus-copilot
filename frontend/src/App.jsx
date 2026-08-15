import { useEffect, useState } from "react"
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

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState("Dashboard")
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
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const currentUser = session?.user || null
    setUser(currentUser)

    if (currentUser) {
      await fetchProfile(currentUser)
    }

    setAuthLoading(false)
  }

  async function fetchProfile(currentUser) {
    if (!currentUser?.id) return
    setProfileLoading(true)

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

    setProfileLoading(false)
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Sign out error:", error)
      return
    }

    setUser(null)
    setProfile(null)
  }

  useEffect(() => {
    if (user?.id && profile) {
      fetchAcademicData()
      loadSyllabusProgress()
    }
  }, [user, profile, currentPage])

  useEffect(() => {
    if (!profile) return
    loadDashboardSchedule()
  }, [profile])

  async function loadDashboardSchedule() {
    try {
      const data = await getClassSchedule(
        profile.semester,
        profile.section
      )
      setDashboardSchedule(data || [])
    } catch (error) {
      console.error("Dashboard schedule error:", error)
    }
  }

  async function loadSyllabusProgress() {
    if (!user?.id || !profile) return

    try {
      const { data: subjectData, error: subjectError } =
        await supabase
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

      const { data: topicData, error: topicError } =
        await supabase
          .from("syllabus_topics")
          .select("*, academic_subjects(subject_name, subject_code)")
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
          .select("*")
          .eq("user_id", user.id)
          .in("syllabus_topic_id", topicIds)

        if (error) {
          console.error(error)
          return
        }

        progressData = data || []
      }

      const progressMap = {}
      progressData.forEach((item) => {
        progressMap[item.syllabus_topic_id] = item
      })

      // Normalize topic subject_name
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

    setDashboardLoading(true)

    const [tasksResult, examsResult, topicsResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending"),

      supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .gte("exam_date", new Date().toISOString()),

      supabase
        .from("topics")
        .select("*")
        .eq("user_id", user.id),
    ])

    if (tasksResult.error) {
      console.error("Tasks error:", tasksResult.error)
    }

    if (examsResult.error) {
      console.error("Exams error:", examsResult.error)
    }

    if (topicsResult.error) {
      console.error("Topics error:", topicsResult.error)
    }

    let userTopics = topicsResult.data || []

    // Seed default topics for new users if none exist
    if (userTopics.length === 0 && !topicsResult.error) {
      const defaultTopics = [
        { user_id: user.id, subject: "Data Structures", topic_name: "Arrays", mastery_score: 80 },
        { user_id: user.id, subject: "Data Structures", topic_name: "Linked Lists", mastery_score: 42 },
        { user_id: user.id, subject: "Data Structures", topic_name: "Stacks", mastery_score: 65 },
        { user_id: user.id, subject: "Data Structures", topic_name: "Trees", mastery_score: 55 },
      ]

      const { data: seeded } = await supabase
        .from("topics")
        .insert(defaultTopics)
        .select()

      if (seeded) {
        userTopics = seeded
      }
    }

    setDashboardTasks(tasksResult.data || [])
    setDashboardExams(examsResult.data || [])
    setDashboardTopics(userTopics)

    setDashboardLoading(false)
  }

  if (authLoading || (user && profileLoading && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-slate-600 font-medium">
        Loading AI Campus Copilot...
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

  const weakestSyllabusTopic = getWeakestSyllabusTopic(
    syllabusTopics,
    topicProgress
  )

  const syllabusMastery = calculateSyllabusMastery(
    syllabusTopics,
    topicProgress
  )

  const weakestTopic = weakestSyllabusTopic
  const pendingTasksCount = dashboardTasks.length
  const todayClasses = getTodaySchedule(dashboardSchedule)
  const nextClass = getNextClass(dashboardSchedule)
  const freeWindows = getFreeWindows(dashboardSchedule)

  const recommendedStudyWindow = getBestStudyWindow(dashboardSchedule, 45)

  // Unified Next Best Action Decision Engine (Step 95)
  const { bestAction, otherPriorities } = runNextBestActionEngine({
    profile,
    schedule: dashboardSchedule,
    tasks: dashboardTasks,
    exams: dashboardExams,
    syllabusTopics,
    topicProgress,
    studyWindow: recommendedStudyWindow,
  })

  const dailyPlan = buildDailyPlan({
    classes: todayClasses,
    tasks: dashboardTasks,
    exams: dashboardExams,
    studyWindows: freeWindows,
    weakestTopic,
  })

  // Calculate nearest upcoming exam and its syllabus readiness
  const closestExam = [...dashboardExams].sort(
    (a, b) => new Date(a.exam_date) - new Date(b.exam_date)
  )[0]

  const matchedSubject = closestExam
    ? academicSubjects.find(
        (s) =>
          s.subject_name.toLowerCase().includes(closestExam.subject.toLowerCase()) ||
          closestExam.subject.toLowerCase().includes(s.subject_name.toLowerCase()) ||
          (s.subject_code && closestExam.subject.toLowerCase().includes(s.subject_code.toLowerCase()))
      )
    : null

  const examSyllabusTopics = matchedSubject
    ? syllabusTopics
        .filter((t) => t.subject_id === matchedSubject.id)
        .map((t) => ({
          ...t,
          mastery_score: topicProgress[t.id]?.mastery_score || 0,
        }))
    : []

  const closestExamDaysRemaining = closestExam
    ? getDaysRemaining(closestExam.exam_date)
    : 0

  const examReadiness = closestExam
    ? calculateExamReadiness({
        topics: examSyllabusTopics.length > 0
          ? examSyllabusTopics
          : dashboardTopics.filter((t) =>
              t.subject?.toLowerCase().includes(closestExam.subject.toLowerCase())
            ),
        daysRemaining: closestExamDaysRemaining,
      })
    : null

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

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        user={user}
        profile={profile}
        onLogout={handleLogout}
      />

      <div className="min-w-0 flex-1">
        <main className="flex-1">
          {currentPage === "Dashboard" && (
            <div className="mx-auto max-w-7xl px-6 py-8">
              {/* Dashboard Heading */}
              <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-medium text-blue-600">
                    Welcome back, {profile.full_name.split(" ")[0]} • Sem {profile.semester} ({profile.section})
                  </p>

                  <h2 className="mt-1 text-3xl font-bold tracking-tight">
                    What deserves your attention today?
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Your priorities are calculated dynamically from deadlines, exams,
                    real syllabus mastery, and available free study windows.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold tracking-wider text-slate-400">
                    TODAY
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Today's Schedule & Academic Context Row */}
              <section className="mb-8 grid gap-5 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold tracking-widest text-blue-600">
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
                      <p className="font-semibold text-slate-800">
                        No more classes today 🎉
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        You have open study time. Focus on your highest-priority task or exam revision below!
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-slate-400">
                      ACADEMIC CONTEXT
                    </p>

                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      Semester {profile.semester}
                    </h3>

                    <p className="text-sm font-medium text-blue-600">
                      Section {profile.section}
                    </p>
                  </div>

                  <div className="mt-6 space-y-3.5 border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Classes today</span>
                      <span className="font-bold text-slate-900">{todayClasses.length}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Upcoming exams</span>
                      <span className="font-bold text-slate-900">{dashboardExams.length}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Pending tasks</span>
                      <span className="font-bold text-slate-900">{dashboardTasks.length}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Step 95: Unified Next Best Action Card */}
              {bestAction && (
                <section className="mb-8 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-xs font-bold tracking-widest text-slate-400">
                          🎯 YOUR NEXT BEST ACTION
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${
                          bestAction.priority === "CRITICAL"
                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                            : bestAction.priority === "HIGH"
                              ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                              : "bg-blue-400/20 text-blue-300 border border-blue-400/30"
                        }`}>
                          {bestAction.priority} PRIORITY ({bestAction.score}/100)
                        </span>
                      </div>

                      <h3 className="text-3xl font-bold tracking-tight text-white">
                        {bestAction.title}
                      </h3>

                      <p className="mt-1 text-sm font-semibold text-blue-400">
                        {bestAction.subject}
                      </p>

                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
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

                      {/* Why This? Breakdown */}
                      {bestAction.whyThis && bestAction.whyThis.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                          <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2">
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

                    {/* Action Trigger Button */}
                    <div className="self-start md:self-center shrink-0">
                      <button
                        onClick={() => handleActionNavigation(bestAction)}
                        className="rounded-xl bg-white px-7 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100 shadow-lg flex items-center gap-2"
                      >
                        <span>Start Now</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>

                  {/* Other Priorities List */}
                  {otherPriorities && otherPriorities.length > 0 && (
                    <div className="mt-8 border-t border-white/10 pt-6">
                      <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">
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
                              <span className={`text-[10px] font-bold ${
                                item.priority === "CRITICAL"
                                  ? "text-red-400"
                                  : item.priority === "HIGH"
                                    ? "text-amber-400"
                                    : "text-blue-400"
                              }`}>
                                {item.priority}
                              </span>
                            </div>
                            <h4 className="mt-1 font-bold text-sm text-white line-clamp-1">
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
              )}

              {/* Today's Academic Plan Timeline */}
              <section className="mb-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-blue-600">
                      TODAY&apos;S ACADEMIC PLAN
                    </p>

                    <h3 className="mt-1 text-2xl font-bold text-slate-900">
                      Your day at a glance
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Classes, open study windows, and academic priorities integrated in real time.
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold self-start border border-blue-200">
                    {dailyPlan.length} timeline blocks
                  </span>
                </div>

                {dailyPlan.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                    <p className="font-semibold text-slate-700">
                      Nothing scheduled for today
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Add academic tasks or check your semester timetable.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dailyPlan.map((item, index) => {
                      const typeStyles = {
                        class: "border-slate-200 bg-slate-50/80 text-slate-900",
                        study: "border-blue-200 bg-blue-50/70 text-blue-950",
                        exam: "border-red-200 bg-red-50/70 text-red-950",
                        weakness: "border-amber-200 bg-amber-50/70 text-amber-950",
                      }

                      const badgeStyles = {
                        class: "bg-slate-200/70 text-slate-700",
                        study: "bg-blue-100 text-blue-700",
                        exam: "bg-red-100 text-red-700",
                        weakness: "bg-amber-100 text-amber-800",
                      }

                      const badgeLabels = {
                        class: "CLASS",
                        study: "STUDY WINDOW",
                        exam: "EXAM",
                        weakness: "WEAK TOPIC",
                      }

                      return (
                        <div
                          key={`${item.type}-${index}`}
                          className={`rounded-2xl border p-4 transition hover:shadow-sm ${typeStyles[item.type] || "bg-slate-50"}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start gap-4">
                              {item.start ? (
                                <div className="min-w-[95px] font-mono text-slate-700">
                                  <p className="text-sm font-bold">
                                    {item.start}
                                  </p>

                                  {item.end && (
                                    <p className="text-xs text-slate-400">
                                      to {item.end}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="min-w-[95px]">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeStyles[item.type]}`}>
                                    {badgeLabels[item.type]}
                                  </span>
                                </div>
                              )}

                              <div>
                                <h4 className="font-bold text-slate-900 leading-snug">
                                  {item.title}
                                </h4>

                                <p className="mt-0.5 text-xs text-slate-500">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>

                            {item.start && (
                              <span className={`self-start sm:self-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeStyles[item.type]}`}>
                                {badgeLabels[item.type]}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Exam Readiness & Overview Row */}
              {closestExam && examReadiness && (
                <section className="mb-8 rounded-3xl border border-red-200/80 bg-gradient-to-br from-white to-red-50/30 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                        <p className="text-xs font-bold tracking-widest text-red-600">
                          NEAREST EXAM READINESS
                        </p>
                      </div>

                      <h3 className="mt-1 text-2xl font-bold text-slate-900">
                        {closestExam.subject}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {closestExamDaysRemaining} {closestExamDaysRemaining === 1 ? "day" : "days"} remaining · Status:{" "}
                        <span className={`font-bold ${
                          examReadiness.label === "Strong"
                            ? "text-emerald-600"
                            : examReadiness.label === "On track"
                              ? "text-blue-600"
                              : "text-amber-600"
                        }`}>
                          {examReadiness.label}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-3xl font-bold text-slate-900">
                          {examReadiness.score}%
                        </p>
                        <p className="text-[11px] font-medium text-slate-400">Readiness Score</p>
                      </div>

                      <button
                        onClick={() => setCurrentPage("Exam Mode")}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm"
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
                      style={{
                        width: `${examReadiness.score}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    Based on your recorded syllabus mastery ({examReadiness.averageMastery}%) and urgency penalty ({closestExamDaysRemaining} days left).
                  </p>
                </section>
              )}

              <section className="grid gap-6 md:grid-cols-3">
                {/* Today's Tasks */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Today&apos;s Tasks</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Focus on what matters today
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentPage("Tasks")}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View all →
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    {dashboardTasks.slice(0, 4).map((task) => (
                      <Task
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
                    {dashboardTasks.length === 0 && !dashboardLoading && (
                      <p className="text-sm text-slate-400">No pending tasks found.</p>
                    )}
                  </div>
                </div>

                {/* Academic Health */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <h3 className="text-lg font-bold">Academic Health</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Your current overview
                  </p>

                  <div className="mt-6 space-y-5">
                    <Stat label="Syllabus Mastery" value={`${syllabusMastery}%`} />
                    <Stat label="Study Streak" value="6 days" />
                    <Stat label="Upcoming Tasks" value={pendingTasksCount.toString()} />
                    <Stat label="Upcoming Exams" value={dashboardExams.length.toString()} />
                  </div>
                </div>
              </section>

              {/* Overall Syllabus Mastery Section */}
              <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-slate-500">
                      SYLLABUS MASTERY
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">
                      {syllabusMastery}% Overall Coverage
                    </h3>
                  </div>

                  <button
                    onClick={() => setCurrentPage("Progress")}
                    className="text-xs font-semibold text-blue-600 hover:underline self-start"
                  >
                    Update Progress →
                  </button>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${syllabusMastery}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Calculated dynamically from your declared topic progress across all semester courses.
                </p>
              </section>

              {/* Upcoming Exams */}
              <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-5">
                  <h3 className="text-lg font-bold">Upcoming Exams</h3>
                  <p className="text-sm text-slate-500">
                    Stay ahead of important dates
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {dashboardExams.length > 0 ? (
                    dashboardExams.map((exam) => {
                      const daysRemaining = Math.max(
                        0,
                        Math.ceil((new Date(exam.exam_date) - new Date()) / (1000 * 60 * 60 * 24))
                      )
                      return (
                        <Exam
                          key={exam.id}
                          subject={exam.subject}
                          date={`${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`}
                        />
                      )
                    })
                  ) : (
                    <>
                      <Exam subject="Data Structures" date="4 days" />
                      <Exam subject="DBMS" date="9 days" />
                      <Exam subject="Operating Systems" date="14 days" />
                    </>
                  )}
                </div>
              </section>
            </div>
          )}

          {currentPage === "My Academics" && <MyAcademics profile={profile} />}
          {currentPage === "Syllabus" && <Syllabus profile={profile} />}
          {currentPage === "Progress" && <Progress user={user} profile={profile} />}
          {currentPage === "Tasks" && <Tasks user={user} />}
          {currentPage === "Exams" && <Exams user={user} />}
          {currentPage === "Exam Mode" && (
            <ExamMode user={user} profile={profile} />
          )}
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
            />
          )}
        </main>
      </div>
    </div>
  )
}

function Task({ time, title, subject, priority }) {
  const priorityStyle = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-emerald-50 text-emerald-700",
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-4 transition-colors hover:bg-slate-50/60">
      <div>
        <p className="text-xs font-medium text-slate-400">{time}</p>
        <h4 className="mt-1 font-semibold">{title}</h4>
        <p className="mt-1 text-xs text-slate-500">{subject}</p>
      </div>

      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityStyle[priority]}`}
      >
        {priority}
      </span>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  )
}

function Exam({ subject, date }) {
  return (
    <div className="rounded-xl border border-slate-200/80 p-4 transition hover:border-slate-300">
      <p className="text-sm font-semibold">{subject}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{date}</p>
      <p className="mt-1 text-xs text-slate-500">remaining</p>
    </div>
  )
}

export default App
