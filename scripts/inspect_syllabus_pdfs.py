import os
import glob
from pypdf import PdfReader

syllabus_dir = r"c:\Users\baps\Desktop\xyz\academic-data\syllabus"
pdf_files = glob.glob(os.path.join(syllabus_dir, "*.pdf"))

print(f"Found {len(pdf_files)} PDF files.")

for pdf_path in pdf_files:
    filename = os.path.basename(pdf_path)
    print("=" * 60)
    print(f"FILE: {filename}")
    try:
        reader = PdfReader(pdf_path)
        print(f"Total Pages: {len(reader.pages)}")
        full_text = ""
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            full_text += f"\n--- Page {i+1} ---\n" + text
        
        # print first 1000 characters
        print(full_text[:1200])
    except Exception as e:
        print(f"Error reading {filename}: {e}")
