import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { extractPdfText } from "../lib/pdfParser"
import {
  matchStudyMaterialTopics,
  indexStudyMaterial,
  generateStudyPack,
  generateFlashcards,
  analyzeExamPaper,
} from "../lib/api"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

const MATERIAL_TYPES = [
  "Lecture Notes",
  "PDF Notes",
  "Question Bank",
  "Assignment",
  "Previous Year Paper",
  "Reference Material",
  "Other",
]

const DEFAULT_UNITS = [1, 2, 3, 4, 5]

function StudyMaterial({
  user,
  profile,
  onNavigateToSyllabus,
  onOpenReader,
  onOpenStudyPack,
  onOpenFlashcards,
  onOpenExamAnalysis,
}) {
  // Academic Context State
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [availableUnits, setAvailableUnits] = useState(DEFAULT_UNITS)
  const [unitsLoading, setUnitsLoading] = useState(false)

  // Document Library State
  const [materials, setMaterials] = useState([])
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [expandedCardIds, setExpandedCardIds] = useState(() => new Set())
  const [matchingCardId, setMatchingCardId] = useState(null)
  const [reindexingId, setReindexingId] = useState(null)
  const [generatingPackId, setGeneratingPackId] = useState(null)
  const [generatingCardDeckId, setGeneratingCardDeckId] = useState(null)
  const [analyzingPaperId, setAnalyzingPaperId] = useState(null)

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [selectedUnit, setSelectedUnit] = useState("")
  const [materialType, setMaterialType] = useState("Lecture Notes")

  // Operation State
  const [uploading, setUploading] = useState(false)
  const [processingStatus, setProcessingStatus] = useState("")
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [recentAnalysis, setRecentAnalysis] = useState(null)

  // ---------------------------------------------------------
  // 1. LOAD STUDENT ACADEMIC SUBJECTS
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadAcademicSubjects() {
      if (!user?.id) return

      setSubjectsLoading(true)
      try {
        let studentSemester = profile?.semester
        let studentSection = profile?.section

        // Fallback fetch profile if not provided in props
        if (!studentSemester) {
          const { data: profData } = await supabase
            .from("student_profiles")
            .select("semester, section")
            .eq("id", user.id)
            .maybeSingle()

          if (profData) {
            studentSemester = profData.semester
            studentSection = profData.section
          }
        }

        if (studentSemester) {
          // Attempt section-specific match first
          let { data: subData, error: subErr } = await supabase
            .from("academic_subjects")
            .select("id, subject_name, subject_code, semester, section")
            .eq("semester", studentSemester)
            .eq("section", studentSection || "A1")
            .order("subject_name")

          // Fallback to semester-wide subjects if section returned 0 rows
          if (subErr || !subData || subData.length === 0) {
            const { data: semData } = await supabase
              .from("academic_subjects")
              .select("id, subject_name, subject_code, semester, section")
              .eq("semester", studentSemester)
              .order("subject_name")

            // Deduplicate subjects by subject_name
            const seen = new Set()
            subData = (semData || []).filter((item) => {
              if (seen.has(item.subject_name)) return false
              seen.add(item.subject_name)
              return true
            })
          }

          setSubjects(subData || [])
          if (subData && subData.length > 0 && !selectedSubjectId) {
            setSelectedSubjectId(String(subData[0].id))
          }
        }
      } catch (err) {
        console.error("Subjects load error:", err)
      } finally {
        setSubjectsLoading(false)
      }
    }

    loadAcademicSubjects()
  }, [user, profile])

  // ---------------------------------------------------------
  // 2. DYNAMICALLY LOAD UNITS FOR SELECTED SUBJECT
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadUnitsForSubject() {
      if (!selectedSubjectId) {
        setAvailableUnits(DEFAULT_UNITS)
        return
      }

      setUnitsLoading(true)
      try {
        const { data: topicsData, error: topicsErr } = await supabase
          .from("syllabus_topics")
          .select("unit_number")
          .eq("subject_id", Number(selectedSubjectId))

        if (!topicsErr && topicsData && topicsData.length > 0) {
          const uniqueUnits = Array.from(
            new Set(topicsData.map((t) => t.unit_number).filter(Boolean))
          ).sort((a, b) => a - b)

          if (uniqueUnits.length > 0) {
            setAvailableUnits(uniqueUnits)
            setSelectedUnit((prev) => (uniqueUnits.includes(Number(prev)) ? prev : String(uniqueUnits[0])))
            return
          }
        }

        // Fallback default units if syllabus_topics has no unit breakdown
        setAvailableUnits(DEFAULT_UNITS)
        setSelectedUnit((prev) => (prev ? prev : "1"))
      } catch (err) {
        console.warn("Units load note:", err)
        setAvailableUnits(DEFAULT_UNITS)
      } finally {
        setUnitsLoading(false)
      }
    }

    loadUnitsForSubject()
  }, [selectedSubjectId])

  // ---------------------------------------------------------
  // 3. LOAD STUDY MATERIALS LIBRARY WITH MATCHED TOPICS
  // ---------------------------------------------------------
  useEffect(() => {
    if (user?.id) {
      loadMaterials()
    }
  }, [user])

  async function loadMaterials() {
    if (!user?.id) return

    setLoadingMaterials(true)
    try {
      // Query structured study_materials table with joined topics
      const { data, error: fetchErr } = await supabase
        .from("study_materials")
        .select(`
          id,
          user_id,
          title,
          subject_id,
          unit_number,
          material_type,
          original_file_name,
          storage_path,
          extracted_character_count,
          processing_status,
          created_at,
          academic_subjects (
            id,
            subject_name,
            subject_code
          ),
          study_packs (
            id,
            updated_at
          ),
          study_flashcards (
            id
          ),
          exam_paper_analysis (
            id,
            updated_at
          ),
          study_material_topics (
            id,
            syllabus_topic_id,
            match_score,
            syllabus_topics (
              id,
              topic_name,
              unit_number
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (fetchErr) {
        // Fallback query without study_material_topics join in case table not created yet
        const { data: baseData, error: baseErr } = await supabase
          .from("study_materials")
          .select(`
            id,
            user_id,
            title,
            subject_id,
            unit_number,
            material_type,
            original_file_name,
            storage_path,
            extracted_character_count,
            processing_status,
            created_at,
            academic_subjects (
              id,
              subject_name,
              subject_code
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (baseErr) {
          // Last fallback to storage list
          const { data: storageFiles } = await supabase.storage
            .from("study-material")
            .list(user.id)

          const fallbackItems = (storageFiles || []).map((file, idx) => ({
            id: idx + 1,
            title: file.name.replace(/^\d+[-_]/, "").replace(/\.pdf$/i, ""),
            subject_id: null,
            unit_number: null,
            material_type: "PDF Document",
            original_file_name: file.name,
            storage_path: `${user.id}/${file.name}`,
            extracted_character_count: 0,
            processing_status: "uploaded",
            created_at: file.created_at || new Date().toISOString(),
            academic_subjects: null,
            study_material_topics: [],
          }))

          setMaterials(fallbackItems)
        } else {
          setMaterials((baseData || []).map((item) => ({ ...item, study_material_topics: [] })))
        }
      } else {
        setMaterials(data || [])
      }
    } catch (err) {
      console.error("Materials load error:", err)
    } finally {
      setLoadingMaterials(false)
    }
  }

  // ---------------------------------------------------------
  // 4. HANDLE FILE SELECTION & AUTO-NAME
  // ---------------------------------------------------------
  function handleFileChange(e) {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setSuccessMsg("")
    setError("")
    setRecentAnalysis(null)

    if (file && !title.trim()) {
      const cleanTitle = file.name
        .replace(/\.pdf$/i, "")
        .replace(/[-_]+/g, " ")
        .trim()
      setTitle(cleanTitle)
    }
  }

  // ---------------------------------------------------------
  // 5. UPLOAD & AUTOMATED TOPIC MATCHING PIPELINE
  // ---------------------------------------------------------
  async function handleUpload(e) {
    e.preventDefault()

    if (!selectedFile) {
      setError("Please select a PDF document to upload.")
      return
    }

    if (!title.trim()) {
      setError("Please enter a document title.")
      return
    }

    if (!selectedSubjectId) {
      setError("Please select a subject.")
      return
    }

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please upload standard PDF documents only.")
      return
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError("File size exceeds 15MB limit. Please upload a smaller PDF.")
      return
    }

    if (!user?.id) {
      setError("Authentication error. Please re-login.")
      return
    }

    setUploading(true)
    setError("")
    setSuccessMsg("")
    setRecentAnalysis(null)
    setProcessingStatus("Uploading document to private storage...")

    try {
      // Step 1: Secure storage path
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`

      const { error: storageError } = await supabase.storage
        .from("study-material")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        })

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`)
      }

      // Step 2: Extract PDF Text
      setProcessingStatus("Extracting document text...")
      let extractedTextContent = ""
      try {
        extractedTextContent = await extractPdfText(selectedFile)
      } catch (pdfErr) {
        console.warn("Text extraction error:", pdfErr)
      }

      const characterCount = extractedTextContent ? extractedTextContent.length : 0
      const status = characterCount > 0 ? "processed" : "failed"

      // Step 3: Save Structured Metadata to study_materials table
      setProcessingStatus("Saving structured metadata...")
      const { data: insertData, error: dbError } = await supabase
        .from("study_materials")
        .insert({
          user_id: user.id,
          title: title.trim(),
          subject_id: selectedSubjectId ? Number(selectedSubjectId) : null,
          unit_number: selectedUnit ? Number(selectedUnit) : null,
          material_type: materialType || "Other",
          original_file_name: selectedFile.name,
          storage_path: storagePath,
          extracted_text: extractedTextContent || null,
          extracted_character_count: characterCount,
          processing_status: status,
        })
        .select()
        .single()

      if (dbError) {
        console.warn("Metadata insert note:", dbError)
      }

      const newMaterialId = insertData?.id

      // Step 4: Run Automated Syllabus Topic Matching if text was extracted
      let detectedMatches = []
      if (newMaterialId && characterCount > 0) {
        setProcessingStatus("Analyzing syllabus topic alignment with AI...")
        try {
          const matchResult = await matchStudyMaterialTopics(newMaterialId, user.id)
          if (matchResult && matchResult.matches) {
            detectedMatches = matchResult.matches
            setRecentAnalysis({
              materialId: newMaterialId,
              title: title.trim(),
              matches: detectedMatches,
            })
            // Expand newly created card
            setExpandedCardIds((prev) => new Set(prev).add(newMaterialId))
          }
        } catch (matchErr) {
          console.warn("Topic matching note:", matchErr)
        }

        // Step 4.5: Generate Semantic Vector Search Chunks & Embeddings (RAG)
        setProcessingStatus("Generating vector embeddings and semantic search index...")
        try {
          await indexStudyMaterial({ studyMaterialId: newMaterialId, userId: user.id })
        } catch (indexErr) {
          console.warn("RAG Indexing note:", indexErr)
        }
      }

      // Step 5: Inform student of result
      if (characterCount > 0) {
        if (detectedMatches.length > 0) {
          setSuccessMsg(
            `Processing complete · ${characterCount.toLocaleString()} characters extracted · ${detectedMatches.length} syllabus topics matched · Search index ready!`
          )
        } else {
          setSuccessMsg(
            `Processing complete · ${characterCount.toLocaleString()} characters extracted · Search index ready.`
          )
        }
      } else {
        setSuccessMsg(
          "Upload succeeded · Text extraction failed (document may be scanned or image-based). Semantic indexing was skipped."
        )
      }

      // Reset form fields
      setSelectedFile(null)
      setTitle("")
      await loadMaterials()
    } catch (err) {
      console.error("Upload process error:", err)
      setError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
      setProcessingStatus("")
    }
  }

  // ---------------------------------------------------------
  // 6. TRIGGER MANUAL TOPIC MATCHING
  // ---------------------------------------------------------
  async function handleMatchTopics(materialId) {
    if (!user?.id || !materialId) return

    setMatchingCardId(materialId)
    setError("")
    setSuccessMsg("")

    try {
      const matchResult = await matchStudyMaterialTopics(materialId, user.id)
      const count = matchResult.matches?.length || 0

      if (count > 0) {
        setSuccessMsg(`✓ Matched ${count} syllabus topics for document.`)
        setRecentAnalysis({
          materialId,
          title: materials.find((m) => m.id === materialId)?.title || "Study Document",
          matches: matchResult.matches,
        })
        setExpandedCardIds((prev) => new Set(prev).add(materialId))
      } else {
        setSuccessMsg("Topic matching finished. No syllabus topics met the 60% relevance threshold.")
      }

      await loadMaterials()
    } catch (err) {
      console.error("Match error:", err)
      setError(
        "Document processed successfully, but topic matching could not be completed. Try 'Match Topics' again."
      )
    } finally {
      setMatchingCardId(null)
    }
  }

  // ---------------------------------------------------------
  // 7. TRIGGER MANUAL RAG RE-INDEXING
  // ---------------------------------------------------------
  async function handleReindex(materialId) {
    if (!user?.id || !materialId) return

    setReindexingId(materialId)
    setError("")
    setSuccessMsg("")

    try {
      const res = await indexStudyMaterial({ studyMaterialId: materialId, userId: user.id })
      setSuccessMsg(`✓ Semantic search index created with ${res.chunks_created || 0} vector passages!`)
      await loadMaterials()
    } catch (err) {
      console.error("Reindex error:", err)
      setError("Semantic search indexing failed. You can retry anytime.")
    } finally {
      setReindexingId(null)
    }
  }

  // ---------------------------------------------------------
  // 8. TRIGGER STUDY PACK GENERATION & NAVIGATION
  // ---------------------------------------------------------
  async function handleCreateStudyPack(materialId) {
    if (!user?.id || !materialId) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("This feature requires an internet connection.")
      return
    }

    setGeneratingPackId(materialId)
    setError("")

    try {
      await generateStudyPack({
        studyMaterialId: materialId,
        userId: user.id,
        forceRegenerate: false,
      })

      if (onOpenStudyPack) {
        onOpenStudyPack(materialId)
      }
    } catch (err) {
      console.error("Create study pack error:", err)
      setError(err.message || "The study pack could not be generated right now. Please try again.")
    } finally {
      setGeneratingPackId(null)
    }
  }

  // ---------------------------------------------------------
  // 9. TRIGGER PREVIOUS-YEAR PAPER ANALYSIS
  // ---------------------------------------------------------
  async function handleAnalyzePaper(materialId) {
    if (!user?.id || !materialId) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("This feature requires an internet connection.")
      return
    }

    setAnalyzingPaperId(materialId)
    setError("")

    try {
      await analyzeExamPaper({
        studyMaterialId: materialId,
        userId: user.id,
        forceRegenerate: false,
      })

      if (onOpenExamAnalysis) {
        onOpenExamAnalysis(materialId)
      }
    } catch (err) {
      console.error("Paper analysis error:", err)
      setError("The question paper is safely uploaded, but analysis could not be completed.")
    } finally {
      setAnalyzingPaperId(null)
    }
  }

  // ---------------------------------------------------------
  // 10. OPEN DOCUMENT WITH SIGNED URL
  // ---------------------------------------------------------
  async function handleOpenFile(item) {
    if (!user?.id || !item?.storage_path) return

    try {
      const { data, error: urlErr } = await supabase.storage
        .from("study-material")
        .createSignedUrl(item.storage_path, 3600)

      if (!urlErr && data?.signedUrl) {
        window.open(data.signedUrl, "_blank")
        return
      }
    } catch (e) {
      console.warn("Signed URL error:", e)
    }

    const { data: pubData } = supabase.storage
      .from("study-material")
      .getPublicUrl(item.storage_path)

    if (pubData?.publicUrl) {
      window.open(pubData.publicUrl, "_blank")
    }
  }

  // ---------------------------------------------------------
  // 8. DELETE DOCUMENT
  // ---------------------------------------------------------
  async function handleDeleteFile(item) {
    if (!user?.id) return
    if (!window.confirm(`Delete "${item.title}"? This will also remove all topic matchings.`)) {
      return
    }

    try {
      if (item.id && typeof item.id === "number") {
        await supabase.from("study_materials").delete().eq("id", item.id)
      }

      if (item.storage_path) {
        await supabase.storage
          .from("study-material")
          .remove([item.storage_path])
      }

      setMaterials((curr) => curr.filter((m) => m.id !== item.id))
      setSuccessMsg(`"${item.title}" was deleted.`)
      if (recentAnalysis?.materialId === item.id) {
        setRecentAnalysis(null)
      }
    } catch (err) {
      console.error("Delete error:", err)
      setError("Could not delete study material.")
    }
  }

  function toggleCardExpand(cardId) {
    setExpandedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Page Header */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
            STRUCTURED ACADEMIC RESOURCES
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Study Material & Topic Indexer
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Upload course documents to automatically index them against your university syllabus topics with AI.
          </p>
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={() => setError("")} />
          </div>
        )}

        {successMsg && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-semibold text-emerald-800 shadow-xs">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* RECENTLY ANALYZED MATERIAL BANNER */}
        {recentAnalysis && recentAnalysis.matches && recentAnalysis.matches.length > 0 && (
          <section className="mb-8 overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-md transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                  ANALYZED MATERIAL
                </span>
                <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
                  Detected syllabus topics in “{recentAnalysis.title}”
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRecentAnalysis(null)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Dismiss ✕
              </button>
            </div>

            <div className="space-y-3">
              {recentAnalysis.matches.map((match) => {
                const score = Math.round(match.match_score)
                const barColor =
                  score >= 85
                    ? "bg-emerald-500"
                    : score >= 75
                      ? "bg-blue-600"
                      : "bg-indigo-500"

                return (
                  <div
                    key={match.syllabus_topic_id || match.topic_name}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {match.topic_name}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {score}%
                        </span>
                      </div>
                      {/* Clean Progress Bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToSyllabus && onNavigateToSyllabus()}
                      className="shrink-0 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition text-left sm:text-right"
                    >
                      View syllabus topic →
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Upload Form Card */}
        <form
          onSubmit={handleUpload}
          className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm transition"
        >
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Upload New Document
              </h2>
              <p className="text-xs text-slate-500">
                CoursePilot will automatically detect and match syllabus topics from the PDF content.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
              PDF Format
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* File Picker */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase mb-1.5">
                Select PDF Document *
              </label>
              <input
                type="file"
                required
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 outline-none transition focus:border-slate-900 focus:bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800 disabled:opacity-50"
              />
            </div>

            {/* Document Title */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase mb-1.5">
                Document Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Unit 1 Linked Lists & Stack Implementations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50"
              />
            </div>

            {/* Subject Selector */}
            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase mb-1.5">
                Academic Subject *
              </label>
              <select
                required
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={uploading || subjectsLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {subjectsLoading ? "Loading subjects..." : "Select Subject"}
                </option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.subject_name} {sub.subject_code ? `(${sub.subject_code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Selector */}
            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase mb-1.5">
                Syllabus Unit *
              </label>
              <select
                required
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                disabled={uploading || unitsLoading || !selectedSubjectId}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {!selectedSubjectId
                    ? "Select subject first"
                    : unitsLoading
                      ? "Loading units..."
                      : "Select Unit"}
                </option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    Unit {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Material Type Dropdown */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase mb-1.5">
                Material Type *
              </label>
              <select
                required
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                disabled={uploading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50"
              >
                {MATERIAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium">
              {processingStatus || "Files are private and accessible only by you."}
            </p>

            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                "Upload & Match Topics →"
              )}
            </button>
          </div>
        </form>

        {/* Study Material Library */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Study Material Library
              </h2>
              <p className="text-xs text-slate-500">
                {materials.length} {materials.length === 1 ? "document" : "documents"} indexed
              </p>
            </div>
          </div>

          {loadingMaterials ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-48 animate-pulse rounded-3xl border border-slate-200/80 bg-white p-5"
                />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-8">
              <EmptyState
                icon="📚"
                title="No study materials uploaded yet"
                description="Upload lecture notes, question banks, or assignment PDFs above to structure your semester resources and match syllabus topics."
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {materials.map((item) => {
                const subjectCode = item.academic_subjects?.subject_code
                const subjectLabel =
                  item.academic_subjects?.subject_name ||
                  (subjectCode ? `${subjectCode} Course Material` : "Academic Course Material")

                const formattedDate = item.created_at
                  ? new Date(item.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Recently"

                const matchedTopics = item.study_material_topics || []
                const matchedCount = matchedTopics.length
                const isExpanded = expandedCardIds.has(item.id)
                const isMatching = matchingCardId === item.id

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                          {subjectLabel} {subjectCode ? `(${subjectCode})` : ""}
                        </span>

                        {item.unit_number && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                            Unit {item.unit_number}
                          </span>
                        )}

                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {item.material_type}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2"
                        title={item.title}
                      >
                        {item.title}
                      </h3>

                      {/* File Details */}
                      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <p className="truncate font-mono text-[11px] text-slate-400">
                          📄 {item.original_file_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>📅 {formattedDate}</span>
                          <span>•</span>
                          <span
                            className={
                              item.processing_status === "processed"
                                ? "font-semibold text-emerald-600"
                                : item.processing_status === "embedding"
                                  ? "font-semibold text-blue-600 animate-pulse"
                                  : item.processing_status === "failed"
                                    ? "font-semibold text-amber-600"
                                    : "text-slate-500"
                            }
                          >
                            {item.processing_status === "processed"
                              ? `✓ Processed (${(item.extracted_character_count || 0).toLocaleString()} chars)`
                              : item.processing_status === "embedding"
                                ? "⏳ Indexing Chunks..."
                                : item.processing_status === "failed"
                                  ? "⚠️ Indexing Failed"
                                  : "📁 Uploaded"}
                          </span>
                        </div>
                      </div>

                      {/* Status & Topic Matches Badges */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {/* RAG Search Status Indicator */}
                        {item.processing_status === "processed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <span>✨</span>
                            <span>Search Ready</span>
                          </span>
                        ) : item.processing_status === "embedding" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 animate-pulse">
                            <span>⏳</span>
                            <span>Indexing...</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                            <span>⚠️</span>
                            <span>Search Index Failed</span>
                          </span>
                        )}

                        {/* Matched Topics Count Badge */}
                        {matchedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                            <span>🎯</span>
                            <span>
                              {matchedCount} syllabus {matchedCount === 1 ? "topic" : "topics"} matched
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            <span>📋</span>
                            <span>No syllabus topics matched</span>
                          </span>
                        )}
                      </div>

                      {/* EXPANDABLE TOPIC MATCHES LIST */}
                      {isExpanded && matchedCount > 0 && (
                        <div className="mt-3.5 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                            MATCHED SYLLABUS TOPICS
                          </p>
                          {matchedTopics.map((mt) => {
                            const topicName =
                              mt.syllabus_topics?.topic_name ||
                              mt.topic_name ||
                              "Syllabus Topic"
                            const score = Math.round(Number(mt.match_score))
                            const barColor =
                              score >= 85
                                ? "bg-emerald-500"
                                : score >= 75
                                  ? "bg-blue-600"
                                  : "bg-indigo-500"

                            return (
                              <div
                                key={mt.id || mt.syllabus_topic_id}
                                className="rounded-xl border border-white bg-white p-2.5 shadow-2xs"
                              >
                                <div className="flex items-center justify-between mb-1 text-xs">
                                  <span className="font-bold text-slate-800 truncate pr-2">
                                    {topicName}
                                  </span>
                                  <span className="font-mono font-bold text-slate-700">
                                    {score}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${barColor}`}
                                    style={{ width: `${Math.min(score, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenReader) {
                              onOpenReader(item.id)
                            } else {
                              handleOpenFile(item)
                            }
                          }}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs active:scale-[0.98]"
                        >
                          <span>Open</span>
                          <span className="text-[10px]">↗</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenReader && onOpenReader(item.id)}
                          className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-xs active:scale-[0.98]"
                        >
                          <span>Ask AI ✨</span>
                        </button>

                        {/* Previous Year Paper Analysis Button (if material is a question paper) */}
                        {item.material_type === "Previous Year Paper" && (
                          item.exam_paper_analysis && (Array.isArray(item.exam_paper_analysis) ? item.exam_paper_analysis.length > 0 : Boolean(item.exam_paper_analysis.id)) ? (
                            <button
                              type="button"
                              onClick={() => onOpenExamAnalysis && onOpenExamAnalysis(item.id)}
                              className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-xs active:scale-[0.98]"
                            >
                              <span>View Analysis 📊</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={analyzingPaperId === item.id || item.processing_status === "failed"}
                              onClick={() => handleAnalyzePaper(item.id)}
                              className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs active:scale-[0.98] disabled:opacity-50"
                            >
                              {analyzingPaperId === item.id ? (
                                <span className="flex items-center gap-1">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                                  Analyzing...
                                </span>
                              ) : (
                                <span>Analyze Paper 📊</span>
                              )}
                            </button>
                          )
                        )}

                        {/* Study Pack Button */}
                        {item.study_packs && (Array.isArray(item.study_packs) ? item.study_packs.length > 0 : Boolean(item.study_packs.id)) ? (
                          <button
                            type="button"
                            onClick={() => onOpenStudyPack && onOpenStudyPack(item.id)}
                            className="flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs active:scale-[0.98]"
                          >
                            <span>Study Pack 📦</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={generatingPackId === item.id || item.processing_status === "failed"}
                            onClick={() => handleCreateStudyPack(item.id)}
                            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-700 transition shadow-xs active:scale-[0.98] disabled:opacity-50"
                          >
                            {generatingPackId === item.id ? (
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
                                Pack...
                              </span>
                            ) : (
                              <span>Study Pack 📦</span>
                            )}
                          </button>
                        )}

                        {/* Flashcards Button */}
                        <button
                          type="button"
                          onClick={() => onOpenFlashcards && onOpenFlashcards(item.id)}
                          className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs active:scale-[0.98] ${
                            item.study_flashcards && (Array.isArray(item.study_flashcards) ? item.study_flashcards.length > 0 : Boolean(item.study_flashcards.id))
                              ? "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
                          }`}
                        >
                          <span>Flashcards 🎴</span>
                          {item.study_flashcards && (Array.isArray(item.study_flashcards) ? item.study_flashcards.length > 0 : Boolean(item.study_flashcards.id)) && (
                            <span className="ml-0.5 rounded-full bg-indigo-200/70 px-1.5 py-0.2 font-mono text-[10px] text-indigo-900 font-bold">
                              {Array.isArray(item.study_flashcards) ? item.study_flashcards.length : 1}
                            </span>
                          )}
                        </button>

                        {matchedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleCardExpand(item.id)}
                            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                          >
                            <span>{isExpanded ? "Hide Topics ▴" : "View Topics ▾"}</span>
                          </button>
                        )}

                        {item.processing_status === "failed" && (
                          <button
                            type="button"
                            disabled={reindexingId === item.id}
                            onClick={() => handleReindex(item.id)}
                            className="flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-xs disabled:opacity-50"
                          >
                            {reindexingId === item.id ? (
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-800 border-t-transparent" />
                                Indexing...
                              </span>
                            ) : (
                              <span>Retry Indexing 🔄</span>
                            )}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteFile(item)}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                        title="Delete material"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudyMaterial
