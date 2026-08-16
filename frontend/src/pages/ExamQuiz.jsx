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
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-sm max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-blue-600">
              Exam Simulator
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
              Configure Your Practice Test
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {syllabusType === "lab" ? "Lab Practicals" : "Syllabus Units"}
              </label>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                syllabusType === "lab" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
              }`}>
                {syllabusType === "lab" ? "LAB" : "THEORY"}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllUnits}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={clearAllUnits}
                className="text-[11px] font-bold text-slate-500 hover:underline"
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
                      ? "border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span>{u}</span>
                  <span className={`h-4 w-4 rounded flex items-center justify-center text-[10px] font-bold ${
                    isChecked ? "bg-blue-600 text-white" : "border border-slate-300"
                  }`}>
                    {isChecked ? "✓" : ""}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-500">
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
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Practice Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAnswerMode("question_only")}
              className={`rounded-2xl p-3.5 text-left border transition ${
                answerMode === "question_only"
                  ? "border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <p className="font-bold text-xs sm:text-sm">Question Only</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Attempt before seeing expected answer & explanation
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAnswerMode("question_and_answer")}
              className={`rounded-2xl p-3.5 text-left border transition ${
                answerMode === "question_and_answer"
                  ? "border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <p className="font-bold text-xs sm:text-sm">Question + Answer</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
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
          className="w-full rounded-2xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
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
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-sm max-w-3xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-900">
                {selectedSubjectName}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                {currentQuestion?.unit || selectedUnits[0]}
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                {currentQuestion?.difficulty || difficulty}
              </span>
            </div>

            <h2 className="mt-1 font-bold text-base sm:text-lg text-slate-800">
              Question {questionNumber} of {totalQuestions}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setStep("config")}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 self-start sm:self-center transition"
          >
            Exit Test
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
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
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-700">
              Generating Question {questionNumber}...
            </p>
            <p className="text-xs text-slate-400">
              Drawing dynamically from {currentQuestion?.unit || selectedUnits[0]}
            </p>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6">
            {/* Question Text */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
              <p className="font-bold text-sm sm:text-base text-slate-900 leading-relaxed">
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

                  let optionStyle = "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  if (isSelected && !isRevealed) {
                    optionStyle = "border-slate-900 bg-slate-900 text-white shadow-xs"
                  } else if (isCorrect) {
                    optionStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                  } else if (isWrongSelected) {
                    optionStyle = "border-red-400 bg-red-50 text-red-900 ring-2 ring-red-500/20"
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
                          ? "bg-white/20 text-white"
                          : isCorrect
                          ? "bg-emerald-600 text-white"
                          : isWrongSelected
                          ? "bg-red-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold flex-1 pt-0.5">
                        {opt}
                      </span>
                      {isCorrect && (
                        <span className="text-emerald-600 font-bold text-xs shrink-0">
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Your Answer
                </label>
                <textarea
                  rows={questionType === "long_answer" ? 6 : 3}
                  value={userAnswer}
                  disabled={isRevealed}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full rounded-2xl border border-slate-300 p-4 text-xs sm:text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition disabled:bg-slate-50"
                />
              </div>
            )}

            {/* Revealed Answer & Explanation Box */}
            {isRevealed && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3.5">
                {/* Result Badge */}
                {questionType === "mcq" && (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      selectedOption === Number(currentQuestion.correct_answer)
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {selectedOption === Number(currentQuestion.correct_answer) ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>
                )}

                {/* Expected Answer for Short/Long */}
                {questionType !== "mcq" && currentQuestion.expected_answer && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Model Expected Answer
                    </p>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                      {currentQuestion.expected_answer}
                    </p>
                  </div>
                )}

                {/* Key Points */}
                {currentQuestion.key_points && currentQuestion.key_points.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Key Grading Points
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                      {currentQuestion.key_points.map((pt, pIdx) => (
                        <li key={pIdx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Explanation */}
                {currentQuestion.explanation && (
                  <div className="border-t border-slate-200/80 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                      Explanation
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-relaxed">
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
                    className="w-full rounded-2xl bg-slate-900 py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRevealAnswer}
                    className="w-full rounded-2xl bg-blue-600 py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Reveal Answer & Explanation
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="w-full rounded-2xl bg-slate-900 py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 flex items-center justify-center gap-2"
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
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-sm max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 border-b border-slate-100 pb-5">
        <span className="text-xs font-bold tracking-widest uppercase text-blue-600">
          Simulation Complete
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Test Results & Mastery Breakdown
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          {selectedSubjectName} · {sessionResults.length} Questions Attempted
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {mcqResults.length > 0 && (
          <div className="rounded-2xl bg-slate-50 p-4 text-center border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase">MCQ Score</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {mcqScore} / {mcqResults.length}
            </p>
            <p className="text-[11px] font-semibold text-blue-600">
              {Math.round((mcqScore / mcqResults.length) * 100)}% Accuracy
            </p>
          </div>
        )}

        {subjectiveCount > 0 && (
          <div className="rounded-2xl bg-slate-50 p-4 text-center border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase">Self-Reviewed</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {subjectiveCount}
            </p>
            <p className="text-[11px] font-semibold text-slate-600">
              Written Responses
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 p-4 text-center border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase">Scope Covered</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {selectedUnits.length}
          </p>
          <p className="text-[11px] font-semibold text-slate-600">
            {syllabusType === "lab" ? "Practicals" : "Units"}
          </p>
        </div>
      </div>

      {/* Question by Question Review */}
      <div className="space-y-4 pt-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Detailed Question Review
        </h3>

        <div className="space-y-3">
          {sessionResults.map((res, rIdx) => (
            <div
              key={rIdx}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  Q{res.questionNumber} · {res.unit}
                </span>

                {res.questionType === "mcq" ? (
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    res.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                    {res.isCorrect ? "Correct" : "Incorrect"}
                  </span>
                ) : (
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                    {res.questionType.replace("_", " ")}
                  </span>
                )}
              </div>

              <p className="font-bold text-xs sm:text-sm text-slate-900">
                {res.question}
              </p>

              {res.questionType === "mcq" && res.options && (
                <div className="text-xs space-y-1 text-slate-600">
                  <p>
                    <strong>Your Choice:</strong>{" "}
                    {res.selectedOption !== null ? res.options[res.selectedOption] : "None"}
                  </p>
                  <p className="text-emerald-700">
                    <strong>Correct Choice:</strong> {res.options[res.correctAnswer]}
                  </p>
                </div>
              )}

              {res.questionType !== "mcq" && (
                <div className="text-xs space-y-1.5 text-slate-700">
                  {res.userAnswer && (
                    <p>
                      <strong>Your Response:</strong> {res.userAnswer}
                    </p>
                  )}
                  {res.expectedAnswer && (
                    <p className="text-blue-900">
                      <strong>Expected Answer:</strong> {res.expectedAnswer}
                    </p>
                  )}
                </div>
              )}

              {res.explanation && (
                <p className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2">
                  <strong>Explanation:</strong> {res.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setStep("config")}
          className="flex-1 rounded-2xl bg-slate-900 py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
        >
          Try Another Test
        </button>

        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          Exit Exam Simulator
        </button>
      </div>
    </div>
  )
}

export default ExamQuiz
