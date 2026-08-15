import os
import glob
from pypdf import PdfReader

syllabus_dir = r"c:\Users\baps\Desktop\xyz\academic-data\syllabus"
pdf_files = sorted(glob.glob(os.path.join(syllabus_dir, "*.pdf")))

output_txt = r"c:\Users\baps\Desktop\xyz\academic-data\extracted_syllabus_full.txt"

with open(output_txt, "w", encoding="utf-8") as out:
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        out.write("\n" + "=" * 80 + "\n")
        out.write(f"FILE: {filename}\n")
        out.write("=" * 80 + "\n")
        try:
            reader = PdfReader(pdf_path)
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                out.write(f"\n--- Page {i+1} ---\n")
                out.write(text + "\n")
        except Exception as e:
            out.write(f"Error reading {filename}: {e}\n")

print(f"Extracted all PDFs to {output_txt}")
