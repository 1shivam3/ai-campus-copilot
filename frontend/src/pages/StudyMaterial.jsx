import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { extractPdfText } from "../lib/pdfParser"
import { analyzeStudyMaterial } from "../lib/api"

function StudyMaterial({ user }) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [subject, setSubject] = useState("")
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState("")
  const [error, setError] = useState("")
  const [extractedText, setExtractedText] = useState("")

  useEffect(() => {
    if (user?.id) {
      loadFiles()
    }
  }, [user])

  async function loadFiles() {
    if (!user?.id) return

    const { data, error } = await supabase.storage
      .from("study-material")
      .list(user.id)

    if (error) {
      console.error(error)
      setError("Could not load study material.")
      return
    }

    setFiles(data || [])
  }

  async function uploadFile(e) {
    e.preventDefault()

    if (!selectedFile || !subject) {
      setError("Select a file and enter a subject.")
      return
    }

    if (selectedFile.type !== "application/pdf") {
      setError("For now, upload PDF files only.")
      return
    }

    if (!user?.id) {
      setError("You must be logged in to upload material.")
      return
    }

    setUploading(true)
    setError("")

    try {
      const text = await extractPdfText(selectedFile)
      if (!text) {
        setError("Could not extract text from this PDF.")
        setUploading(false)
        return
      }

      setExtractedText(text)
      console.log("Extracted PDF text:", text)

      const filePath = `${user.id}/${Date.now()}-${selectedFile.name}`

      const { error: uploadError } = await supabase.storage
        .from("study-material")
        .upload(filePath, selectedFile)

      if (uploadError) {
        console.error(uploadError)
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(false)
        return
      }

      setSelectedFile(null)
      setUploading(false)

      await loadFiles()
    } catch (err) {
      console.error("PDF Extraction error:", err)
      setError("Failed to parse PDF contents.")
      setUploading(false)
    }
  }

  async function analyzeMaterial() {
    if (!extractedText) {
      setError("Upload a PDF first.")
      return
    }

    setAnalyzing(true)
    setAnalysis("")
    setError("")

    try {
      const result = await analyzeStudyMaterial(
        extractedText,
        subject
      )

      setAnalysis(result)
    } catch (error) {
      console.error(error)
      setError("Could not analyze the study material. Make sure the FastAPI backend is running.")
    }

    setAnalyzing(false)
  }

  async function openFile(fileName) {
    if (!user?.id) return

    const { data, error } = await supabase.storage
      .from("study-material")
      .createSignedUrl(`${user.id}/${fileName}`, 3600)

    if (error || !data?.signedUrl) {
      console.error(error)
      setError("Could not generate secure file URL.")
      return
    }

    window.open(data.signedUrl, "_blank")
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Study Material
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Your Knowledge Base
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Upload your syllabus, notes and study material securely.
          </p>
        </div>

        {/* Upload */}
        <form
          onSubmit={uploadFile}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold">
            Upload Material
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Subject e.g. Data Structures"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
            />

            <input
              type="file"
              accept=".pdf"
              onChange={(e) =>
                setSelectedFile(e.target.files?.[0] || null)
              }
              className="rounded-xl border bg-white px-4 py-3 text-sm"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {uploading ? "Extracting & Uploading..." : "Upload PDF"}
            </button>

            {extractedText && (
              <button
                type="button"
                onClick={analyzeMaterial}
                disabled={analyzing}
                className="rounded-xl border border-slate-900 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
              >
                {analyzing ? "Analyzing Document..." : "✨ Generate AI Study Pack"}
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {extractedText && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800 border border-emerald-200">
              <p className="font-semibold">Text extracted successfully ({extractedText.length} characters)!</p>
              <p className="mt-1 text-emerald-700 truncate">Preview: {extractedText.slice(0, 150)}...</p>
            </div>
          )}
        </form>

        {/* Files */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold">
              Uploaded Material
            </h2>

            <p className="text-sm text-slate-500">
              Your uploaded study documents (private to your account)
            </p>
          </div>

          {files.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium text-slate-700">
                No study material yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Upload your first PDF above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id || file.name}
                  className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between hover:border-slate-300 transition"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {file.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      PDF study material
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openFile(file.name)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition text-center"
                  >
                    Open PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Analysis Result */}
        {analysis && (
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border bg-white p-6 shadow-sm leading-relaxed text-sm text-slate-800 font-sans">
            <div className="mb-5 border-b pb-4">
              <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">
                AI STUDY PACK
              </span>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Generated from your study material
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Includes concept summary, key topics, quick revision points, and practice MCQs.
              </p>
            </div>

            {analysis}
          </div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterial
