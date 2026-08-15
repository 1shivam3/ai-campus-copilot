import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { extractPdfText } from "../lib/pdfParser"
import { analyzeStudyMaterial } from "../lib/api"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function StudyMaterial({ user }) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [subject, setSubject] = useState("")
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState("")
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [extractedText, setExtractedText] = useState("")

  useEffect(() => {
    if (user?.id) {
      loadFiles()
    }
  }, [user])

  async function loadFiles() {
    if (!user?.id) return

    try {
      const { data, error: listErr } = await supabase.storage
        .from("study-material")
        .list(user.id)

      if (listErr) throw listErr
      setFiles(data || [])
    } catch (err) {
      console.error("Storage list error:", err)
    }
  }

  async function uploadFile(e) {
    e.preventDefault()

    if (!selectedFile || !subject) {
      setError("Please select a PDF file and specify a subject name.")
      return
    }

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.endsWith(".pdf")
    ) {
      setError("Please upload standard PDF documents only.")
      return
    }

    if (!user?.id) return

    setUploading(true)
    setError("")
    setSuccessMsg("")

    try {
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const filePath = `${user.id}/${Date.now()}-${sanitizedName}`

      const { error: uploadError } = await supabase.storage
        .from("study-material")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        })

      if (uploadError) throw uploadError

      setSuccessMsg("Document uploaded successfully!")

      try {
        const text = await extractPdfText(selectedFile)
        if (text) {
          setExtractedText(text)
        }
      } catch (pdfErr) {
        console.warn("Text extraction note:", pdfErr)
      }

      setSelectedFile(null)
      await loadFiles()
    } catch (err) {
      console.error("Upload error:", err)
      setError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function analyzeMaterial() {
    if (!extractedText) {
      setError("Select and upload a readable PDF document first.")
      return
    }

    setAnalyzing(true)
    setAnalysis("")
    setError("")

    try {
      const result = await analyzeStudyMaterial(
        extractedText,
        subject || "Academic Course"
      )
      setAnalysis(result)
    } catch (err) {
      console.error(err)
      setError(
        "Could not analyze study material. The backend may be waking up — please try again in a moment."
      )
    } finally {
      setAnalyzing(false)
    }
  }

  async function openFile(fileName) {
    if (!user?.id) return

    try {
      const { data, error: urlErr } = await supabase.storage
        .from("study-material")
        .createSignedUrl(`${user.id}/${fileName}`, 3600)

      if (!urlErr && data?.signedUrl) {
        window.open(data.signedUrl, "_blank")
        return
      }
    } catch (e) {
      console.warn("Signed URL note:", e)
    }

    const { data: publicData } = supabase.storage
      .from("study-material")
      .getPublicUrl(`${user.id}/${fileName}`)

    if (publicData?.publicUrl) {
      window.open(publicData.publicUrl, "_blank")
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
            DOCUMENT KNOWLEDGE BASE
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Study Material & AI Summarizer
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Upload lecture slides, notes, or course documents to generate structured revision packs and practice questions.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={() => setError("")} />
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-semibold text-emerald-800">
            ✓ {successMsg}
          </div>
        )}

        {/* Upload Form */}
        <form
          onSubmit={uploadFile}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm"
        >
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Upload Course Material
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Subject Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Data Structures"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                PDF File *
              </label>
              <input
                type="file"
                required
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null)
                  setExtractedText("")
                  setSuccessMsg("")
                  setError("")
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
            >
              {uploading ? "Uploading PDF..." : "Upload Document"}
            </button>

            {extractedText && (
              <button
                type="button"
                onClick={analyzeMaterial}
                disabled={analyzing}
                className="rounded-xl border border-slate-900 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm active:scale-[0.98]"
              >
                {analyzing ? "Analyzing Document..." : "✨ Generate AI Study Pack"}
              </button>
            )}
          </div>

          {extractedText && (
            <div className="mt-4 rounded-xl bg-emerald-50/70 p-3.5 text-xs text-emerald-800 border border-emerald-200">
              <p className="font-semibold">
                ✓ Extracted {extractedText.length} characters of readable content.
              </p>
              <p className="mt-0.5 text-emerald-700 truncate font-mono text-[11px]">
                Preview: {extractedText.slice(0, 140)}...
              </p>
            </div>
          )}
        </form>

        {/* Uploaded Documents */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Uploaded Documents
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Private files saved to your account storage.
          </p>

          {files.length === 0 ? (
            <EmptyState
              icon="📁"
              title="No study documents uploaded yet"
              description="Upload your semester syllabus or lecture notes to unlock instant summaries."
            />
          ) : (
            <div className="space-y-2.5">
              {files.map((file) => (
                <div
                  key={file.id || file.name}
                  className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-100/70 transition"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      PDF Document
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openFile(file.name)}
                    className="self-start sm:self-center shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                  >
                    Open PDF ↗
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Analysis Result */}
        {analysis && (
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm leading-relaxed text-xs sm:text-sm text-slate-800 font-sans">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <span className="rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-[10px] font-bold">
                AI STUDY PACK
              </span>
              <h3 className="mt-2 text-lg font-bold text-slate-900">
                Generated from Study Document
              </h3>
            </div>
            {analysis}
          </div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterial
