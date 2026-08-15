import os
from pypdf import PdfReader

syllabus_dir = r"c:\Users\baps\Desktop\xyz\academic-data\syllabus"

for filename in os.listdir(syllabus_dir):
    if filename.endswith(".pdf"):
        filepath = os.path.join(syllabus_dir, filename)
        reader = PdfReader(filepath)
        print(f"\n====================================\n{filename} (Pages: {len(reader.pages)})")
        for i, p in enumerate(reader.pages):
            txt = p.extract_text() or ""
            print(f"--- Page {i+1} (chars: {len(txt)}) ---")
            if len(txt) < 100:
                print(f"Content: {repr(txt)}")
                print(f"Images in page: {len(p.images)}")
            else:
                print(txt[:300] + "...")
