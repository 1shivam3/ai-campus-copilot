import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
from supabase import create_client

sp = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def generate_terms(q):
    clean = q.strip().lower()
    words = [w.strip() for w in clean.split() if len(w.strip()) > 1]
    terms = set(words)
    terms.add(clean)
    for w in words:
        if w.endswith("s") and len(w) > 3:
            terms.add(w[:-1])
        elif len(w) > 2:
            terms.add(w + "s")
    # Acronyms & aliases
    if "dbms" in clean:
        terms.add("database")
        terms.add("management")
    if "dsa" in clean or "data structure" in clean or "data structures" in clean:
        terms.add("data structure")
        terms.add("algorithm")
        terms.add("structures")
        terms.add("structure")
    if "os" in words:
        terms.add("operating")
        terms.add("system")
    if "oop" in words or "java" in words:
        terms.add("object oriented")
        terms.add("java")
    if "discrete" in words:
        terms.add("discrete")
        terms.add("structures")
    if "bet" in words or "bet-i" in clean:
        terms.add("employability")
        terms.add("training")
        terms.add("bet-i")
    return [t for t in terms if len(t) > 1]

for query in ["Data Structures", "BCSE-501", "Trees", "DBMS", "BET-I", "Normalization", "randomxyz123"]:
    terms = generate_terms(query)
    # Search subjects
    sub_filter = ",".join([f"subject_name.ilike.%{t}%,subject_code.ilike.%{t}%" for t in terms[:6]])
    r_sub = sp.table("academic_subjects").select("id, subject_name, subject_code, semester").eq("semester", 3).or_(sub_filter).limit(5).execute()
    
    # Search topics
    top_filter = ",".join([f"topic_name.ilike.%{t}%,description.ilike.%{t}%" for t in terms[:6]])
    r_top = sp.table("syllabus_topics").select("id, topic_name, unit_number, academic_subjects!inner(subject_name, subject_code, semester)").eq("academic_subjects.semester", 3).or_(top_filter).limit(5).execute()
    
    print(f"\n[QUERY] \"{query}\" (terms: {terms})")
    print(f"  -> Subjects matched: {len(r_sub.data or [])}")
    for s in (r_sub.data or [])[:2]:
        print(f"     - {s['subject_code']}: {s['subject_name']}")
    print(f"  -> Topics matched: {len(r_top.data or [])}")
    for t in (r_top.data or [])[:2]:
        print(f"     - {t['topic_name']} ({t['academic_subjects']['subject_code']})")
