import { useState, useEffect } from "react"
import { generateExamQuestion } from "../lib/api"
import { supabase } from "../lib/supabase"

function ExamQuiz({
  exam,
  topics = [],
  user,
  onComplete,
  onClose,
}) {
  // Navigation & session state
  const [step, setStep] = useState("config") // "config" | "question" | "results"
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  // Configuration State
  const [subjectList, setSubjectList] = useState([])
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [selectedSubjectName, setSelectedSubjectName] = useState(exam?.subject || "Subject")
  const [syllabusType, setSyllabusType] = useState("theory")
  const [availableUnits, setAvailableUnits] = useState([]) // e.g. ["Unit 1", "Unit 2", ...] or ["Practical 1", ...]
  const [selectedUnits, setSelectedUnits] = useState([])
  const [questionType, setQuestionType] = useState("mcq") // "mcq" | "short_answer" | "long_answer"
  const [difficulty, setDifficulty] = useState("mixed") // "easy" | "medium" | "hard" | "mixed"
  const [totalQuestions, setTotalQuestions] = useState(10)
  const [customQuestions, setCustomQuestions] = useState("")
  const [answerMode, setAnswerMode] = useState("question_only") // "question_only" | "question_and_answer"

  // Active Simulation State
  const [questionNumber, setQuestionNumber] = useState(1)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")
  const [selectedOption, setSelectedOption] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const [usedQuestions, setUsedQuestions] = useState([])
  const [sessionResults, setSessionResults] = useState([])
  const [error, setError] = useState("")

  // Monitor network status
  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Load available subjects from Supabase
  useEffect(() => {
    async function loadSubjects() {
      try {
        const { data } = await supabase
          .from("academic_subjects")
          .select("id, subject_code, subject_name, subject_type, syllabus_topics!inner(id)")
          .order("subject_code")

        if (data && data.length > 0) {
          const unique = []
          const seen = new Set()
          for (const s of data) {
            if (!seen.has(s.id)) {
              seen.add(s.id)
              unique.push(s)
            }
          }
          setSubjectList(unique)

          // Match initial exam subject
          const matched = unique.find(
            (s) =>
              s.subject_name.toLowerCase().includes((exam?.subject || "").toLowerCase()) ||
              (exam?.subject || "").toLowerCase().includes(s.subject_name.toLowerCase()) ||
              (s.subject_code && (exam?.subject || "").toLowerCase().includes(s.subject_code.toLowerCase()))
          )

          const target = matched || unique[0]
          setSelectedSubjectId(target.id)
          setSelectedSubjectName(target.subject_name)
          const isLab = target.subject_type?.toLowerCase() === "lab" || target.subject_code?.endsWith("L")
          setSyllabusType(isLab ? "lab" : "theory")
          loadSubjectUnits(target.id, isLab)
        }
      } catch (err) {
        console.warn("Could not load subjects for quiz config:", err)
      }
    }

    loadSubjects()
  }, [exam?.subject])

  // Load units / practicals for selected subject
  async function loadSubjectUnits(subId, isLab) {
    if (!subId) return
    try {
      const { data: topicsData } = await supabase
        .from("syllabus_topics")
        .select("unit_number, topic_name")
        .eq("subject_id", subId)
        .order("unit_number")

      if (topicsData && topicsData.length > 0) {
        const unitNums = Array.from(new Set(topicsData.map((t) => t.unit_number || 1))).sort((a, b) => a - b)
        const unitLabels = unitNums.map((n) => (isLab ? `Practical ${n}` : `Unit ${n}`))
        setAvailableUnits(unitLabels)
        setSelectedUnits(unitLabels) // default all selected
      } else {
        const fallback = isLab ? ["Practical 1", "Practical 2", "Practical 3"] : ["Unit 1", "Unit 2", "Unit 3", "Unit 4"]
        setAvailableUnits(fallback)
        setSelectedUnits(fallback)
      }
    } catch (err) {
      console.warn("Could not load units:", err)
      const fallback = isLab ? ["Practical 1", "Practical 2"] : ["Unit 1", "Unit 2", "Unit 3", "Unit 4"]
      setAvailableUnits(fallback)
      setSelectedUnits(fallback)
    }
  }

  function handleSubjectSelect(e) {
    const subId = Number(e.target.value)
    const sub = subjectList.find((s) => s.id === subId)
    if (sub) {
      setSelectedSubjectId(sub.id)
      setSelectedSubjectName(sub.subject_name)
      const isLab = sub.subject_type?.toLowerCase() === "lab" || sub.subject_code?.endsWith("L")
      setSyllabusType(isLab ? "lab" : "theory")
      loadSubjectUnits(sub.id, isLab)
    }
  }

  function toggleUnit(unitLabel) {
    if (selectedUnits.includes(unitLabel)) {
      if (selectedUnits.length > 1) {
        setSelectedUnits(selectedUnits.filter((u) => u !== unitLabel))
      }
    } else {
      setSelectedUnits([...selectedUnits, unitLabel])
    }
  }

  function selectAllUnits() {
    setSelectedUnits([...availableUnits])
  }

  function clearAllUnits() {
    if (availableUnits.length > 0) {
      setSelectedUnits([availableUnits[0]])
    }
  }

  // Start the test session and fetch question 1
  async function startTest() {
    if (selectedUnits.length === 0) {
      setError("Please select at least one syllabus unit or practical.")
      return
    }

    const questionCount = customQuestions ? Math.min(Math.max(Number(customQuestions) || 10, 1), 25) : totalQuestions
    setTotalQuestions(questionCount)
    setQuestionNumber(1)
    setSessionResults([])
    setUsedQuestions([])
    setError("")
    setStep("question")

    await fetchNextQuestion(1, [])
  }

  // Fetch ONE single question dynamically
  async function fetchNextQuestion(qNum, previousUsed) {
    if (!isOnline) {
      setError("You're offline. Exam question generation requires an internet connection.")
      return
    }

    setLoadingQuestion(true)
    setError("")
    setUserAnswer("")
    setSelectedOption(null)
    setIsSubmitted(false)
    setIsRevealed(false)

    try {
      const payload = {
        subject_id: selectedSubjectId,
        subject_name: selectedSubjectName,
        syllabus_type: syllabusType,
        question_type: questionType,
        selected_units: selectedUnits,
        difficulty: difficulty,
        answer_mode: answerMode,
        used_questions: previousUsed || usedQuestions,
      }

      const qData = await generateExamQuestion(payload)

      if (!qData || !qData.question) {
        throw new Error("Invalid question structure returned.")
      }

      setCurrentQuestion(qData)
      const newSignature = qData.question.trim()
      setUsedQuestions((prev) => [...prev, newSignature])
    } catch (err) {
      console.error("Exam question fetch failed:", err)
      setError("We couldn't generate this question. Please try again.")
    } finally {
      setLoadingQuestion(false)
    }
  }

  // Handle answer submission
  function handleSubmitAnswer() {
    if (questionType === "mcq" && selectedOption === null) return
    if (questionType !== "mcq" && !userAnswer.trim()) return

    setIsSubmitted(true)
    setIsRevealed(true)

    // Record result for session history
    const isCorrect = questionType === "mcq" ? selectedOption === Number(currentQuestion.correct_answer) : null

    const resultRecord = {
      questionNumber,
      unit: currentQuestion.unit || selectedUnits[0],
      questionType,
      difficulty: currentQuestion.difficulty || difficulty,
      question: currentQuestion.question,
      options: currentQuestion.options || [],
      selectedOption,
      correctAnswer: currentQuestion.correct_answer,
      userAnswer,
      expectedAnswer: currentQuestion.expected_answer,
      keyPoints: currentQuestion.key_points || [],
      explanation: currentQuestion.explanation,
      isCorrect,
    }

    setSessionResults((prev) => [...prev, resultRecord])
  }

  // Handle direct answer reveal in Question+Answer mode
  function handleRevealAnswer() {
    setIsRevealed(true)

    const resultRecord = {
      questionNumber,
      unit: currentQuestion.unit || selectedUnits[0],
      questionType,
      difficulty: currentQuestion.difficulty || difficulty,
      question: currentQuestion.question,
      options: currentQuestion.options || [],
      selectedOption: null,
      correctAnswer: currentQuestion.correct_answer,
      userAnswer: "[Revealed directly in Study Mode]",
      expectedAnswer: currentQuestion.expected_answer,
      keyPoints: currentQuestion.key_points || [],
      explanation: currentQuestion.explanation,
      isCorrect: null,
    }

    setSessionResults((prev) => [...prev, resultRecord])
  }

  // Proceed to next question or complete test
  async function handleNextQuestion() {
    if (questionNumber < totalQuestions) {
      const nextNum = questionNumber + 1
      setQuestionNumber(nextNum)
      await fetchNextQuestion(nextNum, usedQuestions)
    } else {
      finishTest()
    }
  }

  // Finish test and sync mastery
  async function finishTest() {
    setStep("results")

    // Update topic progress in Supabase for MCQs
    const mcqResults = sessionResults.filter((r) => r.isCorrect !== null)
    if (mcqResults.length > 0 && user?.id && selectedSubjectId) {
      try {
        const correctCount = mcqResults.filter((r) => r.isCorrect).length
        const scorePercentage = Math.round((correctCount / mcqResults.length) * 100)

        // Find relevant topics for the selected units
        const { data: subjectTopics } = await supabase
          .from("syllabus_topics")
          .select("id, unit_number, topic_name")
          .eq("subject_id", selectedSubjectId)

        if (subjectTopics && subjectTopics.length > 0) {
          for (const top of subjectTopics) {
            const { data: existingProgress } = await supabase
              .from("student_topic_progress")
              .select("mastery_score")
              .eq("user_id", user.id)
              .eq("syllabus_topic_id", top.id)
              .maybeSingle()

            const prevMastery = Number(existingProgress?.mastery_score || 0)
            const updatedMastery = Math.round(prevMastery * 0.7 + scorePercentage * 0.3)
            const updatedStatus = updatedMastery >= 80 ? "mastered" : updatedMastery >= 40 ? "learning" : "not_started"

            await supabase
              .from("student_topic_progress")
              .upsert(
                {
                  user_id: user.id,
                  syllabus_topic_id: top.id,
                  mastery_score: updatedMastery,
                  status: updatedStatus,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,syllabus_topic_id" }
              )
          }
        }
      } catch (err) {
        console.warn("Could not update mastery score:", err)
      }
    }

    if (onComplete) {
      onComplete()
    }
  }

  // =========================================================================
  // SCREEN 1: TEST CONFIGURATION
  // =========================================================================
  if (step === "config") {
    return (
      <div className="rounded-3xl border border-[#E4E4E7] bg-white p-5 sm:p-8 shadow-2xs max-w-3xl mx-auto space-y-6 dark:border-[#27343a] dark:bg-[#141c1f]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-4 dark:border-[#27343a]">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0F766E] dark:text-[#2DD4BF]">
              Exam Simulator
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
              Configure Your Practice Test
            </h2>
            <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#a1a1aa]">
              Customize syllabus units, question formats, and difficulty. Questions are generated one-at-a-time.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* 1. Subject Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Subject
          </label>
          <select
            value={selectedSubjectId || ""}
            onChange={handleSubjectSelect}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition"
          >
            {subjectList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_code} — {s.subject_name} ({s.subject_type || "Theory"})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Syllabus Scope Selection (Theory Units vs Lab Practicals) */}
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#18181B] dark:text-[#f4f4f5]">
                {syllabusType === "lab" ? "Lab Practicals" : "Syllabus Units"}
              </label>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                syllabusType === "lab" ? "bg-[#ECFDF5] text-[#0F766E] border border-teal-200/60" : "bg-zinc-100 text-[#52525B] border border-[#E4E4E7]"
              }`}>
                {syllabusType === "lab" ? "LAB" : "THEORY"}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllUnits}
                className="text-[11px] font-bold text-[#0F766E] hover:underline dark:text-[#2DD4BF]"
              >
                Select All
              </button>
              <span className="text-[#E4E4E7] dark:text-[#27343a]">·</span>
              <button
                type="button"
                onClick={clearAllUnits}
                className="text-[11px] font-bold text-[#71717A] hover:underline dark:text-[#a1a1aa]"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {availableUnits.map((u) => {
              const isChecked = selectedUnits.includes(u)
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => toggleUnit(u)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition border text-left ${
                    isChecked
                      ? "border-[#0F766E] bg-[#ECFDF5] text-[#0F766E] shadow-2xs dark:bg-[#182226] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
                      : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
                  }`}
                >
                  <span>{u}</span>
                  <span className={`h-4 w-4 rounded flex items-center justify-center text-[10px] font-bold ${
                    isChecked ? "bg-[#0F766E] text-white dark:bg-[#2DD4BF] dark:text-[#0f1416]" : "border border-[#E4E4E7] dark:border-[#27343a]"
                  }`}>
                    {isChecked ? "✓" : ""}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-[#71717A] dark:text-[#a1a1aa]">
            Selected scope: {selectedUnits.length} {syllabusType === "lab" ? "practicals" : "units"}. Questions will only be drawn from these.
          </p>
        </div>

        {/* 3. Question Format */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Question Type
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: "mcq", label: "MCQ", desc: "4 Options · 1 Correct" },
              { id: "short_answer", label: "Short Answer", desc: "Conceptual definitions" },
              { id: "long_answer", label: "Long Answer", desc: "In-depth university style" },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setQuestionType(type.id)}
                className={`rounded-2xl p-3.5 text-left border transition ${
                  questionType === type.id
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                }`}
              >
                <p className="font-bold text-xs sm:text-sm">{type.label}</p>
                <p className={`mt-0.5 text-[11px] ${questionType === type.id ? "text-slate-300" : "text-slate-500"}`}>
                  {type.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 4. Number of Questions & Difficulty */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Number of Questions
            </label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setTotalQuestions(num)
                    setCustomQuestions("")
                  }}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    totalQuestions === num && !customQuestions
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Difficulty
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {["easy", "medium", "hard", "mixed"].map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`rounded-xl py-2 text-xs font-bold capitalize transition ${
                    difficulty === diff
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Answer Mode */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#a1a1aa]">
            Practice Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAnswerMode("question_only")}
              className={`rounded-2xl p-3.5 text-left border transition ${
                answerMode === "question_only"
                  ? "border-[#0F766E] bg-[#ECFDF5] text-[#0F766E] shadow-2xs dark:bg-[#182226] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
                  : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
              }`}
            >
              <p className="font-bold text-xs sm:text-sm text-[#18181B] dark:text-[#f4f4f5]">Question Only</p>
              <p className="mt-0.5 text-[11px] text-[#52525B] dark:text-[#a1a1aa]">
                Attempt before seeing expected answer & explanation
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAnswerMode("question_and_answer")}
              className={`rounded-2xl p-3.5 text-left border transition ${
                answerMode === "question_and_answer"
                  ? "border-[#0F766E] bg-[#ECFDF5] text-[#0F766E] shadow-2xs dark:bg-[#182226] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
                  : "border-[#E4E4E7] bg-white text-[#52525B] hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
              }`}
            >
              <p className="font-bold text-xs sm:text-sm text-[#18181B] dark:text-[#f4f4f5]">Question + Answer</p>
              <p className="mt-0.5 text-[11px] text-[#52525B] dark:text-[#a1a1aa]">
                Directly reveal expected answer & key points for quick revision
              </p>
            </button>
          </div>
        </div>

        {/* Start Button */}
        <button
          type="button"
          onClick={startTest}
          disabled={!isOnline || selectedUnits.length === 0}
          className="w-full rounded-2xl bg-[#0F766E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#115E59] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>Start Practice Test</span>
          <span>→</span>
        </button>
      </div>
    )
  }

  // =========================================================================
  // SCREEN 2: ACTIVE QUESTION-BY-QUESTION SIMULATION
  // =========================================================================
  if (step === "question") {
    return (
      <div className="rounded-3xl border border-[#E4E4E7] bg-white p-5 sm:p-8 shadow-2xs max-w-3xl mx-auto space-y-6 dark:border-[#27343a] dark:bg-[#141c1f]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E4E4E7] pb-4 dark:border-[#27343a]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-[#18181B] dark:text-[#f4f4f5]">
                {selectedSubjectName}
              </span>
              <span className="rounded-md bg-[#F7F7F2] px-2 py-0.5 text-[10px] font-bold text-[#52525B] uppercase border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#a1a1aa]">
                {currentQuestion?.unit || selectedUnits[0]}
              </span>
              <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#0F766E] uppercase border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                {currentQuestion?.difficulty || difficulty}
              </span>
            </div>

            <h2 className="mt-1 font-bold text-base sm:text-lg text-[#18181B] dark:text-[#f4f4f5]">
              Question {questionNumber} of {totalQuestions}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setStep("config")}
            className="rounded-xl border border-[#E4E4E7] px-3 py-1.5 text-xs font-semibold text-[#52525B] hover:bg-[#F7F7F2] self-start sm:self-center transition dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
          >
            Exit Test
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-[#E4E4E7] overflow-hidden dark:bg-[#27343a]">
          <div
            className="h-full bg-[#0F766E] transition-all duration-300"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          />
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchNextQuestion(questionNumber, usedQuestions)}
              className="ml-3 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loadingQuestion ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#0F766E] border-t-transparent dark:border-[#2DD4BF]" />
            <p className="text-sm font-semibold text-[#18181B] dark:text-[#f4f4f5]">
              Generating Question {questionNumber}...
            </p>
            <p className="text-xs text-[#71717A] dark:text-[#a1a1aa]">
              Drawing dynamically from {currentQuestion?.unit || selectedUnits[0]}
            </p>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6">
            {/* Question Text */}
            <div className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-5 dark:border-[#27343a] dark:bg-[#182226]">
              <p className="font-bold text-sm sm:text-base text-[#18181B] leading-relaxed dark:text-[#f4f4f5]">
                {currentQuestion.question}
              </p>
            </div>

            {/* MCQ Options */}
            {questionType === "mcq" && currentQuestion.options && (
              <div className="space-y-2.5">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx
                  const isCorrect = isRevealed && idx === Number(currentQuestion.correct_answer)
                  const isWrongSelected = isRevealed && isSelected && !isCorrect

                  let optionStyle = "border-[#E4E4E7] bg-white text-[#18181B] hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5]"
                  if (isSelected && !isRevealed) {
                    optionStyle = "border-[#0F766E] bg-[#ECFDF5] text-[#12312F] ring-1 ring-[#0F766E] shadow-2xs dark:bg-[#182226] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
                  } else if (isCorrect) {
                    optionStyle = "border-[#15803D] bg-emerald-50 text-[#15803D] ring-2 ring-emerald-500/20 dark:bg-[#182226] dark:border-[#15803D] dark:text-emerald-300"
                  } else if (isWrongSelected) {
                    optionStyle = "border-[#DC2626] bg-rose-50 text-[#DC2626] ring-2 ring-rose-500/20 dark:bg-[#182226] dark:border-[#DC2626] dark:text-rose-300"
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isRevealed}
                      onClick={() => setSelectedOption(idx)}
                      className={`w-full flex items-start gap-3 rounded-2xl p-4 text-left border transition ${optionStyle}`}
                    >
                      <span className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSelected && !isRevealed
                          ? "bg-[#0F766E] text-white"
                          : isCorrect
                          ? "bg-[#15803D] text-white"
                          : isWrongSelected
                          ? "bg-[#DC2626] text-white"
                          : "bg-[#F7F7F2] text-[#52525B] dark:bg-[#182226] dark:text-[#a1a1aa]"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold flex-1 pt-0.5">
                        {opt}
                      </span>
                      {isCorrect && (
                        <span className="text-[#15803D] font-bold text-xs shrink-0 dark:text-emerald-300">
                          Correct Answer
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Short / Long Answer Input */}
            {questionType !== "mcq" && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#a1a1aa]">
                  Your Answer
                </label>
                <textarea
                  rows={questionType === "long_answer" ? 6 : 3}
                  value={userAnswer}
                  disabled={isRevealed}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full rounded-2xl border border-[#E4E4E7] bg-white p-4 text-xs sm:text-sm text-[#18181B] outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10 transition disabled:bg-[#F7F7F2] dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5]"
                />
              </div>
            )}

            {/* Revealed Answer & Explanation Box */}
            {isRevealed && (
              <div className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-5 space-y-3.5 dark:border-[#27343a] dark:bg-[#182226]">
                {/* Result Badge */}
                {questionType === "mcq" && (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      selectedOption === Number(currentQuestion.correct_answer)
                        ? "bg-emerald-100 text-[#15803D]"
                        : "bg-rose-100 text-[#DC2626]"
                    }`}>
                      {selectedOption === Number(currentQuestion.correct_answer) ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>
                )}

                {/* Expected Answer for Short/Long */}
                {questionType !== "mcq" && currentQuestion.expected_answer && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#71717A] dark:text-[#a1a1aa]">
                      Model Expected Answer
                    </p>
                    <p className="text-xs sm:text-sm text-[#18181B] leading-relaxed font-medium dark:text-[#f4f4f5]">
                      {currentQuestion.expected_answer}
                    </p>
                  </div>
                )}

                {/* Key Points */}
                {currentQuestion.key_points && currentQuestion.key_points.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#71717A] dark:text-[#a1a1aa]">
                      Key Grading Points
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-[#52525B] dark:text-[#a1a1aa]">
                      {currentQuestion.key_points.map((pt, pIdx) => (
                        <li key={pIdx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Explanation */}
                {currentQuestion.explanation && (
                  <div className="border-t border-[#E4E4E7] pt-3 dark:border-[#27343a]">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
                      Explanation
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed dark:text-[#a1a1aa]">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {!isRevealed ? (
                answerMode === "question_only" ? (
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={questionType === "mcq" ? selectedOption === null : !userAnswer.trim()}
                    className="w-full rounded-2xl bg-[#0F766E] py-3.5 text-xs sm:text-sm font-bold text-white shadow-2xs transition hover:bg-[#115E59] disabled:opacity-50"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRevealAnswer}
                    className="w-full rounded-2xl bg-[#0F766E] py-3.5 text-xs sm:text-sm font-bold text-white shadow-2xs transition hover:bg-[#115E59]"
                  >
                    Reveal Answer & Explanation
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="w-full rounded-2xl bg-[#12312F] py-3.5 text-xs sm:text-sm font-bold text-white shadow-2xs transition hover:bg-[#0F766E] flex items-center justify-center gap-2 dark:bg-[#2DD4BF] dark:text-[#0f1416]"
                >
                  <span>{questionNumber < totalQuestions ? "Next Question" : "Finish Test & View Results"}</span>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // =========================================================================
  // SCREEN 3: FINAL RESULTS & SUMMARY
  // =========================================================================
  const mcqResults = sessionResults.filter((r) => r.questionType === "mcq" && r.isCorrect !== null)
  const mcqScore = mcqResults.filter((r) => r.isCorrect).length
  const subjectiveCount = sessionResults.filter((r) => r.questionType !== "mcq").length

  return (
    <div className="rounded-3xl border border-[#E4E4E7] bg-white p-5 sm:p-8 shadow-2xs max-w-3xl mx-auto space-y-6 dark:border-[#27343a] dark:bg-[#141c1f]">
      {/* Header */}
      <div className="text-center space-y-2 border-b border-[#E4E4E7] pb-5 dark:border-[#27343a]">
        <span className="text-[11px] font-bold tracking-widest uppercase text-[#0F766E] dark:text-[#2DD4BF]">
          Simulation Complete
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
          Test Results & Mastery Breakdown
        </h2>
        <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#a1a1aa]">
          {selectedSubjectName} · {sessionResults.length} Questions Attempted
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {mcqResults.length > 0 && (
          <div className="rounded-2xl bg-[#F7F7F2] p-4 text-center border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a]">
            <p className="text-xs font-bold text-[#71717A] uppercase dark:text-[#a1a1aa]">MCQ Score</p>
            <p className="mt-1 text-2xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
              {mcqScore} / {mcqResults.length}
            </p>
            <p className="text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
              {Math.round((mcqScore / mcqResults.length) * 100)}% Accuracy
            </p>
          </div>
        )}

        {subjectiveCount > 0 && (
          <div className="rounded-2xl bg-[#F7F7F2] p-4 text-center border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a]">
            <p className="text-xs font-bold text-[#71717A] uppercase dark:text-[#a1a1aa]">Self-Reviewed</p>
            <p className="mt-1 text-2xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
              {subjectiveCount}
            </p>
            <p className="text-[11px] font-semibold text-[#52525B] dark:text-[#a1a1aa]">
              Written Responses
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-[#F7F7F2] p-4 text-center border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a]">
          <p className="text-xs font-bold text-[#71717A] uppercase dark:text-[#a1a1aa]">Scope Covered</p>
          <p className="mt-1 text-2xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
            {selectedUnits.length}
          </p>
          <p className="text-[11px] font-semibold text-[#52525B] dark:text-[#a1a1aa]">
            {syllabusType === "lab" ? "Practicals" : "Units"}
          </p>
        </div>
      </div>

      {/* Question by Question Review */}
      <div className="space-y-4 pt-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#18181B] dark:text-[#f4f4f5]">
          Detailed Question Review
        </h3>

        <div className="space-y-3">
          {sessionResults.map((res, rIdx) => (
            <div
              key={rIdx}
              className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 sm:p-5 space-y-3 dark:border-[#27343a] dark:bg-[#182226]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  Q{res.questionNumber} · {res.unit}
                </span>

                {res.questionType === "mcq" ? (
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    res.isCorrect ? "bg-emerald-50 text-[#15803D] border border-emerald-200/60" : "bg-rose-50 text-[#DC2626] border border-rose-200/60"
                  }`}>
                    {res.isCorrect ? "Correct" : "Incorrect"}
                  </span>
                ) : (
                  <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#0F766E] uppercase border border-teal-200/60 dark:bg-[#141c1f] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                    {res.questionType.replace("_", " ")}
                  </span>
                )}
              </div>

              <p className="font-bold text-xs sm:text-sm text-[#18181B] dark:text-[#f4f4f5]">
                {res.question}
              </p>

              {res.questionType === "mcq" && res.options && (
                <div className="text-xs space-y-1 text-[#52525B] dark:text-[#a1a1aa]">
                  <p>
                    <strong>Your Choice:</strong>{" "}
                    {res.selectedOption !== null ? res.options[res.selectedOption] : "None"}
                  </p>
                  <p className="text-[#15803D] dark:text-[#2DD4BF]">
                    <strong>Correct Choice:</strong> {res.options[res.correctAnswer]}
                  </p>
                </div>
              )}

              {res.questionType !== "mcq" && (
                <div className="text-xs space-y-1.5 text-[#52525B] dark:text-[#a1a1aa]">
                  {res.userAnswer && (
                    <p>
                      <strong>Your Response:</strong> {res.userAnswer}
                    </p>
                  )}
                  {res.expectedAnswer && (
                    <p className="text-[#18181B] dark:text-[#f4f4f5]">
                      <strong>Expected Answer:</strong> {res.expectedAnswer}
                    </p>
                  )}
                </div>
              )}

              {res.explanation && (
                <p className="text-[11px] text-[#71717A] border-t border-[#E4E4E7] pt-2 dark:border-[#27343a] dark:text-[#a1a1aa]">
                  <strong>Explanation:</strong> {res.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#E4E4E7] dark:border-[#27343a]">
        <button
          type="button"
          onClick={() => setStep("config")}
          className="flex-1 rounded-2xl bg-[#0F766E] py-3.5 text-xs sm:text-sm font-bold text-white shadow-2xs hover:bg-[#115E59] transition"
        >
          Try Another Test
        </button>

        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-2xl border border-[#E4E4E7] bg-white py-3.5 text-xs sm:text-sm font-bold text-[#18181B] hover:bg-[#F7F7F2] transition dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5]"
        >
          Exit Exam Simulator
        </button>
      </div>
    </div>
  )
}

export default ExamQuiz
