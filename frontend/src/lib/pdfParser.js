import * as pdfjsLib from "pdfjs-dist"

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString()
}

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
  }).promise

  let fullText = ""

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => item.str)
      .join(" ")

    fullText += `${pageText}\n\n`
  }

  return fullText.trim()
}
