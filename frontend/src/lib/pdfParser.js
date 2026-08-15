import * as pdfjsLib from "pdfjs-dist"

if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "4.10.38"}/build/pdf.worker.min.mjs`
  } catch (e) {
    console.warn("Could not set PDF worker URL:", e)
  }
}

export async function extractPdfText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })

    const pdf = await loadingTask.promise
    let fullText = ""

    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 30); pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => item.str)
        .join(" ")

      fullText += `${pageText}\n\n`
    }

    return fullText.trim()
  } catch (err) {
    console.error("PDF Extraction internal error:", err)
    return ""
  }
}
