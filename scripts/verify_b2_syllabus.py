import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('backend/.env')
supabase = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

sub_res = supabase.from_('academic_subjects').select('id, subject_code, subject_name').eq('semester', 3).eq('section', 'B2').execute()
print(f'Subjects for Section B2: {len(sub_res.data)}\n')

for sub in sub_res.data:
    top_res = supabase.from_('syllabus_topics').select('unit_number, topic_name, description').eq('subject_id', sub['id']).order('unit_number').execute()
    print(f"[{sub['subject_code']}] {sub['subject_name']} -> {len(top_res.data)} Units")
    for t in top_res.data:
        print(f"   • Unit {t['unit_number']}: {t['topic_name']}")
    print()
