import { CoursePilotLogo, CoursePilotMark } from "../components/CoursePilotLogo"

function LandingPage({ onGetStarted, onSignIn, user, onGoToDashboard }) {
  return (
    <div className="min-h-screen bg-[#F7F7F2] text-[#18181B] selection:bg-[#0F766E] selection:text-white dark:bg-[#0f1416] dark:text-[#f4f4f5]">
      {/* 1. Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#E4E4E7] bg-white/90 backdrop-blur-md dark:border-[#27343a] dark:bg-[#0f1416]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <CoursePilotLogo size="sm" showTagline={false} />

          <nav className="hidden items-center gap-8 text-xs font-semibold text-[#52525B] md:flex dark:text-[#a1a1aa]">
            <a href="#features" className="hover:text-[#18181B] transition dark:hover:text-white">Features</a>
            <a href="#workflow" className="hover:text-[#18181B] transition dark:hover:text-white">How it Works</a>
            <a href="#comparison" className="hover:text-[#18181B] transition dark:hover:text-white">Comparison</a>
            <a href="#security" className="hover:text-[#18181B] transition dark:hover:text-white">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] transition active:scale-[0.98]"
              >
                Go to Dashboard →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="rounded-xl px-3.5 py-2 text-xs font-bold text-[#52525B] hover:bg-[#F7F7F2] hover:text-[#18181B] transition dark:text-[#a1a1aa] dark:hover:bg-[#182226]"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] transition active:scale-[0.98]"
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
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-[#ECFDF5] px-3.5 py-1 text-xs font-bold text-[#0F766E] mb-6 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E] animate-pulse dark:bg-[#2DD4BF]" />
            <span>Your AI-powered academic co-pilot.</span>
            <span className="text-[#C49A3A]">✦</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-[#18181B] sm:text-6xl sm:leading-[1.1] dark:text-[#f4f4f5]">
            Know what to study next.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-[#52525B] dark:text-[#a1a1aa]">
            CoursePilot combines assignments, exams, syllabus progress, topic mastery, study sessions, and AI assistance to help students decide what deserves their attention next.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            {user ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="rounded-xl bg-[#0F766E] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#115E59] transition active:scale-[0.98]"
              >
                Open Your Dashboard →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="rounded-xl bg-[#0F766E] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#115E59] transition active:scale-[0.98]"
                >
                  Get Started Free
                </button>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="rounded-xl border border-[#E4E4E7] bg-white px-6 py-3.5 text-sm font-semibold text-[#18181B] shadow-2xs hover:bg-[#F7F7F2] transition active:scale-[0.98] dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5]"
                >
                  Sign In
                </button>
              </>
            )}
          </div>

          <p className="mt-4 text-[11px] font-medium text-[#71717A] dark:text-[#71717a]">
            Tailored for university students · Zero setup friction · Free to use
          </p>
        </div>

        {/* 3. Product Visual Mockup */}
        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-[#E4E4E7] bg-white p-3 sm:p-5 shadow-2xl dark:border-[#27343a] dark:bg-[#141c1f]">
            {/* Top Mockup Bar */}
            <div className="mb-4 flex items-center justify-between border-b border-[#E4E4E7] pb-3 px-2 dark:border-[#27343a]">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#E4E4E7] dark:bg-[#27343a]" />
                <span className="h-3 w-3 rounded-full bg-[#E4E4E7] dark:bg-[#27343a]" />
                <span className="h-3 w-3 rounded-full bg-[#E4E4E7] dark:bg-[#27343a]" />
                <span className="ml-2 text-xs font-bold text-[#71717A] dark:text-[#a1a1aa]">app.coursepilot.edu/dashboard</span>
              </div>
              <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#0F766E] border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                LIVE DEMO PREVIEW
              </span>
            </div>

            {/* Dashboard Mockup Grid */}
            <div className="space-y-4">
              {/* Next Best Action Card Mockup */}
              <div className="rounded-2xl bg-[#12312F] p-5 sm:p-7 text-white shadow-lg dark:bg-[#182226]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                        CRITICAL PRIORITY · 92/100
                      </span>
                      <span className="text-xs text-[#A1A1AA] font-mono">
                        Discrete Mathematics
                      </span>
                    </div>

                    <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white">
                      Study: Relations & Closures
                    </h2>

                    <p className="mt-1 text-xs text-[#A1A1AA]">
                      Discrete Mathematics Exam in 3 days · Mastery is low (35%)
                    </p>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3">
                      <p className="text-[10px] font-bold tracking-widest text-[#A1A1AA] uppercase mb-1">
                        WHY THIS NOW?
                      </p>
                      <ul className="space-y-1 text-xs text-[#d4d4d8]">
                        <li className="flex items-center gap-2">
                          <span className="text-[#2DD4BF] font-bold">•</span>
                          <span>Discrete Mathematics exam is scheduled in 3 days (highest academic urgency).</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-[#2DD4BF] font-bold">•</span>
                          <span>Topic mastery is 35% (high risk for end-term assessment).</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-[#2DD4BF] font-bold">•</span>
                          <span>Fits into your 90-minute free study window between lectures.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="shrink-0 self-start md:self-center">
                    <div className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-[#12312F] shadow-md">
                      Take High-Yield Practice Quiz →
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Dashboard Cards Mockup */}
              <div className="grid gap-4 sm:grid-cols-3 text-left">
                <div className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 dark:border-[#27343a] dark:bg-[#182226]">
                  <p className="text-[10px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
                    SCHEDULE CONTEXT
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#18181B] dark:text-[#f4f4f5]">
                    Next: Operating Systems
                  </p>
                  <p className="text-xs text-[#52525B] dark:text-[#a1a1aa]">11:00 AM · Room 304</p>
                </div>

                <div className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 dark:border-[#27343a] dark:bg-[#182226]">
                  <p className="text-[10px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
                    EXAM READINESS
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#D97706]">
                    42% · Needs Immediate Review
                  </p>
                  <p className="text-xs text-[#52525B] dark:text-[#a1a1aa]">Discrete Math in 3 days</p>
                </div>

                <div className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 dark:border-[#27343a] dark:bg-[#182226]">
                  <p className="text-[10px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
                    SYLLABUS PROGRESS
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#18181B] dark:text-[#f4f4f5]">
                    68% Average Mastery
                  </p>
                  <p className="text-xs text-[#52525B] dark:text-[#a1a1aa]">14 of 24 units completed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Value Proposition Workflow */}
      <section id="workflow" className="border-t border-[#E4E4E7] bg-white py-16 sm:py-20 dark:border-[#27343a] dark:bg-[#0f1416]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
              THE DECISION ENGINE
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
              From academic noise to singular focus
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-[#52525B] dark:text-[#a1a1aa]">
              Students juggle countless tasks, dates, and chapters. CoursePilot continuously recalculates priorities so you always know your single next move.
            </p>
          </div>

          {/* Workflow Stepper Grid */}
          <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-6">
            {[
              { num: "01", title: "Academic Data", desc: "Timetable, exams & tasks" },
              { num: "02", title: "Analyze Priorities", desc: "Urgency, impact & free slots" },
              { num: "03", title: "Next Best Action", desc: "One clear recommendation" },
              { num: "04", title: "Targeted Practice", desc: "Adaptive exam revision" },
              { num: "05", title: "Topic Mastery", desc: "Scores update dynamically" },
              { num: "06", title: "Recalculate", desc: "Better next action generated" },
            ].map((step, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 transition hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#182226]"
              >
                <span className="font-mono text-xs font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                  {step.num}
                </span>
                <h3 className="mt-2 text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  {step.title}
                </h3>
                <p className="mt-1 text-[11px] text-[#52525B] leading-tight dark:text-[#a1a1aa]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Features Section (6 Core Features) */}
      <section id="features" className="border-t border-[#E4E4E7] bg-[#F7F7F2] py-16 sm:py-24 dark:border-[#27343a] dark:bg-[#0f1416]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
              POWERFUL CAPABILITIES
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
              Everything you need to master your semester
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-[#52525B] dark:text-[#a1a1aa]">
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
                icon: "🗓️",
                title: "Smart Timetable",
                desc: "Live class countdowns, room locations, teacher schedules, and lab sessions synced with your section.",
              },
              {
                icon: "✅",
                title: "Task & Deadline Tracking",
                desc: "Keep track of upcoming assignments, priority coursework, and submissions in one unified workspace.",
              },
            ].map((feat, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-2xs transition hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f]"
              >
                <span className="text-2xl">{feat.icon}</span>
                <h3 className="mt-3 text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  {feat.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#52525B] dark:text-[#a1a1aa]">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Comparison Section (Traditional vs CoursePilot) */}
      <section id="comparison" className="border-t border-[#E4E4E7] bg-white py-16 sm:py-20 dark:border-[#27343a] dark:bg-[#0f1416]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
              WHY COURSEPILOT
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
              Engineered for academic momentum
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-[#52525B] dark:text-[#a1a1aa]">
              Unlike generic to-do apps, CoursePilot understands your semester syllabus, exam weightage, and daily class schedule.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* Generic Apps */}
            <div className="rounded-3xl border border-[#E4E4E7] bg-[#F7F7F2] p-6 sm:p-8 dark:border-[#27343a] dark:bg-[#182226]">
              <h3 className="text-base font-bold text-[#71717A] uppercase tracking-wider text-xs dark:text-[#a1a1aa]">
                TRADITIONAL METHODS
              </h3>
              <ul className="mt-5 space-y-3.5 text-xs sm:text-sm text-[#52525B] dark:text-[#d4d4d8]">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#DC2626] font-bold">✕</span>
                  <span>Static schedules that don&apos;t know when you actually have free study gaps.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#DC2626] font-bold">✕</span>
                  <span>Long checklists with zero guidance on what has the highest exam impact.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#DC2626] font-bold">✕</span>
                  <span>No concept of subject mastery or syllabus progression tracking.</span>
                </li>
              </ul>
            </div>

            {/* CoursePilot Solution */}
            <div className="rounded-3xl border-2 border-[#0F766E] bg-[#ECFDF5]/30 p-6 sm:p-8 shadow-xs dark:border-[#2DD4BF] dark:bg-[#182226]">
              <h3 className="text-base font-bold text-[#0F766E] uppercase tracking-wider text-xs dark:text-[#2DD4BF]">
                COURSEPILOT DECISION ENGINE
              </h3>
              <ul className="mt-5 space-y-3.5 text-xs sm:text-sm text-[#18181B] dark:text-[#f4f4f5]">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#0F766E] font-bold dark:text-[#2DD4BF]">✓</span>
                  <span>Dynamic daily planner that adapts to class changes and study windows.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#0F766E] font-bold dark:text-[#2DD4BF]">✓</span>
                  <span>Next Best Action formula ranking your single most critical priority.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#0F766E] font-bold dark:text-[#2DD4BF]">✓</span>
                  <span>Adaptive mastery scoring from 0% to 100% across all curriculum topics.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Security & Architecture */}
      <section id="security" className="border-t border-[#E4E4E7] bg-[#F7F7F2] py-16 sm:py-20 dark:border-[#27343a] dark:bg-[#0f1416]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-[#71717A] uppercase dark:text-[#a1a1aa]">
              DATA PRIVACY & INTEGRITY
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#18181B] sm:text-2xl dark:text-[#f4f4f5]">
              Built on academic data isolation
            </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[
              { title: "Row Level Security", desc: "Your tasks, exams and records are strictly isolated to your account." },
              { title: "Secure Auth", desc: "Protected authentication powered by Supabase Auth with token encryption." },
              { title: "Server-Side AI", desc: "Gemini API credentials remain strictly secured on the backend server." },
              { title: "Isolated Cache", desc: "Local cache is cryptographically partitioned per authenticated student." },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-[#E4E4E7] bg-white p-5 text-center dark:border-[#27343a] dark:bg-[#141c1f]">
                <span className="text-xl text-[#0F766E] dark:text-[#2DD4BF]">🛡️</span>
                <h3 className="mt-2 text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">{item.title}</h3>
                <p className="mt-1 text-[11px] text-[#52525B] leading-tight dark:text-[#a1a1aa]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Final Call to Action */}
      <section className="border-t border-[#E4E4E7] bg-[#12312F] py-16 sm:py-24 text-white text-center dark:border-[#27343a] dark:bg-[#0b1012]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CoursePilotMark className="mx-auto h-12 w-12 shadow-lg mb-4" />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Stop wondering what to study next.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-xs sm:text-sm text-[#d4d4d8] leading-relaxed">
            Let CoursePilot synthesize your academic schedule, assignments, and exam deadlines into one clear next best action.
          </p>

          <div className="mt-8 flex justify-center">
            {user ? (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#12312F] hover:bg-[#F7F7F2] transition shadow-lg active:scale-[0.98]"
              >
                Go to Dashboard →
              </button>
            ) : (
              <button
                type="button"
                onClick={onGetStarted}
                className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#12312F] hover:bg-[#F7F7F2] transition shadow-lg active:scale-[0.98]"
              >
                Start with CoursePilot
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="border-t border-[#27343a] bg-[#0b1012] py-8 text-xs text-[#71717A]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-white text-sm">Course<span className="text-[#2DD4BF]">Pilot</span></span>
            <span>— Your AI-powered academic co-pilot.</span>
          </div>

          <div className="flex items-center gap-6 text-[#a1a1aa]">
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
