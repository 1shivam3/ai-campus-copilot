import { CoursePilotLogo, CoursePilotMark } from "../components/CoursePilotLogo"

function LandingPage({ onGetStarted, onSignIn, user, onGoToDashboard }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* 1. Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <CoursePilotLogo size="sm" showTagline={false} />

          <nav className="hidden items-center gap-8 text-xs font-semibold text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#workflow" className="hover:text-slate-900 transition">How it Works</a>
            <a href="#comparison" className="hover:text-slate-900 transition">Comparison</a>
            <a href="#security" className="hover:text-slate-900 transition">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-[0.98]"
              >
                Go to Dashboard →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-[0.98]"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          {/* Tagline Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3.5 py-1 text-xs font-bold text-blue-700 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            <span>Your AI-powered academic co-pilot.</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.1]">
            Know what to study next.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600">
            CoursePilot combines assignments, exams, syllabus progress, topic mastery, study sessions, and AI assistance to help students decide what deserves their attention next.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            {user ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-[0.98]"
              >
                Open Your Dashboard →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-[0.98]"
                >
                  Get Started Free
                </button>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-50 transition active:scale-[0.98]"
                >
                  Sign In
                </button>
              </>
            )}
          </div>

          <p className="mt-4 text-[11px] font-medium text-slate-400">
            Tailored for university students · Zero setup friction · Free to use
          </p>
        </div>

        {/* 3. Product Visual Mockup */}
        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-5 shadow-2xl">
            {/* Top Mockup Bar */}
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 px-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-200" />
                <span className="h-3 w-3 rounded-full bg-slate-200" />
                <span className="h-3 w-3 rounded-full bg-slate-200" />
                <span className="ml-2 text-xs font-bold text-slate-400">app.coursepilot.edu/dashboard</span>
              </div>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                LIVE DEMO PREVIEW
              </span>
            </div>

            {/* Dashboard Mockup Grid */}
            <div className="space-y-4">
              {/* Next Best Action Card Mockup */}
              <div className="rounded-2xl bg-slate-950 p-5 sm:p-7 text-white shadow-lg">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-500/20 text-red-300 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                        CRITICAL PRIORITY · 92/100
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Discrete Mathematics
                      </span>
                    </div>

                    <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white">
                      Study: Relations & Closures
                    </h2>

                    <p className="mt-1 text-xs text-slate-300">
                      Discrete Mathematics Exam in 3 days · Mastery is low (35%)
                    </p>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3">
                      <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">
                        WHY THIS NOW?
                      </p>
                      <ul className="space-y-1 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>Discrete Mathematics exam is scheduled in 3 days (highest academic urgency).</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>Topic mastery is 35% (high risk for end-term assessment).</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>Fits into your 90-minute free study window between lectures.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="shrink-0 self-start md:self-center">
                    <div className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-slate-950 shadow-md">
                      Start Focus Session →
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Dashboard Cards Mockup */}
              <div className="grid gap-4 sm:grid-cols-3 text-left">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    SCHEDULE CONTEXT
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    Next: Operating Systems
                  </p>
                  <p className="text-xs text-slate-500">11:00 AM · Room 304</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    EXAM READINESS
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber-600">
                    42% · Needs Immediate Review
                  </p>
                  <p className="text-xs text-slate-500">Discrete Math in 3 days</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    SYLLABUS PROGRESS
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    68% Average Mastery
                  </p>
                  <p className="text-xs text-slate-500">14 of 24 units completed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Value Proposition Workflow */}
      <section id="workflow" className="border-t border-slate-200/80 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              THE DECISION ENGINE
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              From academic noise to singular focus
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-slate-500">
              Students juggle countless tasks, dates, and chapters. CoursePilot continuously recalculates priorities so you always know your single next move.
            </p>
          </div>

          {/* Workflow Stepper Grid */}
          <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-6">
            {[
              { num: "01", title: "Academic Data", desc: "Timetable, exams & tasks" },
              { num: "02", title: "Analyze Priorities", desc: "Urgency, impact & free slots" },
              { num: "03", title: "Next Best Action", desc: "One clear recommendation" },
              { num: "04", title: "Focus Session", desc: "Distraction-free deep work" },
              { num: "05", title: "Topic Mastery", desc: "Scores update dynamically" },
              { num: "06", title: "Recalculate", desc: "Better next action generated" },
            ].map((step, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-slate-300"
              >
                <span className="font-mono text-xs font-bold text-blue-600">
                  {step.num}
                </span>
                <h3 className="mt-2 text-xs font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Features Section (6 Core Features) */}
      <section id="features" className="border-t border-slate-200/80 bg-[#f8fafc] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              POWERFUL CAPABILITIES
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Everything you need to master your semester
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-slate-500">
              Six synchronized modules designed around actual university coursework and assessment schedules.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🎯",
                title: "Next Best Action",
                desc: "Know what deserves your attention right now based on deadlines, upcoming exams, and your weakest topics.",
              },
              {
                icon: "⚡",
                title: "AI Academic Copilot",
                desc: "Get schedule-aware study strategies aligned with your daily timetable and free revision windows.",
              },
              {
                icon: "📝",
                title: "Exam Mode",
                desc: "Focus revision on your highest-risk topics before an exam with adaptive 10-question simulations.",
              },
              {
                icon: "📊",
                title: "Adaptive Topic Mastery",
                desc: "Your test results and study sessions dynamically update topic mastery curves from 0% to 100%.",
              },
              {
                icon: "📄",
                title: "Study Material Analysis",
                desc: "Turn study PDFs and lecture notes into concise summaries, key revision points, and practice MCQs.",
              },
              {
                icon: "⏱️",
                title: "Deep Work Focus Sessions",
                desc: "Turn recommendations into structured 25, 45, or 60-minute study blocks with automatic progress tracking.",
              },
            ].map((feat, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <span className="text-2xl">{feat.icon}</span>
                <h3 className="mt-3 text-base font-bold text-slate-900">
                  {feat.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Comparison Section (Traditional vs CoursePilot) */}
      <section id="comparison" className="border-t border-slate-200/80 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              WHY COURSEPILOT
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Why a task manager isn&apos;t enough for university
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-slate-500">
              Static to-do lists tell you what is pending, but fail to account for upcoming exam risks or timetable free time.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Traditional Task Manager */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8">
              <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700">
                TRADITIONAL TO-DO APP
              </span>
              <p className="mt-4 font-mono text-xs text-slate-400 uppercase tracking-wider">Output:</p>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 font-medium text-slate-700 text-xs sm:text-sm space-y-2">
                <p className="line-through text-slate-400">☐ Physics Assignment #3</p>
                <p>☐ DBMS assignment due tomorrow</p>
                <p>☐ Mathematics Exam in 3 days</p>
              </div>
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                No synthesis. You must guess whether to do the minor assignment or revise for the high-stakes exam.
              </p>
            </div>

            {/* CoursePilot Engine */}
            <div className="rounded-3xl border border-blue-200 bg-blue-50/40 p-6 sm:p-8 shadow-sm">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">
                COURSEPILOT DECISION ENGINE
              </span>
              <p className="mt-4 font-mono text-xs text-blue-600 uppercase tracking-wider">Synthesized Recommendation:</p>
              <div className="mt-2 rounded-2xl border border-blue-200 bg-white p-4 font-semibold text-slate-900 text-xs sm:text-sm leading-relaxed">
                &ldquo;Your DBMS assignment is due tomorrow, but your Mathematics exam is in 3 days and <strong>Relations</strong> is currently your weakest exam topic (35% mastery). Study Relations first in your 14:00 free window.&rdquo;
              </div>
              <p className="mt-4 text-xs text-blue-900/80 leading-relaxed">
                Combines syllabus weights, mastery gaps, and today&apos;s timetable to eliminate decision fatigue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Trust & Security */}
      <section id="security" className="border-t border-slate-200/80 bg-[#f8fafc] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              STUDENT PRIVACY
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Built with secure cloud infrastructure
            </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[
              { title: "Row Level Security", desc: "Your tasks, exams and notes are strictly isolated to your account." },
              { title: "Secure Auth", desc: "Protected authentication powered by Supabase Auth with token encryption." },
              { title: "Server-Side AI", desc: "Gemini API credentials remain strictly secured on the backend server." },
              { title: "Isolated Storage", desc: "Uploaded study PDFs are stored in dedicated private user buckets." },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 text-center">
                <span className="text-xl text-blue-600">🛡️</span>
                <h3 className="mt-2 text-xs font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Final Call to Action */}
      <section className="border-t border-slate-200/80 bg-slate-950 py-16 sm:py-24 text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CoursePilotMark className="mx-auto h-12 w-12 shadow-lg mb-4" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Stop wondering what to study next.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-xs sm:text-sm text-slate-300 leading-relaxed">
            Let CoursePilot synthesize your academic schedule, assignments, and exam deadlines into one clear next best action.
          </p>

          <div className="mt-8 flex justify-center">
            {user ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-slate-950 hover:bg-slate-100 transition shadow-lg active:scale-[0.98]"
              >
                Go to Dashboard →
              </button>
            ) : (
              <button
                type="button"
                onClick={onGetStarted}
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-slate-950 hover:bg-slate-100 transition shadow-lg active:scale-[0.98]"
              >
                Start with CoursePilot
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-white text-sm">Course<span className="text-blue-500">Pilot</span></span>
            <span>— Your AI-powered academic co-pilot.</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            {user ? (
              <button type="button" onClick={onGoToDashboard} className="hover:text-white transition">
                Dashboard
              </button>
            ) : (
              <>
                <button type="button" onClick={onSignIn} className="hover:text-white transition">
                  Sign In
                </button>
                <button type="button" onClick={onGetStarted} className="hover:text-white transition">
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
